# Import thư viện ngoài 
from flask import Flask, jsonify, request
from flask_cors import CORS
from datetime import datetime
import os
from werkzeug.utils import secure_filename
from flask_limiter import Limiter
from flask_jwt_extended import (
    JWTManager, 
    create_access_token, 
    create_refresh_token,
    jwt_required, 
    get_jwt_identity,
    verify_jwt_in_request
)
from dotenv import load_dotenv


# Import trong project
from models import (
    db,
    Attraction,
    Festival,
    CulturalSpot,
    Review,
    Tag,
    Blog,
    User,
    TokenBlacklist,
)
from init_db import import_demo_data
from service.search_service import precompute_nearby_attractions, smart_recommendation_service, get_nearby_attr
from service.attraction_service import (
    get_attraction_detail_service,
    create_review,
    update_review,
    delete_review,
    set_favorite,
)
from service.tour_service import generate_smart_tour
from service.save_tour_service import (
    get_saved_tours_service,    
    save_tour_service,
    unsave_tour_service
)
from service.user_service import (
    get_user_favorites_service,
    get_user_reviews_service
)
from user.email_utils import init_mail
from user.auth_service import (
    signup_service, 
    login_service,
    verify_email_service, 
    resend_verification_service,
    forgot_password_service,  
    reset_password_service
)
from cloudinary_utils import upload_image_to_cloud
from agent_utils import chat_with_tour_guide, generate_caption

# Load environment variables
load_dotenv()

# ===========================================================================
# ===                                                                     ===
# ===                      Khởi tạo ứng dụng app                          ===
# ===                                                                     ===
# ===========================================================================
def create_app():
    app = Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///demo.db'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['JSON_AS_ASCII'] = False
    app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY', 'fixed-secret-key-for-testing')
    app.config['JWT_ACCESS_TOKEN_EXPIRES'] = 3600  # 1 hour
    app.config['JWT_REFRESH_TOKEN_EXPIRES'] = 172800  # 2 days
    app.config['JWT_BLOCKLIST_ENABLED'] = True
    app.config['JWT_BLOCKLIST_TOKEN_CHECKS'] = ['access', 'refresh']
    # app.config['UPLOAD_FOLDER'] = 'static/uploads/blogs'
    app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size
    
    # Enable CORS for React frontend
    CORS(app, resources={
        r"/api/*": {
            "origins": ["http://localhost:3000", "http://127.0.0.1:3000"],
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
            "allow_headers": ["Content-Type", "Authorization"]
        }
    })

    db.init_app(app=app)
    init_mail(app)
    jwt_manager = JWTManager(app)

    with app.app_context():
        db.create_all()
        if Attraction.query.count() == 0:
            import_demo_data()
            precompute_nearby_attractions()

    return app, jwt_manager

app, jwt = create_app()
limiter = Limiter(app)

# # === THÊM ĐOẠN NÀY ĐỂ DEBUG ===
# @app.before_request
# def log_request_info():
#     if request.path.startswith('/api/'):
#         print(f"\n=== DEBUG REQUEST: {request.method} {request.path} ===")
#         # In ra header Authorization để xem có nhận được không
#         auth_header = request.headers.get('Authorization')
#         print(f"Authorization Header Received: {auth_header}")
#         if auth_header:
#             print(f"Token part: {auth_header.split(' ')[1] if len(auth_header.split(' ')) > 1 else 'Format sai'}")
# ==============================

@jwt.expired_token_loader
def expired_token_callback(jwt_header, jwt_payload):
    return jsonify({"success": False, "error": "Token đã hết hạn"}), 401

@jwt.invalid_token_loader
def invalid_token_callback(error):
    return jsonify({"success": False, "error": "Token không hợp lệ"}), 401

@jwt.unauthorized_loader
def unauthorized_callback(error):
    return jsonify({"success": False, "error": "Thiếu authentication token"}), 401

@jwt.token_in_blocklist_loader
def check_if_token_in_blocklist(jwt_header, jwt_payload):
    """Check if token is in blocklist"""
    #jti = decrypted_token['jti']
    #eturn TokenBlacklist.query.filter_by(jti=jti).first() is not None
    return False

# Cấu hình upload
# UPLOAD_FOLDER = 'static/uploads/blogs'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# ===========================================================================
# ===                                                                     ===
# ===                                Service                              ===
# ===                                                                     ===
# ===========================================================================
"""
=== Chức năng search ===
Frontend cần nhớ:
- Query param `searchTerm` + `typeList` (multi) vẫn như cũ.
- Nếu muốn backend ưu tiên các điểm đã Favorite của user nào đó,
  truyền thêm `userId=<int>` trong query string. Nếu bỏ trống, backend
  sẽ không tính tới danh sách Favorite.
"""
@app.route('/api/search', methods=["GET"])
def search():
    # Xử lý thông tin đầu vào với JWT optional (sử dụng nếu hợp lệ, bỏ qua nếu không hợp lệ)
    user_id = None

    # First try to get user_id from query parameter
    user_id_param = request.args.get("userId")
    if user_id_param:
        try:
            user_id = int(user_id_param)
            if user_id <= 0:
                raise ValueError
        except ValueError:
            return jsonify({"success": False, "error": "userId không hợp lệ"}), 400

    # Then try JWT if available (but don't override query parameter)
    if not user_id:
        try:
            verify_jwt_in_request(optional=True)
            jwt_user_id = get_jwt_identity()

            # If JWT identity is None, try manual extraction (workaround for JWT payload issue)
            if jwt_user_id is None:
                from flask_jwt_extended import get_jwt
                jwt_payload = get_jwt()

                # Try to extract from payload manually
                if jwt_payload.get('identity'):
                    jwt_user_id = jwt_payload['identity']
                elif jwt_payload.get('sub'):
                    jwt_user_id = jwt_payload['sub']

                if isinstance(jwt_user_id, str) and jwt_user_id.isdigit():
                    jwt_user_id = int(jwt_user_id)

            if jwt_user_id:
                user_id = jwt_user_id

        except Exception as e:
            pass

    type_list_str = request.args.get("typeList", "")
    if type_list_str:
        types_list = [t.strip() for t in type_list_str.split(',') if t.strip()]
    else:
        types_list = []
    search_term = request.args.get("searchTerm", "").strip()
    if not user_id:
        user_id_param = request.args.get("userId")
        if user_id_param:
            try:
                user_id = int(user_id_param)
                if user_id <= 0:
                    raise ValueError
            except ValueError:
                return jsonify({"success": False, "error": "userId không hợp lệ"}), 400

    # NOTE userId (nếu có) dùng để ưu tiên các địa điểm đã Favorite
    # Logic chính
    try:
        data = smart_recommendation_service(types_list=types_list, search_term=search_term, user_id=user_id)
        return jsonify({"success": True, "data": data}), 200
    except ValueError as e:
        return jsonify({"success": False, "error": str(e)}), 400
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500



@app.route('/api/nearby/<int:attractionId>', methods=['GET'])
def get_attraction_nearby(attractionId):
    try:
        nearby = get_nearby_attr(attractionId)
        return jsonify({"success": True, **nearby}), 200
    except LookupError as e:
        return jsonify({"success": False, "error": str(e)}), 404
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# NOTE cho frontend:
#   • GET    /api/attraction/<id>?userId=<int optional>
#       - Trả về detail + reviews + trạng thái favorite (nếu có userId).
#   • POST   /api/attraction/<id>
#       - Body theo create_review: { userId, content, ratingScore }.
#       - Response trả lại full detail để FE refresh ngay.
#   • PUT    /api/attraction/<id>
#       - Body: { userId, reviewId, content, ratingScore }.
#   • DELETE /api/attraction/<id>
#       - Body: { userId, reviewId }.
#   • PATCH  /api/attraction/<id>
#       - Toggle favorite. Body: { "userId": <int>, "isFavorite": true/false }.
#       - Response trả về detail + block `favorite` để đồng bộ UI.
# Ghi nhớ: mọi response đều có dạng {"success": bool, "data": {...}} (riêng PATCH có thêm "favorite").
@app.route('/api/attraction/<int:attraction_id>', methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
def get_attraction_detail(attraction_id):
    # Xử lý JWT optional
    user_id = None
    try:
        user_id = get_jwt_identity()
    except:
        pass

    if request.method == "GET":
        """
        Lấy thông tin chi tiết của attraction
        """
        if not user_id:
            user_id_param = request.args.get("userId")
            if user_id_param:
                try:
                    user_id = int(user_id_param)
                    if user_id <= 0:
                        raise ValueError
                except ValueError:
                    return jsonify({"success": False, "error": "userId không hợp lệ"}), 400

        try:
            data = get_attraction_detail_service(attraction_id, user_id=user_id)
            return jsonify({"success": True, "data": data}), 200

        except Exception as e:
            return jsonify({"success": False, "error": str(e)}), 500
    
    elif request.method == "POST":
        """
        Thêm  review mới
        """
        try:
            review_data = request.get_json(silent=True)
            create_review(attraction_id, review_data)
            if not user_id:
                user_id = review_data.get("userId")
                if not user_id:
                    return jsonify({"success": False, "error": "userId là bắt buộc"}), 400
            data = get_attraction_detail_service(attraction_id, user_id=user_id)
            return jsonify({"success": True, "data": data}), 201
        except ValueError as e:
            return jsonify({"success": False, "error": str(e)}), 400
        except PermissionError as e:
            return jsonify({"success": False, "error": str(e)}), 403
        except LookupError as e:
            return jsonify({"success": False, "error": str(e)}), 404
        except Exception as e:
            return jsonify({"success": False, "error": str(e)}), 500

    elif request.method == "PUT":
        """
        Sửa đổi review (yêu cầu reviewId và userId khớp với chủ review)
        """
        try:
            review_data = request.get_json(silent=True)
            update_review(attraction_id, review_data)
            if not user_id:
                user_id = review_data.get("userId") 
            data = get_attraction_detail_service(attraction_id, user_id=user_id)
            return jsonify({"success": True, "data": data}), 200
        except ValueError as e:
            return jsonify({"success": False, "error": str(e)}), 400
        except PermissionError as e:
            return jsonify({"success": False, "error": str(e)}), 403
        except LookupError as e:
            return jsonify({"success": False, "error": str(e)}), 404
        except Exception as e:
            return jsonify({"success": False, "error": str(e)}), 500

    elif request.method == "DELETE":
        """
        Xóa review (yêu cầu reviewId và userId khớp với chủ review)
        """
        try:
            review_data = request.get_json(silent=True)
            delete_review(attraction_id, review_data)
            if not user_id:
                user_id = review_data.get("userId") 
            data = get_attraction_detail_service(attraction_id, user_id=user_id)
            return jsonify({"success": True, "data": data}), 200
        except ValueError as e:
            return jsonify({"success": False, "error": str(e)}), 400
        except PermissionError as e:
            return jsonify({"success": False, "error": str(e)}), 403
        except LookupError as e:
            return jsonify({"success": False, "error": str(e)}), 404
        except Exception as e:
            return jsonify({"success": False, "error": str(e)}), 500

    elif request.method == "PATCH":
        """
        Toggle trạng thái yêu thích:
        Body JSON tối thiểu: { "userId": <int>, "isFavorite": true/false }
        """
        try:
            favorite_data = request.get_json(silent=True)
            favorite_state = set_favorite(attraction_id, favorite_data)
            data = get_attraction_detail_service(
                attraction_id,
                user_id=favorite_state["userId"]
            )
            return jsonify({
                "success": True,
                "data": data,
                "favorite": favorite_state
            }), 200
        except ValueError as e:
            return jsonify({"success": False, "error": str(e)}), 400
        except Exception as e:
            return jsonify({"success": False, "error": str(e)}), 500
    


# === Chức năng tạo tour ===
# NOTE:
# Thông tin cần: attractionIds, startLat, startLon, startTime, endTime
@app.route('/api/quick-tour-creator', methods=['GET'])
def creator():
    """
    API tạo lịch trình thông minh (Method: GET).
    Frontend gửi request dạng Query Params:
    /api/quick-tour-creator?attractionIds=1&attractionIds=5&startLat=10.77&startLon=106.70&startTime=25/12/2025%2008:00
    """
    try:
        # 1. Lấy danh sách ID (List)
        # Frontend cần gửi dạng: ?attractionIds=1&attractionIds=2...
        attraction_ids_raw = request.args.getlist('attractionIds')
        
        # Xử lý trường hợp Frontend gửi dạng mảng có ngoặc vuông (attractionIds[]=1) thường gặp ở Axios/jQuery
        if not attraction_ids_raw:
            attraction_ids_raw = request.args.getlist('attractionIds[]')

        # Convert sang int và lọc bỏ giá trị rác
        attraction_ids = []
        for x in attraction_ids_raw:
            if x.isdigit():
                attraction_ids.append(int(x))

        # 2. Lấy các tham số đơn
        start_lat = request.args.get('startLat')
        start_lon = request.args.get('startLon')
        start_time_str = request.args.get('startTime') # Format: dd/mm/yyyy HH:MM
        end_time_str = request.args.get('endTime')     # Format: dd/mm/yyyy HH:MM (MỚI)

        # 3. Validation
        if not attraction_ids:
             return jsonify({"success": False, "error": "Chưa chọn điểm đến nào (param: attractionIds)"}), 400
        if not start_lat or not start_lon:
             return jsonify({"success": False, "error": "Thiếu tọa độ (param: startLat, startLon)"}), 400
        if not start_time_str:
            return jsonify({"success": False, "error": "Thiếu thời gian (param: startTime)"}), 400
        if not end_time_str:
            return jsonify({"success": False, "error": "Thiếu thời gian kết thúc (param: endTime)"}), 400

        # Parse endTime
        try:
            start_time = datetime.strptime(start_time_str, "%d/%m/%Y %H:%M")
            end_time = datetime.strptime(end_time_str, "%d/%m/%Y %H:%M")
        except ValueError:
            return jsonify({"success": False, "error": "Format time không hợp lệ"}), 400

        if end_time <= start_time:
            return jsonify({"success": False, "error": "Thời gian kết thúc phải sau thời gian bắt đầu"}), 400

        # Validate và parse tọa độ
        try:
            start_lat_float = float(start_lat)
            start_lon_float = float(start_lon)
            # Kiểm tra phạm vi hợp lệ cho tọa độ (lat: -90 đến 90, lon: -180 đến 180)
            if not (-90 <= start_lat_float <= 90):
                return jsonify({"success": False, "error": "Vĩ độ không hợp lệ (phải từ -90 đến 90)"}), 400
            if not (-180 <= start_lon_float <= 180):
                return jsonify({"success": False, "error": "Kinh độ không hợp lệ (phải từ -180 đến 180)"}), 400
        except ValueError:
            return jsonify({"success": False, "error": "Tọa độ không hợp lệ (startLat, startLon phải là số)"}), 400

        # 4. Gọi Service (Logic giữ nguyên)
        result = generate_smart_tour(
            attraction_ids, 
            start_lat_float, 
            start_lon_float, 
            start_time_str,
            end_time_str
        )

        return jsonify({
            "success": True, 
            "data": result
        }), 200

    except Exception as e:
        print(f"Error creating tour: {e}")
        return jsonify({"success": False, "error": str(e)}), 500



@app.route('/api/save-tour', methods=['POST', 'PATCH'])
def save_tour():
    """
    POST: Lưu tour mới
    PATCH: Hủy lưu tour (unsave)
    """
    try:
        # Lấy user_id từ JWT token (nếu có) hoặc từ request
        user_id = None
        try:
            user_id = get_jwt_identity()
        except:
            pass

        if request.method == 'POST':
            # === LƯU TOUR MỚI ===
            data = request.get_json()
            
            if not data:
                return jsonify({"success": False, "error": "Không có dữ liệu được gửi"}), 400
            
            if not user_id:
                user_id = data.get('userId')
            tour_name = data.get('tourName', '').strip()
            attraction_ids = data.get('attractionIds', [])
            
            try:
                tour_data = save_tour_service(user_id, tour_name, attraction_ids)
                return jsonify({
                    "success": True,
                    "message": f"Đã lưu tour '{tour_name}' thành công",
                    "tour": tour_data
                }), 201
            except ValueError as e:
                return jsonify({"success": False, "error": str(e)}), 400
            except LookupError as e:
                return jsonify({"success": False, "error": str(e)}), 404
        
        elif request.method == 'PATCH':
            # === HỦY LƯU TOUR ===
            data = request.get_json()
            
            if not data:
                return jsonify({"success": False, "error": "Không có dữ liệu được gửi"}), 400
            
            if not user_id:
                user_id = data.get('userId')
            tour_id = data.get('tourId')
            
            try:
                tour_name = unsave_tour_service(user_id, tour_id)
                return jsonify({
                    "success": True,
                    "message": f"Đã hủy lưu tour '{tour_name}' thành công"
                }), 200
            except ValueError as e:
                return jsonify({"success": False, "error": str(e)}), 400
            except LookupError as e:
                return jsonify({"success": False, "error": str(e)}), 404
    
    except Exception as e:
        db.session.rollback()
        print(f"Error in save_tour: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

# ===========================================================================
# ===                                                                     ===
# ===                                 USER                                ===
# ===                                                                     ===
# ===========================================================================

# Thêm route get_saved_tours
@app.route('/api/saved-tours', methods=['GET'])
def get_saved_tours():
    """
    Lấy danh sách tours đã lưu của user
    Query param: userId=<int>
    """
    try:
        user_id_param = request.args.get('userId')
        if not user_id_param:
            return jsonify({"success": False, "error": "userId là bắt buộc"}), 400
        
        try:
            user_id = int(user_id_param)
        except ValueError:
            return jsonify({"success": False, "error": "userId không hợp lệ"}), 400
        
        try:
            tours_data = get_saved_tours_service(user_id)
            return jsonify({
                "success": True,
                "data": tours_data,
                "total": len(tours_data)
            }), 200
        except ValueError as e:
            return jsonify({"success": False, "error": str(e)}), 400
        except LookupError as e:
            return jsonify({"success": False, "error": str(e)}), 404
    
    except Exception as e:
        print(f"Error in get_saved_tours: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/user/upload-avatar', methods=['POST'])
@jwt_required()
def upload_avatar():
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        if 'avatar' not in request.files:
            return jsonify({"success": False, "error": "Không có file ảnh"}), 400
            
        file = request.files['avatar']
        
        if file.filename == '':
            return jsonify({"success": False, "error": "Chưa chọn file"}), 400

        if not allowed_file(file.filename):
            return jsonify({"success": False, "error": "Định dạng file không hợp lệ"}), 400

        # GỌI HÀM UPLOAD LÊN CLOUD
        # Folder trên cloud sẽ là: smart_tourism/avatars
        image_url = upload_image_to_cloud(file, folder="smart_tourism/avatars")
        
        if image_url:
            # Lưu link tuyệt đối (https://res.cloudinary.com/...) vào DB
            user.avatar_url = image_url
            db.session.commit()
            
            return jsonify({
                "success": True, 
                "message": "Cập nhật ảnh đại diện thành công",
                "avatarUrl": image_url
            }), 200
        else:
            return jsonify({"success": False, "error": "Lỗi khi upload ảnh"}), 500

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
# ===========================================================================
# ===                                                                     ===
# ===                                 Auth                                ===
# ===                                                                     ===
# ===========================================================================
# NOTE: sửa đổi lại logic cho 2  luồng 
# Đăng ký:
    # Người dùng nhập: username (duy nhất), email (duy nhất), password.
    # Hệ thống tạo user -> Gửi mã về email.
# Đăng nhhập:
    # Người dùng nhập: username + password.
    # Hệ thống kiểm tra:
    # Tìm user theo username.
    # Khớp password.
    # Kiểm tra email_verified (nếu chưa xác thực -> chặn và báo lỗi).
    # Thành công -> Trả về JWT Token.
@app.route('/api/auth/signup', methods=['POST'])
def signup():
    """Đăng ký tài khoản mới"""
    try:
        data = request.get_json()
        result = signup_service(data) # Gọi service
        return jsonify({"success": True, "data": result}), 201
    except ValueError as e:
        return jsonify({"success": False, "error": str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "error": "Lỗi hệ thống: " + str(e)}), 500

# ================================= NEW ============================================
@app.route('/api/auth/verify-email', methods=['POST'])
def verify_email():
    try:
        data = request.get_json()
        email = data.get('email')
        code = data.get('code')
        
        result = verify_email_service(email, code) # Gọi service
        return jsonify({"success": True, "data": result}), 200
    except ValueError as e:
        return jsonify({"success": False, "error": str(e)}), 400
    except LookupError as e:
        return jsonify({"success": False, "error": str(e)}), 404
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/auth/resend-code', methods=['POST'])
def resend_code():
    try:
        data = request.get_json()
        email = data.get('email')
        
        result = resend_verification_service(email) # Gọi service
        return jsonify({"success": True, "data": result}), 200
    except (ValueError, LookupError) as e:
        return jsonify({"success": False, "error": str(e)}), 400
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

# ================================= NEW ============================================


@app.route('/api/auth/login', methods=['POST'])
@limiter.limit("5 per minute")
def login():
    """Đăng nhập"""
    try:
        # NOTE: sửa lại logic đăng nhập dùng username + password cho hợp lý 
        # email chỉ dùng để gửi mã xác nhận khi đăng ký / quên mật khẩu
        data = request.get_json()
        result = login_service(data)
        
        # Nếu có lỗi trong result (ví dụ chưa verify email)
        if "error" in result:
            return jsonify({"success": False, **result}), 403
            
        return jsonify({"success": True, **result}), 200
        
    except ValueError as e:
        # Sai user/pass
        return jsonify({"success": False, "error": str(e)}), 401
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/auth/user/<int:user_id>', methods=['GET'])
def get_user(user_id):
    """Lấy thông tin người dùng theo ID"""
    try:
        user = User.query.get(user_id)
        if not user:
            return jsonify({"success": False, "error": "Không tìm thấy người dùng"}), 404
        
        return jsonify({
            "success": True,
            "user": user.to_json()
        }), 200
        
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/users', methods=['GET'])
def get_users():
    """Lấy danh sách tất cả người dùng"""
    try:
        users = User.query.order_by(User.user_id.asc()).all()
        return jsonify({
            "success": True,
            "data": [user.to_json() for user in users]
        }), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/user/<int:user_id>/favorites', methods=['GET'])
def get_user_favorites(user_id):
    """Lấy danh sách địa điểm yêu thích của user"""
    try:
        favorites = get_user_favorites_service(user_id)
        return jsonify({
            "success": True,
            "data": favorites,
            "total": len(favorites)
        }), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/user/<int:user_id>/reviews', methods=['GET'])
def get_user_reviews(user_id):
    """Lấy lịch sử đánh giá của user"""
    try:
        reviews = get_user_reviews_service(user_id)
        return jsonify({
            "success": True,
            "data": reviews,
            "total": len(reviews)
        }), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/auth/forgot-password', methods=['POST'])
@limiter.limit("3 per minute")
def forgot_password():
    try:
        data = request.get_json()
        email = data.get('email')
        
        result = forgot_password_service(email)
        return jsonify({"success": True, **result}), 200
        
    except ValueError as e:
        return jsonify({"success": False, "error": str(e)}), 400
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/auth/reset-password', methods=['POST'])
def reset_password():
    try:
        data = request.get_json()
        result = reset_password_service(data)
        return jsonify({"success": True, **result}), 200
        
    except ValueError as e:
        return jsonify({"success": False, "error": str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/auth/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh_token():
    """Refresh access token"""
    try:
        current_user_id = get_jwt_identity()
        new_access_token = create_access_token(identity=str(current_user_id))

        return jsonify({
            "success": True,
            "access_token": new_access_token,
            "token_type": "Bearer"
        }), 200

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/auth/logout', methods=['POST'])
@jwt_required()
def logout():
    """Logout user by blacklisting both access and refresh tokens"""
    try:
        current_user_id = get_jwt_identity()

        # Get JTI (JWT ID) from current access token
        from flask_jwt_extended import get_raw_jwt
        raw_jwt = get_raw_jwt()
        access_jti = raw_jwt.get('jti')

        if not access_jti:
            return jsonify({"success": False, "error": "Không thể xác định token"}), 400

        # For refresh token, we need to check if it's provided in the request body
        refresh_token = request.json.get('refresh_token') if request.json else None

        # Blacklist access token
        access_blacklist = TokenBlacklist(
            jti=access_jti,
            token_type='access',
            user_id=current_user_id
        )
        db.session.add(access_blacklist)

        # Blacklist refresh token if provided
        if refresh_token:
            try:
                # Decode refresh token to get its JTI
                from flask_jwt_extended import decode_token
                refresh_decoded = decode_token(refresh_token, allow_expired=False)
                refresh_jti = refresh_decoded.get('jti')

                if refresh_jti:
                    refresh_blacklist = TokenBlacklist(
                        jti=refresh_jti,
                        token_type='refresh',
                        user_id=current_user_id
                    )
                    db.session.add(refresh_blacklist)
            except Exception as e:
                # If refresh token is invalid, just continue with access token
                print(f"Warning: Could not decode refresh token: {e}")
                pass

        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Đăng xuất thành công"
        }), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error in logout: {e}")
        return jsonify({"success": False, "error": "Lỗi hệ thống khi đăng xuất"}), 500
# ===========================================================================
# ===                                                                     ===
# ===                                 Blogs                               ===
# ===                                                                     ===
# ===========================================================================
@app.route('/api/blogs', methods=['GET'])
def get_blogs():
    """Lấy danh sách tất cả blogs"""
    try:
        blogs = Blog.query.order_by(Blog.created_at.desc()).all()
        return jsonify({
            "success": True,
            "data": [blog.to_json() for blog in blogs]
        }), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/blogs/<int:blog_id>', methods=['GET'])
def get_blog(blog_id):
    """Lấy thông tin chi tiết một blog"""
    try:
        # SQLAlchemy 2.0 compatible get
        blog = db.session.get(Blog, blog_id)
        if not blog:
            return jsonify({"success": False, "error": "Không tìm thấy blog"}), 404
        
        return jsonify({
            "success": True,
            "data": blog.to_json()
        }), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
    
@app.route('/api/blogs/<int:blog_id>', methods=['DELETE'])
@jwt_required()
def delete_blog(blog_id):
    try:
        user_id = int(get_jwt_identity())
        blog = db.session.get(Blog, blog_id)

        if not blog:
            return jsonify({"success": False, "error": "Không tìm thấy blog"}), 404
        
        if blog.user_id != user_id:
            return jsonify({"success": False, "error": "Bạn không có quyền xóa bài này"}), 403
        
        db.session.delete(blog)
        db.session.commit()

        return jsonify({"success": True, "message": "Đã xóa bài viết"}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/blogs', methods=['POST'])
@jwt_required()
def create_blog():
    """Tạo blog mới với hình ảnh"""
    try:
        # # Kiểm tra thư mục upload
        # if not os.path.exists(UPLOAD_FOLDER):
        #     os.makedirs(UPLOAD_FOLDER)
        
        title = request.form.get('title', '').strip()
        content = request.form.get('content', '').strip()
        user_id = get_jwt_identity()
        
        if not title or not content or not user_id:
            return jsonify({"success": False, "error": "Thiếu thông tin bắt buộc"}), 400
        
        # # Xử lý upload hình ảnh
        # image_url = None
        # if 'image' in request.files:
        #     file = request.files['image']
        #     if file and file.filename and allowed_file(file.filename):
        #         filename = secure_filename(file.filename)
        #         # Thêm timestamp để tránh trùng tên
        #         from datetime import datetime
        #         timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        #         filename = f"{timestamp}_{filename}"
        #         filepath = os.path.join(UPLOAD_FOLDER, filename)
        #         file.save(filepath)
        #         image_url = f"/static/uploads/blogs/{filename}"

        # Xử lý ảnh Blog
        image_url = None
        print("kiem tra nhan anh")
        image_urls = []
        if 'images' in request.files:
            files = request.files.getlist('images')  # Lấy list files
            print(f"nhan {len(files)} anh")
            for i, file in enumerate(files):
                if file and file.filename != '' and allowed_file(file.filename):
                    print(f"upload anh {i+1}")
                    image_url = upload_image_to_cloud(file, folder="smart_tourism/blogs")
                    if image_url:
                        image_urls.append(image_url)
                elif file.filename != '':
                    # Nếu có file nhưng đuôi không hợp lệ
                    return jsonify({"success": False, "error": f"File {file.filename} không hợp lệ (chỉ nhận ảnh)"}), 400
        
        
        # Convert image_urls list thành JSON string
        import json
        image_urls_json = json.dumps(image_urls) if image_urls else None

        # Tạo blog mới
        new_blog = Blog(
            title=title,
            content=content,
            image_urls=image_urls_json, # Lưu JSON string vào DB
            user_id=user_id
        )
        
        db.session.add(new_blog)
        db.session.commit()
        
        return jsonify({
            "success": True,
            "message": "Tạo blog thành công",
            "data": new_blog.to_json()
        }), 201
        
    except Exception as e:
        print("BLOG ERROR:", e)
        db.session.rollback()
        return jsonify({"success": False, "error": str(e)}), 500

# ===========================================================================
# ===                        AI / Chatbot Routes                          ===
# ===========================================================================
# CHATBOT cho trang service
@app.route('/api/ai/chat', methods=['POST'])
@jwt_required() # Chỉ cho user đăng nhập dùng
def ai_chat():
    """API Chatbot tư vấn du lịch
    Frontend cần gửi JSON:
    {
        "message": "Ở đó có món gì ngon?",
        "history": [
            {"role": "user", "parts": ["Đà Lạt có gì vui?"]},
            {"role": "model", "parts": ["Đà Lạt có hồ Xuân Hương..."]}
        ]
    }
    """
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        message = data.get('message')
        history = data.get('history', [])
        
        if not message:
            return jsonify({"success": False, "error": "Tin nhắn trống"}), 400
            
        top_attractions = smart_recommendation_service(user_id=user_id, search_term=message, limit=10)
       
        context_lines = []
        for a in top_attractions:
            name = a.get('name')
            desc = a.get('briefDescription')
            score = a.get('recommendationScore', 0)
            
            # Chỉ đưa vào context những địa điểm thực sự liên quan (score > 0)
            if score > 0:
                context_lines.append(f"- {name}: {desc}")
        
        # Nếu không tìm thấy gì liên quan thì lấy 3 địa điểm nổi bật ngẫu nhiên
        if not context_lines:
             fallback_attrs = Attraction.query.limit(3).all()
             for a in fallback_attrs:
                 context_lines.append(f"- {a.name}: {a.brief_description}")

        context_info = "Dữ liệu du lịch gợi ý:\n" + "\n".join(context_lines)
        
        reply = chat_with_tour_guide(message, context_data=f"Các địa điểm nổi bật: {context_info}")
        
        return jsonify({"success": True, "reply": reply}), 200
        # NOTE: Frontend phải append reply này vào history ở phía client
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

# CHATBOT tạo nội dung cho trang blog
@app.route('/api/ai/generate-caption', methods=['POST'])
@jwt_required() # Chỉ cho user đăng nhập dùng
def ai_generate_caption():
    """API tạo caption marketing tự động"""
    try:
        data = request.get_json()
        attr_name = data.get('name')
        features = data.get('features', '') # Ví dụ: "yên tĩnh, có hồ bơi, ngắm mây"
        
        if not attr_name:
            return jsonify({"success": False, "error": "Cần tên địa điểm"}), 400
            
        content = generate_caption(attr_name, features)
        return jsonify({"success": True, "data": content}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

# ===========================================================================
# ===                                                                     ===
# ===                                 Run                                 ===
# ===                                                                     ===
# ===========================================================================
# Health check endpoint
@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({"success": True, "message": "API is running"}), 200

def seed_blog_data():
    """Tạo 2 bài blog mẫu nếu database chưa có blog nào"""
    import json

    try:
        count = Blog.query.count()
        if count > 0:
            print("✔ Blog đã có dữ liệu, không tạo mẫu.")
            return

        default_blogs = [
            {
                "title": "Khám phá Hội An – Phố cổ giữa lòng thời gian",
                "content": (
                    "Hội An là một trong những điểm đến văn hóa nổi bật nhất Việt Nam, "
                    "mang vẻ đẹp vừa cổ kính vừa nên thơ. Dạo bước dưới những ánh đèn lồng "
                    "lung linh, thưởng thức cao lầu hay ngồi thuyền trên sông Hoài là trải nghiệm "
                    "không thể bỏ qua."
                ),
                "image_urls": json.dumps([
                    "/static/hoian.png",
                ]),
                "user_id": 1  # Gán cho admin/user mẫu
            },
            {
                "title": "Sapa – Thiên đường săn mây giữa đại ngàn",
                "content": (
                    "Sapa nổi tiếng với khí hậu mát lạnh quanh năm, ruộng bậc thang hùng vĩ "
                    "và những đám mây bồng bềnh vào sáng sớm. Núi Hàm Rồng, Fansipan hay bản Cát Cát "
                    "là những địa điểm không thể bỏ lỡ."
                ),
                "image_urls": json.dumps([
                    "./static/sapa.png"
                ]),
                "user_id": 1
            }
        ]

        for b in default_blogs:
            blog = Blog(
                title=b["title"],
                content=b["content"],
                image_urls=b["image_urls"],
                user_id=b["user_id"]
            )
            db.session.add(blog)

        db.session.commit()
        print("✔ Đã tạo 2 blog mẫu thành công!")

    except Exception as e:
        print("❌ Lỗi seed blog:", e)
        db.session.rollback()

with app.app_context():
    seed_blog_data()


if __name__ == '__main__':
    app.run(debug=True)



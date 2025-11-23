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
    get_jwt_identity
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
)
from init_db import import_demo_data
from service.search_service import search_service
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
from user.email_utils import init_mail
from user.auth_service import (
    signup_service, 
    login_service,
    verify_email_service, 
    resend_verification_service,
    forgot_password_service,  
    reset_password_service
)

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
    app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY', 'asdfghjkmnbvcxzq')
    app.config['JWT_ACCESS_TOKEN_EXPIRES'] = 3600  # 1 hour
    app.config['JWT_REFRESH_TOKEN_EXPIRES'] = 2592000  # 30 days
    app.config['UPLOAD_FOLDER'] = 'static/uploads/blogs'
    app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size
    
    # Enable CORS for React frontend
    CORS(app, resources={
        r"/api/*": {
            "origins": ["http://localhost:3000", "http://127.0.0.1:3000"],
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"]
        }
    })

    db.init_app(app=app)
    init_mail(app)

    with app.app_context():
        db.create_all()
        if Attraction.query.count() == 0:
            import_demo_data()

    return app

app = create_app()
limiter = Limiter(app)
jwt = JWTManager(app)

@jwt.expired_token_loader
def expired_token_callback(jwt_header, jwt_payload):
    return jsonify({"success": False, "error": "Token đã hết hạn"}), 401

@jwt.invalid_token_loader
def invalid_token_callback(error):
    return jsonify({"success": False, "error": "Token không hợp lệ"}), 401

@jwt.unauthorized_loader
def unauthorized_callback(error):
    return jsonify({"success": False, "error": "Thiếu authentication token"}), 401

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

Ví dụ:
/api/search?searchTerm=Hội%20An&typeList=Lễ%20hội&userId=1
"""
@app.route('/api/search', methods=["GET"])
@jwt_required(optional=True)
def search():
    user_id = get_jwt_identity()

    types_list = request.args.getlist("typeList", [])
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

    # NOTE cho FE: userId (nếu có) dùng để ưu tiên các địa điểm đã Favorite
    try:
        data = search_service(types_list, search_term, user_id=user_id)
        return jsonify({"success": True, "data": data}), 200
    except ValueError as e:
        return jsonify({"success": False, "error": str(e)}), 400
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
@jwt_required(optional=True)
def get_attraction_detail(attraction_id):
    user_id = get_jwt_identity()

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
# Thông tin trả về:
# {
#     'success': True|False,
#     'data': {
#         "timeline": [
#         {
#             "day": 1,
#             "date": "25/12/2025",
#             "time": "08:00",
#             "type": "START",
#             "name": "Điểm xuất phát",
#             "detail": "Bắt đầu hành trình"
#         },
#         {
#             "day": 1,
#             "date": "25/12/2025", 
#             "time": "12:00",
#             "type": "LUNCH",
#             "name": "Nghỉ ăn trưa",
#             "detail": "Tự do thưởng thức ẩm thực địa phương",
#             "duration": 60,
#             "endTime": "13:00"
#         },
#         {
#             "day": 1,
#             "date": "25/12/2025",
#             "time": "10:30",
#             "type": "TRAVEL",
#             "name": "Di chuyển đến Cố đô Huế",
#             "detail": "Quãng đường: 85.2km (90 phút)",
#             "duration": 90
#         },
#         {
#             "day": 1,
#             "date": "25/12/2025",
#             "time": "12:00",
#             "type": "VISIT",
#             "id": 1,
#             "name": "Cố đô Huế",
#             "detail": "Tham quan, chụp ảnh.",
#             "duration": 120,
#             "endTime": "14:00",
#             "lat": 16.4637,
#             "lon": 107.5909,
#             "imageUrl": "/static/images/hue.jpg"
#         },
#         {
#             "day": 1,
#             "date": "25/12/2025",
#             "time": "18:00",
#             "type": "DINNER",
#             "name": "Nghỉ ăn tối",
#             "detail": "Tự do thưởng thức ẩm thực địa phương",
#             "duration": 60,
#             "endTime": "19:00"
#         },
#         {
#             "day": 1,
#             "date": "25/12/2025",
#             "time": "22:00",
#             "type": "SLEEP",
#             "name": "Nghỉ ngơi",
#             "detail": "Kết thúc ngày, chuẩn bị cho ngày mai"
#         },
#         {
#             "day": 2,
#             "date": "26/12/2025",
#             "time": "06:00",
#             "type": "WAKE_UP",
#             "name": "Thức dậy",
#             "detail": "Bắt đầu ngày 2"
#         }],
#         "mapHtml": map_html,
#         "invalidAttractions": [
#          {
#              "id": attr.id,
#              "name": attr.name,
#              "reason": reason
#          },
#          {
#              "id": attr.id,
#              "name": attr.name,
#              "reason": reason
#          }
#            
#         ],
#         "finishTime": current_time.strftime("%H:%M"),
#         "totalDestinations": len(visit_points),
#         "totalDays": len(attractions_per_day)
#     }
# }
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

        # 4. Gọi Service (Logic giữ nguyên)
        result = generate_smart_tour(
            attraction_ids, 
            float(start_lat), 
            float(start_lon), 
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
@jwt_required(optional=True)
def save_tour():
    """
    POST: Lưu tour mới
    PATCH: Hủy lưu tour (unsave)
    """
    try:
        # Lấy user_id từ JWT token (nếu có) hoặc từ request
        user_id = get_jwt_identity()  # Trả về None nếu không có token

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
        new_access_token = create_access_token(identity=current_user_id)
        
        return jsonify({
            "success": True,
            "access_token": new_access_token,
            "token_type": "Bearer"
        }), 200
        
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
# ===========================================================================
# ===                                                                     ===
# ===                                 Blogs                               ===
# ===                                                                     ===
# ===========================================================================
# Cấu hình upload
UPLOAD_FOLDER = 'static/uploads/blogs'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

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
        blog = Blog.query.get(blog_id)
        if not blog:
            return jsonify({"success": False, "error": "Không tìm thấy blog"}), 404
        
        return jsonify({
            "success": True,
            "data": blog.to_json()
        }), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/blogs', methods=['POST'])
def create_blog():
    """Tạo blog mới với hình ảnh"""
    try:
        # Kiểm tra thư mục upload
        if not os.path.exists(UPLOAD_FOLDER):
            os.makedirs(UPLOAD_FOLDER)
        
        title = request.form.get('title', '').strip()
        content = request.form.get('content', '').strip()
        user_id = request.form.get('user_id', type=int)
        
        # Validation
        if not title:
            return jsonify({"success": False, "error": "Tiêu đề là bắt buộc"}), 400
        if not content:
            return jsonify({"success": False, "error": "Nội dung là bắt buộc"}), 400
        if not user_id:
            return jsonify({"success": False, "error": "User ID là bắt buộc"}), 400
        
        # Xử lý upload hình ảnh
        image_url = None
        if 'image' in request.files:
            file = request.files['image']
            if file and file.filename and allowed_file(file.filename):
                filename = secure_filename(file.filename)
                # Thêm timestamp để tránh trùng tên
                from datetime import datetime
                timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                filename = f"{timestamp}_{filename}"
                filepath = os.path.join(UPLOAD_FOLDER, filename)
                file.save(filepath)
                image_url = f"/static/uploads/blogs/{filename}"
        
        # Tạo blog mới
        new_blog = Blog(
            title=title,
            content=content,
            image_url=image_url,
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
        db.session.rollback()
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

if __name__ == '__main__':
    app.run(debug=True)
# Import thư viện ngoài 
from flask import Flask, jsonify, request
from flask_cors import CORS
from datetime import datetime
import os
from werkzeug.utils import secure_filename

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

    with app.app_context():
        db.create_all()
        if Attraction.query.count() == 0:
            import_demo_data()

    return app

app = create_app()



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
def search():
    types_list = request.args.getlist("typeList", [])
    search_term = request.args.get("searchTerm", "").strip()
    user_id_param = request.args.get("userId")
    user_id = None
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
def get_attraction_detail(attraction_id):
    if request.method == "GET":
        """
        Lấy thông tin chi tiết của attraction
        """

        user_id_param = request.args.get("userId")
        user_id = None
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
            user_id = review_data.get("userId") if review_data else None
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
            user_id = review_data.get("userId") if review_data else None
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
            user_id = review_data.get("userId") if review_data else None
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
@app.route('/api/quick-tour-creator', methods=['GET', 'POST'])
def creator():
    if request.method == 'POST':
        # Logic xử lý việc lưu tour sẽ ở đây
        # Lấy dữ liệu từ React: data = request.json
        # ...
        print("Đã gọi POST /api/quick-tour-creator")
        return jsonify({"success": True, "message": "Tour đã được tạo (thay thế logic này)"})

    # Logic GET (ví dụ: lấy gợi ý cho React)
    # ...
    print("Đã gọi GET /api/quick-tour-creator")
    return jsonify({"success": True, "message": "API tạo tour sẵn sàng (thay thế logic này)"})


# ===========================================================================
# ===                                                                     ===
# ===                                 User                                ===
# ===                                                                     ===
# ===========================================================================

# ===========================================================================
# ===                                                                     ===
# ===                                 Auth                                ===
# ===                                                                     ===
# ===========================================================================
@app.route('/api/auth/signup', methods=['POST'])
def signup():
    """Đăng ký tài khoản mới"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({"success": False, "error": "Không có dữ liệu được gửi"}), 400
        
        username = data.get('username', '').strip()
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')
        confirm_password = data.get('confirmPassword', '')
        
        # Validation
        if not username:
            return jsonify({"success": False, "error": "Tên người dùng là bắt buộc"}), 400
        
        if not email:
            return jsonify({"success": False, "error": "Email là bắt buộc"}), 400
        
        if not password:
            return jsonify({"success": False, "error": "Mật khẩu là bắt buộc"}), 400
        
        if len(password) < 6:
            return jsonify({"success": False, "error": "Mật khẩu phải có ít nhất 6 ký tự"}), 400
        
        if password != confirm_password:
            return jsonify({"success": False, "error": "Mật khẩu xác nhận không khớp"}), 400
        
        # Kiểm tra email đã tồn tại chưa
        existing_user = User.query.filter_by(email=email).first()
        if existing_user:
            return jsonify({"success": False, "error": "Email này đã được đăng ký"}), 409
        
        # Tạo người dùng mới
        new_user = User(
            username=username,
            email=email
        )
        new_user.set_password(password)
        
        db.session.add(new_user)
        db.session.commit()
        
        return jsonify({
            "success": True,
            "message": "Đăng ký thành công",
            "user": new_user.to_json()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/auth/login', methods=['POST'])
def login():
    """Đăng nhập"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({"success": False, "error": "Không có dữ liệu được gửi"}), 400
        
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')
        
        # Validation
        if not email:
            return jsonify({"success": False, "error": "Email là bắt buộc"}), 400
        
        if not password:
            return jsonify({"success": False, "error": "Mật khẩu là bắt buộc"}), 400
        
        # Tìm người dùng
        user = User.query.filter_by(email=email).first()
        
        if not user or not user.check_password(password):
            return jsonify({"success": False, "error": "Email hoặc mật khẩu không đúng"}), 401
        
        return jsonify({
            "success": True,
            "message": "Đăng nhập thành công",
            "user": user.to_json()
        }), 200
        
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
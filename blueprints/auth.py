from flask import Blueprint, render_template, request, jsonify
from models import db, User
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime

# Main auth blueprint for API endpoints
auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')

# Separate blueprint for template routes
auth_template_bp = Blueprint('auth_template', __name__)

@auth_template_bp.route('/setting')
def setting():
    return render_template('setting.html')

@auth_bp.route('/signup', methods=['POST'])
def signup():
    """Đăng ký"""
    try:
        data = request.get_json()
        
        # Validate required fields
        if not data:
            return jsonify({"success": False, "error": "Không có dữ liệu"}), 400
        
        name = data.get('name', '').strip()
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')
        confirm_password = data.get('confirmPassword', '')
        
        # Check lại
        if not name:
            return jsonify({"success": False, "error": "Tên là bắt buộc"}), 400
        
        if not email:
            return jsonify({"success": False, "error": "Email là bắt buộc"}), 400
        
        if not password:
            return jsonify({"success": False, "error": "Mật khẩu là bắt buộc"}), 400
        
        if len(password) < 6:
            return jsonify({"success": False, "error": "Mật khẩu phải có ít nhất 6 ký tự"}), 400
        
        if password != confirm_password:
            return jsonify({"success": False, "error": "Mật khẩu không khớp"}), 400
        
        # Check xem user đã tồn tại hay chưa
        existing_user = User.query.filter_by(email=email).first()
        if existing_user:
            return jsonify({"success": False, "error": "Email đã được đăng ký"}), 409
        
        # Tạo user mới
        new_user = User(
            name=name,
            email=email
        )
        new_user.set_password(password)
        
        db.session.add(new_user)
        db.session.commit()
        
        return jsonify({
            "success": True,
            "message": "User đăng ký thành công",
            "user": new_user.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "error": str(e)}), 500

@auth_bp.route('/login', methods=['POST'])
def login():
    """Xác thực user và trả về thông tin user"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({"success": False, "error": "Không có dữ liệu"}), 400
        
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')
        
        # Check lại
        if not email:
            return jsonify({"success": False, "error": "Email là bắt buộc"}), 400
        
        if not password:
            return jsonify({"success": False, "error": "Mật khẩu là bắt buộc"}), 400
        
        # Tìm user
        user = User.query.filter_by(email=email).first()
        
        if not user or not user.check_password(password):
            return jsonify({"success": False, "error": "Email hoặc mật khẩu không hợp lệ"}), 401
        
        return jsonify({
            "success": True,
            "message": "Đăng nhập thành công",
            "user": user.to_dict()
        }), 200
        
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@auth_bp.route('/user/<int:user_id>', methods=['GET'])
def get_user(user_id):
    """Lấy user bởi ID"""
    try:
        user = User.query.get(user_id)
        if not user:
            return jsonify({"success": False, "error": "User không tồn tại"}), 404
        
        return jsonify({
            "success": True,
            "user": user.to_dict()
        }), 200
        
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
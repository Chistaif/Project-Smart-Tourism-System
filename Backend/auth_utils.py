"""
Authentication and authorization utilities
"""
from functools import wraps
from flask import jsonify, request
from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity
from models import User

def require_auth(f):
    """Decorator để yêu cầu authentication"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            verify_jwt_in_request()
            current_user_id = get_jwt_identity()
            # Kiểm tra user có tồn tại không
            user = User.query.get(current_user_id)
            if not user:
                return jsonify({"success": False, "error": "Người dùng không hợp lệ"}), 401
            # Thêm user vào kwargs để function có thể sử dụng
            kwargs['current_user'] = user
            return f(*args, **kwargs)
        except Exception as e:
            return jsonify({"success": False, "error": "Token không hợp lệ hoặc đã hết hạn"}), 401
    return decorated_function

def require_owner_or_admin(f):
    """Decorator để yêu cầu user là chủ sở hữu hoặc admin"""
    @wraps(f)
    @require_auth
    def decorated_function(*args, **kwargs):
        current_user = kwargs.get('current_user')
        # Lấy user_id từ route params hoặc request
        target_user_id = kwargs.get('user_id') or request.json.get('user_id') if request.is_json else None
        
        if not target_user_id:
            return jsonify({"success": False, "error": "Không tìm thấy user_id"}), 400
        
        # Kiểm tra quyền (user chỉ có thể chỉnh sửa dữ liệu của chính mình)
        if current_user.user_id != int(target_user_id):
            return jsonify({"success": False, "error": "Không có quyền truy cập"}), 403
        
        return f(*args, **kwargs)
    return decorated_function


from datetime import datetime
from models import db, User
from flask_jwt_extended import create_access_token, create_refresh_token
from user.email_utils import send_verification_email, send_reset_password_email
import string

def check_password(pw: str):
    has_lower = any(c.islower() for c in pw)
    has_upper = any(c.isupper() for c in pw)
    has_digit = any(c.isdigit() for c in pw)
    has_symbol = any(c in string.punctuation for c in pw)
    long_enough = len(pw) >= 8

    return has_lower and has_upper and has_digit and has_symbol and long_enough

def signup_service(data):
    """Xử lý đăng ký tài khoản và gửi mail"""
    username = data.get('username', '').strip()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')
    confirm_password = data.get('confirmPassword', '')
    
    # 1. Validation cơ bản
    if not username or not email or not password:
        raise ValueError("Vui lòng điền đầy đủ thông tin")
    if not check_password(password):
        raise ValueError("Mật khẩu phải ít nhất 8 kí tự, chứa chữ hoa, chữ thường, số, kí tự đặc biệt")
    if password != confirm_password:
        raise ValueError("Mật khẩu xác nhận không khớp")
        
    # 2. Kiểm tra sự tồn tại (Username HOẶC Email)
    if User.query.filter_by(username=username).first():
        raise ValueError(f"Username '{username}' đã được sử dụng")
        
    if User.query.filter_by(email=email).first():
        raise ValueError(f"Email '{email}' đã được đăng ký")
        
    # 3. Tạo user mới
    new_user = User(username=username, email=email)
    new_user.set_password(password)
    
    # 4. Tạo mã xác thực ngay lúc đăng ký
    code = new_user.generate_verification_code()
    
    try:
        db.session.add(new_user)

        # 5. Gửi email (Không chặn luồng nếu gửi lỗi, chỉ log lại)
        sent_success, msg = send_verification_email(username, email, code)
        if not sent_success:
            # Nếu gửi mail thất bại thì báo lỗi luôn, không lưu User
            raise Exception("Không thể gửi email xác thực. Vui lòng kiểm tra lại email.")

        db.session.commit()
        
        return {
            # "user": new_user.to_json(),
            **new_user.to_json(),
            "message": "Đăng ký thành công. Vui lòng kiểm tra email để lấy mã xác thực.",
            "require_verification": True,
            "email_sent": sent_success
        }
    except Exception as e:
        db.session.rollback()
        raise e

def login_service(data):
    """Xử lý đăng nhập bằng Username"""
    username = data.get('username', '').strip()
    password = data.get('password', '')
    
    if not username or not password:
        raise ValueError("Vui lòng nhập tên người dùng và mật khẩu")
        
    # Tìm user theo username
    user = User.query.filter_by(username=username).first()
    
    # Kiểm tra password
    if not user or not user.check_password(password):
        raise ValueError("Tên người dùng hoặc mật khẩu không đúng")
        
    # Kiểm tra xác thực email
    if not user.email_verified:
        return {
            "error": "Tài khoản chưa xác thực email",
            "is_verified": False,
            "email": user.email # Trả về email để FE gợi ý gửi lại mã
        }

    # Cập nhật lần đăng nhập cuối
    user.last_login_at = datetime.utcnow()
    db.session.commit()

    # Tạo token
    access_token = create_access_token(identity=str(user.user_id))
    refresh_token = create_refresh_token(identity=str(user.user_id))
    
    return {
        "message": "Đăng nhập thành công",
        "user": user.to_json(),
        "access_token": access_token,
        "refresh_token": refresh_token,
        "is_verified": True
    }

def verify_email_service(email, code):
    """Xử lý xác thực mã code"""
    if not email or not code:
        raise ValueError("Thiếu email hoặc mã xác thực")
        
    user = User.query.filter_by(email=email.lower()).first()
    if not user:
        raise LookupError("Không tìm thấy người dùng")
        
    if user.email_verified:
        return {"message": "Tài khoản đã được xác thực trước đó"}
        
    if user.verify_code(code):
        user.clear_verification_code() # Xóa mã sau khi dùng xong
        db.session.commit()
        return {"message": "Xác thực tài khoản thành công!"}
    else:
        raise ValueError("Mã xác thực không đúng hoặc đã hết hạn")

def resend_verification_service(email):
    """Xử lý gửi lại mã xác thực"""
    if not email:
        raise ValueError("Email là bắt buộc")
        
    user = User.query.filter_by(email=email.lower()).first()
    if not user:
        raise LookupError("Không tìm thấy người dùng")
        
    if user.email_verified:
        raise ValueError("Tài khoản này đã được xác thực rồi")
        
    # Tạo mã mới
    new_code = user.generate_verification_code()
    db.session.commit()
    
    sent, msg = send_verification_email(user.username, email, new_code)
    if not sent:
        raise Exception("Không thể gửi email. Vui lòng thử lại sau.")
        
    return {"message": msg}


def forgot_password_service(email):
    """
    Xử lý yêu cầu quên mật khẩu:
    1. Tìm user
    2. Tạo mã
    3. Gửi email
    """
    if not email:
        raise ValueError("Vui lòng nhập email")
        
    user = User.query.filter_by(email=email.lower().strip()).first()
    
    if not user:
        raise ValueError("Email không tồn tại trong hệ thống") 

    # Tạo mã reset
    reset_code = user.generate_verification_code()
    db.session.commit()
    
    # Gửi email
    sent, msg = send_reset_password_email(user.username, user.email, reset_code)
    
    if not sent:
        raise Exception("Lỗi gửi email. Vui lòng thử lại sau.")
        
    return {"message": f"Mã xác nhận đã được gửi đến {email}. Vui lòng kiểm tra hộp thư."}

def reset_password_service(data):
    """
    Xử lý đặt lại mật khẩu:
    1. Validate input
    2. Check mã code
    3. Đổi pass
    """
    email = data.get('email', '').strip().lower()
    code = data.get('code', '').strip()
    new_password = data.get('newPassword', '')
    confirm_password = data.get('confirmPassword', '')
    
    # 1. Validation
    if not email or not code or not new_password:
        raise ValueError("Vui lòng điền đầy đủ thông tin")
        
    if new_password != confirm_password:
        raise ValueError("Mật khẩu xác nhận không khớp")
        
    if not check_password(new_password): 
        raise ValueError("Mật khẩu mới phải đủ mạnh (8 ký tự, hoa, thường, số, ký tự đặc biệt)")

    # 2. Tìm user
    user = User.query.filter_by(email=email).first()
    if not user:
        raise ValueError("Người dùng không tồn tại")
        
    # 3. Kiểm tra mã
    if not user.verify_code(code):
        raise ValueError("Mã xác nhận không đúng hoặc đã hết hạn")
        
    # 4. Đổi mật khẩu & Xóa mã
    user.set_password(new_password)
    user.clear_verification_code()
    
    db.session.commit()
    
    return {"message": "Đặt lại mật khẩu thành công. Bạn có thể đăng nhập ngay bây giờ."}
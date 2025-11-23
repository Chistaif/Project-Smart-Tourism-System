from flask_mail import Mail, Message
import os

mail = Mail()

def init_mail(app):
    """Khởi tạo cấu hình Flask-Mail từ biến môi trường"""
    app.config['MAIL_SERVER'] = os.environ.get('MAIL_SERVER', 'smtp.gmail.com')
    app.config['MAIL_PORT'] = int(os.environ.get('MAIL_PORT', 587))
    app.config['MAIL_USE_TLS'] = os.environ.get('MAIL_USE_TLS', 'True').lower() == 'true'
    app.config['MAIL_USERNAME'] = os.environ.get('MAIL_USERNAME')
    app.config['MAIL_PASSWORD'] = os.environ.get('MAIL_PASSWORD')
    app.config['MAIL_DEFAULT_SENDER'] = os.environ.get('MAIL_DEFAULT_SENDER', app.config['MAIL_USERNAME'])
    
    mail.init_app(app)

def send_verification_email(user_name, user_email, verification_code):
    """Gửi email chứa mã xác thực"""
    try:
        msg = Message(
            subject='Mã xác thực tài khoản - Smart Tourism',
            recipients=[user_email],
            body=f'''
            Chào {user_name},
            
            Cảm ơn bạn đã đăng ký tài khoản tại Smart Tourism System.
            Mã xác thực của bạn là: {verification_code}
            
            Mã này có hiệu lực trong 10 phút.
            
            Trân trọng,
            Smart Tourism Team
            '''
        )
        mail.send(msg)
        return True, "Email đã được gửi"
    except Exception as e:
        print(f"❌ Lỗi gửi email: {e}")
        # Trả về False nhưng in mã ra console để dev vẫn test được nếu chưa cấu hình mail
        print(f"🔑 [DEBUG ONLY] Mã xác thực cho {user_email}: {verification_code}")
        return False, str(e)
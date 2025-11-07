from .main import main_bp
from .service import service_bp
from .user import user_bp
from .auth import auth_bp

# Tập hợp blueprint vào 1 list để app.py dễ đăng ký
all_blueprints = [main_bp, service_bp, user_bp, auth_bp]

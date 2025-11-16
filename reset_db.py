"""
Cái này để tạo lại db
"""
from app import app
from models import db, User

with app.app_context():
    # Xóa tất cả các table
    db.drop_all()
    print("Xóa tất cả các table")
    
    # Tạo tất cả các table với schema mới
    db.create_all()
    print("Tạo tất cả các table với schema mới")
    
    print("\nHoàn thành tạo db!")
    print("Bạn có thể chạy app và db sẽ sẵn sàng.")


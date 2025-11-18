"""
Cái này để tạo db nếu đ có db
"""
from app import app
from models import db, User
import os

def migrate_database():
    """Chuyển đổi schema db cho table User"""
    with app.app_context():
        try:
            # kiểm tra db cũ xem có rồi hay ko
            db_uri = app.config['SQLALCHEMY_DATABASE_URI']
            if db_uri.startswith('sqlite:///'):
                db_path = db_uri.replace('sqlite:///', '')
                # Kiểm tra folder instance (mặc định flask)
                instance_path = os.path.join(app.instance_path, db_path)
                if os.path.exists(instance_path):
                    db_path = instance_path
                elif not os.path.exists(db_path):
                    # Kiểm tra íntance folder có rồi hay ko
                    if not os.path.exists(app.instance_path):
                        os.makedirs(app.instance_path)
                    db_path = os.path.join(app.instance_path, db_path)
            
            if not os.path.exists(db_path):
                print("Db không tồn tại. Sẽ được tạo lần đầu.")
                db.create_all()
                return
            
            # check xem có user table hoặc schema cũ 
            inspector = db.inspect(db.engine)
            tables = inspector.get_table_names()
            
            if 'user' not in tables:
                print("User table không tồn tại. Sẽ được tạo lần đầu.")
                db.create_all()
                return
            
            # Lấy cột từ table cũ
            columns = [col['name'] for col in inspector.get_columns('user')]
            
            if 'password_hash' in columns:
                print("Db đã có schema đúng (cột password_hash tồn tại).")
                return
            
            if 'password' in columns:
                print("Chuyển đổi từ schema cũ (password) sang schema mới (password_hash)...")
                
                # (SQLite doesn't support ALTER TABLE RENAME COLUMN well, so we'll recreate
                # First, backup existing data if any) chat gpt :)))
                old_users = db.session.execute(db.text("SELECT id, name, email, password FROM user")).fetchall()
                
                if old_users:
                    print(f"Tìm thấy {len(old_users)} user. Lưu ý: Mật khẩu không thể chuyển đổi (cần được hash lại).")
                    print("Các user sẽ cần đặt lại mật khẩu.")
                
                # Xóa table cũ 
                db.session.execute(db.text("DROP TABLE IF EXISTS user"))
                db.session.commit()
                
                # Tạo table mới với schema mới
                db.create_all()
                
                print("Hoàn thành tạo db! User table đã được tạo lại với cột password_hash.")
                print("Lưu ý: Các user cũ sẽ cần đăng ký lại hoặc đặt lại mật khẩu.")
                
            else:
                # không có cột password, chỉ tạo table mới
                print("Creating User table with new schema...")
                db.create_all()
                
        except Exception as e:
            print(f"Lỗi tạo db: {e}")
            db.session.rollback()
            raise

if __name__ == '__main__':
    print("Bắt đầu tạo db...")
    migrate_database()
    print("Hoàn thành db.")


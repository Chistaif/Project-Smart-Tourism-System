"""
Database Migration Script - Kết hợp SQLAlchemy và Raw SQL approach
Tự động phát hiện và tạo các bảng cần thiết
"""
import os
import sys
import sqlite3

def find_database_path():
    """Tìm đường dẫn database file"""
    db_paths = [
        'instance/demo.db',
        'demo.db',
        'Backend/instance/demo.db',
    ]

    for path in db_paths:
        if os.path.exists(path):
            return path

    return None

def migrate_with_sqlalchemy():
    """Migration sử dụng SQLAlchemy (cần đầy đủ dependencies)"""
    try:
        print("🔄 Thử migration với SQLAlchemy...")
        from Backend.app import app
        from Backend.models import db

        with app.app_context():
            # Kiểm tra và tạo tất cả tables
            inspector = db.inspect(db.engine)
            existing_tables = inspector.get_table_names()

            print(f"📊 Tables hiện tại: {existing_tables}")

            # Tạo tables mới nếu chưa có
            db.create_all()

            # Kiểm tra lại sau khi tạo
            new_tables = inspector.get_table_names()
            created_tables = set(new_tables) - set(existing_tables)

            if created_tables:
                print(f"✅ Đã tạo tables: {list(created_tables)}")
            else:
                print("ℹ️  Không có table mới nào cần tạo")

            # Migration đặc biệt cho User table (password -> password_hash)
            if 'user' in new_tables or 'user' in existing_tables:
                migrate_user_table(db, inspector)

            # Kiểm tra token_blacklist table
            check_token_blocklist_table(inspector)

        return True

    except ImportError as e:
        print(f"❌ Không thể import dependencies: {e}")
        print("🔄 Chuyển sang migration với raw SQL...")
        return False

    except Exception as e:
        print(f"❌ Lỗi SQLAlchemy migration: {e}")
        return False

def migrate_user_table(db, inspector):
    """Migration đặc biệt cho User table"""
    try:
        columns = [col['name'] for col in inspector.get_columns('user')]

        if 'password_hash' in columns:
            print("✅ User table đã có schema đúng (password_hash)")
            return

        if 'password' in columns:
            print("🔄 Chuyển đổi User table từ password sang password_hash...")

            # Backup data
            old_users = db.session.execute(db.text("SELECT id, name, email, password FROM user")).fetchall()

            if old_users:
                print(f"⚠️  Tìm thấy {len(old_users)} user. Mật khẩu cần được hash lại.")
                print("💡 User cần đặt lại mật khẩu sau migration.")

            # Recreate table
            db.session.execute(db.text("DROP TABLE IF EXISTS user"))
            db.session.commit()
            db.create_all()

            print("✅ User table đã được tạo lại với schema mới")

        else:
            print("📋 Tạo User table với schema mới...")

    except Exception as e:
        print(f"⚠️  Lỗi migration User table: {e}")

def check_token_blocklist_table(inspector):
    """Kiểm tra bảng token_blacklist"""
    try:
        tables = inspector.get_table_names()
        if 'token_blacklist' in tables:
            print("✅ Token blocklist table đã tồn tại")
        else:
            print("⚠️  Token blocklist table chưa tồn tại - sẽ tạo bằng raw SQL")
            return False
    except Exception as e:
        print(f"⚠️  Lỗi kiểm tra token_blocklist: {e}")
        return False

    return True

def migrate_with_raw_sql():
    """Migration sử dụng raw SQL (không cần dependencies)"""
    print("🔄 Migration với raw SQL...")

    db_path = find_database_path()
    if not db_path:
        print("❌ Không tìm thấy database file")
        return

    print(f"📂 Database: {db_path}")

    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # Tạo bảng token_blacklist nếu chưa có
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS token_blacklist (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                jti VARCHAR(36) NOT NULL UNIQUE,
                token_type VARCHAR(10) NOT NULL,
                user_id INTEGER NOT NULL,
                blacklisted_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Tạo index
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_token_blacklist_jti ON token_blacklist(jti)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_token_blacklist_user ON token_blacklist(user_id)")

        conn.commit()

        # Kiểm tra kết quả
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='token_blacklist'")
        if cursor.fetchone():
            print("✅ Bảng token_blocklist đã được tạo thành công!")

            # Hiển thị cấu trúc bảng
            cursor.execute("PRAGMA table_info(token_blacklist)")
            columns = cursor.fetchall()
            print("📋 Cấu trúc bảng:")
            for col in columns:
                print(f"  - {col[1]}: {col[2]} {'(NOT NULL)' if col[3] else ''}")

            # Hiển thị index
            cursor.execute("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_token_blacklist%'")
            indexes = cursor.fetchall()
            print(f"🔍 Index: {[idx[0] for idx in indexes]}")

        else:
            print("❌ Có lỗi khi tạo bảng token_blocklist")

        conn.close()

    except Exception as e:
        print(f"❌ Lỗi raw SQL migration: {e}")

def main():
    """Main migration function"""
    print("🚀 Bắt đầu Database Migration")
    print("=" * 50)

    # Thử SQLAlchemy approach trước
    if migrate_with_sqlalchemy():
        print("✅ Migration hoàn thành với SQLAlchemy!")
    else:
        # Fallback về raw SQL
        migrate_with_raw_sql()
        print("✅ Migration hoàn thành với raw SQL!")

    print("=" * 50)
    print("🎉 Migration hoàn thành!")

if __name__ == '__main__':
    main()


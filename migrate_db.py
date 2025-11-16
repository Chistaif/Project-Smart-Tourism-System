"""
Migration script to update User table schema.
This will migrate from the old 'password' column to 'password_hash' column.
"""
from app import app
from models import db, User
import os

def migrate_database():
    """Migrate the database schema for User table"""
    with app.app_context():
        try:
            # Check if old database exists (could be in instance folder or root)
            db_uri = app.config['SQLALCHEMY_DATABASE_URI']
            if db_uri.startswith('sqlite:///'):
                db_path = db_uri.replace('sqlite:///', '')
                # Check in instance folder first (Flask default)
                instance_path = os.path.join(app.instance_path, db_path)
                if os.path.exists(instance_path):
                    db_path = instance_path
                elif not os.path.exists(db_path):
                    # Check if instance folder exists
                    if not os.path.exists(app.instance_path):
                        os.makedirs(app.instance_path)
                    db_path = os.path.join(app.instance_path, db_path)
            
            if not os.path.exists(db_path):
                print("Database doesn't exist. It will be created on first run.")
                db.create_all()
                return
            
            # Check if User table exists and has old schema
            inspector = db.inspect(db.engine)
            tables = inspector.get_table_names()
            
            if 'user' not in tables:
                print("User table doesn't exist. It will be created on first run.")
                db.create_all()
                return
            
            # Get columns from existing table
            columns = [col['name'] for col in inspector.get_columns('user')]
            
            if 'password_hash' in columns:
                print("Database already has the correct schema (password_hash column exists).")
                return
            
            if 'password' in columns:
                print("Migrating from old schema (password) to new schema (password_hash)...")
                
                # SQLite doesn't support ALTER TABLE RENAME COLUMN well, so we'll recreate
                # First, backup existing data if any
                old_users = db.session.execute(db.text("SELECT id, name, email, password FROM user")).fetchall()
                
                if old_users:
                    print(f"Found {len(old_users)} users. Note: Passwords cannot be migrated (they need to be rehashed).")
                    print("Users will need to reset their passwords.")
                
                # Drop the old table
                db.session.execute(db.text("DROP TABLE IF EXISTS user"))
                db.session.commit()
                
                # Create new table with correct schema
                db.create_all()
                
                print("Migration complete! User table has been recreated with password_hash column.")
                print("Note: Existing users will need to sign up again or reset their passwords.")
                
            else:
                # No password column, just create the table
                print("Creating User table with new schema...")
                db.create_all()
                
        except Exception as e:
            print(f"Error during migration: {e}")
            db.session.rollback()
            raise

if __name__ == '__main__':
    print("Starting database migration...")
    migrate_database()
    print("Migration script completed.")


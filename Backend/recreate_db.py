"""Simple script to recreate database with updated schema"""
from models import db, User, Attraction, Festival, CulturalSpot, Review, Tag, Blog, SavedTour, FavoriteAttraction
from flask import Flask
from init_db import import_demo_data

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///demo.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)

with app.app_context():
    # Drop all tables and recreate
    db.drop_all()
    db.create_all()
    print("Database schema created successfully!")
    
    # Import demo data
    try:
        import_demo_data("demo_data.json")
        print("Demo data imported successfully!")
    except Exception as e:
        print(f"Warning: Could not import demo data: {e}")


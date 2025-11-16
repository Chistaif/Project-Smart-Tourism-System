from flask import Flask
from flask_cors import CORS
from models import db  
from init_db import import_demo_data

from blueprints import all_blueprints


# Tạo app
def create_app():
    app = Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///demo.db'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    
    # Bật cors cho frontend
    CORS(app, resources={
        r"/api/*": {
            "origins": ["http://localhost:3000", "http://127.0.0.1:3000"],
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"]
        }
    })

    db.init_app(app=app)

    with app.app_context():
        db.create_all()
        from models import Destination
        if Destination.query.count() == 0:
                import_demo_data()

    return app

app = create_app()



for bp in all_blueprints:
    app.register_blueprint(bp)

if __name__ == '__main__':
    app.run(debug=True)
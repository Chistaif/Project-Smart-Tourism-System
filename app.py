from flask import Flask
from models import db  
from init_db import import_demo_data

from blueprints import all_blueprints


# Khởi tạo ứng dụng app
def create_app():
    app = Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///demo.db'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

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
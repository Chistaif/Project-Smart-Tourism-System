# Import thư viện ngoài 
from flask import Flask, jsonify, request
from flask_cors import CORS        
from datetime import datetime 

# Import trong project
from models import db, Attraction, Festival, CulturalSpot, Review, Tag
from init_db import import_demo_data
from service.search_service import search_service
from service.attraction_service import get_attraction_detail_service


# ===========================================================================
# ===                                                                     ===
# ===                      Khởi tạo ứng dụng app                          ===
# ===                                                                     ===
# ===========================================================================
def create_app():
    app = Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///demo.db'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['JSON_AS_ASCII'] = False
    
    # Enable CORS for React frontend
    CORS(app, resources={r"/api/*": {"origins": "http://localhost:3000"}})

    db.init_app(app=app)

    with app.app_context():
        db.create_all()
        if Attraction.query.count() == 0:
            import_demo_data()

    return app

app = create_app()



# ===========================================================================
# ===                                                                     ===
# ===                                Service                              ===
# ===                                                                     ===
# ===========================================================================
"""
=== Chức năng search ===
/api/search?searchTerm=Hội An&typeList=Lễ hội       => lấy được id, name, url(ảnh mh) cơ bản
{
    "success": True/False,
    "data": {
        "festivals": [...],
        "culturalSpots": [...],
        "otherAttractions": [...]
    }
}

/api/search                                         => lấy tất cả attractions
"""
@app.route('/api/search', methods=["GET"])
def search():
    types_list = request.args.getlist("typeList", [])
    search_term = request.args.get("searchTerm", "").strip()

    try:
        data = search_service(types_list, search_term)
        return jsonify({"success": True, "data": data}), 200
        
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# === Chức năng lấy thông tin chi tiết attraction ===
@app.route('/api/attraction/<int:attraction_id>', methods=["GET"])
def get_attraction_detail(attraction_id):
    try:
        data = get_attraction_detail_service(attraction_id)
        return jsonify({"success": True, "data": data}), 200

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
    


# === Chức năng tạo tour ===
@app.route('/api/quick-tour-creator', methods=['GET', 'POST'])
def creator():
    if request.method == 'POST':
        # Logic xử lý việc lưu tour sẽ ở đây
        # Lấy dữ liệu từ React: data = request.json
        # ...
        print("Đã gọi POST /api/quick-tour-creator")
        return jsonify({"success": True, "message": "Tour đã được tạo (thay thế logic này)"})

    # Logic GET (ví dụ: lấy gợi ý cho React)
    # ...
    print("Đã gọi GET /api/quick-tour-creator")
    return jsonify({"success": True, "message": "API tạo tour sẵn sàng (thay thế logic này)"})


# ===========================================================================
# ===                                                                     ===
# ===                                 User                                ===
# ===                                                                     ===
# ===========================================================================

# ===========================================================================
# ===                                                                     ===
# ===                                 Auth                                ===
# ===                                                                     ===
# ===========================================================================


# ===========================================================================
# ===                                                                     ===
# ===                                 Run                                 ===
# ===                                                                     ===
# ===========================================================================
# Health check endpoint
@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({"success": True, "message": "API is running"}), 200

if __name__ == '__main__':
    app.run(debug=True)
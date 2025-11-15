# Import thư viện ngoài 
import folium
from flask import Flask, jsonify, request
from flask_cors import CORS
from sqlalchemy import or_ 
import pandas as pd        
import requests           
from datetime import datetime 

# Import trong project
from models import db, Attraction, Festival, CulturalSpot, Review, Tag
from init_db import import_demo_data



# ===========================================================================
# ===                                                                     ===
# ===                      Khởi tạo ứng dụng app                          ===
# ===                                                                     ===
# ===========================================================================
def create_app():
    app = Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///demo.db'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    
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
{
    "success": True/False,
    "data": {
        "festivals": [...],
        "cultural_spots": [...],
        "other_attractions": [...]
    }
}
"""
@app.route('/api/search', methods=["GET"])
def search():
    date = request.args.get("datetime", datetime.now())
    types_list = request.args.get("typeList", [])
    search_term = request.args.get("searchTerm", "")

    try:
        query = db.session.query(
            Attraction.id,
            Attraction.name,
            Attraction.url,
            Attraction.type,
            Attraction.average_rating
        )

        query = query.outerjoin(Festival, Festival.id == Attraction.id)
        query = query.outerjoin(CulturalSpot, CulturalSpot.id == Attraction.id)
        query = query.outerjoin(Attraction.tags)

        # Lọc theo nội dung tìm kiếm (tên địa điểm / tên tỉnh tp / tag)
        if search_term:
            search_pattern = f"%{search_term}%"
            query = query.filter(
                or_(
                    Attraction.name.ilike(search_pattern),
                    Attraction.location.ilike(search_pattern),
                    Tag.tag_name.ilike(search_pattern)
                )
            )

        if types_list:
            type_conditions = []
            
            # Tách các loại CulturalSpot (Bảo tàng, Làng nghề, v.v.)
            spot_types_from_list = [t for t in types_list if t != 'Lễ hội']

            # Nếu người dùng check "Lễ hội"
            if 'Lễ hội' in types_list:
                type_conditions.append(Attraction.type == 'festival')
            
            # Nếu người dùng check các loại khác
            if spot_types_from_list:
                type_conditions.append(CulturalSpot.spot_type.in_(spot_types_from_list))
            
            # (Lấy những điểm LÀ 'Lễ hội' HOẶC CÓ 'spot_type' nằm trong danh sách)
            if type_conditions:
                query = query.filter(or_(*type_conditions))

        # Bộ lọc Ngày
        # Chỉ lấy (Attraction.type != 'festival') HOẶC (Festival.time_end >= date)
        query = query.filter(
            or_(
                Attraction.type != 'festival',
                Festival.time_end >= date
            )
        ).distinct()
        results = query.all()

        festivals_list = []
        cultural_spots_list = []
        other_attractions_list = []
        for r in results:
            item_data = {
                "id": r[0], "name": r[1], "url": r[2], 
                "type": r[3], "average_rating": r[4]
            }
            if r[3] == 'festival': festivals_list.append(item_data)
            elif r[3] == 'cultural_spot': cultural_spots_list.append(item_data)
            else: other_attractions_list.append(item_data)

        # Có thể thêm logic đưa những địa điểm hot hit lên trên đầu danh sách ở đây
        # dựa vào rating hoặc các thuật toán RS 

        result_data = {
            "festivals": festivals_list,
            "cultural_spots": cultural_spots_list,
            "other_attractions": other_attractions_list
        }
        if result_data: 
            return jsonify({"success": True, "data": result_data}), 200
        else:
            return jsonify({"success": False, "error": "Không có dữ liệu"}), 500
        
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# === Chức năng lấy thông tin chi tiết attraction ===
@app.route('/api/attraction/<int:attraction_id>', methods=["GET"])
def get_attraction_detail(attraction_id):
    try:
        attraction = Attraction.query.get_or_404(attraction_id)
        attraction_data = attraction.to_json()

        reviews = Review.query.filter_by(attraction_id=attraction_id).order_by(Review.created_at.desc()).all()
        reviews_data = [review.to_json() for review in reviews]

        response_data = {
            "attraction": attraction_data,
            "reviews": reviews_data
        }
        
        return jsonify({"success": True, "data": response_data}), 200

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


# Health check endpoint
@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({"success": True, "message": "API is running"}), 200


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
if __name__ == '__main__':
    app.run(debug=True)
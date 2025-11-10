from flask import Blueprint, render_template, request, jsonify
import pandas as pd
from models import db, Attraction, Festival, CulturalSpot, Tag, Review
from datetime import datetime
import folium
from sqlalchemy import or_

# Dùng request.json.get("key") khi JavaScript gửi JSON.
# Dùng request.form.get("key") khi HTML form gửi dữ liệu.

service_bp = Blueprint('service', __name__, url_prefix='/service')


# =====================================================================================
# ===                                                                               ===
# ===                              Page /service                                    ===
# ===                                                                               ===
# =====================================================================================
@service_bp.route('/', methods=['GET','POST'])
def service():
    if request.method == 'POST':
        # Dùng request.form.get('action') để xem nút nào đã được bấm
        action = request.form.get('action')

        if action == 'search':
            # ... (Code xử lý search ở đây) ...
            return
        elif action == 'quick_tour_creator':
            # ... (Code xử lý gợi ý tạo tour ở đây) ...
            return

        return render_template('service.html')

    else:
        default_coords = (10.7769, 106.7009) # Tọa đồ mặc định là tp.HCM

        try: # Lấy thử tọa độ tham số
            lat = float(request.args.get('lat', default_coords[0]))
            lon = float(request.args.get('lon', default_coords[1]))
            user_coords = (lat, lon)
        except: # Nếu tham số không hợp lệ, lấy tọa độ mặc định
            user_coords = default_coords

        # Tạo bản đồ với tọa độ 
        m = folium.Map(location=user_coords, zoom_start=15)
        folium.Marker(user_coords, popup="<i>Vị trí của bạn</i>", tooltip="Bạn đang ở đây").add_to(m)

        map_html = m._repr_html_()

    return render_template('service.html', map_html=map_html)

# Hàm truy vấn các attraction bằng thanh search
def search_attractions(date=datetime.now(), types_list=[], search_term=""):
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
    return jsonify(result_data)



# =====================================================================================
# ===                                                                               ===
# ===          Page /service/api/attraction-detail/<int: attraction_id>             ===
# ===                                                                               ===
# =====================================================================================

# cần xem xét thay đổi tên key attraction_id
@service_bp.route('/api/attraction-detail/<int:attraction_id>', methods=["GET", "POST"])
def show_attraction(attraction_id):
    if request.method == 'POST':
        # Dùng request.form.get('action') để xem nút nào đã được bấm
        action = request.form.get('action')

        if action == 'add_to_the_schedule':
            # ... (Code xử lý thêm lịch trình vào tour ở đây) ...
            return
        elif action == 'add_review':
            # ... (Code xử lý thêm review ở đây) ...
            return render_template('detail_attraction.html')
    

    # 1. Lấy thông tin Attraction
    attraction = Attraction.query.get_or_404(attraction_id)
    attraction_data = attraction.to_json()
    # 2. Lấy thông tin Reviews
    reviews = Review.query.filter_by(attraction_id=attraction_id).order_by(Review.created_at.desc()).all()
    reviews_data = [review.to_json() for review in reviews]
    # 3. Gói gọn và trả về JSON
    response_data = {
        "attraction": attraction_data,
        "reviews": reviews_data
    }
    response_data = jsonify(response_data)

    return render_template('detail_attraction.html', response_data)

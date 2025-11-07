from flask import Blueprint, render_template, request
from models import db
import folium

service_bp = Blueprint('service', __name__, url_prefix='/service')

@service_bp.route('/')
def service():
    default_coords = (10.7769, 106.7009) # Tọa đồ mặc định là tp.HCM

    try: # Lấy thử tọa độ tham số
        lat = float(request.args.get('lat', default_coords[0]))
        lon = float(request.args.get('lon', default_coords[1]))
        user_coords = (lat, lon)
    except: # Nếu tham số không hợp lệ, lấy tọa độ mặc định
        user_coords = default_coords

    # Tạo bản đồ với tọa độ 
    m = folium.Map(location=user_coords, zoom_start=15)
    # Thêm điểm đánh dấu vào vị trí đó
    folium.Marker(user_coords, popup="<i>Vị trí của bạn<i>", tooltip="Bạn đang ở đây").add_to(m)

    # Chuyển bản đồ thành mã HTML
    map_html = m._repr_html_()

    return render_template('service.html', map_html=map_html)
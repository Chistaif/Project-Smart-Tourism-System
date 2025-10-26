from flask import Flask, render_template, request
from models import db  
from init_db import import_demo_data
import folium

# Khởi tạo ứng dụng app
def create_app():
    app = Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///demo.db'

    db.init_app(app=app)

    with app.app_context():
        db.create_all()
        from models import Festival
        if Festival.query.count() == 0:
                import_demo_data()

    return app

app = create_app()

# === Định nghĩa các Routes ===

# Route cho trang chủ
@app.route('/')
def home():
    # Trả về templates\home.html
    return render_template('home.html')

# Route cho trang dịch vụ
@app.route('/service')
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

# Route cho trang người dùng 
@app.route('/user')
def user():
    return render_template('user.html')

# Route cho trang cài đặt
@app.route('/setting')
def setting():
    return render_template('setting.html')

if __name__ == '__main__':
    app.run(debug=True)
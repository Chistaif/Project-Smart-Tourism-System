from models import db, SavedTour, Attraction
import pandas as pd        
import requests   
import polyline
import numpy as np
from sklearn.cluster import KMeans

def generate_suggestion_service(data):
    num_days = int(data.get("num_days", 3))
    if num_days <= 0:
        raise ValueError("Số ngày ('num_days') phải lớn hơn 0")
    
    ids = data.getlist("ids")
    return


"""
    Trả về khoảng cách di chuyển (m) và thời gian (giây) 
    giữa 2 điểm dựa trên OSRM (OpenStreetMap Routing).
    
    mode: driving | walking | cycling
    """
def osrm_distance(lat1, lon1, lat2, lon2, mode="driving"):
    osrm_url = (
        f"http://router.project-osrm.org/route/v1/{mode}/"
        f"{lon1},{lat1};{lon2},{lat2}"
        f"?overview=false"

    )

    try:
        response = requests.get(osrm_url, timeout=5)
        data = response.json()

        # Kiểm tra lỗi từ OSRM
        if data.get("code") != "Ok":
            return {"error": "OSRM routing failed", "raw": data}

        route = data["routes"][0]

        distance_m = route["distance"]          # mét
        duration_s = route["duration"]          # giây

        return {
            "distance_m": distance_m,
            "distance_km": round(distance_m / 1000, 2),
            "duration_s": duration_s,
            "duration_min": round(duration_s / 60, 1)
        }

    except Exception as e:
        return {"error": str(e)}

# def generate_itinerary():
#     # 1. Lấy dữ liệu từ Frontend
#     data = request.json
#     ids = data.get('ids', []) # ví dụ: [3, 1, 4]
#     travel_mode = data.get('mode', 'driving') # 'driving', 'walking',...
    
#     if len(ids) < 2:
#         return jsonify({"error": "Cần ít nhất 2 điểm đến"}), 400

#     # 2. Lấy tọa độ từ CSDL
#     # Dùng .in_() để lấy tất cả ID, nhưng giữ đúng thứ tự
#     attractions = Attraction.query.filter(Attraction.id.in_(ids)).all()
#     # Sắp xếp lại danh sách attractions theo đúng thứ tự ID mà user gửi lên
#     attractions_dict = {a.id: a for a in attractions}
#     sorted_attractions = [attractions_dict[id] for id in ids if id in attractions_dict]

#     if len(sorted_attractions) < 2:
#         return jsonify({"error": "Không tìm thấy các điểm đến"}), 404

#     # 3. Chuẩn bị tọa độ cho Google API
#     # Điểm đầu tiên là origin
#     origin = sorted_attractions[0]
#     origin_coords = (origin.lat, origin.lon)
    
#     # Điểm cuối cùng là destination
#     destination = sorted_attractions[-1]
#     destination_coords = (destination.lat, destination.lon)
    
#     # Các điểm ở giữa là waypoints
#     waypoints = sorted_attractions[1:-1]
#     waypoints_coords = [(wp.lat, wp.lon) for wp in waypoints]

#     # 4. Gọi Google API để lấy tuyến đường
#     encoded_polyline, total_duration = get_google_directions(
#         origin_coords, 
#         destination_coords, 
#         waypoints_coords, 
#         travel_mode
#     )

#     # 5. Tạo bản đồ Folium
#     m = folium.Map(location=origin_coords, zoom_start=13, tiles="CartoDB positron")
    
#     # Thêm Marker cho tất cả các điểm
#     for i, att in enumerate(sorted_attractions):
#         folium.Marker(
#             location=(att.lat, att.lon),
#             popup=f"<b>Điểm {i+1}: {att.name}</b><br>Ước tính tham quan: {att.visit_duration} phút",
#             tooltip=att.name
#         ).add_to(m)

#     # 6. Vẽ tuyến đường (PolyLine) lên bản đồ
#     if encoded_polyline:
#         # Giải mã polyline (chuỗi string) thành danh sách tọa độ (lat, lon)
#         decoded_polyline_coords = polyline.decode(encoded_polyline)
        
#         folium.PolyLine(
#             locations=decoded_polyline_coords,
#             color="blue",
#             weight=5,
#             opacity=0.7
#         ).add_to(m)
        
#         # Tự động zoom bản đồ cho vừa với tuyến đường
#         m.fit_bounds(m.get_bounds())

#     # 7. Tạo lịch trình (logic đơn giản)
#     itinerary_steps = []
#     current_time = datetime.now().replace(hour=8, minute=0, second=0) # Giả sử bắt đầu lúc 8:00
    
#     for att in sorted_attractions:
#         itinerary_steps.append(f"{current_time.strftime('%H:%M')}: Bắt đầu tham quan <b>{att.name}</b>")
#         # Giả sử thời gian tham quan (đã có trong CSDL)
#         visit_duration_min = att.visit_duration or 60 
#         current_time += timedelta(minutes=visit_duration_min) # Thêm thời gian tham quan
#         itinerary_steps.append(f"{current_time.strftime('%H:%M')}: Kết thúc tham quan")
        
#         # (Logic phức tạp hơn sẽ thêm thời gian di chuyển giữa các điểm)
    
#     # 8. Trả về kết quả
#     total_duration_hours = total_duration / 3600 # Đổi giây sang giờ

#     return jsonify({
#         "map_html": m._repr_html_(),
#         "itinerary_steps_html": "<br>".join(itinerary_steps),
#         "total_travel_time_str": f"Tổng thời gian di chuyển: {total_duration_hours:.1f} giờ"
#     })
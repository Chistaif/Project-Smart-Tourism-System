# from models import db, SavedTour, Attraction
# import pandas as pd        
# import requests   
# import polyline
# import numpy as np
# from sklearn.cluster import KMeans
# from geopy.distance import geodesic
# from datetime import datetime, timedelta


import requests
import folium
import re
from datetime import datetime, timedelta
from geopy.distance import geodesic
from models import Attraction, Festival, CulturalSpot

# --- CẤU HÌNH ---
LUNCH_START_HOUR = 11       # Bắt đầu giờ ăn trưa
LUNCH_END_HOUR = 13         # Kết thúc khung giờ được phép chèn ăn trưa
LUNCH_DURATION_MIN = 60     # Thời gian ăn trưa (phút)

DINNER_START_HOUR = 18      # Bắt đầu giờ ăn tối (MỚI)
DINNER_END_HOUR = 20        # Kết thúc khung giờ ăn tối (MỚI)
DINNER_DURATION_MIN = 60    # Thời gian ăn tối (phút) (MỚI)

SLEEP_START_HOUR = 22       # Giờ ngủ (MỚI)
WAKE_UP_HOUR = 6           # Giờ thức dậy (MỚI)

FALLBACK_SPEED_KMH = 30

def get_routing_info(coord_start, coord_end, vehicle='car'):
    """
    Lấy thông tin di chuyển thực tế từ OSRM.
    Input: tuple (lat, lon)
    Output: (distance_km, duration_minutes, polyline_geometry)
    """
    # OSRM yêu cầu format: lon,lat
    start_str = f"{coord_start[1]},{coord_start[0]}"
    end_str = f"{coord_end[1]},{coord_end[0]}"
    
    # Mode: 'driving' (lái xe), 'foot' (đi bộ)
    url = f"http://router.project-osrm.org/route/v1/driving/{start_str};{end_str}?overview=full&geometries=geojson"
    
    try:
        response = requests.get(url, timeout=3) # Timeout 3s
        data = response.json()
        
        if data.get("code") == "Ok":
            route = data["routes"][0]
            duration_min = round(route["duration"] / 60)
            distance_km = round(route["distance"] / 1000, 2)
            geometry = route["geometry"] # GeoJSON lineString
            return distance_km, duration_min, geometry
            
    except Exception as e:
        print(f"[OSRM Error] {e}. Using fallback calculation.")
    
    # --- FALLBACK (Nếu OSRM lỗi) ---
    dist = geodesic(coord_start, coord_end).km
    speed = 5 if dist < 1 else FALLBACK_SPEED_KMH
    duration = round((dist / speed) * 60) + 5 # Cộng 5p thời gian dây thun
    return round(dist, 2), duration, None

def parse_opening_hours(open_str):
    """
    Parse chuỗi giờ mở cửa (VD: "08:00 - 17:00") thành float (8.0, 17.0).
    """
    if not open_str: return None
    try:
        # Regex tìm giờ:phút AM/PM
        times = re.findall(r'(\d{1,2}):?(\d{2})?\s*(AM|PM)?', open_str, re.IGNORECASE)
        if len(times) >= 2:
            def to_24h(h, m, ampm):
                h = int(h)
                if ampm:
                    if ampm.upper() == 'PM' and h != 12: h += 12
                    if ampm.upper() == 'AM' and h == 12: h = 0
                return h + (int(m)/60 if m else 0)

            start = to_24h(*times[0])
            end = to_24h(*times[1])
            return start, end
    except:
        pass
    return None

def is_attraction_available(attraction, current_time):
    """
    Kiểm tra xem địa điểm có mở cửa/hoạt động vào thời điểm này không.
    """
    # 1. Check Festival (Ngày diễn ra)
    if attraction.type == 'festival':
        fes = Festival.query.get(attraction.id)
        if fes and fes.time_start and fes.time_end:
            if not (fes.time_start <= current_time <= fes.time_end):
                return False, f"Chưa diễn ra hoặc đã kết thúc ({fes.time_start.strftime('%d/%m')} - {fes.time_end.strftime('%d/%m')})"

    # 2. Check CulturalSpot (Giờ mở cửa trong ngày)
    elif attraction.type == 'cultural_spot':
        spot = CulturalSpot.query.get(attraction.id)
        if spot and spot.opening_hours:
            hours = parse_opening_hours(spot.opening_hours)
            if hours:
                start_h, end_h = hours
                curr_h = current_time.hour + current_time.minute/60
                # Logic đơn giản: Nếu đến quá sớm hoặc quá muộn
                if not (start_h <= curr_h <= end_h):
                    return False, f"Đóng cửa (Giờ mở: {spot.opening_hours})"
    
    return True, ""

def generate_smart_tour(attraction_ids, start_lat, start_lon, start_datetime_str, end_datetime_str):
    """
    Hàm chính để tạo lịch trình nhiều ngày.
    """
    # 1. Parse thời gian bắt đầu và kết thúc
    try:
        current_time = datetime.strptime(start_datetime_str, "%d/%m/%Y %H:%M")
        end_time = datetime.strptime(end_datetime_str, "%d/%m/%Y %H:%M")
    except ValueError:
        current_time = datetime.now()
        end_time = current_time + timedelta(days=1)

    # 2. Lấy dữ liệu & Lọc (Validate)
    raw_attractions = Attraction.query.filter(Attraction.id.in_(attraction_ids)).all()
    valid_attractions = []
    invalid_attractions = [] 

    for attr in raw_attractions:
        is_avail, reason = is_attraction_available(attr, current_time)
        if is_avail:
            valid_attractions.append(attr)
        else:
            invalid_attractions.append({
                "id": attr.id,
                "name": attr.name,
                "reason": reason
            })

    if not valid_attractions:
        return {
            "timeline": [],
            "mapHtml": "",
            "invalidAttractions": invalid_attractions,
            "finishTime": current_time.strftime("%H:%M"),
            "totalDestinations": 0,
            "totalDays": 0
        }

    # 3. Phân chia attractions theo ngày
    days = []
    current_day_start = current_time
    day_index = 1
    
    # Chia attractions thành các nhóm theo ngày
    attractions_per_day = []
    
    # Tính số ngày có thể
    total_days = (end_time.date() - current_time.date()).days + 1
    if total_days <= 0:
        total_days = 1
    
    # Phân bổ attractions đều cho các ngày
    attractions_copy = valid_attractions.copy()
    base_per_day = len(attractions_copy) // total_days
    extra = len(attractions_copy) % total_days
    
    start_idx = 0
    for day in range(total_days):
        day_count = base_per_day + (1 if day < extra else 0)
        day_attractions = attractions_copy[start_idx:start_idx + day_count]
        attractions_per_day.append(day_attractions)
        start_idx += day_count

    # 4. Xử lý từng ngày
    all_timeline = []
    all_route_geometries = []
    curr_loc = (start_lat, start_lon)
    
    for day_idx, day_attractions in enumerate(attractions_per_day):
        if not day_attractions:
            continue
            
        day_timeline = []
        day_route_geometries = []
        
        # Reset daily flags
        has_had_lunch = False
        has_had_dinner = False
        
        # Sự kiện: Bắt đầu ngày (chỉ ngày đầu tiên)
        if day_idx == 0:
            day_timeline.append({
                "day": day_idx + 1,
                "date": current_time.strftime("%d/%m/%Y"),
                "time": current_time.strftime("%H:%M"),
                "type": "START",
                "name": "Điểm xuất phát",
                "detail": "Bắt đầu hành trình"
            })
        
        # Sự kiện: Thức dậy (các ngày sau)
        else:
            wake_up_time = current_time.replace(hour=WAKE_UP_HOUR, minute=0)
            day_timeline.append({
                "day": day_idx + 1,
                "date": current_time.strftime("%d/%m/%Y"),
                "time": wake_up_time.strftime("%H:%M"),
                "type": "WAKE_UP",
                "name": "Thức dậy",
                "detail": f"Bắt đầu ngày {day_idx + 1}"
            })
            current_time = wake_up_time

        unvisited = day_attractions.copy()
        
        while unvisited:
            # --- LOGIC ĂN TRƯA ---
            if not has_had_lunch and LUNCH_START_HOUR <= current_time.hour < LUNCH_END_HOUR:
                lunch_end = current_time + timedelta(minutes=LUNCH_DURATION_MIN)
                # Check không vượt quá giờ ngủ
                if lunch_end.hour >= SLEEP_START_HOUR:
                    break
                    
                day_timeline.append({
                    "day": day_idx + 1,
                    "date": current_time.strftime("%d/%m/%Y"),
                    "time": current_time.strftime("%H:%M"),
                    "type": "LUNCH",
                    "name": "Nghỉ ăn trưa",
                    "detail": "Tự do thưởng thức ẩm thực địa phương",
                    "duration": LUNCH_DURATION_MIN,
                    "endTime": lunch_end.strftime("%H:%M")
                })
                current_time = lunch_end
                has_had_lunch = True
                continue

            # --- LOGIC ĂN TỐI ---
            if not has_had_dinner and DINNER_START_HOUR <= current_time.hour < DINNER_END_HOUR:
                dinner_end = current_time + timedelta(minutes=DINNER_DURATION_MIN)
                # Check không vượt quá giờ ngủ
                if dinner_end.hour >= SLEEP_START_HOUR:
                    break
                    
                day_timeline.append({
                    "day": day_idx + 1,
                    "date": current_time.strftime("%d/%m/%Y"),
                    "time": current_time.strftime("%H:%M"),
                    "type": "DINNER",
                    "name": "Nghỉ ăn tối",
                    "detail": "Tự do thưởng thức ẩm thực địa phương",
                    "duration": DINNER_DURATION_MIN,
                    "endTime": dinner_end.strftime("%H:%M")
                })
                current_time = dinner_end
                has_had_dinner = True
                continue

            # Check nếu quá giờ ngủ thì dừng
            if current_time.hour >= SLEEP_START_HOUR:
                break

            # --- TÌM ĐIỂM TIẾP THEO ---
            nearest = min(unvisited, key=lambda x: geodesic(curr_loc, (x.lat, x.lon)).km)
            
            # Tính thời gian di chuyển
            dist_km, travel_minutes, geometry = get_routing_info(curr_loc, (nearest.lat, nearest.lon))
            
            arrival_time = current_time + timedelta(minutes=travel_minutes)
            
            # Check nếu đến nơi quá giờ ngủ thì dừng
            if arrival_time.hour >= SLEEP_START_HOUR:
                break
            
            # Thêm sự kiện: Di chuyển
            day_timeline.append({
                "day": day_idx + 1,
                "date": current_time.strftime("%d/%m/%Y"),
                "time": current_time.strftime("%H:%M"),
                "type": "TRAVEL",
                "name": f"Di chuyển đến {nearest.name}",
                "detail": f"Quãng đường: {dist_km}km ({travel_minutes} phút)",
                "duration": travel_minutes
            })

            # Lưu đường đi
            if geometry:
                path = [[p[1], p[0]] for p in geometry['coordinates']]
                day_route_geometries.append(path)
            else:
                day_route_geometries.append([curr_loc, (nearest.lat, nearest.lon)])

            # --- THAM QUAN ---
            visit_min = nearest.visit_duration if nearest.visit_duration else 60
            departure_time = arrival_time + timedelta(minutes=visit_min)
            
            # Check nếu tham quan xong quá giờ ngủ thì dừng
            if departure_time.hour >= SLEEP_START_HOUR:
                break
            
            # Check availability tại thời điểm đến
            is_open, status = is_attraction_available(nearest, arrival_time)
            note = "" if is_open else f"(LƯU Ý: {status})"

            day_timeline.append({
                "day": day_idx + 1,
                "date": arrival_time.strftime("%d/%m/%Y"),
                "time": arrival_time.strftime("%H:%M"),
                "type": "VISIT",
                "id": nearest.id,
                "name": nearest.name,
                "detail": f"Tham quan, chụp ảnh. {note}",
                "duration": visit_min,
                "endTime": departure_time.strftime("%H:%M"),
                "lat": nearest.lat,
                "lon": nearest.lon,
                "imageUrl": nearest.image_url
            })

            # Cập nhật trạng thái
            current_time = departure_time
            curr_loc = (nearest.lat, nearest.lon)
            unvisited.remove(nearest)

        # Thêm sự kiện ngủ nghỉ
        sleep_time = current_time.replace(hour=SLEEP_START_HOUR, minute=0) if current_time.hour < SLEEP_START_HOUR else current_time
        day_timeline.append({
            "day": day_idx + 1,
            "date": current_time.strftime("%d/%m/%Y"),
            "time": sleep_time.strftime("%H:%M"),
            "type": "SLEEP",
            "name": "Nghỉ ngơi",
            "detail": "Kết thúc ngày, chuẩn bị cho ngày mai"
        })
        
        # Cập nhật cho ngày tiếp theo
        current_time = sleep_time + timedelta(days=1)
        current_time = current_time.replace(hour=WAKE_UP_HOUR, minute=0)
        
        # Thêm vào timeline chung
        all_timeline.extend(day_timeline)
        all_route_geometries.extend(day_route_geometries)

    # 5. Tạo Map HTML
    m = folium.Map(location=[start_lat, start_lon], zoom_start=14)
    
    # Marker Start
    folium.Marker(
        [start_lat, start_lon], 
        popup="Start Point", 
        icon=folium.Icon(color='green', icon='play')
    ).add_to(m)

    # Vẽ đường đi
    for path in all_route_geometries:
        folium.PolyLine(path, color="#3388ff", weight=4, opacity=0.8).add_to(m)

    # Marker các điểm đến
    visit_points = [t for t in all_timeline if t['type'] == 'VISIT']
    for idx, p in enumerate(visit_points):
        folium.Marker(
            [p['lat'], p['lon']],
            popup=f"<b>{idx+1}. {p['name']}</b><br>Ngày {p['day']}: {p['time']}",
            icon=folium.Icon(color='red', icon='camera')
        ).add_to(m)

    map_html = m._repr_html_()

    return {
        "timeline": all_timeline,
        "mapHtml": map_html,
        "invalidAttractions": invalid_attractions,
        "finishTime": current_time.strftime("%H:%M"),
        "totalDestinations": len(visit_points),
        "totalDays": len(attractions_per_day)
    }


import requests
import folium
import re
from datetime import datetime, timedelta
from geopy.distance import geodesic
from models import Attraction, Festival, CulturalSpot
import numpy as np
from sklearn.mixture import GaussianMixture
from dotenv import load_dotenv
import os

load_dotenv()
GRAPHHOPPER_API_KEY = os.getenv('GRAPHHOPPER_API_KEY')

# --- CẤU HÌNH ---
BREAKFAST_START_HOUR = 6       # Bắt đầu khung giờ ăn sáng
BREAKFAST_END_HOUR = 7.30      # Kết thúc khung giờ cho phép bắt đầu ăn sáng
BREAKFAST_DURATION_MIN = 60    # Thời gian ăn sáng 

LUNCH_START_HOUR = 11          # Bắt đầu giờ ăn trưa
LUNCH_END_HOUR = 13            # Kết thúc khung giờ được phép chèn ăn trưa
LUNCH_DURATION_MIN = 60        # Thời gian ăn trưa 

DINNER_START_HOUR = 18         # Bắt đầu giờ ăn tối 
DINNER_END_HOUR = 20           # Kết thúc khung giờ ăn tối 
DINNER_DURATION_MIN = 60       # Thời gian ăn tối 

SLEEP_START_HOUR = 22          # Giờ ngủ 
WAKE_UP_HOUR = 6               # Giờ thức dậy 

FALLBACK_SPEED_KMH = 30        # Đặt tốc độ tb khi di chuyển

def get_routing_info(coord_start, coord_end, vehicle='car'):
    """
    Lấy thông tin di chuyển từ GraphHopper Local Server.
    Input: tuple (lat, lon)
    Output: (distance_km, duration_minutes, polyline_geometry)
    """
    # GraphHopper Local Server endpoint
    base_url = "http://localhost:8989/route"

    # Parameters cho GraphHopper Local Server (GET request)
    params = {
        'point': [f"{coord_start[0]},{coord_start[1]}", f"{coord_end[0]},{coord_end[1]}"],
        'profile': vehicle,
        'locale': 'vi',
        'instructions': 'false',  # Không cần instructions để giảm response size
        'points_encoded': 'false',
        'calc_points': 'true',
        'type': 'json'
    }

    try:
        response = requests.get(base_url, params=params, timeout=15)
        data = response.json()

        if response.status_code == 200 and 'paths' in data and len(data['paths']) > 0:
            path = data['paths'][0]

            # GraphHopper trả về distance (m) và time (ms)
            distance_km = round(path['distance'] / 1000, 2)
            duration_min = round(path['time'] / (1000 * 60))  # Convert ms to minutes

            # Convert points to GeoJSON format
            geometry = None
            if 'points' in path and path['points']['coordinates']:
                # GraphHopper trả về [[lon, lat], [lon, lat], ...]
                coordinates = path['points']['coordinates']
                geometry = {
                    'type': 'LineString',
                    'coordinates': coordinates
                }

            print(f"[GraphHopper Local] Distance: {distance_km}km, Duration: {duration_min}min")
            return distance_km, duration_min, geometry

        else:
            print(f"[GraphHopper Error] Status: {response.status_code}, Message: {data.get('message', 'Unknown error')}")

    except requests.exceptions.ConnectionError:
        print(f"[GraphHopper Failed] Cannot connect to local server at {base_url}. Make sure GraphHopper is running.")
        print("  To start GraphHopper: java -jar graphhopper-web-*.jar server config.yml")
    except requests.exceptions.Timeout:
        print(f"[GraphHopper Failed] Request timeout after 15s")
    except Exception as e:
        print(f"[GraphHopper Failed] {e}")

    # --- FALLBACK: Geodesic calculation ---
    print(f"[GraphHopper Fallback] Using geodesic calculation for {coord_start} -> {coord_end}")
    dist = geodesic(coord_start, coord_end).km

    # Intelligent speed calculation
    if dist < 1:      # Trong vòng 1km
        speed = 5     # Đi bộ
    elif dist < 5:    # 1-5km
        speed = 15    # Xe máy/thành phố
    elif dist < 20:   # 5-20km
        speed = 25    # Đường quốc lộ
    else:             # >20km
        speed = FALLBACK_SPEED_KMH  # Cao tốc

    duration = round((dist / speed) * 60)

    # Create simple geometry (straight line)
    geometry = {
        'type': 'LineString',
        'coordinates': [
            [coord_start[1], coord_start[0]],  # [lon, lat]
            [coord_end[1], coord_end[0]]       # [lon, lat]
        ]
    }

    return round(dist, 2), duration, geometry


def parse_opening_hours(open_str):
    """
    Parse chuỗi giờ mở cửa (VD: "08:00 - 17:00") thành float (8.0, 17.0).
    """
    if not open_str: 
        return None
    try:
        # Regex tìm giờ:phút AM/PM
        times = re.findall(r'(\d{1,2}):?(\d{2})?\s*(AM|PM)?', open_str, re.IGNORECASE)
        if len(times) >= 2:
            def to_24h(h, m, ampm):
                h = int(h)
                if ampm:
                    if ampm.upper() == 'PM' and h != 12: 
                        h += 12
                    if ampm.upper() == 'AM' and h == 12: 
                        h = 0
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
            # Với festival diễn ra hàng năm, cần kiểm tra trong năm hiện tại
            current_year = current_time.year
            
            # Tạo khoảng thời gian diễn ra cho năm hiện tại
            festival_start = fes.time_start.replace(year=current_year)
            festival_end = fes.time_end.replace(year=current_year)
            
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

def calculate_time_balance_score(model, attractions, num_days):
    """
    Đánh giá xem việc chia nhóm hiện tại có công bằng về mặt thời gian giữa các ngày không
    """
    labels = model.predict([[
        a.lat/180, a.lon/180, 
        a.visit_duration/240, 
        30/120,  # Giả sử travel time trung bình
        0.5
    ] for a in attractions])
    
    # Tính thời gian ước tính cho mỗi cụm
    cluster_times = {}
    for i, label in enumerate(labels):
        if label not in cluster_times:
            cluster_times[label] = 0
        cluster_times[label] += attractions[i].visit_duration + 30 
    
    # Tính variance của thời gian
    times = list(cluster_times.values())
    if len(times) <= 1:
        return float('inf')
        
    mean_time = sum(times) / len(times)
    variance = sum((t - mean_time)**2 for t in times) / len(times)
    
    return variance  # Thấp = cân bằng tốt

def calculate_opening_score(attraction, current_time):
    """
    Tính điểm phù hợp dựa trên giờ mở cửa (0 - 1 đ)
    """
    if not hasattr(attraction, 'opening_hours'):
        return 0.5  # trung lập
    
    try:
        hours = parse_opening_hours(attraction.opening_hours)
        if not hours:
            return 0.5
            
        start_h, end_h = hours
        current_h = current_time.hour + current_time.minute/60
        
        # Tính khoảng cách đến khung giờ mở cửa
        if current_h < start_h:
            distance = start_h - current_h
        elif current_h > end_h:
            distance = current_h - end_h
        else:
            return 1.0  # Đang mở cửa
        
        return max(0, 1 - distance/12)  # 12 tiếng là max distance
        
    except:
        return 0.5

def redistribute_clusters_by_time(labels, attractions, num_days, start_location):
    """
    Post-processing để cân bằng thời gian giữa các ngày
    """
    # Gom nhóm theo labels
    clusters = {}
    for idx, label in enumerate(labels):
        if label not in clusters:
            clusters[label] = []
        clusters[label].append(attractions[idx])
    
    # Tính thời gian cho mỗi cụm
    cluster_times = {}
    for label, items in clusters.items():
        total_time = 0
        for attr in items:
            # Tính thời gian di chuyển + tham quan
            dist, travel, _ = get_routing_info(start_location, (attr.lat, attr.lon))
            total_time += travel + attr.visit_duration
        cluster_times[label] = total_time
    
    # Sort theo thời gian (ngày ngắn nhất trước)
    sorted_clusters = sorted(clusters.items(), key=lambda x: cluster_times[x[0]])
    
    # Đảm bảo đủ num_days cụm
    result = []
    for label, items in sorted_clusters[:num_days]:
        result.append(items)
    
    # Nếu thiếu cụm, tạo cụm rỗng
    while len(result) < num_days:
        result.append([])
    
    return result

def cluster_attractions_by_time_and_space(attractions, num_days, start_location, start_time):
    """
    Chia điểm đến thành các cụm bằng Gaussian Mixture Models
    """
    if not attractions:
        return []
        
    # 1. Tính feature vectors với yếu tố thời gian + không gian 
    features = []
    for attr in attractions:
        # Tính thời gian di chuyển từ start
        dist_km, travel_min, _ = get_routing_info(start_location, (attr.lat, attr.lon))
        
        # Feature vector
        feature = [
            attr.lat / 180.0,                    # Vị trí (normalized)
            attr.lon / 180.0,                    # Vị trí (normalized) 
            attr.visit_duration / 240.0,         # Thời gian tham quan (normalized to hours)
            travel_min / 120.0,                  # Thời gian di chuyển (normalized)
            calculate_opening_score(attr, start_time),  # Điểm phù hợp giờ mở cửa
        ]
        features.append(feature)
    
    
    # Thử nghiệm với số cụm khác nhau 
    best_model = None
    best_score = float('inf')
    
    for n_clusters in range(max(1, num_days-1), num_days+2):
        gmm = GaussianMixture(n_components=n_clusters, random_state=42)
        gmm.fit(features)
        
        # Tính score dựa trên time balance
        score = calculate_time_balance_score(gmm, attractions, num_days)
        if score < best_score:
            best_score = score
            best_model = gmm
    
    # 3. Phân cụm và tối ưu
    labels = best_model.predict(features)
    
    # 4. Post-processing: Balance thời gian giữa các ngày
    clusters = redistribute_clusters_by_time(labels, attractions, num_days, start_location)
    
    return clusters


def generate_smart_tour(attraction_ids, start_lat, start_lon, start_datetime_str, end_datetime_str):
    """
    Hàm chính tạo lịch trình. Giới thiệu logic ngắn gọn:
    1: Lọc các điểm đến phù hợp với thời gian user đưa
    2: Tính số ngày và chia điểm đến thành các nhóm
    3: Lập tour chi tiết (áp dụng thuật toán tham lam), trong mỗi ngày:
        - Chọn điểm gần nhất từ vị trí hiện tại
        - Tính routing time + visit time
        - Chèn meal breaks khi cần thiết
        - Cập nhật timeline và vị trí
        - Chèn các điểm đến dư qua ngày hôm sau (nếu có)
    4: Vẽ bản đồ tĩnh bằng folium 
    """
    # Parse thời gian
    try:
        current_time = datetime.strptime(start_datetime_str, "%d/%m/%Y %H:%M")
        end_time = datetime.strptime(end_datetime_str, "%d/%m/%Y %H:%M")
    except ValueError:
        current_time = datetime.now()
        end_time = current_time + timedelta(days=1)

    # 1. Lấy dữ liệu & Validate
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
    
    # 2. Tính số ngày
    total_days = (end_time.date() - current_time.date()).days + 1
    if total_days <= 0:
        total_days = 1
    
    # Chia địa điểm thành các nhóm cho từng ngày
    attractions_per_day = cluster_attractions_by_time_and_space(
        valid_attractions, 
        total_days, 
        (start_lat, start_lon), 
        current_time
    )
    
    total_days = len(attractions_per_day)

    # 3. Xử lý từng ngày (Routing chi tiết)
    all_timeline = []
    all_route_geometries = []
    
    # Vị trí cuối cùng của ngày hôm trước = điểm bắt đầu ngày hôm sau
    curr_loc = (start_lat, start_lon) 
    daily_routes_map = {}

    # Danh sách điểm dư từ ngày trước
    remaining_points = []
    
    for day_idx, day_attractions in enumerate(attractions_per_day):
        # Kết hợp điểm dư + điểm mới
        current_day_points = remaining_points + day_attractions
        remaining_points = []  # Reset cho ngày mới

        if not current_day_points:
            continue
            
        day_timeline = []
        day_route_geometries = []
        
        has_breakfast = False
        has_lunch = False
        has_dinner = False
        
        # [EVENT START/WAKE UP]
        if day_idx == 0:
            day_timeline.append({
                "day": day_idx + 1,
                "date": current_time.strftime("%d/%m/%Y"),
                "time": current_time.strftime("%H:%M"),
                "type": "START",
                "name": "Điểm xuất phát",
                "detail": "Bắt đầu hành trình"
            })
        else:
            # Ngày mới bắt đầu lúc 6:00 + cập nhật lại thời gian hiện tại
            next_day_morning = current_time.replace(hour=WAKE_UP_HOUR, minute=0)
            if next_day_morning < current_time: 
                next_day_morning += timedelta(days=1)
            current_time = next_day_morning
            
            day_timeline.append({
                "day": day_idx + 1,
                "date": current_time.strftime("%d/%m/%Y"),
                "time": current_time.strftime("%H:%M"),
                "type": "WAKE_UP",
                "name": "Thức dậy",
                "detail": f"Bắt đầu ngày {day_idx + 1}"
            })

        # Logic Routing "Nearest Neighbor" trong nội bộ ngày 
        unvisited = current_day_points.copy()
        
        while unvisited:
            # === LOGIC ĂN SÁNG ===
            if not has_breakfast and BREAKFAST_START_HOUR <= current_time.hour < BREAKFAST_END_HOUR:
                breakfast_end = current_time + timedelta(minutes=BREAKFAST_DURATION_MIN)
                
                day_timeline.append({
                    "day": day_idx + 1,
                    "date": current_time.strftime("%d/%m/%Y"),
                    "time": current_time.strftime("%H:%M"),
                    "type": "BREAKFAST", 
                    "name": "Ăn sáng",
                    "detail": "Nạp năng lượng cho ngày mới",
                    "duration": BREAKFAST_DURATION_MIN,
                    "endTime": breakfast_end.strftime("%H:%M")
                })
                current_time = breakfast_end
                has_breakfast = True
                continue

            # === LOGIC ĂN TRƯA ===
            if not has_lunch and LUNCH_START_HOUR <= current_time.hour < LUNCH_END_HOUR:
                lunch_end = current_time + timedelta(minutes=LUNCH_DURATION_MIN)
                day_timeline.append({
                    "day": day_idx + 1, "date": current_time.strftime("%d/%m/%Y"),
                    "time": current_time.strftime("%H:%M"), "type": "LUNCH",
                    "name": "Nghỉ ăn trưa", "duration": LUNCH_DURATION_MIN
                })
                current_time = lunch_end
                has_lunch = True
                continue

            # === LOGIC ĂN TỐI ===
            if not has_dinner and DINNER_START_HOUR <= current_time.hour < DINNER_END_HOUR:
                dinner_end = current_time + timedelta(minutes=DINNER_DURATION_MIN)
                day_timeline.append({
                    "day": day_idx + 1, "date": current_time.strftime("%d/%m/%Y"),
                    "time": current_time.strftime("%H:%M"), "type": "DINNER",
                    "name": "Nghỉ ăn tối", "duration": DINNER_DURATION_MIN
                })
                current_time = dinner_end
                has_dinner = True
                continue

            if current_time.hour >= SLEEP_START_HOUR:
                remaining_points = unvisited.copy()
                print(f"[REMAINING] Ngày {day_idx + 1}: {len(remaining_points)} điểm chưa đi được")
                break

            # --- TÌM ĐIỂM TIẾP THEO (Nearest Neighbor) ---
            # Tìm điểm gần nhất trong cụm hiện tại
            nearest = min(unvisited, key=lambda x: geodesic(curr_loc, (x.lat, x.lon)).km)
            
            dist_km, travel_minutes, geometry = get_routing_info(curr_loc, (nearest.lat, nearest.lon))
            arrival_time = current_time + timedelta(minutes=travel_minutes)
            
            if arrival_time.hour >= SLEEP_START_HOUR:
                remaining_points = unvisited.copy()
                print(f"[REMAINING] Ngày {day_idx + 1}: {len(remaining_points)} điểm chưa đi được")
                break
            
            day_timeline.append({
                "day": day_idx + 1,
                "date": current_time.strftime("%d/%m/%Y"),
                "time": current_time.strftime("%H:%M"),
                "type": "TRAVEL",
                "name": f"Di chuyển đến {nearest.name}",
                "detail": f"Quãng đường: {dist_km}km ({travel_minutes} phút)",
                "duration": travel_minutes
            })

            if geometry:
                path = [[p[1], p[0]] for p in geometry['coordinates']]
                day_route_geometries.append(path)
            else:
                day_route_geometries.append([curr_loc, (nearest.lat, nearest.lon)])

            # Tham quan
            visit_min = nearest.visit_duration if nearest.visit_duration else 60
            departure_time = arrival_time + timedelta(minutes=visit_min)
            
            if departure_time.hour >= SLEEP_START_HOUR:
                remaining_points = unvisited.copy()
                print(f"[REMAINING] Ngày {day_idx + 1}: {len(remaining_points)} điểm chưa đi được")
                break
            
            is_open, status = is_attraction_available(nearest, arrival_time)

            day_timeline.append({
                "day": day_idx + 1,
                "date": arrival_time.strftime("%d/%m/%Y"),
                "time": arrival_time.strftime("%H:%M"),
                "type": "VISIT",
                "id": nearest.id,
                "name": nearest.name,
                "detail": f"Tham quan. Lưu ý: {status}",
                "duration": visit_min,
                "lat": nearest.lat, "lon": nearest.lon,
                "imageUrl": nearest.image_url
            })

            current_time = departure_time
            curr_loc = (nearest.lat, nearest.lon)
            unvisited.remove(nearest)

        # Kết thúc ngày, auto cho user nghỉ ngơi khi ko còn điểm đến phù hợp trong ngày
        sleep_time = current_time
        if current_time.hour < SLEEP_START_HOUR:
            sleep_time = current_time.replace(hour=SLEEP_START_HOUR, minute=0)
             
        day_timeline.append({
            "day": day_idx + 1,
            "date": current_time.strftime("%d/%m/%Y"),
            "time": sleep_time.strftime("%H:%M"),
            "type": "SLEEP",
            "name": "Nghỉ ngơi",
            "detail": "Kết thúc ngày"
        })
        
        # Cập nhật cho ngày tiếp theo
        current_time = sleep_time + timedelta(days=1)
        current_time = current_time.replace(hour=WAKE_UP_HOUR, minute=0)
        
        # Lưu đường + lịch trình
        daily_routes_map[day_idx + 1] = day_route_geometries
        all_timeline.extend(day_timeline)
        all_route_geometries.extend(day_route_geometries)

        if remaining_points:
            remaining_points.sort(key=lambda x: geodesic(curr_loc, (x.lat, x.lon)).km)

    # 4. Tạo Map với màu sắc theo yêu cầu
    m = folium.Map(location=[start_lat, start_lon], zoom_start=14)

    # Start point - XANH LÁ
    folium.Marker([start_lat, start_lon], popup="Start", icon=folium.Icon(color='green', icon='play')).add_to(m)

    # Đường đi - MÀU ĐỎ
    for path in all_route_geometries:
        folium.PolyLine(path, color="red", weight=4, opacity=0.8).add_to(m)

    # Visit points - MÀU VÀNG
    visit_points = [t for t in all_timeline if t['type'] == 'VISIT']
    for idx, p in enumerate(visit_points):
        folium.Marker(
            [p['lat'], p['lon']],
            popup=f"<b>{idx+1}. {p['name']}</b><br>Ngày {p['day']}",
            icon=folium.Icon(color='orange', icon='camera')
        ).add_to(m)

    map_html = m._repr_html_()

    # === TÍNH TOÁN CLUSTER DATA CHO FRONTEND ===
    clusters_data = []
    
    for day_idx in range(total_days):
        day_num = day_idx + 1
        
        # Lấy điểm đến
        day_points = [
            t for t in all_timeline 
            if t['day'] == day_num and t.get('lat') and t.get('lon')
        ]
        
        # Tính tâm nhóm
        center_lat, center_lon = start_lat, start_lon
        if day_points:
            center_lat = sum([p['lat'] for p in day_points]) / len(day_points)
            center_lon = sum([p['lon'] for p in day_points]) / len(day_points)
            
        clusters_data.append({
            "day": day_num,
            "center": [center_lat, center_lon],
            "points": day_points,
            "summary": f"Ngày {day_num}: {len(day_points)} điểm đến",
            "route": daily_routes_map.get(day_num, []) 
        })

    return {
        "timeline": all_timeline,
        "mapHtml": map_html, 
        "clusters": clusters_data, # <--- DATA MỚI CHO FRONTEND
        "startPoint": [start_lat, start_lon],
        "finishTime": current_time.strftime("%H:%M"),
        "totalDestinations": len(visit_points),
        "totalDays": total_days
    }
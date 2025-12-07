import requests
import folium
import re
import heapq
from datetime import datetime, timedelta
from geopy.distance import geodesic
from sqlalchemy.sql.functions import current_date
from models import Attraction, Festival, CulturalSpot
import numpy as np
from sklearn.mixture import GaussianMixture
from dotenv import load_dotenv
import os

load_dotenv()
GRAPHHOPPER_API_KEY = os.getenv('GRAPHHOPPER_API_KEY')
OPENWEATHERMAP_API_KEY = os.getenv('OPENWEATHERMAP_API_KEY')

# --- CẤU HÌNH ---
WAKE_UP_HOUR = 6
FALLBACK_SPEED_KMH = 30        # Đặt tốc độ tb khi di chuyển
MAX_DAY_DURATION_MINUTES = 600 # 10 giờ/ngày (di chuyển + tham quan)
GMM_RANDOM_STATE = 42
IDEAL_TIME_DEFAULT = 1         # Chiều/tùy chọn
IDEAL_TIME_ORDER = {0: 0, 1: 1, 2: 2}

# Danh sách các sân bay lớn tại Việt Nam (Tên, Lat, Lon)
VIETNAM_AIRPORTS = {
    "SGN": {"name": "Sân bay Tân Sơn Nhất (HCM)", "lat": 10.818463, "lon": 106.658825},
    "HAN": {"name": "Sân bay Nội Bài (Hà Nội)", "lat": 21.218715, "lon": 105.804171},
    "DAD": {"name": "Sân bay Đà Nẵng", "lat": 16.053813, "lon": 108.204041},
    "CXR": {"name": "Sân bay Cam Ranh (Khánh Hòa)", "lat": 11.998183, "lon": 109.219373},
    "PQC": {"name": "Sân bay Phú Quốc", "lat": 10.158092, "lon": 103.993931},
    "HPH": {"name": "Sân bay Cát Bi (Hải Phòng)", "lat": 20.819262, "lon": 106.724836},
    "VCA": {"name": "Sân bay Cần Thơ", "lat": 10.082729, "lon": 105.712170},
    "HUI": {"name": "Sân bay Phú Bài (Huế)", "lat": 16.400557, "lon": 107.697042},
    "VII": {"name": "Sân bay Vinh (Nghệ An)", "lat": 18.730302, "lon": 105.677322},
}

def find_nearest_airport(lat, lon):
    """Tìm sân bay gần nhất với tọa độ cho trước"""
    nearest_code = None
    min_dist = float('inf')
    
    for code, info in VIETNAM_AIRPORTS.items():
        dist = geodesic((lat, lon), (info['lat'], info['lon'])).km
        if dist < min_dist:
            min_dist = dist
            nearest_code = code
            
    return VIETNAM_AIRPORTS[nearest_code], min_dist

# --- HÀM TIỆN ÍCH LÀM TRÒN GIỜ & FORMAT ---
def round_to_nearest_10_minutes(dt):
    """
    Làm tròn thời gian về mốc 10 phút gần nhất.
    VD: 8:03 -> 8:00, 8:06 -> 8:10, 8:33 -> 8:30, 8:38 -> 8:40
    """
    if not dt: return dt
    minutes = dt.minute
    remainder = minutes % 10
    
    if remainder < 5:
        # Làm tròn xuống
        delta = -remainder
    else:
        # Làm tròn lên
        delta = 10 - remainder
        
    return dt + timedelta(minutes=delta)

def format_time_vn(dt):
    """
    Chuyển đổi sang định dạng Việt Nam: 14h30p
    """
    if not dt: return ""
    return f"{dt.hour}h{dt.minute:02d}p"

def get_routing_info(coord_start, coord_end, vehicle='car'):
    """
    Thông minh: Tự động chọn Máy bay nếu xa (>400km), Xe nếu gần.
    Trả về: (distance_km, duration_minutes, geometry, transport_mode)
    """
    # 1. Tính khoảng cách đường chim bay trước
    dist_straight = geodesic(coord_start, coord_end).km
    
    # 2. LOGIC MÁY BAY (Nếu xa hơn 400km)
    if dist_straight > 400:
        # Tìm sân bay đi và đến
        airport_start, dist_to_airport = find_nearest_airport(coord_start[0], coord_start[1])
        airport_end, dist_from_airport = find_nearest_airport(coord_end[0], coord_end[1])
        
        print(f"[Smart Route] Bay từ {airport_start['name']} -> {airport_end['name']}")
        
        # Thời gian: 
        # Di chuyển ra sân bay (tốc độ 40km/h) + Bay (800km/h) + Thủ tục (120p)
        road_time_min = (dist_to_airport + dist_from_airport) / 40 * 60
        flight_dist = geodesic((airport_start['lat'], airport_start['lon']), 
                               (airport_end['lat'], airport_end['lon'])).km
        flight_time_min = (flight_dist / 800) * 60
        
        total_duration = int(road_time_min + flight_time_min + 120)
        
        # Tạo đường gấp khúc: Điểm đi -> SB đi -> SB đến -> Điểm đến
        geometry = {
            'type': 'LineString',
            'coordinates': [
                [coord_start[1], coord_start[0]],       # Xuất phát
                [airport_start['lon'], airport_start['lat']], # Sân bay đi
                [airport_end['lon'], airport_end['lat']],     # Sân bay đến
                [coord_end[1], coord_end[0]]            # Đích đến
            ]
        }
        
        # Trả về thêm tên sân bay để hiển thị
        route_desc = f"plane:{airport_start['name']}-{airport_end['name']}"
        
        return round(dist_straight, 2), total_duration, geometry, route_desc

    # 3. LOGIC XE - Nếu gần
    base_url = "http://localhost:8989/route"
    params = {
        'point': [f"{coord_start[0]},{coord_start[1]}", f"{coord_end[0]},{coord_end[1]}"],
        'profile': vehicle,
        'locale': 'vi',
        'points_encoded': 'false',
        'calc_points': 'true',
        'type': 'json'
    }

    try:
        response = requests.get(base_url, params=params, timeout=5)
        if response.status_code == 200:
            data = response.json()
            if 'paths' in data and len(data['paths']) > 0:
                path = data['paths'][0]
                dist = round(path['distance'] / 1000, 2)
                mins = round(path['time'] / 60000)
                
                geometry = None
                if 'points' in path and 'coordinates' in path['points']:
                    geometry = {
                        'type': 'LineString',
                        'coordinates': path['points']['coordinates']
                    }
                return dist, mins, geometry, "car"
    except Exception as e:
        print(f"[GraphHopper Error] {e}")

    # 4. FALLBACK (Đường bộ giả định nếu GraphHopper lỗi)
    speed = 40 # km/h
    duration = round((dist_straight / speed) * 60)
    geometry = {
        'type': 'LineString',
        'coordinates': [[coord_start[1], coord_start[0]], [coord_end[1], coord_end[0]]]
    }
    return round(dist_straight, 2), duration, geometry, "car"

def _route_cache_key(coord_start, coord_end):
    return (
        round(coord_start[0], 5), round(coord_start[1], 5),
        round(coord_end[0], 5), round(coord_end[1], 5)
    )


def get_route_with_cache(coord_start, coord_end, cache):
    key = _route_cache_key(coord_start, coord_end)
    if key in cache:
        return cache[key]

    # Hứng 4 giá trị
    distance_km, duration_min, geometry, mode = get_routing_info(coord_start, coord_end)
    
    # Lưu vào cache
    cache[key] = (distance_km, duration_min, geometry, mode)

    # Cache chiều ngược lại (đảo geometry)
    reverse_key = _route_cache_key(coord_end, coord_start)
    reversed_geometry = None
    if geometry and 'coordinates' in geometry:
        reversed_geometry = {
            'type': geometry['type'],
            'coordinates': list(reversed(geometry['coordinates']))
        }
    cache[reverse_key] = (distance_km, duration_min, reversed_geometry, mode)
    
    return cache[key]

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


def get_weather_by_date_and_coordinates(api_key, date, lat, lon):
    """
    Lấy dự báo thời tiết cho ngày cụ thể sử dụng OpenWeatherMap Forecast API.
    API forecast trả về dự báo 5 ngày với khoảng thời gian 3 giờ.
    """
    base_url = "http://api.openweathermap.org/data/2.5/forecast"

    params = {
        'lat': lat,
        'lon': lon,
        'appid': api_key,
        'units': 'metric',
        'cnt': 40  # Lấy tối đa 40 điểm dữ liệu (5 ngày x 8 điểm/ngày)
    }

    try:
        response = requests.get(base_url, params=params, timeout=10)

        if response.status_code == 200:
            data = response.json()
            target_date_str = date.strftime("%Y-%m-%d")

            # Tìm dự báo cho ngày được chỉ định
            daily_forecasts = []
            for item in data.get('list', []):
                forecast_date = datetime.fromtimestamp(item['dt']).strftime("%Y-%m-%d")
                if forecast_date == target_date_str:
                    daily_forecasts.append(item)

            if not daily_forecasts:
                print(f"[Weather] No forecast data found for date {target_date_str}")
                
                # Nếu là ngày hôm nay mà không có dự báo
                # gọi API Current Weather để lấy thời tiết hiện tại.
                if target_date_str == datetime.now().strftime("%Y-%m-%d"):
                    try:
                        print("[Weather] Attempting to fetch Current Weather fallback...")
                        current_url = "https://api.openweathermap.org/data/2.5/weather"
                        c_params = {
                            'lat': lat, 'lon': lon, 
                            'appid': api_key, 'units': 'metric'
                        }
                        c_res = requests.get(current_url, params=c_params, timeout=5)
                        if c_res.status_code == 200:
                            c_data = c_res.json()
                            # Giả lập cấu trúc dữ liệu giống forecast để trả về
                            return {
                                'date': target_date_str,
                                'temp_min': round(c_data['main']['temp_min'], 1),
                                'temp_max': round(c_data['main']['temp_max'], 1),
                                'temp_avg': round(c_data['main']['temp'], 1),
                                'humidity_avg': c_data['main']['humidity'],
                                'description': c_data['weather'][0]['description'],
                                'icon': c_data['weather'][0]['icon'],
                                'main': c_data['weather'][0]['main'],
                                'wind_speed': c_data.get('wind', {}).get('speed', 0),
                                'clouds': c_data.get('clouds', {}).get('all', 0),
                                'forecasts_count': 1
                            }
                    except Exception as e:
                        print(f"[Weather Fallback Error] {e}")

                return None

            # Tính trung bình các chỉ số thời tiết trong ngày
            temps = [f['main']['temp'] for f in daily_forecasts]
            humidities = [f['main']['humidity'] for f in daily_forecasts]
            weather_descriptions = [f['weather'][0]['description'] for f in daily_forecasts]
            weather_icons = [f['weather'][0]['icon'] for f in daily_forecasts]

            # Lấy thông tin thời tiết vào buổi sáng (6-12h) nếu có
            morning_forecast = None
            for f in daily_forecasts:
                hour = datetime.fromtimestamp(f['dt']).hour
                if 6 <= hour <= 12:
                    morning_forecast = f
                    break

            # Nếu không có buổi sáng, lấy forecast đầu tiên
            representative_forecast = morning_forecast or daily_forecasts[0]

            weather_info = {
                'date': target_date_str,
                'temp_min': round(min(temps), 1),
                'temp_max': round(max(temps), 1),
                'temp_avg': round(sum(temps) / len(temps), 1),
                'humidity_avg': round(sum(humidities) / len(humidities), 1),
                'description': representative_forecast['weather'][0]['description'],
                'icon': representative_forecast['weather'][0]['icon'],
                'main': representative_forecast['weather'][0]['main'],
                'wind_speed': representative_forecast.get('wind', {}).get('speed', 0),
                'clouds': representative_forecast.get('clouds', {}).get('all', 0),
                'forecasts_count': len(daily_forecasts)
            }

            print(f"[Weather] Retrieved forecast for {target_date_str}: {weather_info['temp_min']}°C - {weather_info['temp_max']}°C, {weather_info['description']}")
            return weather_info

        else:
            print(f"[Weather Error] Status: {response.status_code}, Message: {response.text}")
            return None

    except requests.exceptions.RequestException as e:
        print(f"[Weather Failed] {e}")
        return None


def is_attraction_available(attraction, current_time=None, start_datetime=None, end_datetime=None):
    """
    Kiểm tra xem địa điểm có mở cửa/hoạt động vào thời điểm này không.
    """
    # 1. Check Festival (Ngày diễn ra)
    if attraction.type == 'festival':
        fes = Festival.query.get(attraction.id)
        if not fes or not fes.time_start or not fes.time_end:
            return False, "Lễ hội thiếu thông tin thời gian cụ thể"
        
        # Với festival diễn ra hàng năm, cần kiểm tra trong năm hiện tại
        if current_time:
            current_year = current_time.year
            # Tạo khoảng thời gian diễn ra cho năm hiện tại
            festival_start = fes.time_start.replace(year=current_year)
            festival_end = fes.time_end.replace(year=current_year)
            festival_start_date = festival_start.date()
            festival_end_date = festival_end.date()
            current_date = current_time.date()
            
            # Kiểm tra nếu current_time nằm trong khoảng thời gian festival
            if festival_start_date <= current_date <= festival_end_date:
                return True, ""  # Festival đang diễn ra
            else:
                return False, f"Chưa diễn ra hoặc đã kết thúc ({fes.time_start.strftime('%d/%m')} - {fes.time_end.strftime('%d/%m')})"
            
        # Kiểm tra với khoảng thời gian tour (start_datetime, end_datetime)
        if start_datetime and end_datetime:
            # Lấy năm từ start_datetime để kiểm tra
            tour_year = start_datetime.year
            festival_start = fes.time_start.replace(year=tour_year)
            festival_end = fes.time_end.replace(year=tour_year)
            festival_start_date = festival_start.date()
            festival_end_date = festival_end.date()
            tour_start_date = start_datetime.date()
            tour_end_date = end_datetime.date()
            
            # Kiểm tra xem khoảng thời gian tour có giao với khoảng thời gian festival không
            if festival_end_date < tour_start_date or festival_start_date > tour_end_date:
                return False, f"Chưa diễn ra hoặc đã kết thúc ({fes.time_start.strftime('%d/%m')} - {fes.time_end.strftime('%d/%m')})"
            else:
                return True, ""  # Festival diễn ra trong khoảng thời gian tour

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


def approximate_visit_duration(attraction):
    """
    Chuẩn hoá thời gian tham quan (mặc định 60 phút nếu thiếu dữ liệu).
    """
    try:
        duration = getattr(attraction, 'visit_duration', None)
        if duration and duration > 0:
            return duration
    except Exception:
        pass
    return 60


def ideal_time_code(attraction):
    """
    Quy đổi ideal_time của điểm đến về code có thể sort được.
    """
    raw = getattr(attraction, 'ideal_time', IDEAL_TIME_DEFAULT)
    return IDEAL_TIME_ORDER.get(raw, IDEAL_TIME_ORDER[IDEAL_TIME_DEFAULT])


def estimate_cluster_duration(attractions, start_location, cache):
    """
    Ước lượng tổng thời gian (di chuyển + tham quan) cho một cụm.
    """
    if not attractions:
        return 0

    pending = attractions[:]
    current = start_location
    total_minutes = 0

    while pending:
        nearest = min(
            pending,
            key=lambda attr: get_route_with_cache(current, (attr.lat, attr.lon), cache)[0]
        )
        _, travel_min, _, _ = get_route_with_cache(current, (nearest.lat, nearest.lon), cache)
        total_minutes += travel_min + approximate_visit_duration(nearest)
        current = (nearest.lat, nearest.lon)
        pending.remove(nearest)

    return total_minutes


def cluster_attractions_with_gmm(attractions, start_location, max_days, cache, max_duration):
    """
    Chia điểm đến thành các nhóm bằng Gaussian Mixture Model sao cho
    thời gian mỗi nhóm <= max_duration (khi có thể).
    """
    if not attractions:
        return [], []

    capped_days = min(max_days, len(attractions))
    capped_days = max(1, capped_days)

    features = []
    for attr in attractions:
        _, travel_min, _, _ = get_route_with_cache(start_location, (attr.lat, attr.lon), cache)
        features.append([
            attr.lat / 180.0,
            attr.lon / 180.0,
            approximate_visit_duration(attr) / max_duration,
            travel_min / max_duration,
            ideal_time_code(attr) / 3.0
        ])

    for n_clusters in range(1, capped_days + 1):
        gmm = GaussianMixture(n_components=n_clusters, random_state=GMM_RANDOM_STATE)
        labels = gmm.fit_predict(features)
        clusters = {i: [] for i in range(n_clusters)}
        for idx, label in enumerate(labels):
            clusters[label].append(attractions[idx])

        durations_ok = all(
            estimate_cluster_duration(cluster, start_location, cache) <= max_duration
            for cluster in clusters.values()
        )
        if durations_ok:
            centers = gmm.means_.tolist()
            return list(clusters.values()), centers

    # Fallback: dùng số ngày tối đa dù có thể vượt ngưỡng thời gian
    gmm = GaussianMixture(n_components=capped_days, random_state=GMM_RANDOM_STATE)
    labels = gmm.fit_predict(features)
    clusters = {i: [] for i in range(capped_days)}
    for idx, label in enumerate(labels):
        clusters[label].append(attractions[idx])

    return list(clusters.values()), gmm.means_.tolist()


def find_mst_tour_order(attractions, start_location, cache):
    """
    Tạo thứ tự tham quan dựa trên Minimum Spanning Tree (Prim + DFS).
    """
    n = len(attractions)
    if n == 0:
        return {
            "order": [],
            "order_index": {},
            "legs": [],
            "total_distance": 0,
            "total_travel_time": 0
        }

    coords = [(attr.lat, attr.lon) for attr in attractions]

    # Chọn node bắt đầu là điểm gần nhất với vị trí xuất phát
    start_idx = min(
        range(n),
        key=lambda idx: get_route_with_cache(start_location, coords[idx], cache)[0]
    )

    visited = {start_idx}
    adjacency = {i: [] for i in range(n)}
    heap = []

    # tính kc từ start_idx đến các địa điểm còn lại
    for j in range(n):
        if j == start_idx:
            continue
        dist, _, _, _ = get_route_with_cache(coords[start_idx], coords[j], cache)
        heapq.heappush(heap, (dist, start_idx, j))

    # Mở rộng MST
    while len(visited) < n and heap:
        dist, frm, to = heapq.heappop(heap)
        if to in visited:
            continue
        visited.add(to)
        adjacency[frm].append(to)
        adjacency[to].append(frm)

        for nxt in range(n):
            if nxt in visited:
                continue
            ndist, _, _, _ = get_route_with_cache(coords[to], coords[nxt], cache)
            heapq.heappush(heap, (ndist, to, nxt))

    # DFS để lấy thứ tự tham quan
    order = []
    seen = set()
    stack = [start_idx]

    while stack:
        node = stack.pop()
        if node in seen:
            continue
        seen.add(node)
        order.append(attractions[node])

        neighbors = sorted(
            adjacency[node],
            key=lambda idx: get_route_with_cache(coords[node], coords[idx], cache)[0],
            reverse=True
        )
        stack.extend(neighbors)

    order_index = {attr.id: idx for idx, attr in enumerate(order)}

    legs = []
    total_distance = 0
    total_travel_time = 0
    current_coord = start_location
    current_label = "start"

    for attr in order:
        coord = (attr.lat, attr.lon)
        dist, travel_min, geometry, _ = get_route_with_cache(current_coord, coord, cache)
        legs.append({
            "from": current_label,
            "to": attr.id,
            "distance": dist,
            "travel_minutes": travel_min,
            "geometry": geometry
        })
        total_distance += dist
        total_travel_time += travel_min
        current_coord = coord
        current_label = attr.id

    return {
        "order": order,
        "order_index": order_index,
        "legs": legs,
        "total_distance": round(total_distance, 2),
        "total_travel_time": total_travel_time
    }


def assign_clusters_to_days(clusters, centers, festival_constraints, start_location, order_index_map):
    """
    Sắp xếp các cụm thành từng ngày, đồng thời ưu tiên ngày của lễ hội.
    """
    if not clusters:
        return []

    wrapped = []
    for idx, items in enumerate(clusters):
        if items:
            order_positions = [order_index_map.get(attr.id, idx) for attr in items]
            mean_order = sum(order_positions) / len(order_positions)
            center_lat = centers[idx][0] * 180 if idx < len(centers) else np.mean([a.lat for a in items])
            center_lon = centers[idx][1] * 180 if idx < len(centers) else np.mean([a.lon for a in items])
        else:
            mean_order = idx
            center_lat, center_lon = start_location
        wrapped.append({
            "label": idx,
            "attractions": items[:],
            "mean_order": mean_order,
            "center": (center_lat, center_lon)
        })

    wrapped.sort(key=lambda c: c["mean_order"])
    total_days = len(wrapped)
    day_slots = [None] * total_days
    remaining = wrapped[:]

    for constraint in festival_constraints:
        day_offset = constraint["day_offset"]
        if not (0 <= day_offset < total_days):
            continue
        target_attr = constraint["attraction"]
        existing = day_slots[day_offset]

        if existing is None:
            cluster = next((c for c in remaining if target_attr in c["attractions"]), None)
            if cluster:
                day_slots[day_offset] = cluster
                remaining.remove(cluster)
            else:
                # Nếu không tìm thấy, tạo cụm mới chỉ chứa lễ hội
                day_slots[day_offset] = {
                    "label": f"festival-{target_attr.id}",
                    "attractions": [target_attr],
                    "mean_order": day_offset,
                    "center": (target_attr.lat, target_attr.lon)
                }
        else:
            if target_attr not in existing["attractions"]:
                # Di chuyển lễ hội từ cụm cũ sang ngày đúng
                for cluster in remaining:
                    if target_attr in cluster["attractions"]:
                        cluster["attractions"].remove(target_attr)
                        break
                existing["attractions"].append(target_attr)

    slot_idx = 0
    while remaining and slot_idx < total_days:
        if day_slots[slot_idx] is None:
            day_slots[slot_idx] = remaining.pop(0)
        slot_idx += 1

    # Điền cụm rỗng nếu cần
    for idx in range(total_days):
        if day_slots[idx] is None:
            day_slots[idx] = {
                "label": f"empty-{idx}",
                "attractions": [],
                "mean_order": idx,
                "center": start_location
            }

    return day_slots


def build_day_itinerary(day_number, day_attractions, day_start_datetime, start_location, cache, order_index_map):
    """
    Sinh timeline cho từng ngày dựa trên danh sách attraction.
    """
    if not day_attractions:
        return [], {
            "distance_km": 0,
            "travel_minutes": 0,
            "visit_minutes": 0,
            "point_count": 0
        }, [], start_location, day_start_datetime

    ordered = sorted(
        day_attractions,
        key=lambda attr: (attr.ideal_time, order_index_map.get(attr.id, 0))
    )

    day_events = []
    routes = []
    
    # Làm tròn giờ xuất phát cho đẹp
    current_time = round_to_nearest_10_minutes(day_start_datetime)
    current_loc = start_location
    
    day_distance = 0
    day_travel_minutes = 0
    day_visit_minutes = 0

    for attraction in ordered:
        coord = (attraction.lat, attraction.lon)
        dist, travel_min, geometry, mode = get_route_with_cache(current_loc, coord, cache)
        
        # Tính giờ đến nơi thô
        arrival_raw = current_time + timedelta(minutes=travel_min)
        
        # LÀM TRÒN giờ đến nơi cho đẹp (VD: 8:33 -> 8:30)
        arrival_time = round_to_nearest_10_minutes(arrival_raw)

        # Nếu làm tròn khiến giờ đến < giờ đi (do di chuyển quá ngắn), cộng bù 10p
        if arrival_time <= current_time:
            arrival_time = current_time + timedelta(minutes=10)

        # Recalculate travel min hiển thị theo giờ đã làm tròn (để logic hiển thị khớp nhau)
        display_travel_min = int((arrival_time - current_time).total_seconds() / 60)

        if dist > 0:
            # Check nếu mode bắt đầu bằng "plane:"
            if isinstance(mode, str) and mode.startswith('plane:'):
                airports = mode.split(':')[1].split('-') # Lấy tên 2 sân bay
                action_name = f"✈️ {airports[0]} ➝ {airports[1]}"
                detail_text = f"Khoảng {dist} km (Bay + Di chuyển)"
            elif mode == 'plane': # Fallback cho code cũ
                action_name = f"✈️ Bay tới {attraction.name}"
                detail_text = f"{dist} km / ~{travel_min // 60}h{travel_min % 60}p"
            else:
                action_name = f"🚗 Di chuyển tới {attraction.name}"
                detail_text = f"{dist} km / ~{travel_min} phút"

            day_events.append({
                "day": day_number,
                "date": current_time.strftime("%d/%m/%Y"),
                "time": format_time_vn(current_time),
                "type": "TRAVEL",
                "name": action_name, # Dùng tên hành động mới
                "detail": detail_text
            })

            if geometry:
                path = [[p[1], p[0]] for p in geometry['coordinates']]
            else:
                path = [[current_loc[0], current_loc[1]], [coord[0], coord[1]]]
            routes.append(path)

        day_distance += dist
        day_travel_minutes += travel_min # Vẫn cộng thời gian thực tế để thống kê chính xác

        visit_duration = approximate_visit_duration(attraction)
        available, status = is_attraction_available(attraction, arrival_time)
        detail = "Mở cửa" if available else status or "Cần kiểm tra thêm"

        day_events.append({
            "day": day_number,
            "date": arrival_time.strftime("%d/%m/%Y"),
            "time": format_time_vn(arrival_time), 
            "type": "VISIT",
            "id": attraction.id,
            "name": attraction.name,
            "idealTime": getattr(attraction, 'ideal_time', IDEAL_TIME_DEFAULT),
            "detail": detail,
            "duration": visit_duration,
            "lat": attraction.lat,
            "lon": attraction.lon,
            "imageUrl": getattr(attraction, 'image_url', None)
        })

        day_visit_minutes += visit_duration
        
        # Tính giờ rời đi và lại làm tròn tiếp
        leave_time_raw = arrival_time + timedelta(minutes=visit_duration)
        current_time = round_to_nearest_10_minutes(leave_time_raw)
        
        current_loc = coord

    stats = {
        "distance_km": round(day_distance, 2),
        "travel_minutes": day_travel_minutes,
        "visit_minutes": day_visit_minutes,
        "point_count": len(ordered)
    }

    return day_events, stats, routes, current_loc, current_time

def generate_smart_tour(attraction_ids, start_lat, start_lon, start_datetime_str, end_datetime_str):
    """
    Logic mới:
    1. Ưu tiên kiểm tra lễ hội trước khi xét các điểm khác.
    2. Dùng MST (Prim) để tạo tour order tổng thể.
    3. Tối ưu số ngày bằng GMM + ràng buộc thời gian (<= 10h/ngày).
    4. Chia ngày dựa trên cụm GMM, đảm bảo lễ hội diễn ra đúng ngày.
    5. Bên trong mỗi ngày: sắp xếp theo ideal_time -> MST order, kèm quãng đường/thời gian.
    6. Trả về tổng số ngày, tổng khoảng cách, thống kê từng ngày, tâm cụm, số điểm phù hợp.
    """
    # Parse thời gian, tạo cache, lấy danh sách attraction
    try:
        # Thử parse với format có giờ (từ API endpoint)
        start_datetime = datetime.strptime(start_datetime_str, "%d/%m/%Y %H:%M")
        end_datetime = datetime.strptime(end_datetime_str, "%d/%m/%Y %H:%M")
    except ValueError:
        # Fallback: thử parse không có giờ
        try:
            start_datetime = datetime.strptime(start_datetime_str, "%d/%m/%Y")
            end_datetime = datetime.strptime(end_datetime_str, "%d/%m/%Y")
        except ValueError:
            start_datetime = datetime.now()
            end_datetime = start_datetime + timedelta(days=1)

    start_location = (start_lat, start_lon)
    route_cache = {}

    
    raw_attractions = Attraction.query.filter(Attraction.id.in_(attraction_ids)).all()
    valid_attractions = []
    invalid_attractions = []

    max_days_allowed = max(1, (end_datetime.date() - start_datetime.date()).days + 1)

    # Festival không phù hợp -> invalid
    for attr in raw_attractions:
        if attr.type == 'festival':
            is_available, reason = is_attraction_available(attr, start_datetime, start_datetime, end_datetime)
            if is_available:
                valid_attractions.append(attr)
            else:
                invalid_attractions.append({
                    "id": attr.id,
                    "name": attr.name,
                    "reason": reason
                })
        else:
            # Với Bảo tàng, Di tích, Thiên nhiên -> Luôn thêm vào danh sách
            valid_attractions.append(attr)

    if not valid_attractions:
        return {
            "timeline": [],
            "mapHtml": "",
            "invalidAttractions": invalid_attractions,
            "totalDestinations": 0,
            "totalDays": 0,
            "dailySummaries": [],
            "totalDistanceKm": 0,
            "dayCenters": []
        }

    # 
    mst_result = find_mst_tour_order(valid_attractions, start_location, route_cache)
    festival_constraints = []
    for attr in valid_attractions:
        if attr.type == 'festival':
            fes = Festival.query.get(attr.id)
            if fes and fes.time_start:
                offset = (fes.time_start.date() - start_datetime.date()).days
                if offset < 0:
                    offset = 0
                if offset >= max_days_allowed:
                    offset = max_days_allowed - 1
                festival_constraints.append({
                    "attraction": attr,
                    "day_offset": offset
                })

    clusters, centers = cluster_attractions_with_gmm(
        valid_attractions,
        start_location,
        max_days_allowed,
        route_cache,
        MAX_DAY_DURATION_MINUTES
    )

    if not centers:
        centers = [[start_lat / 180.0, start_lon / 180.0, 0, 0, 0] for _ in clusters]

    required_days = max((c["day_offset"] for c in festival_constraints), default=-1) + 1
    while required_days > len(clusters):
        clusters.append([])
        centers.append([start_lat / 180.0, start_lon / 180.0, 0, 0, 0])

    day_clusters = assign_clusters_to_days(
        clusters,
        centers,
        festival_constraints,
        start_location,
        mst_result["order_index"]
    )

    timeline = []
    daily_summaries = []
    daily_routes_map = {}
    day_centers = []
    total_distance = 0
    total_travel_minutes = 0
    last_location = start_location

    for day_idx, cluster in enumerate(day_clusters):
        day_number = day_idx + 1
        day_date = start_datetime.date() + timedelta(days=day_idx)

        # Xác định thời gian bắt đầu ngày
        if day_idx == 0:
            day_start_dt = start_datetime
        else:
            day_start_dt = datetime.combine(day_date, datetime.min.time()).replace(hour=WAKE_UP_HOUR, minute=0)

        # Lấy thông tin thời tiết 
        weather_info = None
        if OPENWEATHERMAP_API_KEY:
            # Sử dụng center của cluster hoặc start_location nếu không có center
            weather_lat, weather_lon = cluster["center"] if cluster["center"] != start_location else start_location

            weather_info = get_weather_by_date_and_coordinates(
                OPENWEATHERMAP_API_KEY,
                day_date,
                weather_lat,
                weather_lon
            )


        timeline.append({
            "day": day_number,
            "date": day_start_dt.strftime("%d/%m/%Y"),
            "time": format_time_vn(day_start_dt),
            "type": "DAY_START",
            "name": f"Ngày {day_number} - Khởi hành",
            "detail": "Bắt đầu hành trình",
            "weather": weather_info
        })

        day_events, stats, routes, last_location, day_end_time = build_day_itinerary(
            day_number,
            cluster["attractions"],
            day_start_dt,
            last_location,
            route_cache,
            mst_result["order_index"]
        )

        timeline.extend(day_events)
        timeline.append({
            "day": day_number,
            "date": day_end_time.strftime("%d/%m/%Y"),
            "time": format_time_vn(day_end_time),
            "type": "DAY_END",
            "name": "Kết thúc ngày",
            "detail": f"Tổng thời gian di chuyển {stats['travel_minutes']} phút"
        })

        daily_routes_map[day_number] = routes

        day_summary = {
            "day": day_number,
            "date": day_start_dt.strftime("%d/%m/%Y"),
            "distanceKm": stats["distance_km"],
            "travelMinutes": stats["travel_minutes"],
            "visitMinutes": stats["visit_minutes"],
            "pointCount": stats["point_count"],
            "center": cluster["center"],
            "includesFestival": any(a.type == 'festival' for a in cluster["attractions"]),
            "weather": weather_info
        }
        daily_summaries.append(day_summary)
        day_centers.append({"day": day_number, "center": cluster["center"]})
        total_distance += stats["distance_km"]
        total_travel_minutes += stats["travel_minutes"]

    visit_points = [evt for evt in timeline if evt.get("lat") and evt["type"] == "VISIT"]

    m = folium.Map(location=[start_lat, start_lon], zoom_start=12)
    folium.Marker(
        [start_lat, start_lon],
        popup="Điểm xuất phát",
        icon=folium.Icon(color='green', icon='play')
    ).add_to(m)

    for paths in daily_routes_map.values():
        for path in paths:
            folium.PolyLine(path, color="red", weight=4, opacity=0.8).add_to(m)

    for idx, p in enumerate(visit_points):
        folium.Marker(
            [p['lat'], p['lon']],
            popup=f"<b>{idx + 1}. {p['name']}</b><br>Ngày {p['day']}",
            icon=folium.Icon(color='orange', icon='camera')
        ).add_to(m)

    map_html = m._repr_html_()

    return {
        "timeline": timeline,
        "mapHtml": map_html,
        "dailySummaries": daily_summaries,
        "dayCenters": day_centers,
        "totalDays": len(day_clusters),
        "totalDistanceKm": round(total_distance, 2),
        "totalTravelMinutes": total_travel_minutes,
        "totalDestinations": len(valid_attractions),
        "invalidAttractions": invalid_attractions,
        "festivalPriorities": [
            {
                "id": constraint["attraction"].id,
                "name": constraint["attraction"].name,
                "scheduledDay": constraint["day_offset"] + 1
            } for constraint in festival_constraints
        ],
        "routes": daily_routes_map
    }
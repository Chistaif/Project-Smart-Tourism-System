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
import logging

load_dotenv()
GRAPHHOPPER_API_KEY = os.getenv('GRAPHHOPPER_API_KEY')
OPENWEATHERMAP_API_KEY = os.getenv('OPENWEATHERMAP_API_KEY')

# --- CẤU HÌNH ---
WAKE_UP_HOUR = 6
FALLBACK_SPEED_KMH = 30        
MAX_DAY_DURATION_MINUTES = 660 # 11 tiếng hoạt động/ngày
GMM_RANDOM_STATE = 42
IDEAL_TIME_DEFAULT = 1         
IDEAL_TIME_ORDER = {0: 0, 1: 1, 2: 2}

# --- CẤU HÌNH LOGGING ---
logging.basicConfig(
    level=logging.INFO, # Đổi thành DEBUG nếu muốn xem siêu chi tiết
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger(__name__)

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
    """Tìm sân bay gần nhất"""
    nearest_code = None
    min_dist = float('inf')
    
    for code, info in VIETNAM_AIRPORTS.items():
        dist = geodesic((lat, lon), (info['lat'], info['lon'])).km
        if dist < min_dist:
            min_dist = dist
            nearest_code = code
            
    return VIETNAM_AIRPORTS[nearest_code], min_dist

def _get_road_segment(coord_start, coord_end, vehicle='car'):
    """
    Gọi GraphHopper để lấy đường đi bộ chi tiết giữa 2 điểm ngắn.
    Trả về: (distance_km, duration_min, list_of_coordinates)
    """
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
                coords = path['points']['coordinates']
                return dist, mins, coords
    except Exception as e:
        print(f"[GraphHopper Internal Error] {e}")

    # Fallback: Đường thẳng nếu GraphHopper lỗi
    dist = geodesic(coord_start, coord_end).km
    speed = 30 if dist < 5 else 40
    mins = round((dist / speed) * 60)
    # GeoJSON format: [lon, lat]
    coords = [[coord_start[1], coord_start[0]], [coord_end[1], coord_end[0]]]
    return round(dist, 2), mins, coords

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
    Thông minh:
    - Nếu đi máy bay: Tính đường bộ ra sân bay + bay + đường bộ về đích.
    - Kết hợp đường đi chi tiết cho các chặng đường bộ.
    """
    # 1. Tính khoảng cách đường chim bay tổng thể
    dist_straight = geodesic(coord_start, coord_end).km
    
    # 2. LOGIC MÁY BAY (Nếu xa hơn 400km)
    if dist_straight > 400:
        # A. Tìm sân bay
        airport_start, dist_to_start_airport = find_nearest_airport(coord_start[0], coord_start[1])
        airport_end, dist_from_end_airport = find_nearest_airport(coord_end[0], coord_end[1])
        
        print(f"[Smart Route] Kết hợp: {airport_start['name']} -> {airport_end['name']}")
        
        # B. Tính toán 3 chặng
        # Chặng 1: Điểm đi -> Sân bay đi (Đường bộ chi tiết)
        d1, t1, coords1 = _get_road_segment(coord_start, (airport_start['lat'], airport_start['lon']))
        
        # Chặng 2: Bay (Đường thẳng)
        flight_dist = geodesic((airport_start['lat'], airport_start['lon']), 
                               (airport_end['lat'], airport_end['lon'])).km
        t2 = (flight_dist / 800) * 60 # Giả định bay 800km/h
        # Tạo đường thẳng bay (2 điểm)
        coords2 = [
            [airport_start['lon'], airport_start['lat']], 
            [airport_end['lon'], airport_end['lat']]
        ]

        # Chặng 3: Sân bay đến -> Điểm đến (Đường bộ chi tiết)
        d3, t3, coords3 = _get_road_segment((airport_end['lat'], airport_end['lon']), coord_end)

        # C. Tổng hợp
        total_dist = round(d1 + flight_dist + d3, 2)
        # Thời gian = Đi xe 1 + Bay + Đi xe 3 + 120p thủ tục
        total_time = int(t1 + t2 + t3 + 120) 
        
        # Nối 3 đoạn đường lại thành 1 danh sách tọa độ duy nhất
        # coords1 + coords2 + coords3
        full_coordinates = coords1 + coords2 + coords3

        geometry = {
            'type': 'LineString',
            'coordinates': full_coordinates
        }
        
        route_desc = f"plane:{airport_start['name']}-{airport_end['name']}"
        return total_dist, total_time, geometry, route_desc

    # 3. LOGIC XE (Gần < 400km) - Gọi hàm helper trực tiếp
    dist, mins, coords = _get_road_segment(coord_start, coord_end, vehicle)
    
    geometry = {
        'type': 'LineString',
        'coordinates': coords
    }
    return dist, mins, geometry, "car"

def _route_cache_key(coord_start, coord_end):
    return (
        round(coord_start[0], 5), round(coord_start[1], 5),
        round(coord_end[0], 5), round(coord_end[1], 5)
    )


def get_route_with_cache(coord_start, coord_end, cache):
    key = _route_cache_key(coord_start, coord_end)
    if key in cache:
        return cache[key]

    # Hứng 4 giá trị từ API/Hàm tính toán
    distance_km, duration_min, geometry, mode = get_routing_info(coord_start, coord_end)
    
    # Lưu chiều xuôi vào cache
    cache[key] = (distance_km, duration_min, geometry, mode)

    # Xử lý cache chiều ngược
    reverse_key = _route_cache_key(coord_end, coord_start)
    
    reversed_geometry = None
    if geometry and 'coordinates' in geometry:
        reversed_geometry = {
            'type': geometry['type'],
            'coordinates': list(reversed(geometry['coordinates']))
        }
    
    # Logic đảo ngược tên sân bay cho biến mode
    reverse_mode = mode
    if isinstance(mode, str) and mode.startswith('plane:'):
        try:
            prefix, names = mode.split(':', 1)
            airport_start, airport_end = names.split('-')
            reverse_mode = f"{prefix}:{airport_end}-{airport_start}"
        except ValueError:
            pass
            
    cache[reverse_key] = (distance_km, duration_min, reversed_geometry, reverse_mode)
    
    return cache[key]

def parse_opening_hours(open_str):
    """
    Parse chuỗi giờ mở cửa (VD: "08:00 - 17:00") thành float (8.0, 17.0).
    """
    if not open_str: 
        return None
    try:
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
        'cnt': 40
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
    Kiểm tra tình trạng mở cửa.
    - Trả về (True, "") nếu mở cửa.
    - Trả về (False, float_hour) nếu chưa mở cửa.
    - Trả về (False, string) nếu đã đóng cửa hoặc lý do khác.
    """
    # 1. Check Festival
    if attraction.type == 'festival':
        fes = Festival.query.get(attraction.id)
        if not fes or not fes.time_start: return False, "Thiếu thời gian"
        
        # Logic check năm
        years = []
        if start_datetime and end_datetime:
            years = range(start_datetime.year, end_datetime.year + 1)
        elif current_time:
            years = [current_time.year]
        else:
            years = [datetime.now().year]

        is_match, display_str = False, ""
        for y in years:
            try:
                fs = fes.time_start.replace(year=y)
                fe = fes.time_end.replace(year=y)
                display_str = f"{fs.strftime('%d/%m')} - {fe.strftime('%d/%m')}"
                if start_datetime and end_datetime:
                    if (fs.date() <= end_datetime.date()) and (fe.date() >= start_datetime.date()):
                        is_match = True; break
                elif current_time:
                    if fs.date() <= current_time.date() <= fe.date():
                        is_match = True; break
            except: continue
            
        if not is_match:
             # LOG DEBUG
             logger.debug(f"[Check] {attraction.name} bị loại vì chưa đến ngày diễn ra ({display_str})")
        return (True, "") if is_match else (False, f"Chưa diễn ra ({display_str})")

    # 2. Check CulturalSpot
    elif attraction.type == 'cultural_spot':
        spot = CulturalSpot.query.get(attraction.id)
        if spot and spot.opening_hours:
            hours = parse_opening_hours(spot.opening_hours)
            if hours and current_time:
                start_h, end_h = hours
                curr_h = current_time.hour + current_time.minute/60
                
                # NẾU ĐẾN SỚM: Trả về số thực để hàm build_itinerary tính giờ chờ
                if curr_h < start_h: 
                    return False, start_h
                
                # NẾU ĐẾN MUỘN: Trả về text thông báo
                if curr_h > end_h: 
                    # LOG INFO
                    logger.info(f"[Check] {attraction.name} đã đóng cửa lúc {format_time_vn(current_time)} (Đóng: {spot.opening_hours})")
                    return False, f"Đã đóng cửa (Mở đến {spot.opening_hours})"
    
    return True, ""

def calculate_tag_relevance(main_attr, candidate_attr):
    """
    Tính điểm liên quan dựa trên tags.
    FIX: Xử lý trường hợp tags là InstrumentedList (Relationship) thay vì String.
    """
    score = 0
    
    # 1. So sánh Type
    if main_attr.type == candidate_attr.type:
        score += 2
        
    # 2. So sánh Tags
    def get_tags_set(attr_obj):
        raw_tags = getattr(attr_obj, 'tags', [])
        
        if not raw_tags:
            return set()
        try:
            tags_set = set()
            for item in raw_tags:
                tag_name = getattr(item, 'name', getattr(item, 'tag_name', str(item)))
                tags_set.add(tag_name.lower())
            return tags_set
        except TypeError:
            return set()

    tags_a = get_tags_set(main_attr)
    tags_b = get_tags_set(candidate_attr)
    
    if tags_a and tags_b:
        common_tags = tags_a.intersection(tags_b)
        score += len(common_tags) * 3 # Mỗi tag trùng +3 điểm
        
    return score

def find_supplementary_attraction(current_loc, current_time, visited_ids, main_attr, cache, max_day_limit_time):
    """
    Tìm địa điểm B phụ:
    1. Gần A (bán kính < 5km).
    2. Chưa đi (không nằm trong visited_ids).
    3. Thỏa mãn thời gian: Đi + Chơi <= Giờ đóng cửa & <= Giới hạn ngày.
    4. Sắp xếp theo độ liên quan tags.
    """
    # Lấy tất cả địa điểm trong DB trừ những điểm đã đi
    candidates = Attraction.query.filter(Attraction.id.notin_(visited_ids)).all()
    
    valid_candidates = []
    
    for cand in candidates:
        # 1. Lọc sơ bộ khoảng cách (Chim bay < 10km để đỡ tốn API)
        dist_straight = geodesic(current_loc, (cand.lat, cand.lon)).km
        if dist_straight > 10: 
            continue

        # 2. Tính toán đường đi thực tế
        dist, travel_min, geometry, mode = get_route_with_cache(current_loc, (cand.lat, cand.lon), cache)
        
        # Nếu xa quá (> 30p di chuyển) thì bỏ qua để tiết kiệm thời gian
        if travel_min > 30: 
            continue
            
        arrival_time = round_to_nearest_10_minutes(current_time + timedelta(minutes=travel_min))
        
        # 3. Kiểm tra giờ mở cửa
        is_open, open_info = is_attraction_available(cand, arrival_time)
        if not is_open:
            continue
            
        visit_duration = approximate_visit_duration(cand)
        finish_time = arrival_time + timedelta(minutes=visit_duration)
        
        # 4. Kiểm tra giới hạn ngày (MAX_DAY_DURATION)
        # max_day_limit_time là datetime object (VD: 17:00 chiều)
        if finish_time > max_day_limit_time:
            continue

        if finish_time.hour >= 17: 
            continue

        # 5. Kiểm tra giờ đóng cửa cụ thể của địa điểm B
        # Hàm is_attraction_available chỉ check lúc đến, giờ check lúc về
        if cand.type == 'cultural_spot':
             # Query lại để lấy giờ đóng cửa chính xác
             spot = CulturalSpot.query.get(cand.id)
             if spot and spot.opening_hours:
                 h_range = parse_opening_hours(spot.opening_hours)
                 if h_range:
                     _, end_h = h_range
                     finish_h = finish_time.hour + finish_time.minute/60
                     if finish_h > end_h:
                         continue

        # Tính điểm liên quan
        relevance_score = calculate_tag_relevance(main_attr, cand)
        
        valid_candidates.append({
            "attraction": cand,
            "score": relevance_score,
            "dist": dist,
            "travel_min": travel_min,
            "geometry": geometry,
            "mode": mode,
            "visit_duration": visit_duration
        })

    # Sắp xếp: Ưu tiên Điểm cao nhất -> Sau đó đến Khoảng cách gần nhất
    valid_candidates.sort(key=lambda x: (-x['score'], x['dist']))
    
    if valid_candidates:
        return valid_candidates[0] # Trả về ứng viên tốt nhất
    return None

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
    Ước lượng tổng thời gian (di chuyển + tham quan + ĂN UỐNG) cho một cụm.
    """
    if not attractions: return 0
    pending = attractions[:]
    current = start_location
    total_minutes = 0
    
    # Giả định bắt đầu lúc 6h sáng
    virtual_time_hour = WAKE_UP_HOUR 
    
    has_lunch = False
    
    while pending:
        # Tìm điểm gần nhất
        nearest = min(pending, key=lambda attr: get_route_with_cache(current, (attr.lat, attr.lon), cache)[0])
        _, travel_min, _, _ = get_route_with_cache(current, (nearest.lat, nearest.lon), cache)
        
        # Cộng thời gian di chuyển
        total_minutes += travel_min
        virtual_time_hour += travel_min / 60.0
        
        # Nếu quá trưa (11.5) mà chưa tính ăn -> Cộng thêm 90p vào tổng thời gian ước lượng
        if not has_lunch and virtual_time_hour >= 11.5:
            total_minutes += 90
            virtual_time_hour += 1.5
            has_lunch = True

        visit_min = approximate_visit_duration(nearest)
        total_minutes += visit_min
        virtual_time_hour += visit_min / 60.0
        
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

    # Nếu chỉ có 1 địa điểm hoặc số ngày cho phép là 1, không cần chạy GMM
    if len(attractions) == 1:
        # Trả về 1 cụm duy nhất chứa địa điểm đó
        return [attractions], [[attractions[0].lat / 180.0, attractions[0].lon / 180.0, 0, 0, 0]]
    
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

def post_process_clusters_capacity(clusters, max_items_per_day=3):
    """
    Hậu xử lý: Kiểm tra nếu cụm nào > 3 điểm thì tách ra.
    Quy tắc:
    1. Ưu tiên Lễ hội (Festival) lên đầu.
    2. Cắt thành các chunk nhỏ (max 3 điểm).
    3. Trả về danh sách cụm mới (số lượng cụm sẽ tăng lên = số ngày tăng lên).
    """
    new_clusters = []
    
    for cluster in clusters:
        # Nếu cụm nhỏ, giữ nguyên
        if len(cluster) <= max_items_per_day:
            new_clusters.append(cluster)
            continue
            
        # LOGIC TÁCH CỤM
        # B1: Sắp xếp ưu tiên Lễ hội lên đầu
        # key: False (0) đứng trước True (1), nên so sánh x.type != 'festival'
        # Nếu cùng là festival hoặc cùng không phải, giữ nguyên thứ tự cũ (stable sort)
        cluster.sort(key=lambda x: x.type != 'festival')
        
        # B2: Cắt thành các cụm nhỏ
        # Ví dụ: 5 điểm -> [3 điểm, 2 điểm] -> Thành 2 ngày
        chunks = [cluster[i:i + max_items_per_day] for i in range(0, len(cluster), max_items_per_day)]
        
        # B3: Thêm các cụm nhỏ vào danh sách kết quả
        new_clusters.extend(chunks)
        
    return new_clusters 

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
    Sinh timeline cho từng ngày.
    Thêm Post-Visit Meal Check để đảm bảo không bị 'đói' khi đi điểm phụ.
    """
    logger.info(f"--- BẮT ĐẦU XÂY DỰNG NGÀY {day_number}: {len(day_attractions)} điểm ---")

    if not day_attractions:
        return [], {"distance_km": 0, "travel_minutes": 0, "visit_minutes": 0, "point_count": 0}, [], start_location, day_start_datetime

    # Sắp xếp danh sách candidates ban đầu theo thứ tự MST
    candidates = sorted(
        day_attractions,
        key=lambda attr: (
            -approximate_visit_duration(attr),        # Ưu tiên visitDuration lớn lên đầu (Buổi sáng)
            order_index_map.get(attr.id, float('inf')) # Sau đó mới xét đến thuận tiện đường đi
        )
    )
    
    visited_ids = set([a.id for a in day_attractions])
    
    day_events = []
    routes = []
    current_time = round_to_nearest_10_minutes(day_start_datetime)
    current_loc = start_location
    
    day_end_limit = day_start_datetime + timedelta(minutes=MAX_DAY_DURATION_MINUTES)
    
    day_distance = 0
    day_travel_minutes = 0
    day_visit_minutes = 0

    has_lunch = False
    has_dinner = False

    while candidates:
        # ============================================================
        # 1. PRE-CHECK MEAL (Đầu vòng lặp - Xử lý khi vừa di chuyển đến)
        # ============================================================
        current_hour = current_time.hour + current_time.minute / 60.0
        
        # Chỉ ăn trưa nếu trong khung giờ 11h - 15h
        if not has_lunch and 11.0 <= current_hour < 15.0:
            lunch_duration = 90
            day_events.append({
                "day": day_number, "date": current_time.strftime("%d/%m/%Y"),
                "time": format_time_vn(current_time), "type": "INFO", 
                "name": "Nghỉ ngơi & Ăn trưa",
                "detail": f"Nạp năng lượng giữa ngày ({lunch_duration} phút)",
                "duration": lunch_duration
            })
            current_time = round_to_nearest_10_minutes(current_time + timedelta(minutes=lunch_duration))
            has_lunch = True
            continue

        # Ăn tối từ 17h30 trở đi
        if not has_dinner and current_hour >= 17.5:
            dinner_duration = 90
            # Nếu ăn quá muộn (> 20h30) thì đổi tên thành Ăn khuya
            meal_name = "Ăn tối" if current_hour < 20.5 else "Ăn khuya / Ăn nhẹ"
            
            day_events.append({
                "day": day_number, "date": current_time.strftime("%d/%m/%Y"),
                "time": format_time_vn(current_time), "type": "INFO",
                "name": meal_name,
                "detail": f"Thưởng thức ẩm thực địa phương ({dinner_duration} phút)",
                "duration": dinner_duration
            })
            current_time = round_to_nearest_10_minutes(current_time + timedelta(minutes=dinner_duration))
            has_dinner = True
            continue

        # ============================================================
        # 2. XỬ LÝ ĐIỂM CHÍNH (MAIN TARGET)
        # ============================================================
        best_candidate = candidates[0]

        logger.debug(f"Đang xét điểm ưu tiên: {best_candidate.name}")
        
        # Tính toán di chuyển
        dist, t_min, _, _ = get_route_with_cache(current_loc, (best_candidate.lat, best_candidate.lon), cache)
        arrival_raw = current_time + timedelta(minutes=t_min)
        arrival_time = round_to_nearest_10_minutes(arrival_raw)
        
        # Check mở cửa
        is_open, open_info = is_attraction_available(best_candidate, arrival_time)
        final_target = best_candidate
        
        # Gap filling logic
        if not is_open and isinstance(open_info, (int, float)):
            open_dt = arrival_time.replace(hour=int(open_info), minute=int((open_info-int(open_info))*60))
            if (open_dt - arrival_time).total_seconds()/60 > 45 and len(candidates) > 1:
                for alt in candidates[1:]:
                    _, t_alt, _, _ = get_route_with_cache(current_loc, (alt.lat, alt.lon), cache)
                    arr_alt = round_to_nearest_10_minutes(current_time + timedelta(minutes=t_alt))
                    if is_attraction_available(alt, arr_alt)[0]:
                        vis_alt = approximate_visit_duration(alt)
                        _, t_back, _, _ = get_route_with_cache((alt.lat, alt.lon), (best_candidate.lat, best_candidate.lon), cache)
                        if arr_alt + timedelta(minutes=vis_alt + t_back) >= open_dt:
                            final_target = alt; break
        
        # Thực hiện di chuyển đến điểm chốt
        target_coord = (final_target.lat, final_target.lon)
        dist, t_min, geometry, mode = get_route_with_cache(current_loc, target_coord, cache)
        arrival_time = round_to_nearest_10_minutes(current_time + timedelta(minutes=t_min))
        
        # [ADD EVENT] Travel
        if dist > 0.01:
            nm = f"Bay tới {final_target.name}" if "plane" in str(mode) else f"Di chuyển tới {final_target.name}"
            day_events.append({
                "day": day_number, 
                "date": current_time.strftime("%d/%m"), 
                "time": format_time_vn(current_time), 
                "type": "TRAVEL", 
                "name": nm, 
                "detail": f"{dist} km / ~{t_min} phút"
            })
            path = [[p[1], p[0]] for p in geometry['coordinates']] if geometry else []
            routes.append({"path": path, "type": "flight" if "plane" in str(mode) else "road"})
            day_distance += dist
            day_travel_minutes += t_min

        logger.debug(f" -> Di chuyển: {dist}km trong {t_min}p tới {final_target.name}")

        # Tính giờ đến nơi
        arrival_time = round_to_nearest_10_minutes(current_time + timedelta(minutes=t_min))

        ok, val = is_attraction_available(final_target, arrival_time)
        if not ok and not isinstance(val, (int, float)):
            # Nếu đóng cửa (val là string báo lỗi) -> Bỏ qua ngay
            logger.warning(f"SKIP {final_target.name}: {val}")
            candidates.remove(final_target)
            continue
        if not ok and isinstance(val, (int, float)):
            # Tính thời điểm mở cửa chính xác
            opens_at = arrival_time.replace(hour=int(val), minute=int((val-int(val))*60))
            
            # Tính thời gian phải chờ (phút)
            wait_minutes = (opens_at - arrival_time).total_seconds() / 60
            
            if wait_minutes > 15:
                # Logic đặt tên sự kiện dựa trên giờ
                arrival_hour = arrival_time.hour + arrival_time.minute/60.0
                
                event_name = "Nghỉ ngơi chờ mở cửa"
                event_detail = f"Thư giãn {int(wait_minutes)} phút tại khu vực gần đó"
                
                # Nếu là buổi sáng trước 9h30 -> Gợi ý Ăn sáng
                if arrival_hour < 9.5:
                    event_name = "Ăn sáng & Cafe sáng"
                    event_detail = f"Thưởng thức bữa sáng trong lúc chờ mở cửa ({int(wait_minutes)} phút)"
                
                # Nếu là buổi trưa trong khoảng 11h30 - 13h30 -> Gợi ý Ăn trưa
                elif 11.5 <= arrival_hour <= 13.5 and not has_lunch:
                    event_name = "Ăn trưa chờ mở cửa"
                    event_detail = f"Dùng bữa trưa trước khi vào tham quan ({int(wait_minutes)} phút)"
                    has_lunch = True 

                day_events.append({
                    "day": day_number, 
                    "date": arrival_time.strftime("%d/%m"), 
                    "time": format_time_vn(arrival_time), 
                    "type": "INFO", 
                    "name": event_name, 
                    "detail": event_detail
                })
                
                # Cập nhật thời gian nhảy đến giờ mở cửa
                current_time = opens_at
                arrival_time = opens_at
            else:
                # Nếu chờ ít (< 15p) thì coi như đến nơi là vào luôn
                current_time = arrival_time
        else:
            current_time = arrival_time

        # [ADD EVENT] Visit
        vis_dur = approximate_visit_duration(final_target)
        avail, stat = is_attraction_available(final_target, arrival_time)
        day_events.append({
            "day": day_number, "date": arrival_time.strftime("%d/%m/%Y"),
            "time": format_time_vn(arrival_time), "type": "VISIT",
            "id": final_target.id, "name": final_target.name,
            "detail": "Mở cửa" if avail else (str(stat) if stat else "Tham quan"),
            "duration": vis_dur, "lat": final_target.lat, "lon": final_target.lon, "imageUrl": getattr(final_target, 'image_url', None)
        })
        day_visit_minutes += vis_dur
        
        # Cập nhật thời gian sau khi thăm xong A
        leave_A_time = round_to_nearest_10_minutes(arrival_time + timedelta(minutes=vis_dur))

        logger.debug(f" -> Di chuyển: {dist}km trong {t_min}p tới {final_target.name}")
        
        # =========================
        # 3. POST-VISIT MEAL CHECK 
        # =========================
        current_hour_decimal = leave_A_time.hour + leave_A_time.minute / 60.0
        
        # Chỉ ăn trưa nếu 11h <= giờ <= 15h
        if not has_lunch and 11.0 <= current_hour_decimal < 15.0:
            lunch_dur = 90
            day_events.append({
                "day": day_number, "date": leave_A_time.strftime("%d/%m/%Y"), 
                "time": format_time_vn(leave_A_time), "type": "INFO", 
                "name": "Nghỉ ngơi & Ăn trưa", 
                "detail": f"Nạp năng lượng ({lunch_dur} phút)",
                "duration": lunch_dur
            })
            leave_A_time = round_to_nearest_10_minutes(leave_A_time + timedelta(minutes=lunch_dur))
            has_lunch = True
            
        elif not has_dinner and current_hour_decimal >= 17.5:
            dinner_dur = 90
            meal_name = "Ăn tối" if current_hour_decimal < 20.5 else "Ăn khuya / Ăn nhẹ"
            day_events.append({
                "day": day_number, "date": leave_A_time.strftime("%d/%m/%Y"), 
                "time": format_time_vn(leave_A_time), "type": "INFO", 
                "name": meal_name, "detail": "Thưởng thức ẩm thực", "duration": dinner_dur
            })
            leave_A_time = round_to_nearest_10_minutes(leave_A_time + timedelta(minutes=dinner_dur))
            has_dinner = True

        # =========================================================================
        # 4. OPPORTUNISTIC INSERTION (TÌM ĐIỂM PHỤ)
        # =========================================================================
        inserted_bonus = False
        time_left = (day_end_limit - leave_A_time).total_seconds() / 60

        # Điều kiện an toàn để chèn: Đã ăn trưa RỒI, hoặc giờ hiện tại chưa tới giờ trưa
        cur_h = leave_A_time.hour + leave_A_time.minute/60.0
        is_safe_time = has_lunch or (cur_h < 11.0)
        
        # Nếu còn dư > 90 phút
        if time_left > 90 and is_safe_time:
            logger.debug(f" -> Còn dư {time_left}p, đang tìm điểm phụ...")
            supp = find_supplementary_attraction(
                current_loc=(final_target.lat, final_target.lon),
                current_time=leave_A_time,
                visited_ids=visited_ids,
                main_attr=final_target,
                cache=cache,
                max_day_limit_time=day_end_limit
            )
            
            if supp:
                cand_B = supp['attraction']
                logger.info(f" [BONUS] Chèn thành công điểm phụ: {cand_B.name} (Điểm match: {supp['score']})")
                # Di chuyển A (hoặc Quán ăn) -> B
                if supp['dist'] > 0.01:
                    is_flight_B = isinstance(supp['mode'], str) and supp['mode'].startswith('plane')
                    day_events.append({
                        "day": day_number, "date": leave_A_time.strftime("%d/%m/%Y"),
                        "time": format_time_vn(leave_A_time), "type": "TRAVEL",
                        "name": f"Ghé thêm: {cand_B.name}",
                        "detail": f"{supp['dist']} km (Gợi ý thêm)"
                    })
                    path_B = [[p[1], p[0]] for p in supp['geometry']['coordinates']] if supp['geometry'] else []
                    routes.append({"path": path_B, "type": "flight" if is_flight_B else "road"})
                    day_distance += supp['dist']; day_travel_minutes += supp['travel_min']
                
                # Tham quan B
                arr_B = round_to_nearest_10_minutes(leave_A_time + timedelta(minutes=supp['travel_min']))
                day_events.append({
                    "day": day_number, "date": arr_B.strftime("%d/%m/%Y"),
                    "time": format_time_vn(arr_B), "type": "VISIT",
                    "id": cand_B.id, "name": cand_B.name,
                    "detail": "Điểm gợi ý thêm",
                    "duration": supp['visit_duration'],
                    "lat": cand_B.lat, "lon": cand_B.lon,
                    "imageUrl": getattr(cand_B, 'image_url', None)
                })
                
                day_visit_minutes += supp['visit_duration']
                visited_ids.add(cand_B.id)
                
                # Cập nhật State từ B
                leave_B = arr_B + timedelta(minutes=supp['visit_duration'])
                current_time = round_to_nearest_10_minutes(leave_B)
                current_loc = (cand_B.lat, cand_B.lon)
                inserted_bonus = True
            else:
                logger.debug(" -> Không tìm thấy điểm phụ phù hợp.")
        # Nếu không chèn điểm phụ -> Cập nhật từ A (đã tính giờ ăn)
        if not inserted_bonus:
            current_time = leave_A_time
            current_loc = target_coord
        
        candidates.remove(final_target)

    stats = {
        "distance_km": round(day_distance, 2),
        "travel_minutes": day_travel_minutes,
        "visit_minutes": day_visit_minutes,
        "point_count": len([e for e in day_events if e['type'] == 'VISIT'])
    }

    return day_events, stats, routes, current_loc, current_time

def generate_smart_tour(attraction_ids, start_lat, start_lon, start_datetime_str, end_datetime_str, start_point_name=None):
    """
    Hàm tạo lịch trình thông minh V3 (Final).
    Tính năng:
    - Xử lý đa năm (2025-2026).
    - Tối ưu hóa cụm (GMM + MST).
    - Smart Transit: Di chuyển đón đầu vào buổi tối nếu chặng sau quá xa.
    """
    logger.info(f"====== REQUEST TẠO TOUR MỚI ======")
    logger.info(f"Input: {len(attraction_ids)} điểm, Từ {start_datetime_str} đến {end_datetime_str}")

    if not (1 <= len(attraction_ids) <= 10):
        error_msg = f"Số lượng địa điểm không hợp lệ ({len(attraction_ids)}). Vui lòng chọn từ 1 đến 10 điểm."
        logger.warning(error_msg)
        return {
            "timeline": [], "routes": {}, "dailySummaries": [], 
            "invalidAttractions": [{"id": -1, "name": "LỖI GIỚI HẠN", "reason": error_msg}],
            "totalDays": 0, "totalDestinations": 0, "totalDistanceKm": 0
        }
    
    # 1. Parse thời gian
    try:
        start_dt = datetime.strptime(start_datetime_str, "%d/%m/%Y %H:%M")
        end_dt = datetime.strptime(end_datetime_str, "%d/%m/%Y %H:%M")
    except ValueError:
        try:
            start_dt = datetime.strptime(start_datetime_str, "%d/%m/%Y")
            end_dt = datetime.strptime(end_datetime_str, "%d/%m/%Y")
        except ValueError:
            start_dt = datetime.now()
            end_dt = start_dt + timedelta(days=1)

    start_location = (start_lat, start_lon)
    route_cache = {}
    
    # 2. Lấy dữ liệu và Lọc sơ bộ
    raw_attrs = Attraction.query.filter(Attraction.id.in_(attraction_ids)).all()
    clean_attrs = []
    for a in raw_attrs:
        # Chỉ lấy điểm có tọa độ hợp lệ
        if -90 <= a.lat <= 90 and -180 <= a.lon <= 180:
            clean_attrs.append(a)
        else:
            logger.error(f"[DATA ERROR] Bỏ qua địa điểm lỗi tọa độ: {a.name} (Lat={a.lat}, Lon={a.lon})")
    valid_attrs = []
    invalid_attrs = []
    
    for a in clean_attrs:
        is_ok, reason = is_attraction_available(a, start_datetime=start_dt, end_datetime=end_dt)
        if is_ok:
            valid_attrs.append(a)
        else:
            rt = str(reason)
            logger.warning(f" [LOẠI BỎ] {a.name}: {rt}")
            invalid_attrs.append({"id": a.id, "name": a.name, "reason": rt})

    logger.info(f"Sau khi lọc: {len(valid_attrs)} điểm hợp lệ / {len(clean_attrs)} tổng số")

    if not valid_attrs:
        logger.error("Không còn điểm nào hợp lệ để tạo tour!")
        return {
            "timeline": [], "routes": {}, "dailySummaries": [], 
            "invalidAttractions": invalid_attrs,
            "totalDays": 0, "totalDestinations": 0, "totalDistanceKm": 0
        }

    # 3. Tính toán số ngày và Phân cụm
    max_days_allowed = max(1, (end_dt.date() - start_dt.date()).days + 1)
    
    mst_res = find_mst_tour_order(valid_attrs, start_location, route_cache)
    
    festival_constraints = []
    for attr in valid_attrs:
        if attr.type == 'festival':
            fes = Festival.query.get(attr.id)
            if fes and fes.time_start:
                offset = (fes.time_start.date() - start_dt.date()).days
                if offset < 0: offset = 0
                if offset >= max_days_allowed: offset = max_days_allowed - 1
                
                festival_constraints.append({"attraction": attr, "day_offset": offset})

    # Kiểm tra khoảng cách cực đại giữa các điểm
    max_dist = 0
    if len(valid_attrs) > 1:
        # Lấy điểm đầu và điểm cuối theo vĩ độ (đại diện Bắc-Nam)
        sorted_by_lat = sorted(valid_attrs, key=lambda x: x.lat)
        p1 = sorted_by_lat[0]
        p2 = sorted_by_lat[-1]
        max_dist = geodesic((p1.lat, p1.lon), (p2.lat, p2.lon)).km

    logger.info(f"Khoảng cách xa nhất giữa các điểm: {max_dist:.2f} km")

    if max_dist > 500:
        logger.warning("Phát hiện các điểm cách xa nhau (>500km). Chuyển sang chế độ chia ngày theo Vùng miền.")
        
        # 1. Sắp xếp Bắc -> Nam
        is_start_north = start_lat > 16 
        sorted_attrs = sorted(valid_attrs, key=lambda x: x.lat, reverse=is_start_north)
        
        # 2. Gom cụm
        clusters = []
        current_cluster = [sorted_attrs[0]]
        
        for i in range(1, len(sorted_attrs)):
            prev = current_cluster[-1]
            curr = sorted_attrs[i]
            dist = geodesic((prev.lat, prev.lon), (curr.lat, curr.lon)).km
            
            if dist < 200: 
                current_cluster.append(curr)
            else:
                clusters.append(current_cluster)
                current_cluster = [curr]
                
        if current_cluster:
            clusters.append(current_cluster)

        # 3. Tính Centers
        centers = []
        for i, cl in enumerate(clusters):
            if cl:
                # Tính trung bình
                sum_lat = sum(a.lat for a in cl)
                sum_lon = sum(a.lon for a in cl)
                count = len(cl)
                
                avg_lat = sum_lat / count
                avg_lon = sum_lon / count
                
                # In log để kiểm tra dữ liệu gốc
                logger.error(f"[DEBUG CLUSTER {i+1}] Gồm các điểm: {[a.name for a in cl]}")
                logger.error(f" -> Dữ liệu gốc: Lat={[a.lat for a in cl]}, Lon={[a.lon for a in cl]}")
                logger.error(f" -> Trung bình tính được: Lat={avg_lat}, Lon={avg_lon}")

                # [QUAN TRỌNG] Append đúng thứ tự (Lat, Lon)
                centers.append((avg_lat / 180.0, avg_lon / 180.0))
        
        logger.info(f"Centers final list: {centers}")

    else:
        # Nếu gần nhau, dùng GMM như cũ
        logger.info("Khoảng cách gần, sử dụng thuật toán GMM.")
        clusters, centers = cluster_attractions_with_gmm(
            valid_attrs, start_location, max_days_allowed, route_cache, MAX_DAY_DURATION_MINUTES
        )

    logger.info(f"Trước khi tách: {len(clusters)} cụm.")
    
    # 1. Gọi hàm tách cụm
    clusters = post_process_clusters_capacity(clusters, max_items_per_day=3)
    
    logger.info(f"Sau khi tách (Limit 3): {len(clusters)} cụm (Số ngày dự kiến tăng).")

    # 2. Tính lại Centers (Tâm cụm) 
    centers = []
    for cl in clusters:
        if cl:
            avg_lat = sum(a.lat for a in cl) / len(cl)
            avg_lon = sum(a.lon for a in cl) / len(cl)

            centers.append([avg_lat / 180.0, avg_lon / 180.0, 0, 0, 0])
        else:
            centers.append([start_lat / 180.0, start_lon / 180.0, 0, 0, 0])

    logger.info(f"Đã phân thành {len(clusters)} cụm (Ngày) bằng GMM.")
    for i, c in enumerate(clusters):
        names = [a.name for a in c]
        logger.debug(f" - Cụm {i+1}: {names}")

    if not centers:
        centers = [[start_lat / 180.0, start_lon / 180.0, 0, 0, 0] for _ in clusters]

    required_days = max((c["day_offset"] for c in festival_constraints), default=-1) + 1
    while required_days > len(clusters):
        clusters.append([])
        centers.append([start_lat / 180.0, start_lon / 180.0, 0, 0, 0])

    day_clusters_raw = assign_clusters_to_days(
        clusters, centers, festival_constraints, start_location, mst_res["order_index"]
    )

    active_clusters = [c for c in day_clusters_raw if c["attractions"]]
    
    day_clusters = []
    for c in active_clusters:
        day_clusters.append({
            "attractions": c["attractions"],
            "center": c["center"]
        })

    # 4. Xây dựng Timeline
    timeline = []
    daily_routes_map = {}
    daily_summaries = []
    day_centers = []

    total_distance = 0
    total_travel_minutes = 0

    # --- KHỞI TẠO BIẾN CHO SMART TRANSIT ---
    curr_date = start_dt
    curr_loc = start_location
    overnight_place_name = start_point_name if start_point_name else "xuất phát điểm"
    
    # Đếm số ngày thực tế (Logical Day)
    logical_day_number = 0

    for idx, cluster_info in enumerate(day_clusters):
        logical_day_number += 1
        
        # 1. Tìm xem trong cụm ngày hôm nay có Lễ hội nào cần 'nhảy cóc' thời gian không
        target_jump_date = None
        for attr in cluster_info['attractions']:
            if attr.type == 'festival':
                fes = Festival.query.get(attr.id)
                if fes and fes.time_start:
                    # Tìm năm phù hợp
                    check_years = range(start_dt.year, end_dt.year + 1)
                    for y in check_years:
                        try:
                            fs = fes.time_start.replace(year=y)
                            # Nếu lễ hội nằm trong khoảng thời gian tour
                            if start_dt.date() <= fs.date() <= end_dt.date():
                                # Nếu ngày lễ hội này xa hơn ngày hiện tại -> Cần nhảy
                                if curr_date.date() < fs.date():
                                    # Nếu chưa có target hoặc target này sớm hơn target trước đó -> Chọn cái sớm nhất
                                    if target_jump_date is None or fs.date() < target_jump_date.date():
                                        target_jump_date = fs
                                break 
                        except: continue
        
        # 2. Thực hiện nhảy cóc nếu tìm thấy target
        if target_jump_date:
            logger.warning(f"[TIME WARP] Nhảy thời gian từ {curr_date.date()} -> {target_jump_date.date()} để đón Lễ hội")
            # Cập nhật curr_date thành ngày bắt đầu lễ hội (giữ giờ cũ hoặc reset về sáng)
            curr_date = datetime.combine(target_jump_date.date(), datetime.min.time())

        # 3. Thiết lập giờ xuất phát (6h sáng)
        day_start_dt = datetime.combine(curr_date.date(), datetime.min.time()).replace(hour=WAKE_UP_HOUR, minute=0)
        
        # Lấy thời tiết tại tâm cụm
        weather_info = None
        if OPENWEATHERMAP_API_KEY:
            c_lat, c_lon = cluster_info['center']
            # Fallback về start_loc nếu center bị lỗi
            if c_lat == 0 and c_lon == 0: c_lat, c_lon = start_location
            weather_info = get_weather_by_date_and_coordinates(OPENWEATHERMAP_API_KEY, day_start_dt, c_lat, c_lon)

        # A. EVENT START DAY
        timeline.append({
            "day": logical_day_number, 
            "date": day_start_dt.strftime("%d/%m/%Y"), 
            "time": format_time_vn(day_start_dt),
            "type": "DAY_START", 
            "name": f"Ngày {logical_day_number}", 
            "detail": f"Thức dậy tại vị trí {overnight_place_name}, sẵn sàng khởi hành", 
            "weather": weather_info
        })
        
        # B. BUILD ITINERARY (Đi các điểm trong ngày)
        events, stats, routes, last_location, day_end_time = build_day_itinerary(
            logical_day_number, 
            cluster_info['attractions'], 
            day_start_dt, 
            curr_loc, 
            route_cache, 
            mst_res['order_index']
        )
        timeline.extend(events)

        # C. SMART TRANSIT: QUYẾT ĐỊNH DI CHUYỂN CUỐI NGÀY
              
        is_last_day = (idx == len(day_clusters) - 1)
        next_start_loc = last_location # Mặc định: Sáng mai dậy ở chỗ cũ
        
        if is_last_day:
            # === NGÀY CUỐI: VỀ NHÀ ===
            d_home, t_home, g_home, m_home = get_route_with_cache(last_location, start_location, route_cache)
            is_flight = isinstance(m_home, str) and m_home.startswith('plane')
            
            if d_home > 1:
                arr_home = day_end_time + timedelta(minutes=t_home)
                
                dest_name = start_point_name if start_point_name else "điểm trả khách"
                nm = "Bay về điểm kết thúc" if "plane" in str(m_home) else f"Về {dest_name}"
                
                timeline.append({
                    "day": logical_day_number, 
                    "date": arr_home.strftime("%d/%m/%Y"), 
                    "time": format_time_vn(arr_home), 
                    "type": "TRAVEL", 
                    "name": nm, 
                    "detail": f"{d_home} km (Kết thúc hành trình)"
                })
                if g_home:
                    routes.append({"path": [[p[1], p[0]] for p in g_home['coordinates']], "type": "flight" if is_flight else "road", "is_return": True})
                
                stats['distance_km'] += d_home
                stats['travel_minutes'] += t_home
                day_end_time = arr_home

        else:
            # === NGÀY GIỮA: KIỂM TRA KHOẢNG CÁCH THỜI GIAN (GAP CHECK) ===
            next_cluster = day_clusters[idx+1]
            next_center = next_cluster['center']
            
            # 1. Tính toán ngày bắt đầu thực sự của chặng tiếp theo
            next_event_date = None
            for attr in next_cluster['attractions']:
                if attr.type == 'festival':
                    fes = Festival.query.get(attr.id)
                    if fes and fes.time_start:
                        check_years = range(start_dt.year, end_dt.year + 1)
                        for y in check_years:
                            try:
                                fs = fes.time_start.replace(year=y)
                                if start_dt.date() <= fs.date() <= end_dt.date():
                                    if day_end_time.date() < fs.date():
                                        if next_event_date is None or fs.date() < next_event_date.date():
                                            next_event_date = fs
                                    break
                            except: continue
            
            # Nếu không phải lễ hội, giả định là ngày hôm sau
            if next_event_date is None:
                next_event_date = day_end_time + timedelta(days=1)

            gap_days = (next_event_date.date() - day_end_time.date()).days

            # 2. LOGIC QUYẾT ĐỊNH
            # NẾU GAP > 3 NGÀY: Về nhà nghỉ ngơi
            if gap_days > 3:
                d_back, t_back, g_back, m_back = get_route_with_cache(last_location, start_location, route_cache)
                is_flight = False
                if d_back > 10: # Chỉ di chuyển nếu đang ở xa nhà
                    is_flight = isinstance(m_back, str) and m_back.startswith('plane')
                    nm = "Bay về điểm xuất phát (Chờ sự kiện tiếp theo)" if is_flight else "Di chuyển về điểm xuất phát"
                    
                    # Di chuyển về
                    arrive_home = day_end_time + timedelta(minutes=t_back)
                    timeline.append({
                        "day": logical_day_number, "date": arrive_home.strftime("%d/%m/%Y"), "time": format_time_vn(arrive_home),
                        "type": "TRAVEL", "name": nm, "detail": f"{d_back} km (Sự kiện tiếp theo còn {gap_days} ngày nữa)"
                    })
                    if g_back:
                        routes.append({"path": [[p[1], p[0]] for p in g_back['coordinates']], "type": "flight" if is_flight else "road", "is_return": True})
                    
                    stats['distance_km'] += d_back
                    stats['travel_minutes'] += t_back
                    day_end_time = arrive_home
                
                # Thêm Event nghỉ ngơi dài ngày
                timeline.append({
                    "day": logical_day_number, "date": day_end_time.strftime("%d/%m/%Y"), "time": format_time_vn(day_end_time),
                    "type": "INFO", "name": f"Nghỉ ngơi tại nhà ({gap_days} ngày)",
                    "detail": f"Tự do hoạt động cá nhân đến ngày {next_event_date.strftime('%d/%m/%Y')} tiếp tục hành trình"
                })
                
                # [QUAN TRỌNG] Thiết lập vị trí khởi hành ngày mai là TỪ NHÀ
                next_start_loc = start_location
                overnight_place_name = "điểm xuất phát (sau thời gian nghỉ)"

            # NẾU GAP <= 3 NGÀY: Di chuyển đến điểm tiếp theo nếu xa
            else:
                d_next, t_next, g_next, m_next = get_route_with_cache(last_location, next_center, route_cache)
                is_flight = False
                dest_location_name = "khu vực tiếp theo"
                if d_next > 50:
                    is_flight = isinstance(m_next, str) and m_next.startswith('plane')
                    # Trích tên tỉnh/thành phố 
                    dest_location_name = "tỉnh/thành phố tiếp theo" # Mặc định
                if next_cluster["attractions"]:
                    # Lấy địa điểm đầu tiên của ngày mai để làm mốc
                    first_dest_tomorrow = next_cluster["attractions"][0]
                    if getattr(first_dest_tomorrow, 'location', None):
                        try:
                            # Tách chuỗi bằng dấu phẩy và lấy phần tử cuối
                            parts = first_dest_tomorrow.location.split(',')
                            if parts:
                                dest_location_name = parts[-1].strip()
                        except:
                            pass
                    move_name = f"Bay đến {dest_location_name}" if is_flight else f"Di chuyển đến {dest_location_name}"
                    depart_transit = day_end_time + timedelta(minutes=60) 
                    
                    timeline.append({
                        "day": logical_day_number, "date": depart_transit.strftime("%d/%m/%Y"), "time": format_time_vn(depart_transit),
                        "type": "TRAVEL", "name": move_name, "detail": f"{d_next} km (Di chuyển đêm)"
                    })
                    
                    if g_next:
                        routes.append({"path": [[p[1], p[0]] for p in g_next['coordinates']], "type": "flight" if is_flight else "road"})
                    
                    stats['distance_km'] += d_next
                    stats['travel_minutes'] += t_next
                    next_start_loc = next_center 
                    
                    if next_cluster["attractions"]:
                        overnight_place_name = f"khu vực gần {next_cluster['attractions'][0].name}"
                    else:
                        overnight_place_name = "khu vực tham quan tiếp theo"
                    
                    day_end_time = depart_transit + timedelta(minutes=t_next)
                else:
                    timeline.append({
                        "day": logical_day_number, "date": day_end_time.strftime("%d/%m/%Y"), "time": format_time_vn(day_end_time),
                        "type": "INFO", "name": "Nghỉ ngơi tại khách sạn", "detail": "Nạp năng lượng cho ngày mai"
                    })
                    next_start_loc = last_location 
                    overnight_place_name = "khách sạn khu vực hiện tại"

        # Tổng kết số liệu ngày
        daily_routes_map[logical_day_number] = routes
        
        day_summary = {
            "day": logical_day_number,
            "date": day_start_dt.strftime("%d/%m/%Y"),
            "distanceKm": round(stats["distance_km"], 2),
            "travelMinutes": stats["travel_minutes"],
            "visitMinutes": stats["visit_minutes"],
            "pointCount": stats["point_count"],
            "center": cluster_info["center"],
            "includesFestival": any(a.type == 'festival' for a in cluster_info["attractions"]),
            "weather": weather_info
        }
        daily_summaries.append(day_summary)
        day_centers.append({"day": logical_day_number, "center": cluster_info["center"]})

        total_distance += stats["distance_km"]
        total_travel_minutes += stats["travel_minutes"]
        
        # Cập nhật cho vòng lặp sau
        curr_loc = next_start_loc 
        # Tăng ngày (Logic: Ngày hôm sau là ngày tiếp theo trên lịch)
        curr_date = curr_date + timedelta(days=1)

    logger.info(f"====== HOÀN TẤT TẠO TOUR: {round(total_distance, 2)}km, {logical_day_number} ngày ======")
    
    return {
        "timeline": timeline,
        "mapHtml": "", # Legacy support
        "dailySummaries": daily_summaries,
        "dayCenters": day_centers,
        "totalDays": logical_day_number, 
        "totalDistanceKm": round(total_distance, 2),
        "totalTravelMinutes": total_travel_minutes,
        "totalDestinations": len(valid_attrs),
        "invalidAttractions": invalid_attrs,
        "festivalPriorities": [
            {
                "id": constraint["attraction"].id,
                "name": constraint["attraction"].name,
                "scheduledDay": constraint["day_offset"] + 1
            } for constraint in festival_constraints
        ],
        "routes": daily_routes_map
    }
from sqlalchemy import or_
from sqlalchemy.orm import aliased, joinedload
from models import db, Attraction, Festival, CulturalSpot, Tag, FavoriteAttraction
from .tour_service import get_route_with_cache
import unicodedata
from datetime import datetime

# --- CÁC HÀM HELPER (Utils) ---

def to_unaccent(text):
    if not text: return ""
    return ''.join(c for c in unicodedata.normalize('NFD', text) if unicodedata.category(c) != 'Mn')

def check_strict_date_filter(attraction, trip_start, trip_end):
    attr_start_val = getattr(attraction, 'time_start', None) or getattr(attraction, 'datetimeStart', None)
    attr_end_val = getattr(attraction, 'time_end', None) or getattr(attraction, 'datetimeEnd', None)

    if attraction.type != 'festival' and not attr_start_val:
        return True

    ref_year = trip_start.year if trip_start else (trip_end.year if trip_end else datetime.now().year)
    
    def normalize_date_val(val, year):
        if not val: return None
        target_date = None
        try:
            if isinstance(val, datetime):
                target_date = val
            elif isinstance(val, str):
                clean_val = val.split('.')[0] if '.' in val and ':' in val else val
                for fmt in ["%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%d/%m/%Y", "%d/%m"]:
                    try:
                        target_date = datetime.strptime(clean_val, fmt)
                        break
                    except ValueError: continue
        except: pass
        if target_date:
            return target_date.replace(year=year, hour=0, minute=0, second=0, microsecond=0)
        return None

    a_start = normalize_date_val(attr_start_val, ref_year)
    a_end = normalize_date_val(attr_end_val, ref_year)

    if attraction.type == 'festival' and (not a_start or not a_end):
        return False

    is_valid = True
    if trip_start and a_start:
        t_start = trip_start.replace(hour=0, minute=0, second=0, microsecond=0)
        if a_start < t_start: is_valid = False
    if trip_end and a_end:
        t_end = trip_end.replace(hour=0, minute=0, second=0, microsecond=0)
        if a_end > t_end: is_valid = False

    return is_valid

def get_user_interest_tags(user_id):
    if not user_id: return set()
    favorite_tags = db.session.query(Tag.tag_name)\
        .join(Attraction.tags).join(FavoriteAttraction)\
        .filter(FavoriteAttraction.user_id == user_id).all()
    return {t[0] for t in favorite_tags}

# --- HÀM TÍNH ĐIỂM (UPDATED - FIX LỖI TÌM KIẾM) ---
def calculate_match_score(attraction, interest_tags, search_term_norm):
    base_score = 0   # Điểm khớp từ khóa (BẮT BUỘC nếu có search)
    bonus_score = 0  # Điểm phụ (Rating, Sở thích...)

    attr_tags = {t.tag_name for t in attraction.tags}
    
    # 1. KIỂM TRA TỪ KHÓA (Logic chặt chẽ hơn)
    if search_term_norm:
        attr_name_norm = to_unaccent(attraction.name.lower())
        attr_location_norm = to_unaccent((attraction.location or "").lower()) # Thêm tìm kiếm theo Vị trí
        attr_desc_norm = to_unaccent((attraction.brief_description or "").lower())

        # Check Name
        if search_term_norm in attr_name_norm:
            base_score += 100
        # Check Location (Quan trọng: Tìm "Đà Nẵng" sẽ khớp vào đây)
        elif search_term_norm in attr_location_norm:
            base_score += 80
        # Check Description
        elif search_term_norm in attr_desc_norm:
            base_score += 50
        # Check Tags
        else:
            for tag in attr_tags:
                if search_term_norm in to_unaccent(tag.lower()):
                    base_score += 50
                    break
        
        # CHỐT: Nếu có từ khóa mà Base Score vẫn bằng 0 -> LOẠI NGAY (Return 0)
        if base_score == 0:
            return 0
    else:
        # Nếu không nhập gì -> Mặc định là khớp
        base_score = 1

    # 2. TÍNH ĐIỂM THƯỞNG (Chỉ cộng nếu đã qua vòng từ khóa)
    matched_interests = attr_tags.intersection(interest_tags)
    bonus_score += len(matched_interests) * 5
    
    if attraction.average_rating:
        bonus_score += attraction.average_rating * 2
        
    try: bonus_score += len(attraction.reviews) * 0.1
    except: pass

    return base_score + bonus_score

province_map = {
    "TPHCM": "Thành phố Hồ Chí Minh", "SG": "Thành phố Hồ Chí Minh", "SAIGON": "Thành phố Hồ Chí Minh",
    "HN": "Hà Nội", "ĐN": "Đà Nẵng", "DANANG": "Đà Nẵng",
    "HP": "Hải Phòng", "BD": "Bình Dương", "CT": "Cần Thơ", 
    "ĐL": "Đà Lạt", "DALAT": "Đà Lạt", 
    "NT": "Nha Trang", "VT": "Vũng Tàu"
}

# --- SERVICE CHÍNH ---

def smart_recommendation_service(types_list=[], user_id=None, search_term=None, limit=50, start_date_str=None, end_date_str=None):
    
    query = Attraction.query.options(joinedload(Attraction.tags))
    
    search_term_norm = ""
    if search_term:
        raw_search = search_term.strip().upper()
        # Map từ viết tắt
        mapped_term = province_map.get(raw_search, search_term)
        search_term_norm = to_unaccent(mapped_term.lower())

    if types_list:
        normalized_types = [t.strip() for t in types_list if t.strip()]
        if normalized_types:
            festival_alias = aliased(Festival)
            cultural_spot_alias = aliased(CulturalSpot)
            query = query.outerjoin(festival_alias, festival_alias.id == Attraction.id)
            query = query.outerjoin(cultural_spot_alias, cultural_spot_alias.id == Attraction.id)
            query = query.outerjoin(Attraction.tags)
            
            type_conditions = []
            for t in normalized_types:
                if t == 'Lễ hội': type_conditions.append(Attraction.type == 'festival')
                elif t == 'Thiên nhiên':
                    type_conditions.append(or_(Attraction.type == 'nature', Tag.tag_name.in_(['Thiên nhiên', 'Sinh thái', 'Núi rừng', 'Biển', 'Hang động'])))
                elif t == 'Đền/Chùa': 
                    type_conditions.append(or_(cultural_spot_alias.spot_type.in_(['Đền', 'Chùa', 'Tôn giáo']), Tag.tag_name.in_(['Tâm linh', 'Phật giáo', 'Đền', 'Chùa'])))
                elif t == 'Làng nghề':
                    type_conditions.append(or_(cultural_spot_alias.spot_type == 'Làng nghề', Tag.tag_name.in_(['Làng nghề', 'Thủ công'])))
                else:
                    type_conditions.append(or_(cultural_spot_alias.spot_type == t, Tag.tag_name == t))

            if type_conditions: query = query.filter(or_(*type_conditions))

    all_attractions = query.distinct().all()

    # Xử lý input date
    def parse_input_date(d_str):
        if not d_str: return None
        for fmt in ["%d/%m/%Y", "%Y-%m-%d"]:
            try: return datetime.strptime(d_str, fmt)
            except ValueError: continue
        return None

    trip_start = parse_input_date(start_date_str)
    trip_end = parse_input_date(end_date_str)

    if search_term:
        print(f"--- FILTERING BY TERM: '{search_term}' (Norm: '{search_term_norm}') ---")

    interest_tags = get_user_interest_tags(user_id)
    final_results = []
    
    for attr in all_attractions:
        # 1. Check Ngày
        if trip_start or trip_end:
            if not check_strict_date_filter(attr, trip_start, trip_end):
                continue 

        # 2. Check Từ khóa & Tính điểm
        score = calculate_match_score(attr, interest_tags, search_term_norm)
        
        # CHỈ LẤY KHI SCORE > 0
        if score > 0:
            final_results.append({
                "attraction": attr,
                "score": score,
                "match_reason": "Phù hợp từ khóa" if search_term_norm else "Gợi ý phổ biến"
            })
    
    final_results.sort(key=lambda x: x["score"], reverse=True)
    limited_results = final_results[:limit]
    
    return [
        {
            **item["attraction"].to_json_brief(),
            "recommendationScore": item["score"], 
            "matchReason": item["match_reason"]
        } 
        for item in limited_results
    ]

# --- (Giữ nguyên phần Nearby function) ---
def get_nearby_attr(attraction_id):
    target = Attraction.query.get(attraction_id)
    if not target: raise LookupError("Không tìm thấy địa điểm")
    if not target.nearby_attractions: return []
    nearby_attractions = Attraction.query.filter(Attraction.id.in_(target.nearby_attractions)).all()
    return [a.to_json_brief() for a in nearby_attractions]

def precompute_nearby_attractions(radius=10):
    pass
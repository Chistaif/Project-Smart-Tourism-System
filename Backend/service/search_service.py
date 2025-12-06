from sqlalchemy import or_
from sqlalchemy.orm import aliased, joinedload
from models import db, Attraction, Festival, CulturalSpot, Tag, FavoriteAttraction
from .tour_service import get_route_with_cache
from functools import lru_cache
import unicodedata

# NEW SEARCH LOGIC
def get_user_interest_tags(user_id):
    """
    Bước 1: Phân tích sở thích người dùng.
    Lấy danh sách các Tag từ những địa điểm mà User đã bấm "Yêu thích".
    """
    # TH: chx login
    if not user_id:
        return set()
    
    # Join bảng Favorite -> Attraction -> Tags
    favorite_tags = db.session.query(Tag.tag_name)\
        .join(Attraction.tags)\
        .join(FavoriteAttraction)\
        .filter(FavoriteAttraction.user_id == user_id)\
        .all()
    
    # Trả về set các tag (VD: {'Biển', 'Ẩm thực', 'Di tích'})
    return {t[0] for t in favorite_tags}

def to_unaccent(text):
    return ''.join(c for c in unicodedata.normalize('NFD', text) if unicodedata.category(c) != 'Mn')

def calculate_score(attraction, interest_tags, search_keywords):
    """
    Bước 2: Hàm tính điểm cho 1 địa điểm dựa trên các tiêu chí
    1. Khớp search keyword 50-100đ
    2: Khớp tag sở thích   3đ/tag
    3. Rating              1.5đ/sao
    4. Số review 1đ        0.1đ/bài
    """
    score = 0

    attr_tags = {t.tag_name for t in attraction.tags}

    # --- Tiêu chí 1 ---
    if search_keywords:
        # Kiểm tra xem tên/mô tả 
        query_lower = to_unaccent(search_keywords.lower())
        if query_lower in to_unaccent(attraction.name.lower()):
            score += 100  # Khớp tên -> ưu tiên cực cao
        elif query_lower in to_unaccent(attraction.brief_description.lower()):
            score += 50
            
        # Kiểm tra tag
        for tag in attr_tags:
            if to_unaccent(tag.lower()) in query_lower:
                score += 50 

    # --- Tiêu chí 2 ---
    matched_interests = attr_tags.intersection(interest_tags)
    score += len(matched_interests) * 3
    
    # --- Tiêu chí 3 ---
    if attraction.average_rating:
        score += attraction.average_rating * 1.5
        
    # --- Tiêu chí 4 ---
    review_count = len(attraction.reviews)
    score += review_count * 0.1

    return score

province_map = {
    "TPHCM": "Thành phố Hồ Chí Minh",
    "SG": "Thành phố Hồ Chí Minh",
    "HN": "Hà Nội",
    "ĐN": "Đà Nẵng",
    "HP": "Hải Phòng",
    "BD": "Bình Dương",
    "HT": "Hà Tây",
    "CT": "Cần Thơ",
    "ĐL": "Đà Lạt",
    "NT": "Nha Trang",
    "BRVT": "Bà Rịa Vũng Tàu",
    "VT": "Vũng Tàu"
}

def smart_recommendation_service(types_list=[], user_id=None, search_term=None, limit=50):
    """
    Service search thông minh: 
    Kết hợp tìm theo Type, SpotType và cả Tag để đảm bảo không bị sót dữ liệu.
    """
    # Lọc theo types_list trước khi tính điểm
    query = Attraction.query.options(joinedload(Attraction.tags))

    if search_term:
        search_term = to_unaccent(search_term.upper())
        search_term = province_map.get(search_term, search_term)

    if types_list:
        normalized_types = [t.strip() for t in types_list if isinstance(t, str) and t.strip()]
        
        if normalized_types:
            # Alias cho các bảng để tránh conflict
            festival_alias = aliased(Festival)
            cultural_spot_alias = aliased(CulturalSpot)
            
            # Join các bảng liên quan
            query = query.outerjoin(festival_alias, festival_alias.id == Attraction.id)
            query = query.outerjoin(cultural_spot_alias, cultural_spot_alias.id == Attraction.id)
            # Join với Tag để tìm kiếm linh hoạt hơn
            query = query.outerjoin(Attraction.tags)
            
            type_conditions = []
            
            for t in normalized_types:
                # 1. Xử lý Lễ hội
                if t == 'Lễ hội':
                    type_conditions.append(Attraction.type == 'festival')
                
                # 2. Xử lý Thiên nhiên (Tìm theo type nature HOẶC tag liên quan)
                elif t == 'Thiên nhiên':
                    type_conditions.append(or_(
                        Attraction.type == 'nature',
                        Tag.tag_name.in_(['Thiên nhiên', 'Sinh thái', 'Núi rừng', 'Biển', 'Hang động'])
                    ))
                
                # 3. Xử lý Đền / Chùa (Tìm theo spot_type HOẶC tag tâm linh)
                elif t == 'Đền/Chùa': 
                    type_conditions.append(or_(
                        cultural_spot_alias.spot_type.in_(['Đền', 'Chùa', 'Tôn giáo']),
                        Tag.tag_name.in_(['Tâm linh', 'Phật giáo', 'Đền', 'Chùa', 'Hành hương'])
                    ))
                
                # 4. Xử lý Làng nghề
                elif t == 'Làng nghề':
                    type_conditions.append(or_(
                        cultural_spot_alias.spot_type == 'Làng nghề',
                        Tag.tag_name.in_(['Làng nghề', 'Thủ công', 'Truyền thống'])
                    ))
                
                # 5. Các loại hình khác (Di tích, Bảo tàng...)
                else:
                    type_conditions.append(or_(
                        cultural_spot_alias.spot_type == t,
                        Tag.tag_name == t
                    ))

            # Áp dụng bộ lọc (Dùng OR để lấy tập hợp các loại đã chọn)
            if type_conditions:
                query = query.filter(or_(*type_conditions))
    
    # Lấy danh sách (dùng distinct để loại bỏ bản ghi trùng do join với tags)
    all_attractions = query.distinct().all()

    # --- Phần tính điểm và trả về giữ nguyên như cũ ---
    interest_tags = get_user_interest_tags(user_id)

    @lru_cache(maxsize=128)
    def cached_calculate_score(attr):
        return calculate_score(attr, interest_tags, search_term)
    
    scored_results = []
    for attr in all_attractions:
        score = cached_calculate_score(attr)
        
        if score > 0 or not search_term:
            scored_results.append({
                "attraction": attr,
                "score": score,
                "match_reason": "Phù hợp sở thích" if score > 5 else "Gợi ý phổ biến"
            })
    
    scored_results.sort(key=lambda x: x["score"], reverse=True)
    final_results = scored_results[:limit]
    
    return [
        {
            **item["attraction"].to_json_brief(),
            "recommendationScore": item["score"], 
            "matchReason": item["match_reason"]
        } 
        for item in final_results
    ]


def get_nearby_attr(attraction_id):
    target = Attraction.query.get(attraction_id)
    if not target:
        raise LookupError("Không tìm thấy địa điểm")

    nearby_attractions = Attraction.query.filter(Attraction.id.in_(target.nearby_attractions)).all()
    return {a.to_json_brief() for a in nearby_attractions}


def precompute_nearby_attractions(radius=5):
    print(f"Starting pre-computation of nearby attractions with radius {radius}km...")

    all_attractions = Attraction.query.all()
    total_count = len(all_attractions)

    if total_count == 0:
        print("No attractions found to process!")
        return

    # Tạo cache route chung cho toàn bộ quá trình pre-compute
    # Điều này giúp tránh tính toán lại các route đã được tính
    route_cache = {}

    print(f"Processing {total_count} attractions...")

    processed_count = 0

    for attraction in all_attractions:
        nearby_ids = []

        # Tối ưu: Chỉ kiểm tra với những attraction có cùng hoặc tọa độ gần
        # Giảm số lượng so sánh không cần thiết
        for other in all_attractions:
            if attraction.id != other.id:
                # Sử dụng cache route chung để tránh tính toán lại
                distance_km, _, _ = get_route_with_cache((attraction.lat, attraction.lon), (other.lat, other.lon), route_cache)
                if distance_km <= radius:
                    nearby_ids.append(other.id)

        attraction.nearby_attractions = nearby_ids
        processed_count += 1

        # Hiển thị tiến trình mỗi 50 attractions
        if processed_count % 50 == 0 or processed_count == total_count:
            print(f"Processed {processed_count}/{total_count} attractions...")

    db.session.commit()
    print(f"Successfully pre-computed nearby attractions for {total_count} attractions!")
    print(f"Route cache contains {len(route_cache)} cached routes.")
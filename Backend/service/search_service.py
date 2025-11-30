from sqlalchemy import or_
from sqlalchemy.orm import aliased
from models import db, Attraction, Festival, CulturalSpot, Tag, FavoriteAttraction
from .tour_service import get_routing_info

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


def calculate_score(attraction, interest_tags, search_keywords):
    """
    Bước 2: Hàm tính điểm cho 1 địa điểm dựa trên các tiêu chí
    1. Khớp search keyword 5-10đ
    2: Khớp tag sở thích   3đ/tag
    3. Rating              1.5đ/sao
    4. Số review 1đ        0.1đ/bài
    """
    score = 0

    attr_tags = {t.tag_name for t in attraction.tags}

    # --- Tiêu chí 1 ---
    if search_keywords:
        # Kiểm tra xem tên/mô tả 
        query_lower = search_keywords.lower()
        if query_lower in attraction.name.lower():
            score += 10  # Khớp tên -> ưu tiên cực cao
        elif query_lower in attraction.brief_description.lower():
            score += 5
            
        # Kiểm tra tag
        for tag in attr_tags:
            if tag.lower() in query_lower:
                score += 5 

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

def smart_recommendation_service(types_list=[], user_id=None, search_term=None, limit=50):
    """
    Service chính để search,
    giới hạn top 50 để tránh việc hiển thị tràn lan 
    """
    # Lọc theo types_list trước khi tính điểm
    query = Attraction.query

    if types_list:
        # Chuẩn hóa types_list
        normalized_types = [
            t.strip() for t in types_list
            if isinstance(t, str) and t.strip()
        ]
        
        if normalized_types:
            festival_alias = aliased(Festival)
            cultural_spot_alias = aliased(CulturalSpot)
            
            # Join với các bảng con
            query = query.outerjoin(festival_alias, festival_alias.id == Attraction.id)
            query = query.outerjoin(cultural_spot_alias, cultural_spot_alias.id == Attraction.id)
            
            type_conditions = []
            
            # Tách festival và cultural spot types
            spot_types_from_list = [t for t in normalized_types if t != 'Lễ hội']
            
            # Điều kiện cho festival
            if 'Lễ hội' in normalized_types:
                type_conditions.append(Attraction.type == 'festival')
            
            # Điều kiện cho cultural spots
            if spot_types_from_list:
                type_conditions.append(cultural_spot_alias.spot_type.in_(spot_types_from_list))
            
            # Áp dụng bộ lọc types
            if type_conditions:
                query = query.filter(or_(*type_conditions))
    
    # Lấy danh sách attractions đã được lọc
    all_attractions = query.distinct().all()

    # lấy sở thích
    interest_tags = get_user_interest_tags(user_id)
    
    # Tính điểm cho từng địa điểm
    scored_results = []
    for attr in all_attractions:
        score = calculate_score(attr, interest_tags, search_term)
        
        # Chỉ lấy những địa điểm có điểm > 0 (có liên quan)
        # Hoặc nếu không tìm kiếm gì thì lấy hết để gợi ý ngẫu nhiên
        if score > 0 or not search_term:
            scored_results.append({
                "attraction": attr,
                "score": score,
                "match_reason": "Phù hợp sở thích" if score > 5 else "Gợi ý phổ biến"
            })
    
    # Sắp xếp theo điểm từ cao xuống thấp
    scored_results.sort(key=lambda x: x["score"], reverse=True)
    
    # Cắt lấy Top N
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


def precompute_nearby_attractions(radius=3):
    print(f"Starting pre-computation of nearby attractions with radius {radius}km...")

    all_attractions = Attraction.query.all()
    total_count = len(all_attractions)
    processed_count = 0

    for attraction in all_attractions:
        nearby_ids = []

        for other in all_attractions:
            if attraction.id != other.id:
                distance_km, _, _ = get_routing_info((attraction.lat, attraction.lon), (other.lat, other.lon))
                if distance_km <= radius:
                    nearby_ids.append(other.id)

        attraction.nearby_attractions = nearby_ids
        processed_count += 1

    db.session.commit()
    print(f"Successfully pre-computed nearby attractions for {total_count} attractions!")
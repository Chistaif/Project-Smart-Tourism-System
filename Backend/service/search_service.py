from sqlalchemy import or_
from models import db, Attraction, Festival, CulturalSpot, Tag, FavoriteAttraction

def search_service(types_list, search_term):
    query = db.session.query(Attraction)
    query = query.outerjoin(Festival, Festival.id == Attraction.id)
    query = query.outerjoin(CulturalSpot, CulturalSpot.id == Attraction.id)
    query = query.outerjoin(Attraction.tags)

    # Lọc theo nội dung tìm kiếm (tên địa điểm / tên tỉnh tp / tag)
    if search_term:
        search_pattern = f"%{search_term}%"
        query = query.filter(
            or_(Attraction.name.ilike(search_pattern),
                Attraction.location.ilike(search_pattern),
                Attraction.tags.any(Tag.tag_name.ilike(search_pattern))
            )
        )

    # Lọc theo loại (Lễ hội / Bảo tàng / ...)
    if types_list:
        type_conditions = []
            
        # Tách các loại CulturalSpot (Bảo tàng, Làng nghề, v.v.)
        spot_types_from_list = [t for t in types_list if t != 'Lễ hội']
        
        # Nếu người dùng check "Lễ hội"
        if 'Lễ hội' in types_list:
            type_conditions.append(Attraction.type == 'festival')
            
        # Nếu người dùng check các loại khác
        if spot_types_from_list:
            type_conditions.append(CulturalSpot.spot_type.in_(spot_types_from_list))
            
        # (Lấy những điểm LÀ 'Lễ hội' HOẶC CÓ 'spot_type' nằm trong danh sách)
        if type_conditions:
            query = query.filter(or_(*type_conditions))

    # # Bộ lọc Ngày
    # # Chỉ lấy (Attraction.type != 'festival') HOẶC (Festival.time_end >= date)
    # query = query.filter(
    #     or_(
    #         Attraction.type != 'festival',
    #         Festival.time_end >= date
    #     )
    # ).distinct()
    # results = query.all()

    festivals_list = []
    cultural_spots_list = []
    other_attractions_list = []
    for r in query.distinct():
        item_data = {
            "id": r.id,
            "name": r.name,
            "imageUrl": r.image_url, 
            # "type": r.type,
            "averageRating": r.average_rating
        }
        if r.type == 'festival': 
            festivals_list.append(item_data)
        elif r.type == 'cultural_spot': 
            cultural_spots_list.append(item_data)
        else: other_attractions_list.append(item_data)

    # Có thể thêm logic đưa những địa điểm hot hit lên trên đầu danh sách ở đây dựa vào các thuật toán RS

    # Sắp xếp các danh sách dựa trên rating, từ cao đến thấp
    festivals_list.sort(key=lambda item: item.get('averageRating', 0) or 0, reverse=True)
    cultural_spots_list.sort(key=lambda item: item.get('averageRating', 0) or 0, reverse=True)
    other_attractions_list.sort(key=lambda item: item.get('averageRating', 0) or 0, reverse=True)

    result_data = {
        "festivals": festivals_list,
        "culturalSpots": cultural_spots_list,
        "otherAttractions": other_attractions_list
    }
    return result_data
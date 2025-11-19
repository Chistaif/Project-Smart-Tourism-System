from sqlalchemy import or_
from sqlalchemy.orm import aliased
from models import db, Attraction, Festival, CulturalSpot, Tag, FavoriteAttraction


def search_service(types_list, search_term, user_id=None):
    types_list = types_list or []
    if not isinstance(types_list, (list, tuple)):
        types_list = [types_list]
    normalized_types = [
        t.strip() for t in types_list
        if isinstance(t, str) and t.strip()
    ]

    festival_alias = aliased(Festival, flat=True)
    cultural_spot_alias = aliased(CulturalSpot, flat=True)

    query = db.session.query(Attraction)
    query = query.outerjoin(festival_alias, festival_alias.id == Attraction.id)
    query = query.outerjoin(cultural_spot_alias, cultural_spot_alias.id == Attraction.id)
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

    # Chuẩn hóa & validate loại (Lễ hội / Bảo tàng / ...)
    # -> Nếu frontend gửi typeList sai chính tả, ta báo lỗi 400 rõ ràng
    if normalized_types:
        # Cho phép 'Lễ hội' + tất cả spot_type hiện có trong DB
        allowed_types = {'Lễ hội'}
        existing_spot_types = (
            db.session.query(CulturalSpot.spot_type)
            .distinct()
            .all()
        )
        allowed_types.update(
            value for value, in existing_spot_types if value
        )

        invalid_types = [t for t in normalized_types if t not in allowed_types]
        if invalid_types:
            raise ValueError(
                f"Loại không hợp lệ: {', '.join(invalid_types)}"
            )

        type_conditions = []

        # Tách các loại CulturalSpot (Bảo tàng, Làng nghề, v.v.)
        spot_types_from_list = [t for t in normalized_types if t != 'Lễ hội']

        # Nếu người dùng check "Lễ hội"
        if 'Lễ hội' in normalized_types:
            type_conditions.append(Attraction.type == 'festival')

        # Nếu người dùng check các loại khác
        if spot_types_from_list:
            type_conditions.append(cultural_spot_alias.spot_type.in_(spot_types_from_list))

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

    # Nếu user đang đăng nhập thì ưu tiên các địa điểm đã đánh dấu Favorite
    favorite_ids = set()
    if user_id is not None:
        favorite_rows = (
            FavoriteAttraction.query
            .with_entities(FavoriteAttraction.attraction_id)
            .filter_by(user_id=user_id)
            .all()
        )
        favorite_ids = {row[0] for row in favorite_rows}

    festivals_list = []
    cultural_spots_list = []
    other_attractions_list = []
    for r in query.distinct():
        is_favorite = r.id in favorite_ids
        item_data = {
            "id": r.id,
            "name": r.name,
            "imageUrl": r.image_url, 
            "averageRating": r.average_rating,
            "isFavorite": is_favorite
        }
        if r.type == 'festival': 
            festivals_list.append(item_data)
        elif r.type == 'cultural_spot': 
            cultural_spots_list.append(item_data)
        else: other_attractions_list.append(item_data)

    def sort_items(items):
        items.sort(
            key=lambda item: (
                item.get("isFavorite", False),
                item.get('averageRating', 0) or 0
            ),
            reverse=True
        )

    sort_items(festivals_list)
    sort_items(cultural_spots_list)
    sort_items(other_attractions_list)

    result_data = {
        "festivals": festivals_list,
        "culturalSpots": cultural_spots_list,
        "otherAttractions": other_attractions_list
    }
    return result_data
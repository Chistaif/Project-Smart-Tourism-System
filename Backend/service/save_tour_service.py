from models import db, SavedTour, Attraction, User

def save_tour_service(user_id, tour_name, attraction_ids, start_date=None, end_date=None, start_lat=None, start_lon=None, start_point_name=None):
    """
    Service để lưu tour mới
    """
    # Validation
    if not user_id:
        raise ValueError("userId là bắt buộc")
    if not tour_name or not tour_name.strip():
        raise ValueError("tourName là bắt buộc")
    if not attraction_ids or len(attraction_ids) == 0:
        raise ValueError("attractionIds không được rỗng")
    
    # Loại bỏ duplicate attraction_ids và validate
    unique_attraction_ids = list(set(attraction_ids))
    if len(unique_attraction_ids) != len(attraction_ids):
        # Có duplicate, nhưng vẫn tiếp tục với danh sách đã loại bỏ duplicate
        pass
    
    # Kiểm tra user tồn tại
    user = User.query.get(user_id)
    if not user:
        raise LookupError("Không tìm thấy user")
    
    # Kiểm tra tên tour đã tồn tại cho user này chưa
    existing_tour = SavedTour.query.filter_by(user_id=user_id, tour_name=tour_name.strip()).first()
    if existing_tour:
        raise ValueError(f"Tour '{tour_name}' đã tồn tại")
    
    # Kiểm tra attractions tồn tại
    attractions = Attraction.query.filter(Attraction.id.in_(unique_attraction_ids)).all()
    if len(attractions) != len(unique_attraction_ids):
        raise ValueError("Một số attraction không tồn tại")
    
    new_tour = SavedTour(
        user_id=user_id, 
        tour_name=tour_name.strip(),
        start_date=start_date,
        end_date=end_date,
        start_lat=start_lat,
        start_lon=start_lon,
        start_point_name=start_point_name 
    )
    db.session.add(new_tour)
    
    for attr in attractions:
        new_tour.attractions.append(attr)

    db.session.commit()
    
    return {
        "tour_id": new_tour.tour_id,
        "tour_name": new_tour.tour_name,
        "created_at": new_tour.created_at.isoformat(),
        "user_id": new_tour.user_id,
        "attraction_count": len(attractions)
    }

def unsave_tour_service(user_id, tour_id):
    """
    Service để hủy lưu tour
    """
    # Validation
    if not user_id:
        raise ValueError("userId là bắt buộc")
    if not tour_id:
        raise ValueError("tourId là bắt buộc")
    
    # Kiểm tra tour tồn tại và thuộc về user
    tour = SavedTour.query.filter_by(tour_id=tour_id, user_id=user_id).first()
    if not tour:
        raise LookupError("Không tìm thấy tour hoặc không có quyền truy cập")
    
    tour_name = tour.tour_name
    db.session.delete(tour)
    db.session.commit()
    
    return tour_name

def get_saved_tours_service(user_id):
    """
    Service để lấy danh sách tours đã lưu của user
    """
    if not user_id:
        raise ValueError("userId là bắt buộc")
    
    # Kiểm tra user tồn tại
    user = User.query.get(user_id)
    if not user:
        raise LookupError("Không tìm thấy user")
    
    # Lấy danh sách tours đã lưu
    saved_tours = SavedTour.query.filter_by(user_id=user_id)\
        .order_by(SavedTour.created_at.desc()).all()
    
    tours_data = []
    for tour in saved_tours:
        attractions = [{
            "id": attr.id,
            "name": attr.name,
            "lat": attr.lat,
            "lon": attr.lon,
            "image_url": attr.image_url
        } for attr in tour.attractions]
        
        tours_data.append({
            "tour_id": tour.tour_id,
            "tour_name": tour.tour_name,
            "created_at": tour.created_at.isoformat(),
            "user_id": tour.user_id,
            "attractions": attractions,
            "attraction_count": len(attractions),
            "startDate": tour.start_date.isoformat() if tour.start_date else None,
            "endDate": tour.end_date.isoformat() if tour.end_date else None,
            "startPoint": {
                "name": getattr(tour, 'start_point_name', None), # Dùng getattr để tương thích ngược
                "lat": getattr(tour, 'start_lat', None),
                "lon": getattr(tour, 'start_lon', None),
            }
        })
    
    return tours_data
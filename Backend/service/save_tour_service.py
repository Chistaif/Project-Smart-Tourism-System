from models import db, SavedTour, Attraction, User

def save_tour_service(user_id, tour_name, attraction_ids):
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
    
    # Kiểm tra user tồn tại
    user = User.query.get(user_id)
    if not user:
        raise LookupError("Không tìm thấy user")
    
    # Kiểm tra tên tour đã tồn tại cho user này chưa
    existing_tour = SavedTour.query.filter_by(user_id=user_id, tour_name=tour_name.strip()).first()
    if existing_tour:
        raise ValueError(f"Tour '{tour_name}' đã tồn tại")
    
    # Kiểm tra attractions tồn tại
    attractions = Attraction.query.filter(Attraction.id.in_(attraction_ids)).all()
    if len(attractions) != len(attraction_ids):
        raise ValueError("Một số attraction không tồn tại")
    
    # Tạo tour mới
    new_tour = SavedTour(
        tour_name=tour_name.strip(),
        user_id=user_id,
        attractions=attractions  # SQLAlchemy sẽ tự động thêm vào bảng tour_attractions
    )
    
    db.session.add(new_tour)
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
            "attraction_count": len(attractions)
        })
    
    return tours_data
from models import db, SavedTour, Attraction
import pandas as pd        
import requests   

def create_tour_service(data):
    """
    Xử lý logic tạo tour.
    data = {
        "tour_name": "...",
        "user_id": 1,
        "attraction_ids": [1,2,3]
    }
    """

    tour_name = data.get("tour_name")
    user_id = data.get("user_id")
    ids = data.get("attraction_ids", [])

    if not tour_name or not user_id:
        raise ValueError("Thiếu tour_name hoặc user_id")

    # Tạo tour mới
    new_tour = SavedTour(
        tour_name=tour_name,
        user_id=user_id
    )
    db.session.add(new_tour)
    db.session.flush()  # cần flush để có tour_id

    # Gán attractions
    for attraction_id in ids:
        attraction = Attraction.query.get(attraction_id)
        if attraction:
            new_tour.attractions.append(attraction)

    db.session.commit()

    return {
        "message": "Tạo tour thành công",
        "tour_id": new_tour.tour_id
    }


def get_tour_creator_info_service():
    """
    Dùng để trả suggestion, cấu hình mặc định, pre-fill data…
    """
    return {
        "message": "API tạo tour hoạt động tốt",
        "suggestion": ["Chọn địa điểm", "Chọn số ngày", "Tự động xếp lịch"]
    }

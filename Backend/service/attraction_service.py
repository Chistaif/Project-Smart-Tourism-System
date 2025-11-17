from models import db, Attraction, Review

def get_attraction_detail_service(attraction_id):
    attraction = Attraction.query.get_or_404(attraction_id)
    attraction_data = attraction.to_json()

    reviews = Review.query.filter_by(attraction_id=attraction_id).order_by(Review.created_at.desc()).all()
    reviews_data = [review.to_json() for review in reviews]

    response_data = {
        "infomation": attraction_data,
        "reviews": reviews_data
    }
    return response_data

def update_attraction_rating_service(attraction_id, commit_now=True):
    """
    Tính toán và cập nhật điểm rating trung bình cho một attraction.
    Hàm này nên được gọi bất cứ khi nào có review mới/sửa/xóa.

    :param attraction_id: ID của attraction cần cập nhật
    :param commit_now: Nếu True, hàm sẽ tự commit. 
                       Nếu False, hàm chỉ thêm vào session (dùng cho script init_db)
    """
    
    # 1. Tìm attraction
    attraction = Attraction.query.get(attraction_id)
    if not attraction:
        print(f"Warning: Không tìm thấy attraction ID {attraction_id} để cập nhật rating.")
        return False

    # 2. Lấy tất cả review của attraction đó
    reviews = Review.query.filter_by(attraction_id=attraction.id).all()

    # 3. Tính toán
    if reviews:
        total_score = sum(r.rating_score for r in reviews)
        avg_score = total_score / len(reviews)
        attraction.average_rating = round(avg_score, 1)
    else:
        # Nếu không có review
        attraction.average_rating = 0.0
    
    # 4. Lưu thay đổi (nếu được yêu cầu)
    if commit_now:
        try:
            db.session.add(attraction)
            db.session.commit()
            return True
        except Exception as e:
            db.session.rollback()
            print(f"Lỗi khi cập nhật rating cho ID {attraction_id}: {e}")
            return False
    else:
        # Nếu không commit, chỉ cần thêm vào session để lệnh commit bên ngoài (của init_db) xử lý
        db.session.add(attraction)
        return True
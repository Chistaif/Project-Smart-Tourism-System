from models import db, Attraction, Review, FavoriteAttraction

def get_attraction_detail_service(attraction_id, user_id=None):
    attraction = Attraction.query.get_or_404(attraction_id)
    attraction_data = attraction.to_json()

    reviews = Review.query.filter_by(attraction_id=attraction_id).order_by(Review.created_at.desc()).all()
    reviews_data = [review.to_json() for review in reviews]

    favorite_info = None
    if user_id:
        favorite_exists = FavoriteAttraction.query.filter_by(
            user_id=user_id,
            attraction_id=attraction_id
        ).first() is not None
        favorite_info = {
            "userId": user_id,
            "isFavorite": favorite_exists
        }

    response_data = {
        "infomation": attraction_data,
        "reviews": reviews_data
    }
    if favorite_info is not None:
        response_data["favorite"] = favorite_info

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
    

def _validate_review_payload(data, require_review_id=False):
    """
    Chuẩn hóa và kiểm tra dữ liệu review từ frontend.
    Frontend chỉ cần gửi dạng JSON:
        {
            "userId": <int>,
            "content": <string>,
            "ratingScore": 1..5,
            "reviewId": <int> (chỉ bắt buộc với update/delete)
        }
    """
    if not data:
        raise ValueError("Thiếu dữ liệu review.")

    user_id = data.get('userId')
    if not user_id:
        raise ValueError('Chưa có tài khoản')

    content = (data.get('content') or "").strip()
    if not content:
        raise ValueError("Nội dung review không được để trống.")

    try:
        rating_score = int(data.get('ratingScore', 0))
    except (TypeError, ValueError):
        raise ValueError("ratingScore phải là số.")

    if rating_score < 1 or rating_score > 5:
        raise ValueError("ratingScore phải nằm trong khoảng 1-5.")

    review_id = data.get('reviewId')
    if require_review_id and not review_id:
        raise ValueError("Thiếu reviewId.")

    return {
        "user_id": user_id,
        "content": content,
        "rating_score": rating_score,
        "review_id": review_id
    }


def _get_review_or_404(review_id, attraction_id):
    review = Review.query.filter_by(review_id=review_id, attraction_id=attraction_id).first()
    if not review:
        raise LookupError(f"Không tìm thấy review {review_id}.")
    return review


def _assert_owner(review, user_id):
    if review.user_id != user_id:
        raise PermissionError("Bạn không có quyền thao tác review này.")


def create_review(attraction_id, data):
    payload = _validate_review_payload(data)

    new_review = Review(
        content=payload["content"],
        rating_score=payload["rating_score"],
        user_id=payload["user_id"],
        attraction_id=attraction_id
    )

    db.session.add(new_review)
    db.session.commit()
    update_attraction_rating_service(attraction_id)
    return new_review.to_json()


def update_review(attraction_id, data):
    payload = _validate_review_payload(data, require_review_id=True)
    review = _get_review_or_404(payload["review_id"], attraction_id)
    _assert_owner(review, payload["user_id"])

    review.content = payload["content"]
    review.rating_score = payload["rating_score"]
    db.session.commit()
    update_attraction_rating_service(attraction_id)
    return review.to_json()


def delete_review(attraction_id, data):
    payload = _validate_review_payload(data, require_review_id=True)
    review = _get_review_or_404(payload["review_id"], attraction_id)
    _assert_owner(review, payload["user_id"])

    db.session.delete(review)
    db.session.commit()
    update_attraction_rating_service(attraction_id)
    return True


def _validate_favorite_payload(data):
    if not data:
        raise ValueError("Thiếu dữ liệu favorite.")

    user_id = data.get("userId")
    if not user_id:
        raise ValueError("Thiếu userId.")

    try:
        user_id = int(user_id)
    except (TypeError, ValueError):
        raise ValueError("userId phải là số.")

    if user_id <= 0:
        raise ValueError("userId không hợp lệ.")

    raw_is_favorite = data.get("isFavorite")
    if raw_is_favorite is None:
        raise ValueError("Thiếu isFavorite.")

    if isinstance(raw_is_favorite, bool):
        is_favorite = raw_is_favorite
    elif isinstance(raw_is_favorite, str):
        normalized = raw_is_favorite.strip().lower()
        if normalized in ("true", "1", "yes"):
            is_favorite = True
        elif normalized in ("false", "0", "no"):
            is_favorite = False
        else:
            raise ValueError("isFavorite phải là boolean.")
    else:
        is_favorite = bool(raw_is_favorite)

    return {
        "user_id": user_id,
        "is_favorite": is_favorite
    }


def set_favorite(attraction_id, data):
    payload = _validate_favorite_payload(data)

    # Đảm bảo attraction tồn tại
    Attraction.query.get_or_404(attraction_id)

    favorite = FavoriteAttraction.query.filter_by(
        user_id=payload["user_id"],
        attraction_id=attraction_id
    ).first()

    try:
        if payload["is_favorite"]:
            if not favorite:
                favorite = FavoriteAttraction(
                    user_id=payload["user_id"],
                    attraction_id=attraction_id
                )
                db.session.add(favorite)
        else:
            if favorite:
                db.session.delete(favorite)

        db.session.commit()
    except Exception as e:
        db.session.rollback()
        raise e

    return {
        "userId": payload["user_id"],
        "isFavorite": payload["is_favorite"]
    }
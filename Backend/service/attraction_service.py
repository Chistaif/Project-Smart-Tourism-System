from models import Attraction, Review

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
"""Service functions for user-related operations"""
from models import db, User, FavoriteAttraction, Review, Attraction

def get_user_favorites_service(user_id):
    """Get all favorite attractions for a user"""
    favorites = FavoriteAttraction.query.filter_by(user_id=user_id).all()
    attractions = []
    for fav in favorites:
        attraction = Attraction.query.get(fav.attraction_id)
        if attraction:
            attractions.append(attraction.to_json())
    return attractions

def get_user_reviews_service(user_id):
    """Get all reviews written by a user"""
    reviews = Review.query.filter_by(user_id=user_id).order_by(Review.created_at.desc()).all()
    reviews_data = []
    for review in reviews:
        attraction = Attraction.query.get(review.attraction_id)
        review_data = review.to_json()
        if attraction:
            review_data['attraction'] = {   
                'id': attraction.id,
                'name': attraction.name,
                'location': attraction.location,
                'imageUrl': attraction.image_url
            }
        reviews_data.append(review_data)
    return reviews_data


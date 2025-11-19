from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime

db = SQLAlchemy()

# Bảng liên kết Nhiều-Nhiều: Attraction <-> Tag
attraction_tags = db.Table('attraction_tags',
    db.Column('tag_id', db.Integer, db.ForeignKey('tag.id'), primary_key=True),
    db.Column('attraction_id', db.Integer, db.ForeignKey('attraction.id'), primary_key=True)
)

# Bảng liên kết Nhiều-Nhiều: SavedTour <-> Attraction
tour_attractions = db.Table('tour_attractions',
    db.Column('tour_id', db.Integer, db.ForeignKey('saved_tour.tour_id'), primary_key=True),
    db.Column('attraction_id', db.Integer, db.ForeignKey('attraction.id'), primary_key=True)
)

# ======================================================================
# ===                                                                ===
# ===                    Thong tin nguoi dung                        ===
# ===                                                                ===
# ======================================================================
class User(db.Model):
    __tablename__ = 'user'
    user_id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    avatar_url = db.Column(db.String(100), nullable=True, default='default_avatar.png') 

    # Relationships
    reviews = db.relationship('Review', back_populates='user', lazy=True)
    saved_tours = db.relationship('SavedTour', back_populates='user', lazy=True)
    favorite_attractions = db.relationship('FavoriteAttraction', back_populates='user', lazy=True)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_json(self):
        return {
            "username": self.username,
            "avatar_url": self.avatar_url,
            "email": self.email
        }

# ======================================================================
# ===                                                                ===
# ===                    Thong tin diem den                          ===
# ===                                                                ===
# ======================================================================
class Attraction(db.Model):
    __tablename__ = 'attraction'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100))
    location = db.Column(db.String(100))
    brief_description = db.Column(db.String(200))
    detail_description = db.Column(db.JSON)
    average_rating = db.Column(db.Float, default=0.0)
    visit_duration = db.Column(db.Integer)
    lat = db.Column(db.Float)
    lon = db.Column(db.Float)
    image_url = db.Column(db.String(200))

    type = db.Column(db.String(50))

    __mapper_args__ = {
        'polymorphic_identity': 'attraction',
        'polymorphic_on': type
    }

    # Relationships
    reviews = db.relationship('Review', back_populates='attraction', cascade="all, delete-orphan")
    tags = db.relationship('Tag', secondary=attraction_tags, back_populates='attractions', lazy='dynamic')
    favorited_by = db.relationship('FavoriteAttraction', back_populates='attraction', cascade="all, delete-orphan")
    tours = db.relationship('SavedTour', secondary=tour_attractions, back_populates='attractions', lazy='dynamic')

    def to_json(self):
        tag_list = [tag.tag_name for tag in self.tags]

        return {
            "id": self.id,
            "name": self.name,
            "location": self.location,
            "briefDescription": self.brief_description,
            "detailDescription": self.detail_description,
            "averageRating": self.average_rating,
            "visitDuration": self.visit_duration,
            "imageUrl": self.image_url,
            "tags": tag_list
        }

class Festival(Attraction):
    __tablename__ = 'festival'
    id = db.Column(db.Integer, db.ForeignKey('attraction.id'), primary_key=True) 
    time_start = db.Column(db.DateTime)
    time_end = db.Column(db.DateTime)

    __mapper_args__ = {
        'polymorphic_identity': 'festival', # Giá trị của cột 'type'
    }

    def to_json(self):
        data = super().to_json()
        data.update({
            "timeStart": self.time_start.isoformat() if self.time_start else None,
            "timeEnd": self.time_end.isoformat() if self.time_end else None,
            "type": "festival"
        })
        return data

class CulturalSpot(Attraction):
    __tablename__ = 'cultural_spot'
    id = db.Column(db.Integer, db.ForeignKey('attraction.id'), primary_key=True)
    opening_hours = db.Column(db.String(100)) # Ví dụ: "8:00 AM - 5:00 PM"
    ticket_price = db.Column(db.Float)
    spot_type = db.Column(db.String(50))  # Phân loại (Bảo tàng, Làng nghề, Di tích...) 

    __mapper_args__ = {
        'polymorphic_identity': 'cultural_spot', # Giá trị của cột 'type'
    }

    def to_json(self):
        data = super().to_json()
        data.update({
            "openingHours": self.opening_hours,
            "ticketPrice": self.ticket_price,
            "spotType": self.spot_type,
            "type": "cultural_spot"
        })
        return data
    

# ======================================================================
# ===                                                                ===
# ===                      Thong tin khac                            ===
# ===                                                                ===
# ======================================================================
class Tag(db.Model):
    __tablename__ = 'tag'
    id = db.Column(db.Integer, primary_key=True)
    tag_name = db.Column(db.String(50), unique=True, nullable=False)

    # Mối quan hệ M2M ngược lại
    attractions = db.relationship('Attraction', secondary=attraction_tags, back_populates='tags', lazy='dynamic')

class Review(db.Model):
    __tablename__ = 'review'
    review_id = db.Column(db.Integer, primary_key=True)
    content = db.Column(db.String(2000))
    rating_score = db.Column(db.Integer, nullable=False) # 1-5 sao
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user_id = db.Column(db.Integer, db.ForeignKey('user.user_id'), nullable=False)
    attraction_id = db.Column(db.Integer, db.ForeignKey('attraction.id'), nullable=False)

    user = db.relationship('User', back_populates='reviews')
    attraction = db.relationship('Attraction', back_populates='reviews')

    def to_json(self):
        return {
            "reviewId": self.review_id,
            "userId": self.user_id,
            "rating": self.rating_score,
            "content": self.content,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "user": self.user.to_json() if self.user else None
        }

class SavedTour(db.Model):
    __tablename__ = 'saved_tour'
    tour_id = db.Column(db.Integer, primary_key=True)
    tour_name = db.Column(db.String(100), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user_id = db.Column(db.Integer, db.ForeignKey('user.user_id'), nullable=False)
    user = db.relationship('User', back_populates='saved_tours')

    # Mối quan hệ M2M
    attractions = db.relationship('Attraction', secondary=tour_attractions, back_populates='tours', lazy='dynamic')

class FavoriteAttraction(db.Model):
    __tablename__ = 'favorite_attraction'
    # Dùng 2 cột làm khóa chính (Composite Primary Key)
    user_id = db.Column(db.Integer, db.ForeignKey('user.user_id'), primary_key=True)
    attraction_id = db.Column(db.Integer, db.ForeignKey('attraction.id'), primary_key=True)
    
    user = db.relationship('User', back_populates='favorite_attractions')
    attraction = db.relationship('Attraction', back_populates='favorited_by')
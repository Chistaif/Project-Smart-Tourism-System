from flask_sqlalchemy import SQLAlchemy
from flask import jsonify
from werkzeug.security import generate_password_hash, check_password_hash

db = SQLAlchemy()

# ======================================================================
class User(db.Model):
    __tablename__ = 'user'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False)
    password = db.Column(db.String(50),nullable=False)
    email = db.Column(db.String(1000), unique=True, nullable=False)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_json(self):
        return jsonify({
            "id": self.id,
            "name": self.name,
            "password": self.password,
            "email": self.email
        })


class Destination(db.Model):
    __tablename__ = 'Destination'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50))
    location = db.Column(db.String(16))
    datetime_start = db.Column(db.DateTime)
    datetime_end = db.Column(db.DateTime)
    brief_description = db.Column(db.String(100))
    detail_description = db.Column(db.String(200))
    ticket_price = db.Column(db.String(50))
    lat = db.Column(db.Float)
    lon = db.Column(db.Float)
    # Relationship đến Tag thông qua TagAssociation
    tags = db.relationship(
        "Tag",
        secondary="tag_association",
        primaryjoin="and_(Destination.id==TagAssociation.object_id, "
                    "TagAssociation.object_type=='Destination')",
        secondaryjoin="Tag.id==TagAssociation.tag_id",
        viewonly=True
    )

    def to_json(self):
        return jsonify({
            "id": self.id,
            "name": self.name,
            "tags": self.tags,
            "briefDescription": self.brief_description,
            "datetimeStart": self.datetime_start,
            "datetimeEnd": self.datetime_end,
            "location": self.location,
            "ticketPrice": self.ticket_price,
            "detailDescription": self.detail_description,
            "lat": self.lat,
            "lon": self.lon
        })


class Attraction(db.Model):
    __tablename__ = 'attraction'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    location = db.Column(db.String(16))
    rating = db.Column(db.Float)
    lat = db.Column(db.Float)
    lon = db.Column(db.Float)

    tags = db.relationship(
        "Tag",
        secondary="tag_association",
        primaryjoin="and_(Attraction.id==TagAssociation.object_id, "
                    "TagAssociation.object_type=='Attraction')",
        secondaryjoin="Tag.id==TagAssociation.tag_id",
        viewonly=True
    )

    def to_json(self):
        return jsonify({
            "id": self.id,
            "name": self.name,
            "location": self.location,
            "rating": self.rating,
            "lat": self.lat,
            "lon": self.lon
        })


# ======================================================================
class Tag(db.Model):
    __tablename__ = 'tag'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), unique=True, nullable=False)

    # Tất cả các liên kết tag đến nhiều loại khác nhau
    associations = db.relationship("TagAssociation", back_populates="tag", cascade="all, delete")


class TagAssociation(db.Model):
    __tablename__ = 'tag_association'
    id = db.Column(db.Integer, primary_key=True)
    tag_id = db.Column(db.Integer, db.ForeignKey('tag.id'))
    object_id = db.Column(db.Integer, nullable=False)      # ID của đối tượng (Festival, Attraction...)
    object_type = db.Column(db.String(50), nullable=False) # Loại đối tượng

    tag = db.relationship("Tag", back_populates="associations")

    # Tuỳ chọn: nếu muốn xóa tag khi đối tượng xóa
    __table_args__ = (
        db.UniqueConstraint('tag_id', 'object_id', 'object_type', name='uix_tag_object'),
    )

# THÊM TAG CHO 1 LỄ HỘI 
# nature = Tag.query.filter_by(name="thiên nhiên").first()
# if not nature:
#     nature = Tag(name="thiên nhiên")

# festival = Festival.query.get(1)
# assoc = TagAssociation(tag=nature, object_id=festival.id, object_type="Festival")

# db.session.add(assoc)
# db.session.commit()

#Lấy danh sách tag của một lễ hội
# festival = Festival.query.get(1)
# for tag in festival.tags:
#     print(tag.name)

#Tìm tất cả lễ hội có tag “leo núi”
# festivals = (db.session.query(Festival)
#     .join(TagAssociation, (TagAssociation.object_id == Festival.id) & (TagAssociation.object_type == "Festival"))
#     .join(Tag)
#     .filter(Tag.name == "leo núi")
#     .all())


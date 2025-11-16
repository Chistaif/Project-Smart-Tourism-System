import json
from models import User, Destination, Attraction, Tag, TagAssociation, db
from datetime import datetime

def parse_datetime(date_str):
    try:
        return datetime.strptime(date_str, "%d:%m:%Y %M:%H")
    except:
        return None
    

def import_demo_data(json_path="demo_data.json"):
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    for des in data["destinations"]:
        # 1. Tạo Festival
        destination = Destination(name=des["name"],
                            location=des.get("location"),
                            datetime_start=parse_datetime(des["datetimeStart"]),
                            datetime_end=parse_datetime(des["datetimeEnd"]),
                            brief_description=des["brief_description"],
                            detail_description=des["detail_description"],
                            ticket_price=des["ticketPrice"],
                            lat=des.get("lat"),
                            lon=des.get("lon")
                            )
        db.session.add(destination)
        db.session.flush()  # để lấy được id ngay lập tức

        # 2. Xử lý tag
        for tag_name in des.get("tags", []):
            tag = Tag.query.filter_by(name=tag_name).first()
            if not tag:
                tag = Tag(name=tag_name)
                db.session.add(tag)
                db.session.flush()  # để có id

            assoc = TagAssociation(tag_id=tag.id, object_id=destination.id, object_type="Destination")
            db.session.add(assoc)

    for u in data["users"]:
        user = User(name=u["name"],
                    email=u["email"]
                    )
        user.set_password(u["password"])  # Use set_password to hash the password
        db.session.add(user)
        db.session.flush()

    for a in data["attractions"]:
        # 1. Tạo attraction
        attraction = Attraction(name=a["name"],
                                location=a.get("location"),
                                rating=a["rating"],
                                lat=a.get("lat"),
                                lon=a.get("lon")
                                )
        db.session.add(attraction)
        db.session.flush()  # để lấy được id ngay lập tức

        # 2. Xử lý tag
        for tag_name in a.get("tags", []):
            tag = Tag.query.filter_by(name=tag_name).first()
            if not tag:
                tag = Tag(name=tag_name)
                db.session.add(tag)
                db.session.flush()  # để có id

            assoc = TagAssociation(tag_id=tag.id, object_id=attraction.id, object_type="Attraction")
            db.session.add(assoc)

    db.session.commit()
    print("Import demo data hoàn tất!")
import json
from models import User, Festival, Attraction, Tag, TagAssociation, db
from datetime import datetime

def parse_datetime(date_str):
    try:
        return datetime.strptime(date_str, "%d:%m:%Y")
    except:
        return None
    


def import_demo_data(json_path="demo_data.json"):
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    for fes in data["festivals"]:
        # 1. Tạo Festival
        festival = Festival(name=fes["name"],
                            location=fes.get("location"),
                            datetime=parse_datetime(fes["datetime"]),
                            brief_description=fes["brief_description"],
                            detail_description=fes["detail_description"],
                            lat=fes.get("lat"),
                            lon=fes.get("lon")
                            )
        db.session.add(festival)
        db.session.flush()  # để lấy được id ngay lập tức

        # 2. Xử lý tag
        for tag_name in fes.get("tags", []):
            tag = Tag.query.filter_by(name=tag_name).first()
            if not tag:
                tag = Tag(name=tag_name)
                db.session.add(tag)
                db.session.flush()  # để có id

            assoc = TagAssociation(tag_id=tag.id, object_id=festival.id, object_type="Festival")
            db.session.add(assoc)

    for u in data["users"]:
        user = User(name=u["name"],
                    password=u["password"],
                    email=u["email"]
                    )
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
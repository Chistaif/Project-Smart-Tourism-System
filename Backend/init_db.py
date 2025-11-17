import json
from datetime import datetime

from models import db, User, Festival, CulturalSpot, Attraction, Tag

def parse_datetime(date_str):
    """
    Chuyển đổi chuỗi ngày tháng từ demo_data.json (ví dụ: "12:4:2025")
    sang đối tượng datetime của Python.
    """
    if not date_str:
        return None
    try:
        # Định dạng trong demo_data.json là Ngày:Tháng:Năm
        return datetime.strptime(date_str, "%d:%m:%Y")
    except ValueError:
        print(f"Warning: Không thể phân tích ngày '{date_str}'. Bỏ qua.")
        return None
    

def import_demo_data(json_path="demo_data.json"):
    """
    Nạp dữ liệu từ file JSON vào cơ sở dữ liệu
    sử dụng cấu trúc model Kế thừa (Inheritance) mới.
    """
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Dùng cache (bộ đệm) để lưu các tag đã xử lý
    # giúp tăng tốc độ và tránh tạo tag trùng lặp
    tag_cache = {}

    def get_or_create_tag(tag_name):
        """
        Kiểm tra xem tag đã có trong cache/DB chưa.
        Nếu chưa, tạo mới và thêm vào session.
        """
        if tag_name in tag_cache:
            return tag_cache[tag_name]
        
        tag = Tag.query.filter_by(tag_name=tag_name).first()
        if not tag:
            tag = Tag(tag_name=tag_name)
            db.session.add(tag)
            # Dùng flush để tag này có thể được tìm thấy
            # ngay trong các vòng lặp tiếp theo
            db.session.flush()
        
        tag_cache[tag_name] = tag
        return tag

    try:
        # --- 1. Nạp Users ---
        for u in data["users"]:
            # Bỏ qua nếu email đã tồn tại
            if User.query.filter_by(email=u["email"]).count() > 0:
                continue
                
            new_user = User(
                username=u["name"], # Dùng "name" làm "username"
                email=u["email"],
                avatar_url=u.get("avatarUrl") 
            )
            # Dùng hàm set_password để băm mật khẩu
            new_user.set_password(u["password"])
            db.session.add(new_user)

        # --- 2. Nạp Festivals (từ "festivals" trong JSON) ---
        for fes in data["festivals"]:
            # Bỏ qua nếu tên đã tồn tại
            if Attraction.query.filter_by(name=fes["name"]).count() > 0:
                continue
            
            new_festival = Festival(
                name=fes["name"],
                location=fes.get("location"),
                time_start=parse_datetime(fes.get("datetimeStart")),
                time_end=parse_datetime(fes.get("datetimeEnd")),
                brief_description=fes.get("briefDescription"),
                detail_description=fes.get("detailDescription"),
                lat=fes.get("lat"),
                lon=fes.get("lon"),
                average_rating=fes.get("rating"),
                visit_duration=fes.get("visitDuration"),
                image_url=fes.get("imageUrl"),
            )
            db.session.add(new_festival)

            # Gán tag cho festival
            for tag_name in fes.get("tags", []):
                tag = get_or_create_tag(tag_name)
                # Dùng .append() để xử lý quan hệ Nhiều-Nhiều
                if tag:
                    new_festival.tags.append(tag)

        # --- 3. Nạp CulturalSpots (từ "culturalSpots" trong JSON) ---
        for cul in data["culturalSpots"]:
            # Bỏ qua nếu tên đã tồn tại
            if Attraction.query.filter_by(name=cul["name"]).count() > 0:
                continue

            new_spot = CulturalSpot(
                name=cul["name"],
                location=cul.get("location"),
                average_rating=cul.get("rating"),
                lat=cul.get("lat"),
                lon=cul.get("lon"),
                brief_description=cul.get("briefDescription"),
                detail_description=cul.get("detailDescription"),
                spot_type=cul.get("spotType"),
                ticket_price=cul.get("ticketPrice"),
                opening_hours=cul["openHours"],
                visit_duration=cul.get("visitDuration"),
                image_url=cul.get("imageUrl")
            )
            db.session.add(new_spot)

            # Gán tag cho cultural spot
            for tag_name in cul.get("tags", []):
                tag = get_or_create_tag(tag_name)
                if tag:
                    new_spot.tags.append(tag)

        # --- 4. Nạp Attraction (từ "attraction" trong JSON) ---
        for a in data["attraction"]:
            # Bỏ qua nếu tên đã tồn tại
            if Attraction.query.filter_by(name=a["name"]).count() > 0:
                continue

            new_attr = Attraction(
                name=a["name"],
                location=a.get("location"),
                average_rating=a.get("rating"),
                brief_description=a.get("briefDescription"),
                detail_description=a.get("detailDescription"),
                lat=a.get("lat"),
                lon=a.get("lon"),
                visit_duration=a.get("visitDuration"),
                image_url=a.get("imageUrl")
            )
            db.session.add(new_attr)

            # Gán tag cho cultural spot
            for tag_name in a.get("tags", []):
                tag = get_or_create_tag(tag_name)
                if tag:
                    new_attr.tags.append(tag)

        # --- 5. Commit ---
        # Sau khi thêm tất cả, commit một lần duy nhất
        db.session.commit()
        print("Import demo data (mới) hoàn tất!")

    except Exception as e:
        # Nếu có lỗi, rollback lại toàn bộ
        db.session.rollback()
        print(f"Lỗi khi import demo data: {e}")
        raise e
import json
from datetime import datetime
from lunardate import LunarDate

from models import db, User, Festival, CulturalSpot, Attraction, Tag, Review
from service.attraction_service import update_attraction_rating_service

def parse_datetime(date_str):
    """
    Chuyển đổi chuỗi ngày tháng từ demo_data.json (format mới: "dd/mm" hoặc "dd/mm âm lịch")
    sang đối tượng datetime của Python.
    
    Logic: Festival diễn ra hàng năm vào cùng ngày tháng đó
    """
    if not date_str:
        return None
        
    try:
        current_year = datetime.now().year
        current_date = datetime.now().date()  # Chỉ lấy date để so sánh
        
        # Xử lý ngày âm lịch
        if "âm lịch" in date_str:
            lunar_date = date_str.replace(" âm lịch", "")
            day, month = map(int, lunar_date.split("/"))
            
            # Chuyển đổi âm lịch sang dương lịch cho năm hiện tại
            try:
                lunar = LunarDate(current_year, month, day)
                solar_date = lunar.toSolarDate()  # Trả về datetime.date
                
                # Nếu ngày âm lịch này đã qua trong năm nay, chuyển sang năm sau
                if solar_date < current_date:  # So sánh date với date
                    lunar = LunarDate(current_year + 1, month, day)
                    solar_date = lunar.toSolarDate()
                    
                # Chuyển date thành datetime (thêm thời gian mặc định)
                return datetime.combine(solar_date, datetime.min.time())
                
            except ImportError:
                print("Warning: Cần cài đặt thư viện 'lunardate' để xử lý âm lịch")
                # Fallback: giả sử ngày âm lịch ≈ ngày dương lịch cùng tháng
                gregorian_date = datetime(current_year, month, day)
                if gregorian_date.date() < current_date:
                    gregorian_date = gregorian_date.replace(year=current_year + 1)
                return gregorian_date
        else:
            # Xử lý ngày dương lịch
            day, month = map(int, date_str.split("/"))
            
            # Tạo datetime cho năm hiện tại
            gregorian_date = datetime(current_year, month, day)
            
            # Nếu ngày này đã qua trong năm nay, chuyển sang năm sau
            if gregorian_date.date() < current_date:
                gregorian_date = gregorian_date.replace(year=current_year + 1)
                
            return gregorian_date
            
    except ValueError as e:
        print(f"Warning: Không thể phân tích ngày '{date_str}': {e}")
        return None
    except Exception as e:
        print(f"Warning: Lỗi xử lý ngày '{date_str}': {e}")
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
                avatar_url=u.get("avatarUrl"),
                is_admin=u.get("isAdmin", False),
                email_verified=u.get("isVerify", True)
            )
            # Dùng hàm set_password để băm mật khẩu
            new_user.set_password(u["password"])
            db.session.add(new_user)

        # --- 2. Nạp Festivals (từ "festivals" trong JSON) ---
        for fes in data["festivals"]:
            # Bỏ qua nếu tên đã tồn tại
            if Attraction.query.filter_by(name=fes["name"]).count() > 0:
                continue

            start_str = fes.get("datetimeStart")
            end_str = fes.get("datetimeEnd")
            
            new_festival = Festival(
                name=fes["name"],
                location=fes.get("location"),
                time_start=parse_datetime(start_str),  # Ngày đã chuyển đổi
                time_end=parse_datetime(end_str),      # Ngày đã chuyển đổi
                is_lunar="âm lịch" in (start_str or ""),  # Đánh dấu âm lịch
                original_start=start_str,              # Lưu chuỗi gốc
                original_end=end_str,                  # Lưu chuỗi gốc
                brief_description=fes.get("briefDescription"),
                detail_description=fes.get("detailDescription"),
                lat=fes.get("lat"),
                lon=fes.get("lon"),
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

        # --- 5. Nạp Reviews ---
        # (Chúng ta nạp review SAU KHI đã nạp User và Attraction)
        for r_data in data.get("reviews", []):
            # 1. Tìm user bằng email
            user = User.query.filter_by(email=r_data.get("userEmail")).first()
            
            # 2. Tìm attraction bằng name
            attraction = Attraction.query.filter_by(name=r_data.get("attractionName")).first()

            # 3. Chỉ tạo review nếu tìm thấy cả user và attraction
            if user and attraction:
                # Kiểm tra xem review này đã tồn tại chưa
                existing_review = Review.query.filter_by(
                    user_id=user.user_id,
                    attraction_id=attraction.id,
                    content=r_data.get("content") # Thêm kiểm tra content để tránh trùng
                ).first()

                if not existing_review:
                    new_review = Review(
                        content=r_data.get("content"),
                        rating_score=r_data.get("rating"),
                        user_id=user.user_id,
                        attraction_id=attraction.id
                        # created_at sẽ tự động được gán giá trị default
                    )
                    db.session.add(new_review)
            else:
                if not user:
                    print(f"Warning: (Review) Không tìm thấy user với email '{r_data.get('userEmail')}'")
                if not attraction:
                    print(f"Warning: (Review) Không tìm thấy attraction với tên '{r_data.get('attractionName')}'")

        db.session.flush()

        all_attractions = Attraction.query.all()
        for att in all_attractions:
            # Gọi hàm service mới, nhưng KHÔNG commit
            update_attraction_rating_service(att.id, commit_now=False)
            
        # --- 6. Commit --- (Đổi số thứ tự)
        # Sau khi thêm tất cả, commit một lần duy nhất
        db.session.commit()
        print("Import demo data (mới) hoàn tất!")

    except Exception as e:
        # Nếu có lỗi, rollback lại toàn bộ
        db.session.rollback()
        print(f"Lỗi khi import demo data: {e}")
        raise e
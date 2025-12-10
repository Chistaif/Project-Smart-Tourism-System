from models import db, TourPackage, Attraction

def get_all_packages_service():
    """
    Service để lấy danh sách tóm tắt tất cả các Gói Tour Chủ đề.
    Dùng cho việc hiển thị danh sách slider trên trang Service.js.
    """
    try:
        packages = TourPackage.query.order_by(TourPackage.id.asc()).all()
        packages_data = [pkg.to_json_brief() for pkg in packages]
        
        return packages_data
    
    except Exception as e:
        print(f"Error fetching all tour packages: {e}")
        raise Exception("Lỗi hệ thống khi tải danh sách gói tour")

def get_package_detail_service(package_id):
    """
    Service để lấy chi tiết của một Gói Tour Chủ đề.
    Dùng cho trang TourPackageDetail.js.
    """
    if not package_id:
        raise ValueError("package_id là bắt buộc")

    try:
        package = TourPackage.query.get(package_id) 
        if not package:
            raise LookupError(f"Không tìm thấy gói tour với ID: {package_id}")
        return package.to_json()
    except LookupError:
        raise
    except Exception as e:
        print(f"Error fetching package detail for ID {package_id}: {e}")
        raise Exception("Lỗi hệ thống khi tải chi tiết gói tour")
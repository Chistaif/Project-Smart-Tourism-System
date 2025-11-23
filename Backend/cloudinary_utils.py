import cloudinary
import cloudinary.uploader
import os
from dotenv import load_dotenv

load_dotenv()

# Cấu hình Cloudinary
cloudinary.config(
    cloud_name = os.environ.get('CLOUDINARY_CLOUD_NAME'),
    api_key = os.environ.get('CLOUDINARY_API_KEY'),
    api_secret = os.environ.get('CLOUDINARY_API_SECRET'),
    secure = True
)

def upload_image_to_cloud(file_obj, folder="smart_tourism/avatars"):
    """
    Upload file ảnh lên Cloudinary
    
    :param file_obj: Đối tượng file từ request.files['image']
    :param folder: Thư mục trên Cloudinary để dễ quản lý
    :return: URL ảnh (https://...) hoặc None nếu lỗi
    """
    if not file_obj:
        return None
        
    try:
        # Upload trực tiếp file object, không cần lưu tạm
        upload_result = cloudinary.uploader.upload(
            file_obj,
            folder=folder,
            resource_type="image" 
        )
        
        # Trả về đường dẫn bảo mật (https)
        return upload_result.get('secure_url')
        
    except Exception as e:
        print(f"Lỗi upload ảnh lên Cloud: {e}")
        return None
# Hướng dẫn cấu hình cho file .env

## 1. Google Gemini API
Để sử dụng các mô hình AI của Google (Gemini Pro, Flash, v.v.).

- Truy cập <https://aistudio.google.com/projects>

- Đăng nhập bằng tài khoản Google của bạn.

- Nhấn vào nút "Get API key" (Lấy khóa API) ở menu bên trái.

- Nhấn "Create API key". Bạn có thể chọn tạo trong một dự án Google Cloud mới (New Project) hoặc dự án có sẵn.

- Sao chép chuỗi ký tự bắt đầu bằng AIza....

`
GEMINI_API_KEY=AIzaSyDxxxxxxxxxxxxxxxxxxxxxxxx
`

## 2. Cloudinary Configuration
Dịch vụ này dùng để upload và quản lý hình ảnh/video cho ứng dụng.

- Đăng ký hoặc đăng nhập tại <https://cloudinary.com/>.

- Sau khi đăng nhập, bạn sẽ được đưa đến trang Dashboard (Bảng điều khiển).

- Tìm phần "Product Environment Credentials" (thường nằm ở góc trên bên trái).

- Bạn sẽ thấy 3 thông tin quan trọng:
    - Cloud Name
    - API Key
    - API Secret (Nhấn vào biểu tượng con mắt để xem).

```
CLOUDINARY_CLOUD_NAME=ten_cloud_cua_ban
CLOUDINARY_API_KEY=1234567890
CLOUDINARY_API_SECRET=abcdefg_hijklmn
```

## 3. Email Configuration (Gmail SMTP)
Để ứng dụng có thể gửi email (ví dụ: xác thực tài khoản, quên mật khẩu) thông qua Gmail, bạn không thể dùng mật khẩu đăng nhập thông thường. Bạn cần tạo Mật khẩu ứng dụng (App Password).

***Bước 1: Bật xác minh 2 bước (2-Step Verification)***
Nếu bạn đã bật, hãy bỏ qua bước này.

- Truy cập <https://myaccount.google.com/security>

- Tìm mục "How you sign in to Google" (Cách bạn đăng nhập vào Google).

- Chọn 2-Step Verification và làm theo hướng dẫn để bật nó lên.

***Bước 2: Tạo Mật khẩu ứng dụng***
- Tại trang Security, tìm kiếm từ khóa "App passwords" (Mật khẩu ứng dụng) trên thanh tìm kiếm hoặc lướt xuống dưới mục 2-Step Verification.

- Tạo mật khẩu mới:

    - App (Ứng dụng): Chọn "Other (Custom name)" -> Đặt tên (ví dụ: MyWebApp).

    - Generate (Tạo).

- Google sẽ cấp cho bạn một chuỗi 16 ký tự (ví dụ: abcd efgh ijkl mnop). Đây chính là mật khẩu bạn sẽ dùng trong code.

```
EMAIL_SERVICE=gmail
EMAIL_USER=email_cua_ban@gmail.com
EMAIL_PASS=abcd efgh ijkl mnop  # Mật khẩu ứng dụng 16 ký tự (không phải pass login)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
```

## 4. Tổng hợp file .env mẫu
```
# JWT Configuration
JWT_SECRET_KEY=1234567890poiuytrewqasdfghjklmnbvcxz

# Flask Configuration
SECRET_KEY=qwertyuiasdfghjk
FLASK_ENV=development

# --- Gemini AI ---
GEMINI_API_KEY=AIzaSy...

# --- Cloudinary ---
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

# --- Email (Gmail SMTP) ---
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
```
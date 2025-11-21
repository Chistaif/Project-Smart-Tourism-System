# Hướng Dẫn Bảo Mật

Tài liệu này mô tả các biện pháp bảo mật đã được triển khai trong ứng dụng.

## 🔒 Các Biện Pháp Bảo Mật Đã Triển Khai

### 1. **JWT Authentication (JSON Web Tokens)**
- Sử dụng `flask-jwt-extended` để xác thực người dùng
- Access token có thời hạn 24 giờ
- Refresh token có thời hạn 30 ngày
- Tokens được lưu an toàn trong localStorage (frontend)

### 2. **Rate Limiting (Giới Hạn Tần Suất)**
- **Đăng ký**: 3 lần/phút
- **Đăng nhập**: 5 lần/phút
- **Tạo blog**: 10 lần/giờ
- **API chung**: 200 requests/ngày, 50 requests/giờ
- Bảo vệ chống brute force attacks

### 3. **Input Validation & Sanitization**
- **Username**: 
  - 3-50 ký tự
  - Chỉ chứa chữ cái, số và dấu gạch dưới
- **Email**: 
  - Validation format email
  - Chuyển về lowercase
- **Password**: 
  - Tối thiểu 6 ký tự, tối đa 128 ký tự
  - Phải chứa ít nhất 1 chữ cái và 1 số
- **Blog content**: 
  - Loại bỏ HTML tags để chống XSS
  - Giới hạn độ dài (title: 200, content: 10000)

### 4. **File Upload Security**
- Chỉ chấp nhận: png, jpg, jpeg, gif, webp
- Giới hạn kích thước: 5MB
- Sử dụng `secure_filename()` để tránh path traversal
- Thêm timestamp và user_id vào tên file để tracking

### 5. **Authorization (Phân Quyền)**
- User chỉ có thể xem/chỉnh sửa dữ liệu của chính mình
- Endpoints được bảo vệ bằng `@jwt_required()`
- Kiểm tra quyền truy cập trước khi thực hiện thao tác

### 6. **Environment Variables**
- JWT secret key được lưu trong `.env`
- Database URL có thể cấu hình
- Không hardcode sensitive data

### 7. **Error Handling**
- Không expose thông tin nhạy cảm trong error messages
- Generic error messages cho user
- Chi tiết lỗi chỉ log ở server

### 8. **CORS Configuration**
- Chỉ cho phép requests từ localhost:3000 và 127.0.0.1:3000
- Cấu hình methods và headers cụ thể

## 📦 Cài Đặt Dependencies

Cài đặt các thư viện bảo mật:

```bash
cd Backend
pip install flask-jwt-extended flask-limiter python-dotenv
```

## ⚙️ Cấu Hình

### 1. Tạo file `.env` trong thư mục `Backend/`:

```env
# Database
DATABASE_URL=sqlite:///demo.db

# JWT Secret Key - THAY ĐỔI TRONG PRODUCTION!
# Generate secret key: python -c "import secrets; print(secrets.token_hex(32))"
JWT_SECRET_KEY=your-super-secret-key-change-this-in-production

# Flask Environment
FLASK_ENV=development
FLASK_DEBUG=True
```

### 2. Generate JWT Secret Key:

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

Copy kết quả vào `JWT_SECRET_KEY` trong file `.env`

## 🔐 Protected Endpoints

Các endpoint sau yêu cầu JWT token:

- `GET /api/users` - Lấy danh sách users
- `GET /api/auth/user/<id>` - Lấy thông tin user
- `POST /api/blogs` - Tạo blog mới
- `POST /api/auth/refresh` - Refresh access token

## 🛡️ Best Practices

1. **Luôn sử dụng HTTPS trong production**
2. **Thay đổi JWT_SECRET_KEY trong production**
3. **Không commit file `.env` vào git**
4. **Regular security audits**
5. **Update dependencies thường xuyên**
6. **Monitor rate limiting logs**

## 📝 Notes

- Tokens được lưu trong localStorage (có thể cân nhắc httpOnly cookies cho production)
- Rate limiting sử dụng IP address (có thể bị bypass với VPN)
- File uploads được lưu trong `static/uploads/blogs/` (cần backup định kỳ)


-----

# 🤖 Hệ Thống Du Lịch Thông Minh (AI Smart Tour Guide)

Dự án này là một ứng dụng web du lịch thông minh, được xây dựng bằng Python (Flask), ứng dụng tư duy tính toán để giúp người dùng lên kế hoạch du lịch tại Việt Nam một cách cá nhân hóa và hiệu quả.

## 🎯 Giới thiệu về Dự án

### 1\. Mục tiêu

Mục tiêu chính của hệ thống là phát triển một trang web giúp người dùng tự động tạo ra một kế hoạch du lịch chi tiết. Hệ thống phân tích các yếu tố cá nhân hóa như **ngân sách**, **sở thích**, và **thời gian** để đề xuất một lịch trình tối ưu.

### 2\. Đối tượng người dùng

Dự án hướng đến đối tượng khách du lịch tự túc, đặc biệt là người trẻ trong độ tuổi 18-35, đi một mình hoặc theo nhóm nhỏ.

## ✨ Các tính năng chính

Hệ thống được xây dựng xoay quanh 4 trang chức năng chính:

  * **Trang Chủ (Home):** Giao diện giới thiệu tổng quan về dự án và các tính năng.
  * **Trang Dịch Vụ (Service):** Đây là chức năng cốt lõi của hệ thống.
      * **Tiếp nhận đầu vào:** Người dùng cung cấp thông tin về điểm đến, ngân sách, thời gian, loại hình du lịch (thiên nhiên, mạo hiểm...) và sở thích (ẩm thực, chụp ảnh...).
      * **Xử lý & Gợi ý:** Hệ thống phân tích thông tin đầu vào để đề xuất một lịch trình tối ưu, bao gồm các điểm tham quan, nhà hàng, và khách sạn.
      * **Bản đồ tương tác:** Lịch trình gợi ý được hiển thị trực quan trên bản đồ (sử dụng thư viện `folium`) và có khả năng lấy vị trí GPS của người dùng để cá nhân hóa lộ trình.
  * **Trang Người Dùng (User):** Quản lý thông tin tài khoản và lịch sử các chuyến đi đã tạo.
  * **Trang Cài Đặt (Setting):** Cho phép người dùng tùy chỉnh các cài đặt của tài khoản.

## 🛠️ Công nghệ sử dụng

Dự án được phát triển với các công nghệ sau:

  * **Backend:** **Python** (Ngôn ngữ chính) và **Flask** (Web Framework).
  * **Frontend:** **HTML** và **CSS** cơ bản.
  * **Thư viện Python hỗ trợ:**
      * `folium`: Để tạo và hiển thị bản đồ tương tác.
      * `pandas` & `numpy`: Để xử lý và phân tích dữ liệu đầu vào.
      * `geopy`: Để xử lý các tác vụ liên quan đến vị trí địa lý (ví dụ: tính toán khoảng cách).

## 🚀 Cài đặt và Chạy dự án

Để chạy dự án này trên máy local của bạn, hãy làm theo các bước sau:

**1. Clone repository:**

```bash
git clone https://github.com/[ten-tai-khoan-cua-ban]/smart-tourism-project.git
cd smart-tourism-project
```

**2. Tạo và kích hoạt môi trường ảo (virtual environment):**

```bash
# Đối với Windows
python -m venv venv
.\venv\Scripts\activate

# Đối với macOS/Linux
python3 -m venv venv
source venv/bin/activate
```

**3. Cài đặt các thư viện cần thiết:**

*(Bạn nên tạo một file `requirements.txt` bao gồm các dòng sau):*

```
Flask
folium
pandas
numpy
geopy
```

*Chạy lệnh cài đặt:*

```bash
pip install -r requirements.txt
```

**4. Chạy ứng dụng:**

```bash
python app.py
```

Sau khi chạy lệnh trên, ứng dụng sẽ có sẵn tại địa chỉ `http://127.0.0.1:5000/` trên trình duyệt của bạn.

## 📂 Cấu trúc thư mục

```
/smart-tourism-project/
|
|-- app.py               # File Python chính của Flask, chứa logic backend
|
|-- /templates/          # Thư mục chứa các file HTML
|   |-- base.html        # Template cơ sở (chứa navbar, footer)
|   |-- home.html        # Giao diện trang chủ
|   |-- service.html     # Giao diện trang dịch vụ (chứa bản đồ)
|   |-- user.html        # Giao diện trang người dùng
|   `-- setting.html     # Giao diện trang cài đặt
|
`-- /static/             # Thư mục chứa các file tĩnh
    |-- /css/
    |   `-- style.css    # File CSS để tùy chỉnh giao diện
    `-- /images/
        `-- banner-image.jpg # Nơi lưu trữ hình ảnh
```

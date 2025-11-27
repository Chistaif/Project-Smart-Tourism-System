import requests
import json
import time

BASE_URL = "http://127.0.0.1:5000/api"
TEST_USERNAME = "user_1764203958" 
TEST_PASSWORD = "Password123@"


def log(title, response):
    """Hàm in kết quả đẹp mắt"""
    print(f"\n{'='*10} {title} {'='*10}")
    print(f"Status: {response.status_code}")
    try:
        print("Response:", json.dumps(response.json(), indent=2, ensure_ascii=False))
    except:
        print("Response (Text):", response.text)

def test_health():
    """Kiểm tra server có sống không"""
    try:
        res = requests.get(f"{BASE_URL}health")
        log("HEALTH CHECK", res)
    except requests.exceptions.ConnectionError:
        print("❌ Không thể kết nối tới Server. Hãy chắc chắn bạn đã chạy 'python app.py'")
        exit()

def test_signup():
    """Test đăng ký tài khoản mới"""
    timestamp = int(time.time())
    payload = {
        "username": f"user_{timestamp}",
        "email": f"test_{timestamp}@gmail.com",
        "password": "Password123@",
        "confirmPassword": "Password123@"
    }
    res = requests.post(f"{BASE_URL}/auth/signup", json=payload)
    log("ĐĂNG KÝ (SIGNUP)", res)
    return payload

def test_verify(email, code):
    """Test xác thực email"""
    payload = {
        'email': email,
        'code': code
    }
    res = requests.post(f'{BASE_URL}/auth/verify-email', json=payload)
    log("XÁC THỰC EMAIL", res)
    return res.status_code == 200

def test_resend_code(email):
    payload = {
        'email': email
    }
    res = requests.post(f'{BASE_URL}/auth/resend-code', json=payload)
    log("GỬI LẠI MÃ CODE", res)
    return res.status_code == 200

def test_forgot_password(email):
    """Test yêu cầu quên mật khẩu"""
    payload = {
        "email": email
    }
    res = requests.post(f"{BASE_URL}/auth/forgot-password", json=payload)
    log("QUÊN MẬT KHẨU (FORGOT PASSWORD)", res)
    return res.status_code == 200

def test_reset_password(email, code, new_password, confirm_password):
    """Test đặt lại mật khẩu"""
    payload = {
        "email": email,
        "code": code,
        "newPassword": new_password,
        "confirmPassword": confirm_password
    }
    res = requests.post(f"{BASE_URL}/auth/reset-password", json=payload)
    log("ĐẶT LẠI MẬT KHẨU (RESET PASSWORD)", res)
    return res.status_code == 200

def test_refresh(refresh_token):
    """Test lấy Access Token mới từ Refresh Token"""
    headers = {
        "Authorization": f"Bearer {refresh_token}"
    }
    # Lưu ý: Endpoint này yêu cầu Refresh Token trong Header
    res = requests.post(f"{BASE_URL}/auth/refresh", headers=headers)
    log("REFRESH TOKEN", res)
    
    if res.status_code == 200:
        return res.json().get("access_token")
    return None

# CẬP NHẬT LẠI hàm test_login để lấy cả Refresh Token
def test_login(username, password): 
    """Test đăng nhập và lấy Token"""
    payload = {
        "username": username,
        "password": password
    }
    res = requests.post(f"{BASE_URL}/auth/login", json=payload)
    log(f"ĐĂNG NHẬP ({username})", res)
    
    if res.status_code == 200:
        data = res.json()
        # Trả về cả 2 token để dùng cho các test sau
        return data.get("access_token"), data.get("refresh_token")
    elif res.status_code == 403:
        print("⚠️ Tài khoản này chưa xác thực Email.")
    return None, None


def test_login(username, password): 
    """Test đăng nhập và lấy Token"""
    payload = {
        "username": username,
        "password": password
    }
    res = requests.post(f"{BASE_URL}/auth/login", json=payload)
    log(f"ĐĂNG NHẬP ({username})", res)
    
    if res.status_code == 200:
        return res.json().get("access_token")
    elif res.status_code == 403:
        print("⚠️ Tài khoản này chưa xác thực Email (đúng quy trình bảo mật).")
    return None



def test_search(token=""):
    """Test tìm kiếm (có gợi ý theo sở thích nếu có token)"""
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    params = {
        "searchTerm": "Hội An",
        "typeList": ["Lễ hội", "Di tích"]
    }
    res = requests.get(f"{BASE_URL}/search", params=params, headers=headers)
    log("TÌM KIẾM (SEARCH)", res)

def test_ai_chat(token):
    """Test Chatbot tư vấn"""
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    payload = {
        "message": "Tư vấn cho mình chuyến đi biển cho cặp đôi",
        "history": []
    }
    res = requests.post(f"{BASE_URL}/ai/chat", json=payload, headers=headers)
    log("AI CHATBOT", res)

def test_ai_caption(token):
    """Test AI viết quảng cáo"""
    if not token:
        print("⏩ Bỏ qua test AI Caption vì chưa có Token.")
        return

    headers = {"Authorization": f"Bearer {token}"}
    payload = {
        "name": "Hồ Gươm",
        "features": "sáng sớm, mùa thu, lãng mạn"
    }
    res = requests.post(f"{BASE_URL}/ai/generate-caption", json=payload, headers=headers)
    log("AI WRITE CAPTION", res)

# --- CHẠY TEST ---
if __name__ == "__main__":
    print("🚀 BẮT ĐẦU TEST HỆ THỐNG SMART TOURISM...\n")
    # user = test_signup()
    # test_resend_code(user['email'])
    # test_verify(user['email'], '857638')
    # token = test_login('user_1764203958', 'Password123@')
    # test_search(token)
    # test_ai_chat(token)
    # test_ai_caption(token)

    # test_forgot_password('test_1764203958@gmail.com')
    # test_reset_password('test_1764203958@gmail.com', '751551', '123QAZqaz!', '123QAZqaz!')
    
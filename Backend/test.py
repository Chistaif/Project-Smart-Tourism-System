import requests
import json
import time
import sys
import os
from datetime import datetime, timedelta
import time as time_module

# Add the project root to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from service.tour_service import generate_smart_tour
from models import Attraction, Festival, CulturalSpot, db
from app import app

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
        "message": "Tư vấn cho mình nơi nào đó thơ mộng, phù hợp để đi date với em ny",
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

def test_nearby_attr(attractionId):
    res = requests.get(f'{BASE_URL}/nearby/{attractionId}')
    if res.status_code == 200:
        log("ATTRACION NEARBY", res)
    print(res)



# --- CHẠY TEST ---
if __name__ == "__main__":
    print("🚀 BẮT ĐẦU TEST HỆ THỐNG SMART TOURISM...\n")
    # user = test_signup()
    # test_resend_code(user['email'])
    # test_verify(user['email'], '857638')
    # token = test_login('duy', '123EDCvfr$')
    # test_search(token)
    # test_ai_chat(token)
    # test_ai_caption(token)

    test_nearby_attr(1)

    # test_forgot_password('test_1764203958@gmail.com')

# ============================================================================
# UNIT TESTS FOR TOUR GENERATION LOGIC
# ============================================================================

def test_generate_smart_tour_success():
    """Test tạo tour thành công với data hợp lệ"""
    print("\n" + "="*60)
    print("TEST: Generate Smart Tour - Success Case")
    print("="*60)

    with app.app_context():
        # Lấy một số attractions từ database
        attractions = Attraction.query.limit(5).all()
        if not attractions:
            print("❌ SKIP: No attractions in database")
            return

        attraction_ids = [attr.id for attr in attractions]

        # Test parameters
        start_lat, start_lon = 21.0285, 105.8342  # Hà Nội
        start_time = datetime.now().strftime("%d/%m/%Y %H:%M")
        end_time = (datetime.now() + timedelta(days=2)).strftime("%d/%m/%Y %H:%M")

        try:
            result = generate_smart_tour(
                attraction_ids=attraction_ids,
                start_lat=start_lat,
                start_lon=start_lon,
                start_datetime_str=start_time,
                end_datetime_str=end_time
            )

            # Validate response structure
            required_keys = ['timeline', 'mapHtml', 'clusters', 'startPoint', 'finishTime', 'totalDestinations', 'totalDays']

            for key in required_keys:
                assert key in result, f"❌ Missing key: {key}"

            assert isinstance(result['timeline'], list), "❌ Timeline should be list"
            assert isinstance(result['clusters'], list), "❌ Clusters should be list"
            assert result['totalDestinations'] > 0, "❌ Should have destinations"
            assert result['totalDays'] > 0, "❌ Should have days"

            print("✅ SUCCESS: Tour generated successfully")
            print(f"   📍 Total destinations: {result['totalDestinations']}")
            print(f"   📅 Total days: {result['totalDays']}")
            print(f"   📋 Timeline events: {len(result['timeline'])}")
            print(f"   🗺️  Map HTML length: {len(result['mapHtml'])} chars")

        except Exception as e:
            print(f"❌ FAILED: {e}")
            raise


def test_generate_smart_tour_empty_attractions():
    """Test tạo tour với empty attractions list"""
    print("\n" + "="*60)
    print("TEST: Generate Smart Tour - Empty Attractions")
    print("="*60)

    with app.app_context():
        start_lat, start_lon = 21.0285, 105.8342
        start_time = datetime.now().strftime("%d/%m/%Y %H:%M")
        end_time = (datetime.now() + timedelta(days=1)).strftime("%d/%m/%Y %H:%M")

        try:
            result = generate_smart_tour(
                attraction_ids=[],  # Empty list
                start_lat=start_lat,
                start_lon=start_lon,
                start_datetime_str=start_time,
                end_datetime_str=end_time
            )

            # Should return empty timeline
            assert result['timeline'] == [], "❌ Should have empty timeline"
            assert result['totalDestinations'] == 0, "❌ Should have 0 destinations"
            assert result['invalidAttractions'] == [], "❌ Should have empty invalid attractions"

            print("✅ SUCCESS: Empty attractions handled correctly")

        except Exception as e:
            print(f"❌ FAILED: {e}")
            raise


def test_generate_smart_tour_invalid_datetime():
    """Test tạo tour với invalid datetime format"""
    print("\n" + "="*60)
    print("TEST: Generate Smart Tour - Invalid DateTime")
    print("="*60)

    with app.app_context():
        # Use at least 4 attractions to avoid GMM issues
        attractions = Attraction.query.limit(4).all()
        if len(attractions) < 4:
            print("❌ SKIP: Need at least 4 attractions for this test")
            return

        attraction_ids = [attr.id for attr in attractions]

        try:
            result = generate_smart_tour(
                attraction_ids=attraction_ids,
                start_lat=21.0285,
                start_lon=105.8342,
                start_datetime_str="invalid-date-format",  # Invalid format
                end_datetime_str="01/01/2024 10:00"
            )

            # Should still work (fallback to current time)
            assert 'timeline' in result, "❌ Should have timeline key"
            assert isinstance(result['timeline'], list), "❌ Timeline should be list"

            print("✅ SUCCESS: Invalid datetime handled with fallback")

        except Exception as e:
            print(f"❌ FAILED: {e}")
            raise


def test_generate_smart_tour_nonexistent_attractions():
    """Test tạo tour với attraction IDs không tồn tại"""
    print("\n" + "="*60)
    print("TEST: Generate Smart Tour - Non-existent Attractions")
    print("="*60)

    with app.app_context():
        # Find the highest existing ID and add some fake ones
        max_id = db.session.query(db.func.max(Attraction.id)).scalar() or 0
        fake_attraction_ids = [max_id + 1, max_id + 2, max_id + 3]

        start_time = datetime.now().strftime("%d/%m/%Y %H:%M")
        end_time = (datetime.now() + timedelta(days=1)).strftime("%d/%m/%Y %H:%M")

        try:
            result = generate_smart_tour(
                attraction_ids=fake_attraction_ids,
                start_lat=21.0285,
                start_lon=105.8342,
                start_datetime_str=start_time,
                end_datetime_str=end_time
            )

            # Should return empty timeline since no valid attractions
            assert result['timeline'] == [], "❌ Should have empty timeline"
            assert result['totalDestinations'] == 0, "❌ Should have 0 destinations"
            # Note: invalidAttractions might be empty if no attractions found at all
            print(f"   ℹ️  Found {len(result.get('invalidAttractions', []))} invalid attractions")

            print("✅ SUCCESS: Non-existent attractions handled correctly")

        except Exception as e:
            print(f"❌ FAILED: {e}")
            raise


def test_tour_timeline_structure():
    """Test structure của timeline trong tour"""
    print("\n" + "="*60)
    print("TEST: Tour Timeline Structure Validation")
    print("="*60)

    with app.app_context():
        # Use at least 4 attractions to avoid GMM issues
        attractions = Attraction.query.limit(4).all()
        if len(attractions) < 4:
            print("❌ SKIP: Need at least 4 attractions for this test")
            return

        attraction_ids = [attr.id for attr in attractions]

        start_time = datetime.now().strftime("%d/%m/%Y %H:%M")
        end_time = (datetime.now() + timedelta(days=1)).strftime("%d/%m/%Y %H:%M")

        try:
            result = generate_smart_tour(
                attraction_ids=attraction_ids,
                start_lat=21.0285,
                start_lon=105.8342,
                start_datetime_str=start_time,
                end_datetime_str=end_time
            )

            # Validate timeline events structure
            for event in result['timeline']:
                required_event_keys = ['day', 'date', 'time', 'type', 'name', 'detail']

                for key in required_event_keys:
                    assert key in event, f"❌ Event missing key: {key}"

                # Validate event types
                valid_types = ['START', 'WAKE_UP', 'TRAVEL', 'VISIT', 'BREAKFAST', 'LUNCH', 'DINNER', 'SLEEP']
                assert event['type'] in valid_types, f"❌ Invalid event type: {event['type']}"

            print("✅ SUCCESS: Timeline structure is valid")
            print(f"   📋 Events validated: {len(result['timeline'])}")

            # Print some sample events
            for i, event in enumerate(result['timeline'][:5]):
                print(f"   {i+1}. [{event['type']}] {event['name']} at {event['time']}")

        except Exception as e:
            print(f"❌ FAILED: {e}")
            raise


def test_generate_smart_tour_minimal():
    """Test tạo tour với ít attractions để tránh rate limiting"""
    print("\n" + "="*60)
    print("TEST: Generate Smart Tour - Minimal Case (Rate Limit Friendly)")
    print("="*60)

    with app.app_context():
        # Only use 2 attractions to minimize API calls
        attractions = Attraction.query.limit(2).all()
        if len(attractions) < 2:
            print("❌ SKIP: Need at least 2 attractions for this test")
            return

        attraction_ids = [attr.id for attr in attractions]

        # Single day to reduce clustering complexity
        start_time = datetime.now().strftime("%d/%m/%Y %H:%M")
        end_time = (datetime.now() + timedelta(hours=8)).strftime("%d/%m/%Y %H:%M")  # Same day

        try:
            result = generate_smart_tour(
                attraction_ids=attraction_ids,
                start_lat=21.0285,
                start_lon=105.8342,
                start_datetime_str=start_time,
                end_datetime_str=end_time
            )

            # Validate response structure
            required_keys = ['timeline', 'mapHtml', 'clusters', 'startPoint', 'finishTime', 'totalDestinations', 'totalDays']

            for key in required_keys:
                assert key in result, f"❌ Missing key: {key}"

            assert isinstance(result['timeline'], list), "❌ Timeline should be list"
            assert result['totalDestinations'] >= 0, "❌ Should have valid destination count"
            assert result['totalDays'] >= 0, "❌ Should have valid day count"

            print("✅ SUCCESS: Minimal tour generated successfully")
            print(f"   📍 Total destinations: {result['totalDestinations']}")
            print(f"   📅 Total days: {result['totalDays']}")
            print(f"   📋 Timeline events: {len(result['timeline'])}")

        except Exception as e:
            print(f"❌ FAILED: {e}")
            raise


def run_tour_logic_tests():
    """Chạy tất cả các unit tests cho tour logic"""
    print("\n" + "🚀" + "="*58 + "🚀")
    print("🧪 RUNNING TOUR GENERATION LOGIC UNIT TESTS 🧪")
    print("🚀" + "="*58 + "🚀")

    # Add delay between tests to avoid rate limiting
    test_functions = [
        test_generate_smart_tour_minimal,  # Run this first (least API calls)
        test_generate_smart_tour_empty_attractions,
        test_generate_smart_tour_success,  # Run success case with delay
        test_generate_smart_tour_invalid_datetime,
        test_generate_smart_tour_nonexistent_attractions,
        test_tour_timeline_structure
    ]

    passed = 0
    failed = 0

    for i, test_func in enumerate(test_functions):
        if i > 0:  # Add delay between tests
            print(f"⏳ Waiting 10 seconds before next test to avoid rate limiting...")
            time_module.sleep(10)

        try:
            test_func()
            passed += 1
        except Exception as e:
            print(f"❌ TEST FAILED: {e}")
            failed += 1

    print(f"\n{'='*60}")
    print("📊 TEST RESULTS SUMMARY")
    print(f"{'='*60}")
    print(f"✅ PASSED: {passed}")
    print(f"❌ FAILED: {failed}")
    print(f"📈 SUCCESS RATE: {passed/(passed+failed)*100:.1f}%" if (passed+failed) > 0 else "N/A")
    print(f"{'='*60}")

    if failed > 0:
        print("💡 TIP: If tests fail due to rate limiting, try running them individually:")
        print("   from test import test_generate_smart_tour_minimal")
        print("   test_generate_smart_tour_minimal()")


if __name__ == "__main__":
    # Uncomment to run tour logic unit tests
    # run_tour_logic_tests()

    # Uncomment to run API tests
    # run_api_tests()

    # Default: Run tour logic unit tests
    run_tour_logic_tests()


def run_api_tests():
    """Chạy các API tests hiện có"""
    print("\n" + "🚀" + "="*58 + "🚀")
    print("🌐 RUNNING API INTEGRATION TESTS 🌐")
    print("🚀" + "="*58 + "🚀")

    # Uncomment and modify these tests as needed
    # test_health()
    # test_register()
    # test_login()
    # test_nearby_attr(1)

    print("ℹ️  API tests are commented out. Uncomment them in the code to run.")
    # test_reset_password('test_1764203958@gmail.com', '751551', '123QAZqaz!', '123QAZqaz!')
    
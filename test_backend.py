"""
Cái này để kiểm tra backend có chạy được hay ko
"""
import requests
import sys

def test_backend():
    base_url = "http://localhost:5000"
    
    print("Kiểm tra kết nối backend...")
    print(f"Checking: {base_url}")
    
    try:
        # Kiểm tra endpoint health
        response = requests.get(f"{base_url}/api/health", timeout=5)
        if response.status_code == 200:
            print("✅ Backend đang chạy và đáp ứng!")
            print(f"Response: {response.json()}")
            return True
        else:
            print(f"❌ Backend đáp ứng với status: {response.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        print("❌ Không thể kết nối đến backend!")
        print("   Make sure Flask server is running:")
        print("   python app.py")
        return False
    except requests.exceptions.Timeout:
        print("❌ Timeout kết nối!")
        return False
    except Exception as e:
        print(f"❌ Lỗi: {e}")
        return False

if __name__ == '__main__':
    success = test_backend()
    sys.exit(0 if success else 1)


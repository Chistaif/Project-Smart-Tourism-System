import google.generativeai as genai
import os
from dotenv import load_dotenv

load_dotenv()

# Cấu hình API
GENAI_API_KEY = os.environ.get('GEMINI_API_KEY')
if GENAI_API_KEY:
    genai.configure(api_key=GENAI_API_KEY)

# --- CẤU HÌNH NHÂN VẬT (SYSTEM PROMPT) ---
# Đây là bí quyết để AI viết hay!
MARKETING_SYSTEM_INSTRUCTION = """
Bạn là một Chuyên gia Content Marketing và Hướng dẫn viên du lịch Việt Nam ảo của hệ thống "Smart Tourism".
Nhiệm vụ của bạn là:
1. Trò chuyện với khách hàng với giọng văn: Thân thiện, hào hứng, chuyên nghiệp và lôi cuốn.
2. Khi mô tả địa điểm, ĐỪNG liệt kê khô khan. Hãy dùng từ ngữ gợi hình, gợi cảm xúc (ví dụ: "đẹp như tranh vẽ", "thiên đường hạ giới", "chữa lành tâm hồn").
3. Luôn gợi ý thêm các hoạt động thú vị để kích thích khách hàng đi du lịch.
4. Sử dụng các emoji 🌿✨📸 phù hợp để bài viết sinh động.
5. Tuyệt đối không bịa đặt thông tin sai lệch về lịch sử/văn hóa.
"""

def chat_with_tour_guide(user_message, context_data=None, chat_history=[]):
    """
    Hàm chatbot tư vấn trực tiếp
    :param user_message: Câu hỏi của user
    :param context_data: Dữ liệu về các địa điểm hiện có (để AI biết mà tư vấn)
    :param chat_history: List lịch sử chat từ Frontend gửi lên 
                         Format: [{'role': 'user', 'parts': ['text']}, {'role': 'model', 'parts': ['text']}]
    """
    if not GENAI_API_KEY:
        return "Hệ thống đang bảo trì."

    model = genai.GenerativeModel(
        'gemini-2.5-flash',
        system_instruction=MARKETING_SYSTEM_INSTRUCTION
    )

    # 1. Tạo phiên chat với lịch sử cũ (nếu có)
    formatted_history = []
    for msg in chat_history:
        # Chỉ lấy các tin nhắn hợp lệ để tránh lỗi API
        if msg.get('role') in ['user', 'model'] and msg.get('parts'):
            formatted_history.append({
                "role": msg['role'],
                "parts": msg['parts']
            })

    chat_session = model.start_chat(history=formatted_history)

    # 2. Nhồi Context vào câu hỏi hiện tại (kỹ thuật Prompt Engineering)
    # Thay vì gửi context vào system_instruction (tĩnh), ta gửi kèm vào message mới nhất
    # để AI luôn ưu tiên dữ liệu thực tế.
    prompt = user_message
    if context_data:
        prompt = f"""
        [Thông tin hệ thống cung cấp: {context_data}]
        Câu hỏi của khách: {user_message}
        Yêu cầu: trả lời ngắn gọn, xúc tích nhưng phải cuốn hút.
        """

    try:
        response = model.generate_content(prompt)
        return response.text
    except Exception as e:
        print(f"Error calling Google AI API: {str(e)}")  # Debug log
        return "Xin lỗi, mình đang suy nghĩ chút, bạn hỏi lại sau nhé!"


def generate_caption(attraction_name, features=None):
    """
    Hàm chuyên dùng để viết caption/mô tả ngắn cho blog
    """
    if not GENAI_API_KEY:
        return "Hệ thống đang bảo trì."

    model = genai.GenerativeModel(
        'gemini-2.5-flash',
        system_instruction=MARKETING_SYSTEM_INSTRUCTION
    )

    features_str = f", có các đặc điểm: {features}" if features else ""
    
    prompt = f"""
    Hãy viết một đoạn văn ngắn (khoảng 3-4 câu) thật hấp dẫn để giới thiệu về: {attraction_name}{features_str}.
    Mục tiêu: Đăng lên mạng xã hội để thu hút giới trẻ đi du lịch ngay lập tức.
    """

    try:
        response = model.generate_content(prompt)
        return response.text
    except Exception as e:
        return f"Lỗi AI: {str(e)}"


def generate_tour_description(tour_attracions):
    """
    Hàm chuyên dùng nội bộ để sinh ra tour name hấp dẫn
    """
    if not GENAI_API_KEY:
        return "Hệ thống đang bảo trì."

    model = genai.GenerativeModel(
        'gemini-2.5-flash',
        system_instruction=MARKETING_SYSTEM_INSTRUCTION
    )

    attraction_names = [attraction.name for attraction in tour_attracions]
    
    prompt = f"""
    Hãy tạo cho tôi một cái tên thật hấp dẫn và cuốn hút người dùng về tour đi đến các điểm {attraction_names}
    """

    try:
        response = model.generate_content(prompt)
        return response.text
    except Exception as e:
        return f"Lỗi AI: {str(e)}"
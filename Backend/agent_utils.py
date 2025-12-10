import os
from typing import List, Optional

import google.generativeai as genai
from dotenv import load_dotenv
from sqlalchemy.orm import joinedload
from models import Attraction, db
from service.search_service import smart_recommendation_service

load_dotenv()

# Cấu hình API
GENAI_API_KEY = os.environ.get('GEMINI_API_KEY')
if GENAI_API_KEY:
    genai.configure(api_key=GENAI_API_KEY)

# --- CẤU HÌNH NHÂN VẬT (SYSTEM PROMPT) ---
# Đây là bí quyết để AI viết hay!
SYSTEM_PROMPT_SMART_TOURISM = """
Bạn là Trợ lý Du lịch chính thức của hệ thống Smart Tourism.

Mục tiêu:
• Tư vấn du lịch bằng dữ liệu có thật trong hệ thống.
• Không bịa đặt địa điểm, món ăn, giá vé, hoặc thông tin lịch sử/văn hóa.
• Ưu tiên các địa điểm liên quan trực tiếp đến dữ liệu được cung cấp.

Quy tắc bắt buộc:
1) Nếu dữ liệu trong hệ thống có → sử dụng 100% dữ liệu thật, không mở rộng.
2) Nếu dữ liệu không có → phải nói rõ “Hệ thống chưa có dữ liệu về nội dung này”.
3) Không được phát minh tên địa điểm, nhà hàng, lễ hội, món ăn hoặc giờ mở cửa.
4) Có thể dùng giọng văn sinh động và cảm xúc **nhưng không được thêm chi tiết ngoài dữ liệu**.
5) Chỉ dùng emoji khi mô tả cảm xúc chung, không gán emoji cho dữ liệu.
6) Khi người dùng hỏi về lịch trình, gợi ý hoạt động → chỉ nói các hoạt động chung chung (đi dạo, chụp ảnh, thư giãn…), không được nêu tên địa điểm không có trong DB.
7) Luôn ưu tiên sở thích cá nhân hóa nếu người dùng đã có lịch sử yêu thích.

Vai trò:
• Khi mô tả địa điểm → ngắn gọn, rõ ràng, ưu tiên điểm nhấn: vị trí, tags, highlights.
• Khi gợi ý → chỉ gợi ý trong phạm vi dữ liệu có thật.
• Khi không chắc chắn → trả lời an toàn, không đoán.

Phong cách:
• Chuyên nghiệp, thân thiện, dễ đọc.
• Không văn vẻ quá mức, không marketing lố.

Quy định trình bày bắt buộc:
• Luôn trả lời theo cấu trúc Markdown rõ ràng.
• Mỗi mục xuống dòng và dùng bullet “-”.
• Không dùng dấu * để mở đầu dòng.
• Không gộp nhiều đoạn thành một đoạn dài.
• Mỗi ý tối đa 2–3 câu.
• Không bao giờ trả về một khối text liền một đoạn.
Ví dụ format yêu cầu:
- **Tên:** ...
- **Vị trí:** ...
- **Điểm nổi bật:** ...
- **Tags:** ...

Bạn luôn tuân thủ tuyệt đối dữ liệu được gửi kèm.
"""


def _truncate(text: Optional[str], max_len: int = 200) -> str:
    """Giới hạn độ dài để tránh nhồi quá nhiều token."""
    if not text:
        return ""
    text = text.strip().replace("\n", " ")
    return text[: max_len - 3].strip() + ("..." if len(text) > max_len else "")


def build_ai_context(user_message: str, user_id: Optional[int] = None, limit: int = 13) -> str:
    """
    Build context ngắn gọn, sạch và ưu tiên dữ liệu thật cho AI.
    """
    recommendations = smart_recommendation_service(
        user_id=user_id,
        search_term=user_message,
        limit=limit,
    )

    # Fallback khi không tìm thấy gì
    if not recommendations:
        fallback_attrs = Attraction.query.limit(3).all()
        recommendations = [{
            "id": a.id,
            "name": a.name,
            "location": a.location,
            "briefDescription": a.brief_description
        } for a in fallback_attrs]

    # Lấy danh sách Attraction thực sự
    ids = [r["id"] for r in recommendations if r.get("id")]
    attractions = Attraction.query.filter(Attraction.id.in_(ids)).options(
        joinedload(Attraction.tags)
    ).all()
    attr_map = {a.id: a for a in attractions}

    context_lines = []

    for item in recommendations:
        attr = attr_map.get(item["id"])
        if not attr:
            continue

        tags = [t.tag_name for t in attr.tags][:5]

        highlights = ""
        if isinstance(attr.detail_description, dict):
            raw = attr.detail_description.get("highlights") or attr.detail_description.get("features")
            if isinstance(raw, list):
                highlights = ", ".join(raw[:3])
            elif isinstance(raw, str):
                highlights = raw

        line = f"- {attr.name} ({attr.location})"
        if tags:
            line += f" | Tags: {', '.join(tags)}"
        if highlights:
            line += f" | Điểm nhấn: {highlights}"

        context_lines.append(line)

    return "Danh sách dữ liệu điểm đến trong hệ thống:\n" + "\n".join(context_lines)



def chat_with_tour_guide(user_message, context_data=None, chat_history=None, user_id=None):
    if not GENAI_API_KEY:
        return "Hệ thống đang bảo trì."

    model = genai.GenerativeModel(
        "gemini-2.5-flash",
        system_instruction=SYSTEM_PROMPT_SMART_TOURISM  # dùng prompt mới
    )

    # Lọc history – tối đa 6 lượt (đủ dùng, ít nhiễu)
    formatted_history = []
    if chat_history:
        for msg in chat_history[-6:]:
            if msg.get("role") in ["user", "model"] and msg.get("parts"):
                formatted_history.append({
                    "role": msg["role"],
                    "parts": msg["parts"]
                })

    chat_session = model.start_chat(history=formatted_history)

    prompt = f"""
Dữ liệu hệ thống (phải sử dụng 100%, không được bịa):
{context_data or 'Không có dữ liệu.'}

Yêu cầu người dùng: {user_message}

Hướng dẫn:
- Chỉ trả lời dựa trên dữ liệu trên.
- Nếu không có dữ liệu phù hợp → nói thẳng “Hệ thống chưa có dữ liệu”.
- Không thêm địa điểm, món ăn, hoạt động không có trong dữ liệu.
- Không đưa thông tin giả, không đoán.
- Văn phong thân thiện, rõ ràng, dễ đọc.

Hãy trả lời theo đúng Markdown sau:
- **Tên:** ...
- **Vị trí:** ...
- **Điểm nổi bật:** ...
- **Tags:** ...

Không được trả về đoạn văn liền mạch. Mỗi dòng phải tách biệt.
"""

    try:
        response = chat_session.send_message(prompt)
        return response.text
    except Exception as e:
        print("AI ERROR:", str(e))
        return "Xin lỗi, mình đang gặp chút sự cố. Bạn có thể thử lại sau."


def generate_caption(attraction_name, features=None):
    """
    Hàm chuyên dùng để viết caption/mô tả ngắn cho blog
    """
    if not GENAI_API_KEY:
        return "Hệ thống đang bảo trì."

    model = genai.GenerativeModel(
        'gemini-2.5-flash',
        system_instruction=SYSTEM_PROMPT_SMART_TOURISM
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
        system_instruction=SYSTEM_PROMPT_SMART_TOURISM
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
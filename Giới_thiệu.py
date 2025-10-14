import streamlit as st

# name + icon of website
st.set_page_config(page_title="GoViet Travel",
                   page_icon="assets/images/icon_web.png",
                   layout='wide',
                   initial_sidebar_state='collapsed',
                   menu_items={
                       'Report a bug': 'https://www.facebook.com/danh6112006',
                       'About': """
                        ### 🌏 GoViet Travel
                        Trang web khám phá du lịch Việt Nam.

                        🧭 Phiên bản: 1.0.0 

                        🧑‍💻 Tác giả: Sky Nguyễn 
                        """
    })

st.image('./assets/images/logo.png', width='stretch')



st.title("***CÙNG GOVIET KHÁM PHÁ VIỆT NAM***", anchor=False)

st.header("Điểm đến độc lạ, Văn hóa chân thực, Trải nghiệm riêng biệt", anchor=False)
st.write(
    "GoViet không chỉ là du lịch, mà là khám phá những điểm đến ít người biết" \
    ", những câu chuyện địa phương chân thực và những trải nghiệm văn hóa sâu sắc." \
    " Chúng tôi tuyển chọn những hành trình độc đáo, vượt xa các lộ trình du lịch " \
    "truyền thống, giúp bạn tìm thấy vẻ đẹp tiềm ẩn của Việt Nam."
)

"""


"""

st.header("Tùy chỉnh lịch trình, Theo sở thích, Ngân sách linh hoạt", anchor=False)
st.write(
    "Bạn có thể tự do lên kế hoạch cho chuyến đi của mình. Từ việc chọn điểm đến," \
    "hoạt động, lịch trình đến cả ngân sách, GoViet cung cấp công cụ và gợi ý để bạn " \
    "tạo ra một chuyến đi hoàn hảo, phản ánh đúng sở thích và phong cách của bạn."
)

"""


"""

st.header("Hỗ trợ 24/7, Đặt vé dễ dàng, An tâm trọn vẹn", anchor=False)
st.write(
    "Từ lúc bạn lên ý tưởng cho chuyến đi cho đến khi trở về nhà an toàn, GoViet luôn " \
    "đồng hành cùng bạn. Chúng tôi cung cấp hỗ trợ đặt vé, chỗ ở, phương tiện di chuyển," \
    " bảo hiểm du lịch và đội ngũ hỗ trợ 24/7, đảm bảo mọi thứ diễn ra suôn sẻ."
)

"""


"""

st.header("Chia sẻ kinh nghiệm, Kết nối đam mê, Truyền cảm hứng", anchor=False)
st.write(
    "Hãy chia sẻ những câu chuyện, hình ảnh và mẹo du lịch của bạn với cộng đồng " \
    "GoViet. Học hỏi từ kinh nghiệm của những người khác và truyền cảm hứng cho những chuyến " \
    "phiêu lưu mới. Đây là nơi những người yêu du lịch kết nối và lan tỏa niềm đam mê."
)
st.link_button("💬 Tham gia Discord của chúng tôi",
               "https://discord.gg/9NFGZg3ws",
               help="Join Discord")

left, center, right = st.columns([2, 1, 2])
with center:
    if st.button("Bắt đầu hành trình phiêu lưu cùng GoViet!"):
        st.switch_page(page='pages/1_Home.py')


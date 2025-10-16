import streamlit as st
from streamlit_option_menu import option_menu
from streamlit_carousel import carousel

st.set_page_config(page_title="Smart Tourism", layout="wide")

image_list = [
    {
        "img": "assets/images/Vinh-Ha-Long.jpg",
        "title": "Vịnh Hạ Long",
        "text": "Di sản thiên nhiên thế giới với hàng nghìn hòn đảo kỳ vĩ."
    },
    {
        "img": "assets/images/Hoi-An.jpg",
        "title": "Hội An",
        "text": "Phố cổ yên bình với những chiếc đèn lồng rực rỡ và nét văn hóa cổ kính."
    },
    {
        "img": "assets/images/Ha-Noi.jpg",
        "title": "Hà Nội",
        "text": "Thủ đô nghìn năm văn hiến, nơi lưu giữ tinh hoa văn hóa Việt."
    }
]

# ======= Thanh menu ngang =======
selected = option_menu(
    menu_title=None,
    options=["Home", "Service", "About us", "Setting"],
    icons=["house-door", "map", "person", "gear-fill"],
    menu_icon="cast",
    default_index=0,
    orientation="horizontal"
)

# ======= Chia màn hình 2 cột =======
col1, col2 = st.columns([2,1])

with col1: # Nửa trái: Banner
    carousel(items=image_list,width=1100)
    # ======= Script JavaScript để tự động chuyển ảnh =======
    auto_slide_js = """
    <script>
    let currentIndex = 0;
    const slides = window.parent.document.querySelectorAll('[data-testid="stCarouselItem"]');
    if (slides.length > 0) {
        slides[currentIndex].style.display = "block";
        setInterval(() => {
            slides[currentIndex].style.display = "none";
            currentIndex = (currentIndex + 1) % slides.length;
            slides[currentIndex].style.display = "block";
        }, 4000);
    }
    </script>
    """
    st.markdown(auto_slide_js, unsafe_allow_html=True)
with col2: # Nửa phải: Text + Button chuyển trang
    st.markdown("Chào mừng đến với Smart Tourism")
    st.write("""
        Đây là trang giới thiệu hệ thống du lịch thông minh.
        Bạn có thể khám phá các dịch vụ, địa điểm, và lên kế hoạch cho chuyến đi.
            """)
    st.markdown("---")
    # Nút bấm
    if st.button("Bắt đầu"):
        st.switch_page("pages/2_Service.py")
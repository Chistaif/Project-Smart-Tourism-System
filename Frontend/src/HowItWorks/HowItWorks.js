import React from 'react';
import './HowItWorks.css';
import trip from "./Trip.png";
import place from "./Place.png";
import chat from "./Chat.png";
import acc from "./Account.png";

const defaultItems = [
  {
    title: 'Khởi Tạo Chân Dung Khách Du Lịch - Tạo & Quản lý tài khoản cá nhân',
    subtext: 'Bước đầu tiên để mở khóa thế giới du lịch văn hóa cá nhân hóa.',
    text: [
      'Tạo tài khoản dễ dàng với email và xác thực OTP an toàn, đảm bảo dữ liệu của bạn được bảo mật tuyệt đối. Việc đăng nhập nhanh chóng giúp bạn mở khóa toàn bộ tính năng độc quyền: từ lưu hành trình, tạo blog đến đồng bộ dữ liệu trên mọi thiết bị. Tài khoản cá nhân hóa sẽ là nơi lưu trữ hồ sơ sở thích du lịch của bạn, làm nền tảng cho mọi gợi ý sau này.',
    ],
    img: acc,
    alt: 'Đăng ký tài khoản',
  },
  {
    title: 'Thẩm Định Điểm Đến - Khám phá địa điểm chi tiết và chân thực',
    subtext: 'Cơ sở dữ liệu phong phú về văn hóa và du lịch Việt Nam.',
    text: [
      'Khám phá hàng ngàn điểm đến với góc nhìn sâu sắc về văn hóa, lịch sử và truyền thống. Xem hình ảnh chất lượng cao, mô tả chi tiết, mẹo du lịch được cộng đồng kiểm chứng và đánh giá từ cộng đồng người dùng. Culture Compass giúp bạn không chỉ "thấy" mà còn "hiểu" rõ về điểm đến trước khi quyết định, đảm bảo mọi trải nghiệm đều mang tính giáo dục và chân thực.',
    ],
    img: place,
    alt: 'Khám phá điểm đến',
  },
  {
    title: 'Kiến Tạo Hành Trình Độc Nhất - Cá nhân hóa những chuyến đi với AI',
    subtext: 'Chức năng cốt lõi giúp Culture Compass trở nên độc đáo.',
    text: [
      'Không cần mất hàng giờ lên kế hoạch thủ công. Chỉ với vài lựa chọn đơn giản (thời gian, ngân sách, sở thích văn hóa), hệ thống AI thông minh của chúng tôi sẽ tức thì gợi ý hành trình phù hợp nhất với sở thích, thời gian và phong cách du lịch của bạn.',
      'Mỗi chuyến đi được tạo ra đều là một hành trình độc nhất — mang dấu ấn của chính bạn, tối ưu hóa lộ trình di chuyển và đề xuất trải nghiệm văn hóa địa phương sâu sắc.',
    ],
    img: trip,
    alt: 'Tạo hành trình',
  },
  {
    title: 'Trợ Lý Du Lịch Riêng - Tối ưu hóa kế hoạch bằng AI thông minh',
    subtext: 'Người bạn đồng hành ảo luôn sẵn sàng hỗ trợ.',
    text: [
      'Trò chuyện trực tiếp với trợ lý AI chuyên biệt của Culture Compass. Trợ lý này không chỉ giúp bạn nhận gợi ý hành trình thay thế hoặc điểm dừng chân bất ngờ, mà còn giải đáp nhanh chóng mọi thắc mắc du lịch.',
      'Sử dụng AI để tối ưu hóa kế hoạch chuyến đi của bạn theo thời gian thực, điều chỉnh lịch trình khi có thay đổi thời tiết hoặc giao thông, đảm bảo hành trình của bạn luôn suôn sẻ nhất.',
    ],
    img: chat,
    alt: 'Trợ lý AI',
  },
  {
    title: 'Quản Lý & Lưu Trữ Đa Nền Tảng',
    subtext: 'Kiểm soát mọi thứ một cách trực quan.',
    text: [
      'Dễ dàng lưu hành trình yêu thích và chỉnh sửa linh hoạt bất cứ lúc nào bạn muốn. Toàn bộ dữ liệu của bạn, bao gồm các địa điểm đã lưu và lịch sử tạo tour, được đồng bộ hóa tức thì và an toàn trên mọi thiết bị (điện thoại, máy tính bảng).',
      'Điều này mang lại sự tiện lợi và trực quan tối đa, cho phép bạn tiếp tục lên kế hoạch dù đang ở đâu.',
    ],
    img: '/path/to/img-save.jpg',
    alt: 'Lưu hành trình',
  },
  {
    title: 'Gắn Kết Cộng Đồng - Sẻ chia những trải nghiệm văn hóa',
    subtext: 'Trở thành một phần của Bản đồ Văn hóa Việt.',
    text: [
      'BLOGS - Culture Compass là nơi giao lưu của những người yêu văn hóa. Mỗi câu chuyện bạn kể, mỗi nơi bạn đi qua, mỗi khoảnh khắc bạn mang về — đều góp phần tạo nên một bản đồ văn hoá đầy màu sắc. Hãy để những trải nghiệm của bạn trở thành cảm hứng cho những người yêu văn hoá Việt trên khắp mọi miền.',
      'Tính năng blog mạnh mẽ giúp bạn dễ dàng chia sẻ và kết nối.',
    ],
    img: '/path/to/img-blog.jpg',
    alt: 'Viết blog du lịch',
    button: true,
  },
];

export default function HowItWorks({ items = defaultItems }) {
  return (
    <section className="hiw">
      <div className="hiw__container">
        <h2 className="hiw__title">HÀNH TRÌNH KHÁM PHÁ CỦA BẠN</h2>
        <p className="hiw__subtitle">
          Culture Compass: Lên kế hoạch du lịch văn hóa dễ dàng — từ khám phá đến chia sẻ, từng bước rõ ràng và trực quan.
        </p>

        <div className="hiw__list">
          {items.map((it, idx) => (
            <article
              key={idx}
              className={`hiw__item ${idx % 2 === 1 ? 'hiw__item--reverse' : ''}`}
            >
              <div className="hiw__content">
                <h3 className="hiw__heading">{it.title}</h3>
                <p className="hiw__subtext">{it.subtext}</p>
                {it.text.map((paragraph, pIdx) => (
                    <p key={pIdx} className="hiw__text">{paragraph}</p>
                ))}

                {it.button && (
                    <a href="/blogs" className="hiw__button">
                        Khám phá Blog →
                    </a>
                )}

              </div>
                
              <div className="hiw__media">
                <img src={it.img} alt={it.alt || it.title} className="hiw__img" />
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { destinationsAPI } from '../utils/api';
import test1 from '../asset/test1.png';
import test2 from '../asset/test2.png';
import test3 from '../asset/test3.png';
import HowItWorks from '../HowItWorks/HowItWorks';
export default function HomePage({ handleCardClick, currentUser, images, swapImage}) {
  const [destinations, setDestinations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const navigate = useNavigate();

    const FeatureCard = ({ title, desc }) => (
    <div className="feature-card">
      <h4 className="feature-title">{title}</h4>
      <p className="feature-desc">{desc}</p>
    </div>
  );

  useEffect(() => {
    // Fetch destinations from Flask API
    const fetchDestinations = async () => {
      try {
        setLoading(true);
        const response = await destinationsAPI.getAll({
          userId: currentUser?.user_id,
        });
        if (response.success) {
          setDestinations(response.data);
        } else {
          setError('Failed to load destinations');
        }
      } catch (err) {
        console.error('Error fetching destinations:', err);
        setError('Error connecting to server. Make sure Flask is running on port 5000.');
      } finally {
        setLoading(false);
      }
    };

    fetchDestinations();
  }, [currentUser]);

  return (
    /*FRAME 1*/
    <>

    <main className="hero">
      <section className="left">

        <div className="eyebrow">Culture Compass</div>
        <h1>Khám phá chất Việt qua những hành trình đậm nét văn hóa</h1>
        <p className="lead">
          Trải nghiệm những truyền thống ẩn giấu, lễ hội chân thực và hành trình khó quên.
        </p>
        <a className="cta" onClick={() => navigate('/service')}>Bắt đầu ngay!</a>

        {/* <p 
          className="homepage-link"
          onClick={() => window.location.href = '/blogs'}
        >
          Xem các bài viết mới nhất hoặc Tạo bài viết của bạn →
        </p> */}

        {/* Display API data
        {loading && <p style={{ color: 'white', marginTop: '20px' }}>Loading destinations...</p>}
        {error && <p style={{ color: 'red', marginTop: '20px' }}>{error}</p>}
        {!loading && !error && destinations.length > 0 && (
          <div style={{ marginTop: '20px', color: 'white' }}>
            <p>Found {destinations.length} destinations from API:</p>
            <ul style={{ fontSize: '0.9em', marginTop: '10px' }}>
              {destinations.slice(0, 3).map(dest => (
                <li key={dest.id}>{dest.name} - {dest.location}</li>
              ))}
            </ul>
          </div>
        )} */}
      </section>

      <aside className="right">
        {images.slice(1).map((img, index) => (
          <div className={`card-col col-${index}`} key={index}>
            <div className="img-card" onClick={() => swapImage(index + 1)}>
              <div className="inner" style={{ backgroundImage: `url(${img})` }} />
            </div>
          </div>
        ))}
      </aside>

    </main>

    <section className="howitworks-section">
      <div className="howitworks-box">
        <HowItWorks />
      </div>
    </section>

    {/*FRAME 2 */}
    
    {/*
    <section className="blogs-preview">
      <div className="blogs-box">

        <div className="eyebrow">CUTURE COMPASS</div>

        <h2 className="blogs-title">
          Nơi những câu chuyện văn hoá được sẻ chia
        </h2>

        <p className="blogs-desc">
          Khám phá khóc nhìn mới từ cộng đồng yêu văn hoá Việt.
          Đọc những câu chuyện thực tế hoặc chia sẻ hành trình của riêng bạn.
        </p>

        <button
          className="blogs-cta"
          onClick={() => navigate('/blogs')}
        >
          Khám phá Blog →
        </button>

      </div>
    </section>  */}

    {/*FRAME 3*/}

    <section className="tour-section">
  <div className="tour-box">
    
    <div className="eyebrow">CULTURE COMPASS</div>

    <h2 className="tour-title">
      Tạo hành trình của riêng bạn theo cách nhanh nhất
    </h2>
    <p className="tour-desc">
      Không cần mất hàng giờ lên kế hoạch. Chỉ với vài lựa chọn đơn giản, hệ thống gợi ý hành trình
      phù hợp với sở thích, thời gian và phong cách du lịch của bạn. Mỗi tour được tạo ra đều là một
      hành trình độc nhất — mang dấu ấn của chính bạn.
    </p>

    <h2 className="tour-title">
      Khám phá mọi miền đất nước theo lộ trình thông minh
    </h2>
    <p className="tour-desc">
      Từ núi rừng Tây Bắc đến biển xanh miền Trung, từ những lễ hội rực rỡ đến những làng nghề trăm năm tuổi —
      bạn có thể tạo tour đi bất cứ đâu chỉ trong vài giây. Culture Compass sẽ giúp bạn chọn điểm đến,
      tối ưu quãng đường và gợi ý trải nghiệm văn hoá mang đậm chất Việt.
    </p>

  </div>
</section>


    {/*FRAME 4*/}

    <section className="inspire-section">

  <div className="inspire-box">
    
    <div className="eyebrow">CULTURE COMPASS</div>

    <h2 className="inspire-title">
      Nơi mỗi bước chân đều chạm vào một phần ký ức Việt
    </h2>

    <p className="inspire-desc">
      Văn hoá không chỉ nằm trong những trang sử cũ — nó sống trong hơi thở của từng vùng đất,
      trong giọng nói, trong lễ hội, trong nhịp sống thường ngày. Culture Compass đồng hành cùng bạn
      trên hành trình khám phá những giá trị tưởng chừng quen thuộc nhưng chưa bao giờ ngừng mới lạ.
    </p>

    <h2 className="inspire-title">
      Gắn kết con người qua những câu chuyện được sẻ chia
    </h2>

    <p className="inspire-desc">
      Mỗi câu chuyện bạn kể, mỗi nơi bạn đi qua, mỗi khoảnh khắc bạn mang về —
      đều góp phần tạo nên một bản đồ văn hoá đầy màu sắc. Hãy để những trải nghiệm của bạn
      trở thành cảm hứng cho những người yêu văn hoá Việt trên khắp mọi miền.
    </p>

      </div>
    </section>
    
        <section className="why-choose-us" style={{ padding: '60px 0', textAlign: 'center' }}>
      <div className="container">
        <div className="eyebrow">VÌ SAO CHỌN CULTURE COMPASS</div>
        <h2 className="why-title">
          Trải nghiệm du lịch thông minh, đậm chất văn hóa Việt
        </h2>
        <div className="features-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '30px' }}>
                <FeatureCard 
                    title="Hành Trình Độc Nhất AI" 
                    desc="Hệ thống AI cá nhân hóa tour theo sở thích, tối ưu hóa lộ trình tức thì." 
                />
                <FeatureCard 
                    title="Thấu Hiểu Văn Hóa" 
                    desc="Thông tin chi tiết, hình ảnh chất lượng cao và đánh giá chân thực về điểm đến." 
                />
                <FeatureCard 
                    title="Trợ Lý Thông Minh" 
                    desc="Trò chuyện với AI để nhận gợi ý, giải đáp và điều chỉnh kế hoạch 24/7." 
                />
                <FeatureCard 
                    title="Cộng Đồng Sẻ Chia" 
                    desc="Gắn kết, viết blog, và nhận cảm hứng từ những câu chuyện du lịch thực tế." 
                />
            </div>
        </div>
      </section>
  </>
  );
}
    
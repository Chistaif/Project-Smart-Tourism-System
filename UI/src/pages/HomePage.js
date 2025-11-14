import React from 'react';
import test1 from '../asset/test1.png';
import test2 from '../asset/test2.png';
import test3 from '../asset/test3.png';

export default function HomePage({ handleCardClick }) {
  return (
    <main className="hero">
      <section className="left">
        <div className="eyebrow">Culture Compass</div>
        <h1>Khám phá chất Việt qua những hành trình đậm nét văn hóa</h1>
        <p className="lead">
          Trải nghiệm những truyền thống ẩn giấu, lễ hội chân thực và hành trình khó quên.
        </p>
        <a className="cta">Start now!</a>
      </section>

      <aside className="right">
        <div className="card-col">
          <div className="img-card" onClick={() => handleCardClick(`url(${test3})`)}>
            <div className="inner" style={{ backgroundImage: `url(${test3})` }} />
          </div>
        </div>

        <div className="card-col">
          <div className="img-card" onClick={() => handleCardClick(`url(${test2})`)}>
            <div className="inner" style={{ backgroundImage: `url(${test2})` }} />
          </div>
        </div>

        <div className="card-col">
          <div className="img-card" onClick={() => handleCardClick(`url(${test1})`)}>
            <div className="inner" style={{ backgroundImage: `url(${test1})` }} />
          </div>
        </div>
      </aside>
    </main>
  );
}
    
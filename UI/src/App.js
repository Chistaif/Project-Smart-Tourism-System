import React, { useState } from 'react';
import './App.css';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';


import homeImg from './asset/home.png';
import test1 from './asset/test1.png';
import test2 from './asset/test2.png';
import test3 from './asset/test3.png';

function App() {
  const [currentBackground, setCurrentBackground] = useState(`url(${homeImg})`);
  const [isOpen, setIsOpen] = useState(false);
  

  const openPopup = () => setIsOpen(true);
  const closePopup = () => setIsOpen(false);

  const handleCardClick = (cardBg) => {
    if (cardBg && cardBg !== 'none') {
      setCurrentBackground(cardBg);
    }
  };

  return (
    <div className="App" style={{ backgroundImage: currentBackground }}>
      <header>
        <div className="logo">Culture Compass</div>
        <nav>
          <a className="active">Home</a>
          <a>Service</a>
          <a>Blogs</a>  
          <a>User</a>
        </nav>
        <div className="auth">
          <button className="btn" onClick={openPopup}>Sign up</button> {
            isOpen && (
              <div className="popup-overlay">
                <div className='popup'>
                  <h2> here is popup</h2>
                  <button onClick={closePopup}> close</button>
                </div>
              </div>
            )
          }
          <button className="btn">Login</button>
        </div>
      </header>

      <main className="hero">
        <section className="left">
          <div className="eyebrow">Culture Compass</div>
          <h1>Khám phá chất Việt qua những hành trình đậm nét văn hóa</h1>
          <p className="lead">
            Trải nghiệm những truyền thống ẩn giấu, những lễ hội chân thực và những hành trình khó quên khắp Việt Nam.
          </p>
          <a className="cta">Start now!</a>
        </section>

        <aside className="right" aria-hidden="true">
          <div className="card-col">
            <div className="img-card" onClick={() => handleCardClick(`url(${test3})`)}>
              <div className="inner" style={{ backgroundImage: `url(${test3})` }}></div>
            </div>
          </div>

          <div className="card-col">
            <div className="img-card" onClick={() => handleCardClick(`url(${test2})`)}>
              <div className="inner" style={{ backgroundImage: `url(${test2})` }}></div>
            </div>
          </div>

          <div className="card-col">
            <div className="img-card" onClick={() => handleCardClick(`url(${test1})`)}>
              <div className="inner" style={{ backgroundImage: `url(${test1})` }}></div>
            </div>
          </div>
        </aside>
      </main>

      <footer>
        <small>© 2025 Culture Compass</small>
      </footer>
    </div>
  );
}

export default App;

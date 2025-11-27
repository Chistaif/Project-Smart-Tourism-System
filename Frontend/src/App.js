import React, { useState, useEffect } from 'react';
import './App.css';

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import Navigation from './layout/Navigation';
import HomePage from './pages/HomePage';
import Service from './pages/Service';
import Blogs from './pages/Blogs';
import BlogDetail from './pages/BlogDetail';
import AttractionDetail from './pages/AttractionDetail';
import UserPage from './pages/UserPage';
import { authAPI } from './utils/api';

import test1 from './asset/box1.jpg';
import test2 from './asset/box2.jpg';
import test3 from './asset/box3.jpg';
import homeImg from './asset/home_1.jpg';

const initialImages = [homeImg, test1, test2, test3];


function App() {
  const [currentBackground, setCurrentBackground] = useState(`url(${homeImg})`);
  const [isOpen, setIsOpen] = useState(false);
  const [popupMode, setPopupMode] = useState('signup'); // 'signup' or 'login'
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);

  const [images, setImages] = useState(initialImages);

  const swapImage = (clickedIndex) => {
    const newImages = [...images];

    // Swap ảnh index 0 (background) với ảnh được click
    const temp = newImages[0];
    newImages[0] = newImages[clickedIndex];
    newImages[clickedIndex] = temp;

    setImages(newImages);
    setCurrentBackground(`url(${newImages[0]})`);
  };


  useEffect(() => {
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (err) {
        console.error('Invalid stored user data', err);
        localStorage.removeItem('currentUser');
      }
    }
  }, []);

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('currentUser');
  };

  const openPopup = (mode = 'signup') => {
    setPopupMode(mode);
    setIsOpen(true);
    setError('');
  };
  const closePopup = () => {
    setIsOpen(false);
    setError('');
  };
  const switchMode = (mode) => {
    setPopupMode(mode);
    setError('');
  };

  const handleCardClick = (bg) => {
    if (bg && bg !== 'none') setCurrentBackground(bg);
  };

  return (
    <Router>
      <div className="App" style={{ backgroundImage: currentBackground }}>
        
        <Navigation 
          openPopup={openPopup} 
          openLogin={() => openPopup('login')} 
          openSignup={() => openPopup('signup')} 
          user={user}
          onLogout={handleLogout}
        />

        {/* POPUP */}
        {isOpen && (
          <div className="popup-overlay" onClick={closePopup}>
            <div className="popup" onClick={(e) => e.stopPropagation()}>
              <button className="popup-close" onClick={closePopup} aria-label="Đóng">
                ×
              </button>
              
              {popupMode === 'signup' && (
                <div className="signup-container">
                  <h2 className="signup-title">Tạo Tài Khoản</h2>
                  <p className="signup-subtitle">Tham gia Culture Compass và bắt đầu hành trình của bạn</p>
                  
                  {error && <div className="error-message">{error}</div>}
                  
                  <form className="signup-form" onSubmit={async (e) => {
                    e.preventDefault();
                    setError('');
                    setLoading(true);
                    
                    try {
                      const formData = new FormData(e.target);
                      const username = (formData.get('username') || '').trim();
                      const email = (formData.get('email') || '').trim().toLowerCase();
                      const password = String(formData.get('password') || '').trim();
                      const confirmPassword = String(formData.get('confirmPassword') || '').trim();

                      // Validate password length first
                      if(!password || password.length < 6) {
                        setError("Mật khẩu phải có ít nhất 6 ký tự");
                        return;
                      }

                      // Compare passwords
                      if(password !== confirmPassword) {
                        setError("Mật khẩu xác nhận không khớp. Vui lòng kiểm tra lại.");
                        return;
                      }
                      
                      const userData = {username, email, password};    
                      const response = await authAPI.signup(userData);
                      
                      if (response.success) {
                        setUser(response.user);
                        localStorage.setItem('currentUser', JSON.stringify(response.user));
                        alert('Đăng ký thành công!');
                        closePopup();
                      } else {
                        setError(response.error || 'Đăng ký thất bại');
                      }
                    } catch (err) {
                      setError(err.message || 'Đăng ký thất bại');
                    } finally {
                      setLoading(false);
                    }
                  }}>
                    <div className="form-group">
                      <label htmlFor="signup-username">Tên người dùng</label>
                      <input 
                        type="text" 
                        id="signup-username" 
                        name="username" 
                        placeholder="Nhập tên người dùng"
                        required
                      />
                    </div>
                    
                    <div className="form-group">
                      <label htmlFor="signup-email">Email</label>
                      <input 
                        type="email" 
                        id="signup-email" 
                        name="email" 
                        placeholder="Nhập email của bạn"
                        required
                      />
                    </div>
                    
                    <div className="form-group">
                      <label htmlFor="signup-password">Mật khẩu</label>
                      <input 
                        type="password" 
                        id="signup-password" 
                        name="password" 
                        placeholder="Tạo mật khẩu"
                        required
                        minLength="6"
                      />
                    </div>
                    
                    <div className="form-group">
                      <label htmlFor="signup-confirmPassword">Xác nhận mật khẩu</label>
                      <input 
                        type="password" 
                        id="signup-confirmPassword" 
                        name="confirmPassword" 
                        placeholder="Xác nhận mật khẩu"
                        required
                      />
                    </div>
                    
                    <button type="submit" className="signup-btn" disabled={loading}>
                      {loading ? 'Đang tạo tài khoản...' : 'Đăng Ký'}
                    </button>
                  </form>
                  
                  <div className="signup-footer">
                    <p>Đã có tài khoản? <a href="#" className="signup-link" onClick={(e) => { e.preventDefault(); switchMode('login'); }}>Đăng Nhập</a></p>
                  </div>
                </div>
              )}

              {popupMode === 'login' && (
                <div className="signup-container">
                  <h2 className="signup-title">Chào Mừng Trở Lại</h2>
                  <p className="signup-subtitle">Đăng nhập để tiếp tục hành trình</p>
                  
                  {error && <div className="error-message">{error}</div>}
                  
                  <form className="signup-form" onSubmit={async (e) => {
                    e.preventDefault();
                    setError('');
                    setLoading(true);
                    
                    try {
                      const formData = new FormData(e.target);
                      const credentials = {
                        username: formData.get('username'),
                        password: formData.get('password')
                      };
                      
                      const response = await authAPI.login(credentials);
                      if (response.success) {
                        setUser(response.user);
                        localStorage.setItem('currentUser', JSON.stringify(response.user));
                        alert('Đăng nhập thành công!');
                        closePopup();
                      } else {
                        setError(response.error || 'Đăng nhập thất bại');
                      }
                    } catch (err) {
                      setError(err.message || 'Đăng nhập thất bại');
                    } finally {
                      setLoading(false);
                    }
                  }}>
                    <div className="form-group">
                      <label htmlFor="login-username">Tên Đăng Nhập</label>
                      <input 
                        type="text" 
                        id="login-username" 
                        name="username" 
                        placeholder="Nhập tên đăng nhập"
                        required
                      />
                    </div>
                    
                    <div className="form-group">
                      <label htmlFor="login-password">Mật khẩu</label>
                      <input 
                        type="password" 
                        id="login-password" 
                        name="password" 
                        placeholder="Nhập mật khẩu"
                        required
                      />
                    </div>
                    
                    <div className="form-options">
                      <label className="checkbox-label">
                        <input type="checkbox" />
                        <span>Ghi nhớ đăng nhập</span>
                      </label>
                      <a href="#" className="forgot-password" onClick={(e) => {e.preventDefault(); switchMode('forgot'); }}>Quên mật khẩu?</a>
                    </div>
                    
                    <button type="submit" className="signup-btn" disabled={loading}>
                      {loading ? 'Đang đăng nhập...' : 'Đăng Nhập'}
                    </button>
                  </form>
                  
                  <div className="signup-footer">
                    <p>Chưa có tài khoản? <a href="#" className="signup-link" onClick={(e) => { e.preventDefault(); switchMode('signup'); }}>Đăng Ký</a></p>
                  </div>
                </div>
              )}

              {popupMode === 'forgot' && (
                <div className="signup-container">
                  <h2 className="signup-title">Quên Mật Khẩu</h2>
                  <p className="signup-subtitle">
                    Nhập email để xác nhận
                  </p>

                  {error && <div className="error-message">{error}</div>}

                  <form 
                    classNmae="signup-form"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      setError('');
                      setLoading(true);

                      const formData = new FormData(e.target);
                      const email = formData.get('email');

                      if(!email) {
                        setError('Vui lòng nhập email trước khi xác thực');
                        setLoading(false);
                        return;
                      }

                      try {
                        alert(
                          'Nếu email tồn tại trong hệ thống, mã xác thực sẽ được gửi'
                        );

                        switchMode('login');
                      } catch(err) {
                        setError(
                          err.message || 'Không thể gửi email xác thực, thử lại sau'
                        );
                      } finally {
                        setLoading(false);
                      }
                    }}
                  >
                    <div className="form-group">
                      <label htmlFor="forgot-email">Email</label>
                      <input
                        type="email"
                        id="forgot-email"
                        name="email"
                        placeholder="Nhập email của bạn"
                        required
                      />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '10px'}}>
                      <button 
                        type="submit"
                        className="forgot-btn"
                        disabled={loading}
                      >
                        {loading ? 'Đang gửi...' : 'Xác thực'}
                      </button>
                    </div>
                  </form>

                  <div className="signup-footer">
                    <p>
                      Nhớ mật khẩu rồi?{' '}
                      <a
                        href="#"
                        className="signup-link"
                        onClick={(e)=> {
                          e.preventDefault();
                          switchMode('login');
                        }}
                      >
                        Quay lại đăng nhập
                      </a>
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ROUTES */}
        <Routes>
          <Route 
            path="/" 
            element={<HomePage handleCardClick={handleCardClick} currentUser={user} images={images} swapImage={swapImage} />} 
          />
          <Route 
            path="/service" 
            element={<Service currentUser={user} />} 
          />
          <Route path="/attractions/:id" element={<AttractionDetail currentUser={user} />} />
          <Route path="/blogs" element={<Blogs currentUser={user} />} />
          <Route path="/user" element={<UserPage currentUser={user} onLogout={handleLogout} />} />
          <Route path="/blogs/:id" element={<BlogDetail />} />

        </Routes>

        <footer>
          <small>© 2025 Culture Compass</small>
        </footer>
      </div>
    </Router>
  );
}

export default App;

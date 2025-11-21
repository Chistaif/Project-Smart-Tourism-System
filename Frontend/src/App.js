import React, { useState, useEffect } from 'react';
import './App.css';

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import Navigation from './layout/Navigation';
import HomePage from './pages/HomePage';
import Service from './pages/Service';
import Blogs from './pages/Blogs';
import BlogDetail from './pages/BlogDetail';
import AttractionDetail from './pages/AttractionDetail';
import { authAPI } from './utils/api';

import homeImg from './asset/home.png';

function App() {
  const [currentBackground, setCurrentBackground] = useState(`url(${homeImg})`);
  const [isOpen, setIsOpen] = useState(false);
  const [popupMode, setPopupMode] = useState('signup'); // 'signup' or 'login'
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);

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
              
              {popupMode === 'signup' ? (
                <div className="signup-container">
                  <h2 className="signup-title">Tạo Tài Khoản</h2>
                  <p className="signup-subtitle">Tham gia Culture Compass và bắt đầu hành trình của bạn</p>
                  
                  {error && <div className="error-message">{error}</div>}
                  
                  <form className="signup-form" onSubmit={async (e) => {
                    e.preventDefault();
                    setError('');
                    setLoading(true);
                    
                    const formData = new FormData(e.target);
                    const userData = {
                      username: formData.get('username'),
                      email: formData.get('email'),
                      password: formData.get('password'),
                      confirmPassword: formData.get('confirmPassword')
                    };
                    
                    try {
                      const response = await authAPI.signup(userData);
                      if (response.success) {
                        setUser(response.user);
                        localStorage.setItem('currentUser', JSON.stringify(response.user));
                        alert('Đăng ký thành công!');
                        closePopup();
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
              ) : (
                <div className="signup-container">
                  <h2 className="signup-title">Chào Mừng Trở Lại</h2>
                  <p className="signup-subtitle">Đăng nhập để tiếp tục hành trình</p>
                  
                  {error && <div className="error-message">{error}</div>}
                  
                  <form className="signup-form" onSubmit={async (e) => {
                    e.preventDefault();
                    setError('');
                    setLoading(true);
                    
                    const formData = new FormData(e.target);
                    const credentials = {
                      email: formData.get('email'),
                      password: formData.get('password')
                    };
                    
                    try {
                      const response = await authAPI.login(credentials);
                      if (response.success) {
                        setUser(response.user);
                        localStorage.setItem('currentUser', JSON.stringify(response.user));
                        alert('Đăng nhập thành công!');
                        closePopup();
                      }
                    } catch (err) {
                      setError(err.message || 'Đăng nhập thất bại');
                    } finally {
                      setLoading(false);
                    }
                  }}>
                    <div className="form-group">
                      <label htmlFor="login-email">Email</label>
                      <input 
                        type="email" 
                        id="login-email" 
                        name="email" 
                        placeholder="Nhập email của bạn"
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
                      <a href="#" className="forgot-password">Quên mật khẩu?</a>
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
            </div>
          </div>
        )}

        {/* ROUTES */}
        <Routes>
          <Route 
            path="/" 
            element={<HomePage handleCardClick={handleCardClick} currentUser={user} />} 
          />
          <Route 
            path="/service" 
            element={<Service currentUser={user} />} 
          />
          <Route path="/attractions/:id" element={<AttractionDetail currentUser={user} />} />
          <Route path="/blogs" element={<Blogs currentUser={user} />} />
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

import React, { useState, useEffect } from 'react';
import './App.css';

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import ItineraryPage from './pages/ItineraryPage';

import Navigation from './layout/Navigation';
import ChatAssistant from './layout/ChatBox';
import HomePage from './pages/HomePage';
import Service from './pages/Service';
import Blogs from './pages/Blogs';
import BlogDetail from './pages/BlogDetail';

import AttractionDetail from './pages/AttractionDetail';
import UserPage from './pages/User';
import { authAPI } from './utils/api';

import test1 from './asset/box1.jpg';
import test2 from './asset/box2.jpg';
import test3 from './asset/box3.jpg';
import homeImg from './asset/home_1.jpg';

const initialImages = [homeImg, test1, test2, test3];

function App() {
  const [currentBackground, setCurrentBackground] = useState(`url(${homeImg})`);
  const [isOpen, setIsOpen] = useState(false);
  const [popupMode, setPopupMode] = useState('signup'); // 'signup', 'login', 'verify', 'forgot', 'forgot_verify', 'reset_password'
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    window.addEventListener("openLoginPopup", () => {
      openPopup("login");
    });
  }, []);


  const [verifyEmail, setVerifyEmail] = useState("");
  const [resetCode, setResetCode] = useState(""); 

  const [images, setImages] = useState(initialImages);

  const swapImage = (clickedIndex) => {
    const newImages = [...images];
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
    localStorage.removeItem('access_token');
    alert("Đã đăng xuất thành công!");
  };

  const openPopup = (mode = 'signup') => {
    setPopupMode(mode);
    setIsOpen(true);
    setError('');
    setSuccess('');
  };
  
  const closePopup = () => {
    setIsOpen(false);
    setError('');
    setSuccess('');
  };
  
  const switchMode = (mode) => {
    setPopupMode(mode);
    setError('');
    setSuccess('');
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
              
              {/* --- 1. ĐĂNG KÝ --- */}
              {popupMode === 'signup' && (
                <div className="signup-container">
                  <h2 className="signup-title">Tạo Tài Khoản</h2>
                  <p className="signup-subtitle">Tham gia Culture Compass và bắt đầu hành trình của bạn</p>
                  
                  {error && <div className="error-message">{error}</div>}
                  
                  <form className="signup-form" onSubmit={async (e) => {
                    e.preventDefault();
                    setError('');
                    setLoading(true);
                    
                    const formData = new FormData(e.target);
                    const username = formData.get('username');
                    const email = formData.get('email');
                    const password = formData.get('password');
                    const confirmPassword = formData.get('confirmPassword');
                    setVerifyEmail(email);
              
                    const userData = {username, email, password, confirmPassword};    
                    
                    try {
                      const response = await authAPI.signup(userData);
                      if (response.success) {
                        switchMode('verify');
                      } else {
                        setError(response.message);
                      }
                    } catch (err) {
                      setError(err.message || 'Đăng ký thất bại');
                    } finally {
                      setLoading(false);
                    }
                  }}>
                    {/* Các input form đăng ký */}
                    <div className="form-group">
                      <label htmlFor="signup-username">Tên người dùng</label>
                      <input type="text" id="signup-username" name="username" placeholder="Nhập tên người dùng" required />
                    </div>
                    <div className="form-group">
                      <label htmlFor="signup-email">Email</label>
                      <input type="email" id="signup-email" name="email" placeholder="Nhập email của bạn" required />
                    </div>
                    <div className="form-group">
                      <label htmlFor="signup-password">Mật khẩu</label>
                      <input type="password" id="signup-password" name="password" placeholder="Tạo mật khẩu" required minLength="6" />
                    </div>
                    <div className="form-group">
                      <label htmlFor="signup-confirmPassword">Xác nhận mật khẩu</label>
                      <input type="password" id="signup-confirmPassword" name="confirmPassword" placeholder="Xác nhận mật khẩu" required />
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

              {/* --- 2. ĐĂNG NHẬP --- */}
              {popupMode === 'login' && (
                <div className="signup-container">
                  <h2 className="signup-title">Chào Mừng Trở Lại</h2>
                  <p className="signup-subtitle">Đăng nhập để tiếp tục hành trình</p>
                  
                  {success && <div className="popup-message-success">{success}</div>}
                  {error && <div className="popup-message-error">{error}</div>}
                                    
                  <form className="signup-form" onSubmit={async (e) => {
                    e.preventDefault();
                    setError('');
                    setLoading(true);
                    
                    const formData = new FormData(e.target);
                    const credentials = {
                      username: formData.get('username'),
                      password: formData.get('password')
                    };                    
                    try {
                      const response = await authAPI.login(credentials);
                      if (response.success) {
                          setUser(response.user);
                          localStorage.setItem('currentUser', JSON.stringify(response.user));
                          localStorage.setItem('access_token', response.access_token); 
                          
                          setSuccess("Đăng nhập thành công!");
                          setTimeout(() => {
                            closePopup();
                            setSuccess("");
                          }, 1200);
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
                      <input type="text" id="login-username" name="username" placeholder="Nhập tên đăng nhập" required />
                    </div>
                    <div className="form-group">
                      <label htmlFor="login-password">Mật khẩu</label>
                      <input type="password" id="login-password" name="password" placeholder="Nhập mật khẩu" required />
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

              {/* --- 3. QUÊN MẬT KHẨU (B1: NHẬP EMAIL) --- */}
              {popupMode === 'forgot' && (
                <div className="signup-container">
                  <h2 className="signup-title">Quên Mật Khẩu</h2>
                  <p className="signup-subtitle">Nhập email để xác nhận</p>

                  {success && <div className="popup-message-success">{success}</div>}
                  {error && <div className="popup-message-error">{error}</div>}

                  <form className="signup-form" onSubmit={async (e) => {
                      e.preventDefault();
                      setError('');
                      setLoading(true);

                      const formData = new FormData(e.target);
                      const email = formData.get('email');

                      if(!email) {
                        setError('Vui lòng nhập email');
                        setLoading(false);
                        return;
                      }

                      try {
                        const response = await authAPI.forgotPassword({email});
                        if(response.success) {
                          setSuccess("Mã xác thực đã được gửi! Vui lòng kiểm tra email.");
                          setVerifyEmail(email);
                          // Chuyển sang bước nhập OTP
                          setTimeout(() => switchMode('forgot_verify'), 1500);
                        } else {
                          setError(response.error || "Không thể gửi mã xác thực");
                        }
                      } catch(err) {
                        setError(err.message || 'Lỗi gửi email');
                      } finally {
                        setLoading(false);
                      }
                    }}
                  >
                    <div className="form-group">
                      <label htmlFor="forgot-email">Email</label>
                      <input type="email" id="forgot-email" name="email" placeholder="Nhập email của bạn" required />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '10px'}}>
                      <button type="submit" className="forgot-btn" disabled={loading}>
                        {loading ? 'Đang gửi...' : 'Xác thực'}
                      </button>
                    </div>
                  </form>

                  <div className="signup-footer">
                    <p>Nhớ mật khẩu rồi? <a href="#" className="signup-link" onClick={(e)=> {e.preventDefault(); switchMode('login');}}>Quay lại đăng nhập</a></p>
                  </div>
                </div>
              )}

              {/* --- 4. XÁC THỰC EMAIL KHI ĐĂNG KÝ (SIGNUP VERIFY) --- */}
              {popupMode === 'verify' && (
                <div className="signup-container">
                  <h2 className="signup-title">Xác Thực Email</h2>
                  <p className="signup-subtitle">Mã OTP gồm 6 số đã được gửi tới: <b>{verifyEmail}</b></p>

                  {success && <div className="popup-message-success">{success}</div>}
                  {error && <div className="popup-message-error">{error}</div>}

                  <form className="signup-form" onSubmit={async (e) => {
                      e.preventDefault();
                      setError('');
                      setLoading(true);
                      const formData = new FormData(e.target);
                      const otp = formData.get('otp');

                      if(otp.length !== 6) { setError("Mã OTP phải gồm 6 số"); setLoading(false); return; }

                      try {
                        const response = await authAPI.verifyOTP({ email: verifyEmail, code: otp });
                        if(response.success) {
                          alert("Xác thực thành công!");
                          switchMode('login');
                        } else {
                          setError(response.message || "OTP Không đúng");
                        }
                      } catch(err) { setError(err.message); } 
                      finally { setLoading(false); }
                    }}
                  >
                    <div className="form-group">
                      <label>Nhập mã OTP</label>
                      <input type="text" name="otp" placeholder="Nhập mã OTP (6 số)" maxLength="6" required />
                    </div>
                    <button type="submit" className="forgot-btn" disabled={loading}>{loading ? "Đang xác thực..." : "Xác thực OTP"}</button>
                  </form>
                  <div className="signup-footer">
                    <p>Không nhận được mã? <a href="#" className="signup-link" onClick={async(e) => { e.preventDefault(); /* Logic gửi lại OTP */ }}>Gửi lại OTP</a></p>
                  </div>
                </div>
              )}

              {/* --- 5. XÁC THỰC QUÊN MẬT KHẨU (B2: NHẬP OTP) --- */}
              {popupMode === 'forgot_verify' && (
                <div className="signup-container">
                  <h2 className="signup-title">Nhập Mã OTP</h2>
                  <p className="signup-subtitle">Mã xác thực 6 số đã gửi tới: <b>{verifyEmail}</b></p>

                  {error && <div className="popup-message-error">{error}</div>}

                  <form className="signup-form" onSubmit={(e) => {
                      e.preventDefault();
                      const formData = new FormData(e.target);
                      const otp = formData.get('otp');

                      if(!otp || otp.length !== 6) {
                        setError("Mã OTP phải gồm 6 số");
                        return;
                      }

                      setResetCode(otp);
                      setSuccess(""); 
                      switchMode('reset_password');
                    }}
                  >
                    <div className="form-group">
                      <label>Nhập mã OTP (6 số)</label>
                      <input type="text" maxLength="6" name="otp" placeholder="______" required />
                    </div>
                    <button type="submit" className="forgot-btn">Tiếp tục</button>
                  </form>

                  <div className="signup-footer">
                    <p style={{marginTop: "8px"}}><a href="#" className="signup-link" onClick={() => switchMode('forgot')}>← Quay lại</a></p>
                  </div>
                </div>
              )}

              {/* --- 6. ĐẶT LẠI MẬT KHẨU --- */}
              {popupMode === 'reset_password' && (
                <div className="signup-container">
                  <h2 className="signup-title">Mật Khẩu Mới</h2>
                  <p className="signup-subtitle">Nhập mật khẩu mới cho tài khoản: <b>{verifyEmail}</b></p>

                  {success && <div className="popup-message-success">{success}</div>}
                  {error && <div className="popup-message-error">{error}</div>}

                  <form className="signup-form" onSubmit={async (e) => {
                      e.preventDefault();
                      setError('');
                      setLoading(true);

                      const formData = new FormData(e.target);
                      const newPassword = formData.get('newPassword');
                      const confirmPassword = formData.get('confirmPassword');

                      if(newPassword.length < 8) { setError("Mật khẩu phải ít nhất 8 ký tự"); setLoading(false); return; }

                      try {
                        const response = await authAPI.resetPassword({
                          email: verifyEmail,
                          code: resetCode, 
                          newPassword,
                          confirmPassword
                        });

                        if(response.success || response.message) {
                          setSuccess("Đặt mật khẩu thành công! Đang chuyển hướng...");
                          setTimeout(() => {
                            switchMode('login');
                            setSuccess('');
                            setResetCode('');
                          }, 1500);
                        } else {
                          setError(response.error || "Không thể đặt lại mật khẩu");
                        }
                      } catch(err) {
                        setError(err.message || "Mã OTP không đúng hoặc đã hết hạn");
                      } finally {
                        setLoading(false);
                      }
                    }}
                  >
                    <div className="form-group">
                      <label>Mật khẩu mới</label>
                      <input type="password" name="newPassword" placeholder="Ít nhất 8 ký tự" required />
                    </div>
                    <div className="form-group">
                      <label>Xác nhận mật khẩu</label>
                      <input type="password" name="confirmPassword" placeholder="Nhập lại mật khẩu" required />
                    </div>
                    <button type="submit" className="forgot-btn" disabled={loading}>
                      {loading ? "Đang xử lý..." : "Xác nhận"}
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ROUTES */}
        <Routes>
          <Route path="/" element={<HomePage handleCardClick={handleCardClick} currentUser={user} images={images} swapImage={swapImage} />} />
          <Route path="/service" element={<Service currentUser={user} />} />
          <Route path="/attractions/:id" element={<AttractionDetail currentUser={user} openLogin={() => openPopup('login')}/>} />
          <Route path="/blogs" element={<Blogs currentUser={user} />} />
          <Route path="/user" element={<UserPage currentUser={user} onLogout={handleLogout} />} />
          <Route path="/blogs/:id" element={<BlogDetail />} />
        </Routes>


        <footer>
          <small>© 2025 SmartTour - Hệ thống gợi ý hành trình du lịch</small>
        </footer>

        <ChatAssistant 
          user={user} 
          openLogin={() => openPopup('login')} 
        />

      </div>
    </Router>
  );
}

export default App;
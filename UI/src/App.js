import React, { useState } from 'react';
import './App.css';

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import Navigation from './layout/Navigation';
import HomePage from './pages/HomePage';
import Service from './pages/Service';
import { authAPI } from './utils/api';

import homeImg from './asset/home.png';

function App() {
  const [currentBackground, setCurrentBackground] = useState(`url(${homeImg})`);
  const [isOpen, setIsOpen] = useState(false);
  const [popupMode, setPopupMode] = useState('signup'); // 'signup' or 'login'
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);

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
        
        <Navigation openPopup={openPopup} openLogin={() => openPopup('login')} openSignup={() => openPopup('signup')}/>
        
        {/* POPUP */}
        {isOpen && (
          <div className="popup-overlay" onClick={closePopup}>
            <div className="popup" onClick={(e) => e.stopPropagation()}>
              <button className="popup-close" onClick={closePopup} aria-label="Close">
                ×
              </button>
              
              {popupMode === 'signup' ? (
                <div className="signup-container">
                  <h2 className="signup-title">Create Account</h2>
                  <p className="signup-subtitle">Join Culture Compass and start your journey</p>
                  
                  {error && <div className="error-message">{error}</div>}
                  
                  <form className="signup-form" onSubmit={async (e) => {
                    e.preventDefault();
                    setError('');
                    setLoading(true);
                    
                    const formData = new FormData(e.target);
                    const userData = {
                      name: formData.get('name'),
                      email: formData.get('email'),
                      password: formData.get('password'),
                      confirmPassword: formData.get('confirmPassword')
                    };
                    
                    try {
                      const response = await authAPI.signup(userData);
                      if (response.success) {
                        setUser(response.user);
                        alert('Account created successfully!');
                        closePopup();
                      }
                    } catch (err) {
                      setError(err.message || 'Failed to create account');
                    } finally {
                      setLoading(false);
                    }
                  }}>
                    <div className="form-group">
                      <label htmlFor="signup-name">Full Name</label>
                      <input 
                        type="text" 
                        id="signup-name" 
                        name="name" 
                        placeholder="Enter your full name"
                        required
                      />
                    </div>
                    
                    <div className="form-group">
                      <label htmlFor="signup-email">Email</label>
                      <input 
                        type="email" 
                        id="signup-email" 
                        name="email" 
                        placeholder="Enter your email"
                        required
                      />
                    </div>
                    
                    <div className="form-group">
                      <label htmlFor="signup-password">Password</label>
                      <input 
                        type="password" 
                        id="signup-password" 
                        name="password" 
                        placeholder="Create a password"
                        required
                        minLength="6"
                      />
                    </div>
                    
                    <div className="form-group">
                      <label htmlFor="signup-confirmPassword">Confirm Password</label>
                      <input 
                        type="password" 
                        id="signup-confirmPassword" 
                        name="confirmPassword" 
                        placeholder="Confirm your password"
                        required
                      />
                    </div>
                    
                    <button type="submit" className="signup-btn" disabled={loading}>
                      {loading ? 'Creating Account...' : 'Sign Up'}
                    </button>
                  </form>
                  
                  <div className="signup-footer">
                    <p>Already have an account? <a href="#" className="signup-link" onClick={(e) => { e.preventDefault(); switchMode('login'); }}>Sign In</a></p>
                  </div>
                </div>
              ) : (
                <div className="signup-container">
                  <h2 className="signup-title">Welcome Back</h2>
                  <p className="signup-subtitle">Sign in to continue your journey</p>
                  
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
                        alert('Login successful!');
                        closePopup();
                      }
                    } catch (err) {
                      setError(err.message || 'Failed to login');
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
                        placeholder="Enter your email"
                        required
                      />
                    </div>
                    
                    <div className="form-group">
                      <label htmlFor="login-password">Password</label>
                      <input 
                        type="password" 
                        id="login-password" 
                        name="password" 
                        placeholder="Enter your password"
                        required
                      />
                    </div>
                    
                    <div className="form-options">
                      <label className="checkbox-label">
                        <input type="checkbox" />
                        <span>Remember me</span>
                      </label>
                      <a href="#" className="forgot-password">Forgot password?</a>
                    </div>
                    
                    <button type="submit" className="signup-btn" disabled={loading}>
                      {loading ? 'Signing In...' : 'Sign In'}
                    </button>
                  </form>
                  
                  <div className="signup-footer">
                    <p>Don't have an account? <a href="#" className="signup-link" onClick={(e) => { e.preventDefault(); switchMode('signup'); }}>Sign Up</a></p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ROUTES */}
        <Routes>
          <Route path="/" element={<HomePage handleCardClick={handleCardClick} />} />
          <Route path="/service" element={<Service />} />
        </Routes>

        <footer>
          <small>© 2025 Culture Compass</small>
        </footer>
      </div>
    </Router>
  );
}

export default App;

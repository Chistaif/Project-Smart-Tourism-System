import React from 'react';
import { Link, useLocation } from 'react-router-dom';

export default function Navigation({ openPopup, openLogin, openSignup, user, onLogout }) {
  const location = useLocation();

  const isActive = (path) => (location.pathname === path ? 'active' : '');

  const getInitials = (name = '') => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map(part => part.charAt(0))
      .join('')
      .slice(0, 2)
      .toUpperCase();
  };

  return (
    <header>
      <div className="logo">Culture Compass</div>

      <nav>
        <Link to="/" className={isActive('/')}>Home</Link>
        <Link to="/service" className={isActive('/service')}>Service</Link>
        <Link to="/blogs" className={isActive('/blogs')}>Blogs</Link>
        <Link to="/user" className={isActive('/user')}>User</Link>
      </nav>

      {user ? (
        <div className="user-info">

          <Link to="/user" className="user-link">

            <div className="user-avatar">{getInitials(user.username)}</div>
            <div className="user-details">

              <span>{user.username}</span>
              <small>{user.email}</small>
              
            </div>

          </Link>

          <button className="nav-logout-btn" onClick={onLogout}>
            Đăng Xuất
          </button>

        </div>
      ) : (
        <div className="auth">

          <button className="nav-btn-register" onClick={openSignup || openPopup}>
            Đăng Ký
          </button>

          <button className="nav-btn-login" onClick={openLogin || openPopup}>
            Đăng Nhập
          </button>

        </div>

      )}
    </header>
  );
}

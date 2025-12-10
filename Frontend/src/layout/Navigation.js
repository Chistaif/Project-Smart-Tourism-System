import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";

export default function Navigation({ openPopup, openLogin, openSignup, user, onLogout }) {
  const location = useLocation();

  const [showNavbar, setShowNavbar] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  // ⭐ HÀM RELOAD TRANG KHI CLICK LẠI CHÍNH NÓ
  const handleNavClick = (path) => {
    if (location.pathname === path) {
      window.location.reload();     // reload lại trang đang đứng
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY;

      if (currentY < 10) {
        setShowNavbar(true);
      } else if (currentY > lastScrollY && currentY > 50) {
        setShowNavbar(false);
      } else if (currentY < lastScrollY) {
        setShowNavbar(true);
      }

      setLastScrollY(currentY);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [lastScrollY]);

  const isActive = (path) => (location.pathname === path ? "active" : "");

  const getInitials = (name = "") => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((part) => part.charAt(0))
      .join("")
      .slice(0, 2)
      .toUpperCase();
  };

  return (
    <header className={`navbar-container ${showNavbar ? "show" : "hide"}`}>
      <div className="logo">Culture Compass</div>

      <nav>
        {/* ⭐ THÊM onClick để reload nếu đang đứng cùng path */}
        <Link 
          to="/" 
          className={isActive("/")} 
          onClick={() => handleNavClick("/")}
        >
          Home
        </Link>

        <Link 
          to="/service" 
          className={isActive("/service")} 
          onClick={() => handleNavClick("/service")}
        >
          Service
        </Link>

        <Link 
          to="/blogs" 
          className={isActive("/blogs")} 
          onClick={() => handleNavClick("/blogs")}
        >
          Blogs
        </Link>

        <Link 
          to="/user" 
          className={isActive("/user")} 
          onClick={() => handleNavClick("/user")}
        >
          User
        </Link>
      </nav>

      {user ? (
        <div className="user-info">
          <Link 
            to="/user" 
            className="user-link"
            onClick={() => handleNavClick("/user")}
          >
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

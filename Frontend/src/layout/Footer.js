import React from 'react';
import { Link } from 'react-router-dom';
import './Footer.css';

import logo from '../asset/logo.png';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-container">
        {/* Mô tả ngắn */}
        <div className="footer-description">
          <div className="footer-logo">
            <img src={logo} alt="Culture Compass Logo" className="footer-logo-img" />
          </div>
          <p>Cultural Compass– Ứng dụng khám phá du lịch Việt Nam, tìm kiếm điểm đến và trải nghiệm hấp dẫn.</p>
        </div>

        {/* Điều hướng quan trọng */}
        <div className="footer-navigation">
          <h4>Điều Hướng</h4>
          <nav className="footer-nav-links">
            <Link to="/">Trang Chủ</Link>
            <Link to="/service">Dịch Vụ</Link>
            <Link to="/blogs">Blog</Link>
            <Link to="/user">Người Dùng</Link>
          </nav>
        </div>

        {/* Thông tin nhóm */}
        <div className="footer-team">
          <h4>Nhóm Phát Triển</h4>
          <div className="team-info">
            <p><strong>Tên nhóm:</strong> Nhóm 3</p>
            <p><strong>Danh sách thành viên:</strong></p>
            <ul className="team-members">
              <li>Nguyễn Ngọc Thiên</li>
              <li>Nguyễn Chí Tài</li>
              <li>Phan Quang Tiến</li>
              <li>Võ Minh Khang</li>
              <li>Hà Như Lương</li>
              <li>Lý Sĩ Vĩ</li>
            </ul>
            <p><strong>Email liên lạc:</strong> <a href="mailto:danh6112006@gmail.com">danh6112006@gmail.com</a></p>
          </div>
        </div>

        {/* Liên hệ & Mạng xã hội */}
        <div className="footer-contact">
          <h4>Liên Hệ</h4>
          <div className="contact-info">
            <p><strong>Mạng xã hội:</strong></p>
            <a href="https://www.facebook.com/danh6112006" target="_blank" rel="noopener noreferrer" className="social-link">
              Facebook: https://www.facebook.com/danh6112006
            </a>
          </div>
        </div>
      </div>

      {/* Bản quyền */}
      <div className="footer-copyright">
        <p>© 2025 Nhóm 3 – Đồ án Web Smart Tourism – HCMUS</p>
      </div>
    </footer>
  );
}
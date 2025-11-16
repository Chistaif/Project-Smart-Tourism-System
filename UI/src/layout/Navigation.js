import React from 'react';
import { Link } from 'react-router-dom';

export default function Navigation({ openPopup, openLogin, openSignup }) {
  return (
    <header>
      <div className="logo">Culture Compass</div>

      <nav>
        <Link to="/" className="active">Home</Link>
        <Link to="/service">Service</Link>
        <Link to="/blogs">Blogs</Link>
        <Link to="/user">User</Link>
      </nav>

      <div className="auth">
        <button className="btn" onClick={openSignup || openPopup}>Sign up</button>
        <button className="btn" onClick={openLogin || openPopup}>Login</button>
      </div>
    </header>
  );
}

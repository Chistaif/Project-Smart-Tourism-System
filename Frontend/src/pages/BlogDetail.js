import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { blogsAPI } from '../utils/api';
import './BlogDetail.css';

export default function BlogDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [blog, setBlog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [popupMessage, setPopupMessage] = useState({ type: "", text: "" });

  const showPopup = (type, text) => {
    setPopupMessage({ type, text });
    setTimeout(() => setPopupMessage({ type: "", text: "" }), 3000);
  };


  useEffect(() => {
    fetchBlog();
  }, [id]);

  const fetchBlog = async () => {
    try {
      setLoading(true);
      const response = await blogsAPI.getById(id);
      if (response.success) {
        setBlog(response.data);
      } else {
        showPopup("error", "Không tìm thấy bài viết");
      }
    } catch (err) {
      console.error('Error fetching blog:', err);
      showPopup("error", "Lỗi kết nối đến máy chủ");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="blog-detail-container">
        <div className="loading">Đang tải bài viết...</div>
      </div>
    );
  }

  const avatarUrl = blog.user?.avatar_url;
  const avatarSrc = avatarUrl?.startsWith('http')
    ? avatarUrl
    : avatarUrl
      ? `http://localhost:5000/static/images/${avatarUrl}`
      : null;

  const heroImage = (blog.image_urls && blog.image_urls[0]) || blog.image_url || null;

  return (
    
    <div className="blog-detail-container">
      {popupMessage.text && (
        <div className={`popup-message-${popupMessage.type}`}>
          {popupMessage.text}
        </div>
      )}

      <div className="blog-detail-actions">
        <button className="btn-back" onClick={() => navigate('/blogs')}>
          ← Quay lại
        </button>
      </div>

      <article className="blog-detail">
        {heroImage && (
          <div className="blog-detail-image">
            <img src={heroImage} alt={blog.title} />
          </div>
        )}

        <div className="blog-detail-content">
          <h1 className="blog-detail-title">{blog.title}</h1>
          
          <div className="blog-detail-meta">
            <div className="author-info">
              {avatarSrc && (
                <img 
                  src={avatarSrc}
                  alt={blog.user.username}
                  className="author-avatar"
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
              )}
              <div>
                <p className="author-name">{blog.user?.username || 'Người dùng'}</p>
                <p className="blog-date">
                  {new Date(blog.created_at).toLocaleString('vi-VN', {
                    timeZone: 'Asia/Ho_Chi_Minh',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>

              </div>
            </div>
          </div>

          <div className="blog-detail-text">
            {blog.content.split('\n').map((paragraph, index) => (
              paragraph.trim() && (
                <p key={index}>{paragraph}</p>
              )
            ))}
          </div>

          {blog.updated_at && blog.updated_at !== blog.created_at && (
            <p className="blog-updated">
              Cập nhật lần cuối: {new Date(blog.updated_at).toLocaleDateString('vi-VN')}
            </p>
          )}
        </div>
      </article>
    </div>
  );
}


import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { blogsAPI } from '../utils/api';
import './BlogDetail.css';

// Parse image_urls which can be an array or a JSON string
const parseImageUrls = (imageUrls) => {
  if (!imageUrls) return [];
  if (Array.isArray(imageUrls)) return imageUrls;
  try {
    const parsed = JSON.parse(imageUrls);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export default function BlogDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [blog, setBlog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentImage, setCurrentImage] = useState(0);

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
        setCurrentImage(0);
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

  const images = parseImageUrls(blog.image_urls);
  const allImages = images.length > 0 ? images : (blog.image_url ? [blog.image_url] : []);
  const heroImage = allImages[0] || null;

  const handlePrev = (e) => {
    e.stopPropagation();
    setCurrentImage((prev) => (prev - 1 + allImages.length) % allImages.length);
  };

  const handleNext = (e) => {
    e.stopPropagation();
    setCurrentImage((prev) => (prev + 1) % allImages.length);
  };

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
          <div className="blog-image-slider">
            <img src={allImages[currentImage]} alt={`${blog.title} ${currentImage + 1}`} />
            {allImages.length > 1 && (
              <>
                <button className="slider-btn prev" onClick={handlePrev}>‹</button>
                <button className="slider-btn next" onClick={handleNext}>›</button>
                <div className="slider-dots">
                  {allImages.map((_, idx) => (
                    <span
                      key={idx}
                      className={`dot ${idx === currentImage ? 'active' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentImage(idx);
                      }}
                    />
                  ))}
                </div>
              </>
            )}
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


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
  const [selectedFile, setSelectedFile] = useState(null);

  const showPopup = (type, text) => {
    setPopupMessage({ type, text });
    setTimeout(() => setPopupMessage({ type: "", text: "" }), 3000);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      // Handle file upload logic here
    }
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
        
        <label htmlFor="select-image" className="btn-select-image">
          <span className="select-image-icon">🖼️</span>
          <span className="select-image-text">Chọn ảnh</span>
          <input
            type="file"
            id="select-image"
            accept="image/*"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
        </label>
      </div>

      <article className="blog-detail">
        {blog.image_url && (
          <div className="blog-detail-image">
            <img src={blog.image_url} alt={blog.title} />
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

          <div className="file-upload-section">
            <label htmlFor="blog-image-upload" className="file-upload-label">
              Hình ảnh (tùy chọn)
            </label>
            <input
              type="file"
              id="blog-image-upload"
              accept="image/*"
              onChange={handleFileChange}
              className="styled-file-input"
            />
            {selectedFile && (
              <div className="file-selected-info">
                <span className="file-name">✓ {selectedFile.name}</span>
                <span className="file-size">
                  ({(selectedFile.size / 1024).toFixed(2)} KB)
                </span>
              </div>
            )}
          </div>
        </div>
      </article>
    </div>
  );
}


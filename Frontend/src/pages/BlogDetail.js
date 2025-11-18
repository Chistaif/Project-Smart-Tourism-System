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
        setError('Không tìm thấy bài viết');
      }
    } catch (err) {
      console.error('Error fetching blog:', err);
      setError('Lỗi kết nối đến máy chủ');
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

  if (error || !blog) {
    return (
      <div className="blog-detail-container">
        <div className="error-message">{error || 'Không tìm thấy bài viết'}</div>
        <button className="btn-back" onClick={() => navigate('/blogs')}>
          Quay lại danh sách
        </button>
      </div>
    );
  }

  return (
    <div className="blog-detail-container">
      <button className="btn-back" onClick={() => navigate('/blogs')}>
        ← Quay lại
      </button>

      <article className="blog-detail">
        {blog.image_url && (
          <div className="blog-detail-image">
            <img src={`http://localhost:5000${blog.image_url}`} alt={blog.title} />
          </div>
        )}

        <div className="blog-detail-content">
          <h1 className="blog-detail-title">{blog.title}</h1>
          
          <div className="blog-detail-meta">
            <div className="author-info">
              {blog.user?.avatar_url && (
                <img 
                  src={`http://localhost:5000/static/images/${blog.user.avatar_url}`} 
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
                  {new Date(blog.created_at).toLocaleDateString('vi-VN', {
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


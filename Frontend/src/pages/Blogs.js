import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { blogsAPI } from '../utils/api';
import './Blogs.css';

export default function Blogs({ currentUser }) {
  const navigate = useNavigate();
  const [blogs, setBlogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    image: null,
    user_id: currentUser?.user_id || ''
  });
  const [submitting, setSubmitting] = useState(false);
  const isLoggedIn = Boolean(currentUser);

  useEffect(() => {
    fetchBlogs();
  }, []);

  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      user_id: currentUser?.user_id || ''
    }));
  }, [currentUser]);

  const fetchBlogs = async () => {
    try {
      setLoading(true);
      const response = await blogsAPI.getAll();
      if (response.success) {
        setBlogs(response.data);
      } else {
        setError('Không thể tải danh sách blog');
      }
    } catch (err) {
      console.error('Error fetching blogs:', err);
      setError('Lỗi kết nối đến máy chủ');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData(prev => ({
        ...prev,
        image: file
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    if (!formData.user_id) {
      setError('Bạn cần đăng nhập để tạo bài viết.');
      setSubmitting(false);
      return;
    }

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('title', formData.title);
      formDataToSend.append('content', formData.content);
      formDataToSend.append('user_id', formData.user_id);
      if (formData.image) {
        formDataToSend.append('image', formData.image);
      }

      const response = await blogsAPI.create(formDataToSend);
      if (response.success) {
        // Reset form
        setFormData({
          title: '',
          content: '',
          image: null,
          user_id: formData.user_id
        });
        setShowForm(false);
        // Reload blogs
        fetchBlogs();
        alert('Tạo blog thành công!');
      }
    } catch (err) {
      setError(err.message || 'Không thể tạo blog');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="blogs-container">
      <div className="blogs-header">
        <h1>Blogs</h1>
        <button className="btn-add-blog" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Đóng' : '+ Thêm Bài Viết'}
        </button>
      </div>

      {showForm && (
        <div className="blog-form-container">
          <h2>Tạo Bài Viết Mới</h2>
          <form onSubmit={handleSubmit} className="blog-form">
            <div className="form-group">
              <label htmlFor="title">Tiêu đề</label>
              <input
                type="text"
                id="title"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                placeholder="Nhập tiêu đề bài viết"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="content">Nội dung</label>
              <textarea
                id="content"
                name="content"
                value={formData.content}
                onChange={handleInputChange}
                placeholder="Nhập nội dung bài viết"
                rows="8"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="image">Hình ảnh (tùy chọn)</label>
              <input
                type="file"
                id="image"
                name="image"
                accept="image/*"
                onChange={handleImageChange}
              />
              {formData.image && (
                <div className="image-preview">
                  <img src={URL.createObjectURL(formData.image)} alt="Preview" />
                  <p>{formData.image.name}</p>
                </div>
              )}
            </div>

            {error && <div className="error-message">{error}</div>}

            {!isLoggedIn && (
              <div className="info-message">
                Bạn cần đăng nhập để tạo bài viết mới.
              </div>
            )}

            <button type="submit" className="btn-submit" disabled={submitting || !isLoggedIn}>
              {submitting ? 'Đang tạo...' : 'Tạo Blog'}
            </button>
          </form>
        </div>
      )}

      {loading && <div className="loading">Đang tải blogs...</div>}
      {error && !showForm && <div className="error-message">{error}</div>}

      <div className="blogs-list">
        {blogs.length > 0 ? (
          blogs.map(blog => (
            <div 
              key={blog.blog_id} 
              className="blog-card"
              onClick={() => navigate(`/blogs/${blog.blog_id}`)}
            >
              {blog.image_url && (
                <div className="blog-image">
                  <img src={`http://localhost:5000${blog.image_url}`} alt={blog.title} />
                </div>
              )}
              <div className="blog-content">
                <h2>{blog.title}</h2>
                <p className="blog-meta">
                  Bởi {blog.user?.username || 'Người dùng'} • {new Date(blog.created_at).toLocaleDateString('vi-VN')}
                </p>
                <p className="blog-text">{blog.content}</p>
                <button 
                  className="btn-read-more"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/blogs/${blog.blog_id}`);
                  }}
                >
                  Đọc thêm →
                </button>
              </div>
            </div>
          ))
        ) : (
          !loading && <div className="no-blogs">Chưa có bài viết nào. Hãy tạo bài viết đầu tiên!</div>
        )}
      </div>
    </div>
  );
}


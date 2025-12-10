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
    images: [],
    user_id: currentUser?.user_id || ''
  });
  const [submitting, setSubmitting] = useState(false);

  const [popupMessage, setPopupMessage] = useState({ type: "", text: "" });

  const [confirmDelete, setConfirmDelete] = useState({ show: false, blogId: null });

  const showPopup = (type, text) => {
    setPopupMessage({ type, text });
    setTimeout(() => {
      setPopupMessage({ type: "", text: "" });
    }, 3000);
  };

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
        showPopup("error", "Không thể tải danh sách blog");
      }
    } catch (err) {
      console.error('Error fetching blogs:', err);
      showPopup("error", "Lỗi kết nối đến máy chủ");
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
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      // Validate file types
      const validFiles = files.filter(file => file.type.startsWith('image/'));
      if (validFiles.length !== files.length) {
        showPopup("error", "Một số file không phải là hình ảnh đã bị bỏ qua");
      }
      if (validFiles.length > 0) {
        setFormData(prev => ({
          ...prev,
          images: [...prev.images, ...validFiles]
        }));
      }
    }
  };

  const removeImage = (index) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  const clearAllImages = () => {
    setFormData(prev => ({
      ...prev,
      images: []
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    if (!formData.user_id) {
      showPopup("error", "Bạn cần đăng nhập để tạo bài viết.");
      setSubmitting(false);
      return;
    }

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('title', formData.title);
      formDataToSend.append('content', formData.content);
      
      // Backend expects 'images' field with files
      if (formData.images.length > 0) {
        for (let i = 0; i < formData.images.length; i++) {
          formDataToSend.append('images', formData.images[i]);
        }
      }

      const response = await blogsAPI.create(formDataToSend);
      if (response.success) {
        // Reset form
        setFormData({
          title: '',
          content: '',
          images: [],
          user_id: formData.user_id
        });
        setShowForm(false);
        // Reload blogs
        fetchBlogs();
        showPopup("success", "Tạo blog thành công!");
      }
    } catch (err) {
      showPopup("error", err.message || "Không thể tạo blog");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="blogs-container">

      {popupMessage.text && (
        <div
          className={
            popupMessage.type === "success"
            ? "popup-message-success"
            : "popup-message-error"
          }
        >
          {popupMessage.text}
        </div>
      )}

      <div className="blogs-header">
        <h1>Blogs</h1>
      </div>

      {showForm && (
        <div className="blog-form-wrapper">
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
              <div className="file-upload-header">
                <label htmlFor="images">Hình ảnh (tùy chọn - có thể chọn nhiều)</label>
                {formData.images.length > 0 && (
                  <button 
                    type="button"
                    onClick={clearAllImages}
                    className="btn-clear-all"
                  >
                    Xóa tất cả
                  </button>
                )}
              </div>
              <input
                type="file"
                id="images"
                name="images"
                accept="image/*"
                multiple
                onChange={handleImageChange}
                className="styled-file-input"
              />
              
              {formData.images.length > 0 && (
                <div className="images-preview-container">
                  <div className="images-preview-grid">
                    {formData.images.map((image, index) => (
                      <div key={index} className="image-preview-item">
                        <div className="image-preview-wrapper">
                          <img 
                            src={URL.createObjectURL(image)} 
                            alt={`Preview ${index + 1}`}
                            className="image-preview-img"
                          />
                          <button
                            type="button"
                            onClick={() => removeImage(index)}
                            className="btn-remove-image"
                            aria-label="Xóa ảnh"
                          >
                            ×
                          </button>
                        </div>
                        <div className="image-preview-info">
                          <span className="image-preview-name" title={image.name}>
                            {image.name.length > 20 
                              ? image.name.substring(0, 20) + '...' 
                              : image.name}
                          </span>
                          <span className="image-preview-size">
                            {(image.size / 1024).toFixed(2)} KB
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="images-count-info">
                    Đã chọn {formData.images.length} {formData.images.length === 1 ? 'ảnh' : 'ảnh'}
                  </div>
                </div>
              )}
            </div>

            {!isLoggedIn && (
              <div className="info-message" onClick={() => window.dispatchEvent(new Event("openLoginPopup"))}>
                Bạn cần đăng nhập để tạo bài viết mới.
              </div>
            )}

            <button type="submit" className="btn-submit" disabled={submitting || !isLoggedIn}>
              {submitting ? 'Đang tạo...' : 'Tạo Blog'}
            </button>
          </form>
        </div>
        </div>
      )}

      {loading && <div className="loading">Đang tải blogs...</div>}

      {!showForm && (
        <button 
          className="add-blog-btn"
          onClick={() => setShowForm(true)}
        >
          + Thêm bài viết
        </button>
      )}


      <div className="blogs-list">
        {blogs.length > 0 ? (
          blogs.map(blog => (
            (() => {
              const coverImage = (blog.image_urls && blog.image_urls[0]) || blog.image_url || null;
              return (
            <div 
              key={blog.blog_id} 
              className="blog-card"
              onClick={() => navigate(`/blogs/${blog.blog_id}`)}
            >

              {currentUser?.user_id === blog.user_id && (
                <button 
                  className="delete-blog-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmDelete({ show: true, blogId: blog.blog_id });
                  }}
                >
                  ✖
                </button>
              )}

              {coverImage && (
                <div className="blog-image">
                  <img src={coverImage} alt={blog.title} />
                </div>
              )}
              <div className="blog-content">
                <h2>{blog.title}</h2>
                <p className="blog-meta">
                  Bởi {blog.user?.username || 'Người dùng'} • {new Date(blog.created_at).toLocaleDateString('vi-VN', {
                    timeZone: 'Asia/Ho_Chi_Minh'
                  })}

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
              );
            })()
          ))
        ) : (
          !loading && !showForm && (
            <div className="blogs-empty">
              <div className="empty-card">
                <div className="empty-icon">📝</div>

                <h2>Chưa có bài viết nào</h2>
                <p>Hãy bắt đầu chia sẻ những hành trình văn hóa của bạn!</p>

                <button 
                  className="empty-add-btn"
                  onClick={() => setShowForm(true)}
                >
                  + Tạo Bài Viết Đầu Tiên
                </button>
              </div>
            </div>
          )
        )}
      </div>
    
      {confirmDelete.show && (
        <div className="delete-popup-overlay">
          <div className="delete-popup">
            <h3>Bạn có chắc muốn xóa bài viết này?</h3>
            <p>Hành động này không thể hoàn tác.</p>

            <div className="delete-popup-buttons">
               <button 
                  className="cancel-btn"
                  onClick={() => setConfirmDelete({ show: false, blogId: null })}
              >
                Hủy
              </button>

              <button
                className="confirm-delete-btn"
                onClick={async () => {
                  const res = await blogsAPI.delete(confirmDelete.blogId);
                  if (res.success) {
                    fetchBlogs();
                  }
                  setConfirmDelete({ show: false, blogId: null });
                }}
              >
                Xóa
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}


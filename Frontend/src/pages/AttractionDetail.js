import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { attractionsAPI } from '../utils/api';
import './AttractionDetail.css';

const createDefaultReviewForm = () => ({
  content: '',
  ratingScore: 5,
  reviewId: null,
});

export default function AttractionDetail({ currentUser, openLogin }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const userId = currentUser?.user_id;

  // --- STATE ---
  const [info, setInfo] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [favorite, setFavorite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [reviewForm, setReviewForm] = useState(() => createDefaultReviewForm());
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [favoriteSubmitting, setFavoriteSubmitting] = useState(false);
  const [popupMessage, setPopupMessage] = useState({ type: "", text: "" });

  const showPopup = (type, text) => {
    setPopupMessage({ type, text });
    setTimeout(() => {
      setPopupMessage({ type: "", text: "" });
    }, 3000);
  };

  // --- HELPER FUNCTIONS ---
  const getRatingLabel = (score, count) => {
    if (!count || count === 0) return "Chưa có đánh giá";
    if (score >= 4.5) return "Tuyệt vời";
    if (score >= 3.5) return "Khá tốt";
    if (score >= 2.5) return "Ổn";
    return "Trung bình";
  };

  const renderStars = (score) => {
    const rounded = Math.round(score || 0);
    return '★'.repeat(rounded) + '☆'.repeat(5 - rounded);
  };

  const renderFormattedText = (text) => {
    if (!text) return "";
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index} style={{ color: '#a16207' }}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  const formatAttractionTime = (info) => {
    if (info.type === 'cultural_spot') {
      return info.openingHours || "Mở cửa cả ngày";
    }
    if (info.type === 'festival') {
      if (info.isLunar) {
        return `${info.originalStart} - ${info.originalEnd}`;
      }
      if (info.timeStart && info.timeEnd) {
        const startDate = new Date(info.timeStart);
        const endDate = new Date(info.timeEnd);
        const formatDate = (date) => {
          const day = date.getDate().toString().padStart(2, '0');
          const month = (date.getMonth() + 1).toString().padStart(2, '0');
          return `${day}/${month}`;
        };
        return `${formatDate(startDate)} - ${formatDate(endDate)}`;
      }
      return "Thời gian chưa cập nhật";
    }
    return "Mở cửa cả ngày";
  };

  // Bọc hàm này trong useCallback để nó không bị tạo lại mỗi lần render
  const syncStateFromDetail = useCallback((dataPayload) => {
    const data = dataPayload || {};
    setInfo(data.infomation || {});
    setReviews(data.reviews || []);
    setFavorite(data.favorite || null);

    if (userId) {
      const existingReview = (data.reviews || []).find((review) => review.userId === userId);
      if (existingReview) {
        setReviewForm({
          content: existingReview.content || '',
          ratingScore: existingReview.rating || 5,
          reviewId: existingReview.reviewId,
        });
      }
    }
  }, [userId]); 
  
  const loadDetail = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    setError('');
    try {
      const response = await attractionsAPI.getDetail(id, userId);
      if (!response.success) throw new Error(response.error || 'Lỗi tải dữ liệu.');
      syncStateFromDetail(response.data);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id, userId, syncStateFromDetail]);

  useEffect(() => { 
    loadDetail(); 
  }, [loadDetail]);

  // --- HANDLERS ---
  const handleSubmitReview = async (event) => {
    event.preventDefault();
    if (!userId) { showPopup("error", "Vui lòng đăng nhập."); return; }
    setReviewSubmitting(true);
    try {
      const payload = { userId, content: reviewForm.content.trim(), ratingScore: Number(reviewForm.ratingScore) || 5 };
      if (reviewForm.reviewId) {
        payload.reviewId = reviewForm.reviewId;
        await attractionsAPI.updateReview(id, payload);
        showPopup("success", "Cập nhật đánh giá thành công!");
      } else {
        await attractionsAPI.createReview(id, payload);
        showPopup("success", "Gửi đánh giá thành công!");
      }
      await loadDetail(true);
    } catch (err) { showPopup("error", err.message); } finally { setReviewSubmitting(false); }
  };

  const handleDeleteReview = async (reviewId) => {
    if (!userId || !window.confirm('Xóa đánh giá này?')) return;
    setReviewSubmitting(true);
    try {
      await attractionsAPI.deleteReview(id, { userId, reviewId });
      setReviewForm(createDefaultReviewForm());
      await loadDetail(true);
      showPopup("success", "Đã xóa đánh giá.");
    } catch (err) { showPopup("error", err.message); } finally { setReviewSubmitting(false); }
  };

  const handleToggleFavorite = async () => {
    if (!userId) { showPopup("error", "Vui lòng đăng nhập."); return; }
    setFavoriteSubmitting(true);
    try {
      const nextState = !(favorite?.isFavorite);
      const response = await attractionsAPI.toggleFavorite(id, { userId, isFavorite: nextState });
      if (response.success) {
        setFavorite(response.favorite);
        showPopup("success", nextState ? "Đã lưu vào yêu thích!" : "Đã bỏ khỏi yêu thích!");
        if (response.data) syncStateFromDetail(response.data);
      }
    } catch (err) { showPopup("error", err.message); } finally { setFavoriteSubmitting(false); }
  };

  // --- HANDLER: THÊM VÀO LỊCH TRÌNH ---
  const handleAddToItinerary = () => {
    if (!info || !info.id) {
      showPopup("error", "Dữ liệu chưa sẵn sàng.");
      return;
    }
    try {
      const savedState = sessionStorage.getItem('service_page_draft');
      const currentState = savedState ? JSON.parse(savedState) : {};
      const currentSelectedAttractions = currentState.selectedAttractions || [];

      const exists = currentSelectedAttractions.find(item => item.id === info.id);
      if (exists) {
        if (window.confirm(`"${info.name}" đã có trong lịch trình. Xóa khỏi danh sách?`)) {
          const updatedSelectedAttractions = currentSelectedAttractions.filter(item => item.id !== info.id);
          sessionStorage.setItem('service_page_draft', JSON.stringify({ ...currentState, selectedAttractions: updatedSelectedAttractions }));
          showPopup("success", "Đã xóa khỏi lịch trình.");
        }
        return;
      }

      const attractionToAdd = {
        id: info.id,
        name: info.name,
        imageUrl: info.imageUrl || info.image_url,
        location: info.location,
        lat: info.lat,
        lon: info.lon,
        averageRating: info.averageRating || 0,
        type: info.type,
        tags: info.tags || []
      };

      const updatedSelectedAttractions = [...currentSelectedAttractions, attractionToAdd];
      sessionStorage.setItem('service_page_draft', JSON.stringify({ ...currentState, selectedAttractions: updatedSelectedAttractions }));
      showPopup("success", "Đã thêm vào lịch trình!");
      
      setTimeout(() => {
        if (window.confirm("Chuyển đến trang tạo lịch trình ngay?")) navigate('/service');
      }, 500);
    } catch (err) {
      console.error(err);
      showPopup("error", "Lỗi lưu lịch trình.");
    }
  };

  const descriptionSections = useMemo(() => {
    if (!info?.detailDescription?.sections) return [];
    return Array.isArray(info.detailDescription.sections) ? info.detailDescription.sections : [];
  }, [info]);

  if (loading) return <div className="attraction-loading-screen">Loading...</div>;
  
  if (error) return (
    <div className="attraction-error-screen">
      <h2>⚠️ Đã xảy ra lỗi</h2>
      <p>{error}</p>
      <button onClick={() => navigate(-1)}>Quay lại</button>
    </div>
  );

  return (
    <div className="attraction-page-wrapper">
      
      {popupMessage.text && (
        <div className={`detail-popup ${popupMessage.type}`}>
          {popupMessage.text}
        </div>
      )}

      <div className="attraction-container">

        <div className="beige-card">
          <div className="card-image-col">
            <img src={info?.imageUrl} alt={info?.name} className="card-main-image" />
          </div>

          <div className="card-content-col">
            <div className="card-header-row">
              <h1 className="card-title">{info?.name}</h1>
              <span className="card-id-badge">ID: {info?.id || "DT00"}</span>
            </div>

            <div className="card-tags-row">
              <span className="tag-icon">🏷️ Tag:</span>
              {info?.tags?.map((t, i) => <span key={i} className="brown-tag">{t}</span>)}
            </div>

            <div className="card-description">
              📖 <strong>Mô tả:</strong> {info?.briefDescription}
            </div>

            <div className="card-meta-list">
              <p><strong>Thời gian:</strong> {formatAttractionTime(info)}</p>
              <p><strong>Địa điểm:</strong> {info?.location}</p>
              <p><strong>Vào cửa:</strong> {info?.ticketPrice ? `${info.ticketPrice.toLocaleString()}đ` : "Miễn phí"}</p>
            </div>

            <div className="star-position">
              <button
                className={`heart-btn ${favorite?.isFavorite ? 'active' : ''}`}
                onClick={handleToggleFavorite}
                disabled={favoriteSubmitting}
                title={favorite?.isFavorite ? "Bỏ yêu thích" : "Thêm vào yêu thích"}
              >
                {favorite?.isFavorite ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="page-actions-row">
          <button className="action-link-btn" onClick={() => navigate(-1)}>Trở lại</button>
          <button className="action-primary-btn" onClick={handleAddToItinerary}>Thêm vào lịch trình</button>
        </div>

        <div className="detail-sections-wrapper">
          {descriptionSections.length > 0 && (
            <div className="content-section full-width">
              <h2 className="section-title-line">Thông tin chi tiết</h2>
              {descriptionSections.map((section, index) => (
                <div key={index} className="content-block">
                  {section.title && <h3>{section.title}</h3>}
                  {section.imageUrl && <img src={section.imageUrl} alt="" className="content-img" />}
                  <div className="content-text">
                    {section.type === 'list' && Array.isArray(section.items) ? (
                      <ul>{section.items.map((it, i) => <li key={i}>{renderFormattedText(it)}</li>)}</ul>
                    ) : (
                      <p>{renderFormattedText(section.content)}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="reviews-section-wrapper">
            <h2 className="section-title-line">Đánh giá từ cộng đồng</h2>
            <div className="reviews-section">
              <div className="reviews-header">
                <div className="rating-box">
                  <span className="rating-num">{info?.averageRating || 0}</span>
                  <div style={{display:'flex', flexDirection:'column', marginLeft:'10px'}}>
                    <span className="rating-stars" style={{ color: '#facc15', fontSize: '1.2rem' }}>
                        {renderStars(info?.averageRating)}
                    </span>
                    <span style={{ fontSize: '0.9rem', color: '#2563eb', fontWeight: '600' }}>
                        {getRatingLabel(info?.averageRating, reviews.length)}
                    </span>
                  </div>
                  <span className="rating-count" style={{marginLeft:'5px'}}>({reviews.length} đánh giá)</span>
                </div>
              </div>

              <div className="write-review-box">
                {currentUser ? (
                  <form onSubmit={handleSubmitReview}>
                    <textarea
                      placeholder="Chia sẻ trải nghiệm thực tế của bạn tại đây..."
                      value={reviewForm.content}
                      onChange={(e) => setReviewForm({ ...reviewForm, content: e.target.value })}
                      rows={4}
                      disabled={reviewSubmitting}
                    />
                    <div className="form-bottom">
                      <div className="rating-select-group">
                        <span>Bạn chấm mấy sao?</span>
                        <select
                          value={reviewForm.ratingScore}
                          onChange={(e) => setReviewForm({ ...reviewForm, ratingScore: e.target.value })}
                          disabled={reviewSubmitting}
                        >
                          {[5, 4, 3, 2, 1].map(s => <option key={s} value={s}>{s} Sao</option>)}
                        </select>
                      </div>
                      <button type="submit" disabled={reviewSubmitting}>
                        {reviewSubmitting ? 'Đang gửi...' : 'Gửi đánh giá'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="login-alert" onClick={openLogin}>
                    👋 Đăng nhập để viết đánh giá
                  </div>
                )}
              </div>

              <div className="reviews-list">
                {reviews.map(r => (
                  <div key={r.reviewId} className="review-item">
                    <div className="review-user">
                      <div className="user-info">
                        <div className="avatar-placeholder">{r.user?.username?.charAt(0)}</div>
                        <div>
                          <strong>{r.user?.username || "Người dùng"}</strong>
                          <div className="review-time">{new Date(r.createdAt).toLocaleDateString('vi-VN')}</div>
                        </div>
                      </div>
                      {r.userId === userId && (
                        <button 
                            className="del-review" 
                            onClick={() => handleDeleteReview(r.reviewId)}
                            disabled={reviewSubmitting}
                        >
                            Xóa
                        </button>
                      )}
                    </div>
                    <div className="review-content">
                      <div className="user-rating-star">{'★'.repeat(r.rating)}</div>
                      <p>{r.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div> 
      </div> 
    </div> 
  );
}
import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { attractionsAPI } from '../utils/api';
import './AttractionDetail.css';

const createDefaultReviewForm = () => ({
  content: '',
  ratingScore: 5,
  reviewId: null,
});

export default function AttractionDetail({currentUser, openLogin }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const userId = currentUser?.user_id;

  // State kiểm soát chế độ xem (Tóm tắt vs Chi tiết)
  const [showFullDetail, setShowFullDetail] = useState(false);

  const [info, setInfo] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [favorite, setFavorite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // State cho review & favorite
  const [reviewForm, setReviewForm] = useState(() => createDefaultReviewForm());
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [favoriteSubmitting, setFavoriteSubmitting] = useState(false);

  // Hàm logic xếp hạng
  const getRatingLabel = (score, count) => {
    if (!count || count === 0) return "Chưa có đánh giá";
    if (score >= 4.5) return "Tuyệt vời";
    if (score >= 3.5) return "Khá tốt";
    if (score >= 2.5) return "Ổn";
    if (score >= 1.5) return "Trung bình";
    return "Tệ";
  };

  const renderStars = (score) => {
    // Làm tròn số sao
    const rounded = Math.round(score || 0);
    // Tạo chuỗi sao: ★ (đầy) và ☆ (rỗng)
    return '★'.repeat(rounded) + '☆'.repeat(5 - rounded);
  };

  // --- HÀM XỬ LÝ TEXT IN ĐẬM ---
  const renderFormattedText = (text) => {
    if (!text) return "";
    // Tách chuỗi dựa trên ký tự **text**
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, index) => {
      // Nếu là phần nằm trong **...**
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index} style={{ color: '#c4b30a' }}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

const loadDetail = async (isBackground = false) => {
    if (!isBackground) {
        setLoading(true);
    }
    
    setError('');
    try {
      const response = await attractionsAPI.getDetail(id, userId);
      if (!response.success) {
        throw new Error(response.error || 'Không thể tải dữ liệu địa điểm.');
      }
      syncStateFromDetail(response.data);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Không thể tải dữ liệu địa điểm.');
    } finally {
      setLoading(false);
    }
  };

  const syncStateFromDetail = (dataPayload) => {
    const data = dataPayload || {};
    const infoData = data.infomation || {};
    const reviewsData = data.reviews || [];

    setInfo(infoData);
    setReviews(reviewsData);
    setFavorite(data.favorite || null);

    if (userId) {
      const existingReview = reviewsData.find((review) => review.userId === userId);
      if (existingReview) {
        setReviewForm({
          content: existingReview.content || '',
          ratingScore: existingReview.rating || 5,
          reviewId: existingReview.reviewId,
        });
      } else {
        setReviewForm(createDefaultReviewForm());
      }
    }
  };

  useEffect(() => {
    loadDetail();
    setShowFullDetail(false); // Reset về tóm tắt khi đổi ID
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, userId]);

  // Các hàm xử lý Review & Favorite
  const handleReviewChange = (field, value) => {
    setReviewForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmitReview = async (event) => {
    event.preventDefault();
    if (!userId) { setError('Bạn cần đăng nhập để gửi đánh giá.'); return; }
    if (!reviewForm.content.trim()) { setError('Nội dung đánh giá không được để trống.'); return; }
    setReviewSubmitting(true);
    try {
      const payload = { userId, content: reviewForm.content.trim(), ratingScore: Number(reviewForm.ratingScore) || 5 };
      if (reviewForm.reviewId) {
        payload.reviewId = reviewForm.reviewId;
        await attractionsAPI.updateReview(id, payload);
      } else {
        await attractionsAPI.createReview(id, payload);
      }
      await loadDetail(true);
    } catch (err) { setError(err.message); } finally { setReviewSubmitting(false); }
  };

const handleDeleteReview = async (reviewId) => {
    if (!userId || !window.confirm('Bạn chắc chắn muốn xóa?')) return;
    setReviewSubmitting(true);
    try {
      await attractionsAPI.deleteReview(id, { userId, reviewId });
      
      // Reset form về mặc định nếu lỡ đang sửa cái review bị xóa
      setReviewForm(createDefaultReviewForm());
      
      await loadDetail(true); // Tải lại dữ liệu để cập nhật danh sách
      alert("Đã xóa đánh giá thành công!");
      
    } catch (err) { 
        console.error(err);
        alert("Lỗi khi xóa: " + err.message); 
    } finally { 
        setReviewSubmitting(false); 
    }
  };

  const handleToggleFavorite = async () => {
    if (!userId) { setError('Đăng nhập để lưu địa điểm yêu thích.'); return; }
    setFavoriteSubmitting(true);
    try {
      const nextState = !(favorite?.isFavorite);
      const response = await attractionsAPI.toggleFavorite(id, { userId, isFavorite: nextState });
      if (response.success) {
          setFavorite(response.favorite);
          if (response.data) syncStateFromDetail(response.data);
      }
    } catch (err) { setError(err.message); } finally { setFavoriteSubmitting(false); }
  };

  const descriptionSections = useMemo(() => {
    if (!info?.detailDescription?.sections) return [];
    return Array.isArray(info.detailDescription.sections) ? info.detailDescription.sections : [];
  }, [info]);

  if (loading) return <div className="attraction-loading">Đang tải thông tin...</div>;
  if (error) return <div className="attraction-error">{error}</div>;

  // =================================================================
  // VIEW 1: GIAO DIỆN TÓM TẮT (Summary Card)
  // =================================================================
  if (!showFullDetail) {
    return (
      <div className="summary-page-container">
        <div className="summary-card">
          {/* Cột Trái: Ảnh */}
          <div className="summary-left">
             <img src={info?.imageUrl} alt={info?.name} className="summary-hero-img" />
          </div>

          {/* Cột Phải: Nội dung & Nút */}
          <div className="summary-right">
            <h1 className="summary-title">{info?.name}</h1>
            <span className="summary-id-badge">ID: {info?.id || "DT00"}</span> 

            <div className="summary-tags">
               <span className="tag-label">🏷 Tag:</span>
               {info?.tags?.map((t, i) => <span key={i} className="tag-pill">{t}</span>)}
            </div>

            <div className="summary-section">
                <p>📖 <strong>Mô tả:</strong> {info?.briefDescription}</p>
            </div>

            <div className="summary-info-list">
                <p>🗓 <strong>Thời gian:</strong> {info?.openingHours || info?.timeStart || "Mở cửa cả ngày"}</p>
                <p>📍 <strong>Địa điểm:</strong> {info?.location}</p>
                <p>🎟 <strong>Vé vào cửa:</strong> {info?.ticketPrice ? `${info.ticketPrice.toLocaleString()}đ` : "Miễn phí"}</p>
            </div>

            <button className="view-detail-link" onClick={() => setShowFullDetail(true)}>
                &lt;Xem chi tiết&gt;
            </button>

            {/* Khối nút hành động (Nằm trong summary-right) */}
            <div className="summary-footer-actions">
                 <button className="back-link-btn" onClick={() => navigate(-1)}>
                    Trở lại
                 </button>
                 <button className="add-schedule-btn">
                    Thêm vào lịch trình
                 </button>
            </div>

            {/* Nút yêu thích góc dưới cùng phải */}
            <div className="summary-fav-pos">
                 <button 
                    className={`fav-icon-btn ${favorite?.isFavorite ? 'active' : ''}`}
                    onClick={handleToggleFavorite}
                 >
                    {favorite?.isFavorite ? '★' : '☆'}
                 </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =================================================================
  // VIEW 2: GIAO DIỆN CHI TIẾT (Full Detail)
  // =================================================================
  return (
    <div className="attraction-detail-page full-view">
      <div className="attraction-detail-inner">

        <header className="detail-view-header">
            <h2 className="section-heading">Các hoạt động chính</h2>
        </header>

        {/* Nội dung chi tiết (đã fix lỗi in đậm) */}
        <section className="attraction-description">
            {descriptionSections.map((section, index) => (
                <article 
                    key={index} 
                    className={`description-block ${section.type === 'list' ? 'description-block-list' : ''}`}
                >
                    {section.title && <h3 className="content-title">{section.title}</h3>}
                    
                    {section.imageUrl && (
                        <div className="content-image-wrapper">
                            <img src={section.imageUrl} alt="minh hoa" />
                        </div>
                    )}

                    <div className="content-text">
                        {section.type === 'list' && Array.isArray(section.items) ? (
                            <ul>
                                {section.items.map((it, i) => (
                                    <li key={i}>{renderFormattedText(it)}</li>
                                ))}
                            </ul>
                        ) : (
                            <p>{renderFormattedText(section.content)}</p>
                        )}
                    </div>
                </article>
            ))}
        </section>

        {/* Gợi ý cho du khách */}
        <section className="tourist-tips">
            <h3>Gợi ý cho Du khách</h3>
            <ul>
                <li>Phải mặc trang phục gọn gàng, lịch sự.</li>
                <li>Giữ trật tự, không gây ồn ào, không tổ chức hoạt động trái phép.</li>
                <li>Tuyệt đối không sờ, leo trèo, hoặc ngồi lên bục trưng bày hiện vật.</li>
                <li>Không ăn uống, hút thuốc trong khu vực tham quan.</li>
            </ul>
        </section>

        <div className="detail-footer-actions">
            <button className="back-button" onClick={() => setShowFullDetail(false)}>
              Quay lại tóm tắt
            </button>
            <button className="add-schedule-btn-small">
              Thêm vào lịch trình
            </button>
        </div>

        {/* --- PHẦN ĐÁNH GIÁ --- */}
        <section className="attraction-reviews">
            <div className="reviews-header-modern">
               <div className="header-left">
                   <h3>Đánh giá từ du khách</h3>
                   <p className="review-count">
                       ({reviews.length > 0 ? `${reviews.length} nhận xét` : "Chưa có nhận xét"})
                   </p>
               </div>
               
               <div className="header-right-score">
                   {/* Hiển thị điểm số thực tế */}
                   <div className="score-big">{info?.averageRating || 0}</div>
                   <div className="score-details">
                       {/* Hiển thị sao động */}
                       <div className="stars" style={{color: '#facc15', letterSpacing: '2px'}}>
                           {renderStars(info?.averageRating)}
                       </div>
                       {/* Hiển thị chữ động (Tuyệt vời/Ổn...) */}
                       <span className="rating-text">
                           {getRatingLabel(info?.averageRating, reviews.length)}
                       </span>
                   </div>
               </div>
            </div>

            {/* Form viết đánh giá, Thông báo đăng nhập */}
            <div className="review-input-container">
                {currentUser ? (
                    <form className="review-form-modern" onSubmit={handleSubmitReview}>
                      <div className="form-top">
                        <div className="user-label">
                            <span className="user-avatar-small">
                                {currentUser.avatar_url ? <img src={currentUser.avatar_url} alt="avt" /> : currentUser.username.charAt(0)}
                            </span>
                            <span>{currentUser.username}</span>
                        </div>
                        <div className="rating-select">
                            <span>Bạn chấm mấy sao?</span>
                            <select value={reviewForm.ratingScore} onChange={(e) => handleReviewChange('ratingScore', e.target.value)}>
                              {[5,4,3,2,1].map(s => <option key={s} value={s}>{s} ⭐</option>)}
                            </select>
                        </div>
                      </div>
                      
                      <textarea 
                        className="review-textarea"
                        value={reviewForm.content} 
                        onChange={(e) => handleReviewChange('content', e.target.value)}
                        placeholder="Chia sẻ trải nghiệm thực tế của bạn tại đây..."
                        rows="3"
                      />
                      <div className="form-actions">
                          <button type="submit" className="submit-review-btn" disabled={reviewSubmitting}>
                             {reviewSubmitting ? 'Đang gửi...' : 'Gửi đánh giá'}
                          </button>
                      </div>
                    </form>
                ) : (
                    <div className="login-prompt-banner">
                        <div className="prompt-icon">✍️</div>
                        <div className="prompt-text">
                            <strong>Bạn đã đến đây chưa?</strong>
                            <p>Hãy đăng nhập để chia sẻ cảm nhận nhé!</p>
                        </div>
                        <div 
                            className="prompt-action" 
                            onClick={openLogin}
                            style={{cursor: 'pointer'}}
                        >
                            Đăng nhập để viết
                        </div>
                    </div>
                )}
            </div>

            <div className="reviews-list-modern">
                {reviews.length > 0 ? reviews.map(r => (
                    <div key={r.reviewId} className="review-card">
                        <div className="review-card-header">
                            <div className="reviewer-avatar">
                                {r.user?.avatar_url ? (
                                    <img src={r.user.avatar_url} alt="user" />
                                ) : (
                                    r.user?.username?.charAt(0).toUpperCase() || "U"
                                )}
                            </div>
                            <div className="reviewer-meta">
                                <span className="reviewer-name">{r.user?.username || "Ẩn danh"}</span>
                                <span className="review-date">{r.createdAt ? new Date(r.createdAt).toLocaleDateString('vi-VN') : 'Gần đây'}</span>
                            </div>
                            <div className="review-rating-badge">
                                {r.rating} <span className="star-icon">★</span>
                            </div>
                        </div>
                        
                        <div className="review-card-body">
                            <p>{r.content}</p>
                        </div>

                        {r.userId == userId && (
                            <button className="delete-review-link" onClick={() => handleDeleteReview(r.reviewId)}>
                                Xóa đánh giá này
                            </button>
                        )}
                    </div>
                )) : (
                    <p className="no-reviews">Chưa có đánh giá nào. Hãy là người đầu tiên!</p>
                )}
            </div>
        </section>
      </div>
    </div>
  );
}
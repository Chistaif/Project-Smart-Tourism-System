import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { attractionsAPI } from '../utils/api';
import './AttractionDetail.css';

const createDefaultReviewForm = () => ({
  content: '',
  ratingScore: 5,
  reviewId: null,
});

export default function AttractionDetail({ currentUser }) {
  const { id } = useParams();
  const navigate = useNavigate();

  const userId = currentUser?.user_id;

  const [info, setInfo] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [favorite, setFavorite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reviewForm, setReviewForm] = useState(() => createDefaultReviewForm());
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [favoriteSubmitting, setFavoriteSubmitting] = useState(false);

  const descriptionSections = useMemo(() => {
    if (!info?.detailDescription?.sections) return [];
    return Array.isArray(info.detailDescription.sections) ? info.detailDescription.sections : [];
  }, [info]);

  const loadDetail = async () => {
    setLoading(true);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, userId]);

  const handleReviewChange = (field, value) => {
    setReviewForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmitReview = async (event) => {
    event.preventDefault();
    if (!userId) {
      setError('Bạn cần đăng nhập để gửi đánh giá.');
      return;
    }

    if (!reviewForm.content.trim()) {
      setError('Nội dung đánh giá không được để trống.');
      return;
    }

    setReviewSubmitting(true);
    setError('');

    try {
      const payload = {
        userId,
        content: reviewForm.content.trim(),
        ratingScore: Number(reviewForm.ratingScore) || 5,
      };

      if (reviewForm.reviewId) {
        payload.reviewId = reviewForm.reviewId;
        await attractionsAPI.updateReview(id, payload);
      } else {
        await attractionsAPI.createReview(id, payload);
      }

      await loadDetail();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Không thể lưu đánh giá.');
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleEditReview = (review) => {
    setReviewForm({
      content: review.content || '',
      ratingScore: review.rating || 5,
      reviewId: review.reviewId,
    });
  };

  const handleDeleteReview = async (reviewId) => {
    if (!userId) {
      setError('Bạn cần đăng nhập để xóa đánh giá.');
      return;
    }

    if (!window.confirm('Bạn chắc chắn muốn xóa đánh giá này?')) {
      return;
    }

    setReviewSubmitting(true);
    setError('');

    try {
      await attractionsAPI.deleteReview(id, {
        userId,
        reviewId,
      });
      setReviewForm(createDefaultReviewForm());
      await loadDetail();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Không thể xóa đánh giá.');
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleToggleFavorite = async () => {
    if (!userId) {
      setError('Đăng nhập để lưu địa điểm yêu thích.');
      return;
    }

    setFavoriteSubmitting(true);
    setError('');

    try {
      const nextState = !(favorite?.isFavorite);
      const response = await attractionsAPI.toggleFavorite(id, {
        userId,
        isFavorite: nextState,
      });

      if (!response.success) {
        throw new Error(response.error || 'Không thể cập nhật yêu thích.');
      }

      setFavorite(response.favorite);
      if (response.data) {
        syncStateFromDetail(response.data);
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Không thể cập nhật yêu thích.');
    } finally {
      setFavoriteSubmitting(false);
    }
  };

  const heading = info?.name || 'Địa điểm';
  const tags = info?.tags || [];

  return (
    <div className="attraction-detail-page">
      <div className="attraction-detail-inner">
        <button className="back-button" onClick={() => navigate(-1)}>
          ← Quay lại
        </button>

        {loading ? (
          <div className="attraction-loading">Đang tải thông tin địa điểm...</div>
        ) : error ? (
          <div className="attraction-error">{error}</div>
        ) : (
          <>
            <header className="attraction-header">
              <div className="attraction-header-content">
                <p className="attraction-location">{info?.location}</p>
                <h1>{heading}</h1>
                <div className="attraction-meta">
                  <span>⭐ {info?.averageRating ?? 'Chưa có đánh giá'}</span>
                  {info?.visitDuration && (
                    <span>⏱ {Math.round(info.visitDuration / 60)} giờ tham quan</span>
                  )}
                </div>
                <div className="attraction-tags">
                  {tags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
              </div>
              {info?.imageUrl && (
                <div className="attraction-hero-image">
                  <img src={info.imageUrl} alt={info.name} />
                </div>
              )}
            </header>

            <section className="attraction-favorite">
              <p>{info?.briefDescription}</p>
              <button
                className={`favorite-toggle ${favorite?.isFavorite ? 'active' : ''}`}
                onClick={handleToggleFavorite}
                disabled={!currentUser || favoriteSubmitting}
              >
                {favorite?.isFavorite ? '★ Đã yêu thích' : '☆ Thêm vào yêu thích'}
              </button>
              {!currentUser && <small>Đăng nhập để lưu địa điểm vào danh sách yêu thích.</small>}
            </section>

            <section className="attraction-description">
              {info?.detailDescription?.mainTitle && (
                <h2>{info.detailDescription.mainTitle}</h2>
              )}
              {descriptionSections.length > 0 ? (
                descriptionSections.map((section, index) => (
                  <article key={`${section.title}-${index}`} className="description-section">
                    {section.title && <h3>{section.title}</h3>}
                    {section.imageUrl && (
                      <div className="section-image">
                        <img src={section.imageUrl} alt={section.title || 'Section'} />
                      </div>
                    )}
                    {section.type === 'list' && Array.isArray(section.items) ? (
                      <ul>
                        {section.items.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    ) : (
                      <p>{section.content}</p>
                    )}
                  </article>
                ))
              ) : (
                <p>Chưa có nội dung chi tiết cho địa điểm này.</p>
              )}
            </section>

            <section className="attraction-reviews">
              <div className="reviews-header">
                <h2>Đánh giá ({reviews.length})</h2>
              </div>

              {currentUser ? (
                <form className="review-form" onSubmit={handleSubmitReview}>
                  <div className="form-row">
                    <label htmlFor="rating">Điểm đánh giá</label>
                    <select
                      id="rating"
                      value={reviewForm.ratingScore}
                      onChange={(event) => handleReviewChange('ratingScore', Number(event.target.value))}
                    >
                      {[1, 2, 3, 4, 5].map((score) => (
                        <option key={score} value={score}>
                          {score} sao
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-row">
                    <label htmlFor="review-content">Cảm nhận của bạn</label>
                    <textarea
                      id="review-content"
                      rows="4"
                      value={reviewForm.content}
                      onChange={(event) => handleReviewChange('content', event.target.value)}
                      placeholder="Chia sẻ trải nghiệm của bạn..."
                    />
                  </div>
                  <button type="submit" disabled={reviewSubmitting}>
                    {reviewForm.reviewId ? 'Cập nhật đánh giá' : 'Gửi đánh giá'}
                  </button>
                  {reviewForm.reviewId && (
                    <button
                      type="button"
                      className="reset-btn"
                      onClick={() => setReviewForm(createDefaultReviewForm())}
                    >
                      Viết đánh giá mới
                    </button>
                  )}
                </form>
              ) : (
                <p className="login-reminder">Đăng nhập để viết đánh giá cho địa điểm này.</p>
              )}

              <div className="reviews-list">
                {reviews.length > 0 ? (
                  reviews.map((review) => (
                    <article key={review.reviewId} className="review-card">
                      <div className="review-card-header">
                        <div>
                          <strong>{review.user?.username || `User #${review.userId}`}</strong>
                          <span>⭐ {review.rating}</span>
                        </div>
                        <time>
                          {review.createdAt ? new Date(review.createdAt).toLocaleDateString('vi-VN') : ''}
                        </time>
                      </div>
                      <p>{review.content}</p>
                      {review.userId === userId && (
                        <div className="review-actions">
                          <button type="button" onClick={() => handleEditReview(review)}>
                            Sửa
                          </button>
                          <button type="button" onClick={() => handleDeleteReview(review.reviewId)}>
                            Xóa
                          </button>
                        </div>
                      )}
                    </article>
                  ))
                ) : (
                  <p>Chưa có đánh giá nào, hãy là người đầu tiên chia sẻ!</p>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}


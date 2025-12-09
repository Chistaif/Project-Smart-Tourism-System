import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { authAPI, attractionsAPI, userAPI, tourAPI } from "../utils/api";
import "./User.css";

export default function UserPage({ currentUser, onLogout }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("profile");
  const [userInfo, setUserInfo] = useState(null);
  const [favorites, setFavorites] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [savedTours, setSavedTours] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ---------------------------
  // LOAD DATA WHEN USER LOGGED IN
  // ---------------------------
  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    if (currentUser?.user_id) {
      loadUserData();
    }
  }, [currentUser]);

  // Listen for tourSaved events (dispatched after saving a tour) so the UI updates live
  useEffect(() => {
    function handleTourSaved(e) {
      const tour = e && e.detail ? e.detail : null;
      if (!tour || !currentUser) return;
      // Only add if the tour belongs to current user
      if (tour.user_id && tour.user_id !== currentUser.user_id) return;

      setSavedTours(prev => {
        // Avoid duplicates if the tour already exists
        if (!prev) return [tour];
        const exists = prev.some(t => t.tour_id === tour.tour_id);
        if (exists) return prev;
        return [tour, ...prev];
      });
    }

    window.addEventListener('tourSaved', handleTourSaved);
    return () => window.removeEventListener('tourSaved', handleTourSaved);
  }, [currentUser]);

  const loadUserData = async () => {
    setLoading(true);
    setError("");

    try {
      const userResponse = await authAPI.getUser(currentUser.user_id);
      if (userResponse.success) {
        setUserInfo(userResponse.user);
      }

      const favData = await userAPI.getFavorites(currentUser.user_id);
      if (favData.success) setFavorites(favData.data || []);

      const reviewData = await userAPI.getReviews(currentUser.user_id);
      if (reviewData.success) setReviews(reviewData.data || []);

      // Load saved tours
      const tourData = await userAPI.getSavedTours(currentUser.user_id);
      if (tourData.success) setSavedTours(tourData.data || []);
    } catch (err) {
      setError(err.message || "Không thể tải dữ liệu người dùng");
      setFavorites([]);
      setReviews([]);
      setSavedTours([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveFavorite = async (id) => {
    try {
      await attractionsAPI.toggleFavorite(id, {
        userId: currentUser.user_id,
        isFavorite: false,
      });
      setFavorites(favorites.filter((f) => f.id !== id));
    } catch {
      setError("Không thể xóa khỏi yêu thích");
    }
  };

  const handleEditReview = (review) =>
    navigate(`/attractions/${review.attraction.id}`);

  const handleDeleteReview = async (reviewId, attractionId) => {
    if (!window.confirm("Bạn chắc chắn muốn xóa đánh giá này?")) return;

    try {
      await attractionsAPI.deleteReview(attractionId, {
        userId: currentUser.user_id,
        reviewId,
      });

      setReviews(reviews.filter((r) => r.reviewId !== reviewId));
    } catch {
      setError("Không thể xóa đánh giá");
    }
  };

  // ---------------------------
  // UI KHI CHƯA ĐĂNG NHẬP
  // ---------------------------
  if (!currentUser) {
    return (
      <div className="user-page not-login">
        <div className="not-login-box">
          <h2>Vui lòng đăng nhập để xem trang cá nhân</h2>

          <div className="not-login-actions">
            <button className="btn-home" onClick={() => navigate("/")}>
              Về trang chủ
            </button>

            <button
              className="btn-login"
              onClick={() => window.dispatchEvent(new Event("openLoginPopup"))}
            >
              Đăng nhập
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------
  // LOADING UI
  // ---------------------------
  if (loading) {
    return (
      <div className="user-page">
        <div className="user-loading">Đang tải thông tin...</div>
      </div>
    );
  }

  const displayUser = userInfo || currentUser;

  return (
    <div className="user-page">
      <div className="user-container">
        {/* HEADER */}
        <div className="user-header">
          <div className="user-avatar-section">
            <img
              src={
                displayUser.avatar_url ||
                "https://res.cloudinary.com/dmuxwuk4q/image/upload/v1763910182/c6e56503cfdd87da299f72dc416023d4_s2kfhu.jpg"
              }
              alt={displayUser.username}
              className="user-avatar"
            />
            <div>
              <h1>{displayUser.username}</h1>
              <p className="user-email">{displayUser.email}</p>
            </div>
          </div>

          <button className="logout-btn" onClick={onLogout}>
            Đăng xuất
          </button>
        </div>

        {/* TABS */}
        <div className="user-tabs">
          <button
            className={`tab-btn ${activeTab === "profile" ? "active" : ""}`}
            onClick={() => setActiveTab("profile")}
          >
            Thông tin cá nhân
          </button>

          <button
            className={`tab-btn ${activeTab === "favorites" ? "active" : ""}`}
            onClick={() => setActiveTab("favorites")}
          >
            Địa điểm yêu thích ({favorites.length})
          </button>

          <button
            className={`tab-btn ${activeTab === "tourHistory" ? "active" : ""}`}
            onClick={() => setActiveTab("tourHistory")}
          >
            Lịch sử tạo tour ({savedTours.length})
          </button>

          <button
            className={`tab-btn ${activeTab === "history" ? "active" : ""}`}
            onClick={() => setActiveTab("history")}
          >
            Lịch sử đánh giá ({reviews.length})
          </button>
        </div>

        {error && <div className="user-error">{error}</div>}

        {/* ------------------------ */}
        {/* TAB NỘI DUNG */}
        {/* ------------------------ */}

        <div className="user-content">
          {/* PROFILE */}
          {activeTab === "profile" && (
            <div className="profile-section">
              <h2>Thông tin tài khoản</h2>

              <div className="profile-info">
                <div className="info-row">
                  <label>Tên người dùng:</label>
                  <span>{displayUser.username}</span>
                </div>

                <div className="info-row">
                  <label>Email:</label>
                  <span>{displayUser.email}</span>
                </div>

                <div className="info-row">
                  <label>ID người dùng:</label>
                  <span>#{displayUser.user_id}</span>
                </div>

                <div className="info-row">
                  <label>Số địa điểm yêu thích:</label>
                  <span>{favorites.length}</span>
                </div>

                <div className="info-row">
                  <label>Số đánh giá đã viết:</label>
                  <span>{reviews.length}</span>
                </div>
              </div>
            </div>
          )}

          {/* FAVORITES */}
          {activeTab === "favorites" && (
            <div className="favorites-section">
              <h2>Địa điểm yêu thích của bạn</h2>

              {favorites.length === 0 ? (
                <div className="empty-state">
                  <p>Bạn chưa có địa điểm yêu thích nào.</p>
                  <button onClick={() => navigate("/service")}>
                    Khám phá ngay
                  </button>
                </div>
              ) : (
                <div className="favorites-grid">
                  {favorites.map((a) => (
                    <div key={a.id} className="favorite-card">
                      {a.imageUrl && (
                        <div className="favorite-image">
                          <img src={a.imageUrl} alt={a.name} />
                        </div>
                      )}

                      <div className="favorite-content">
                        <h3 onClick={() => navigate(`/attractions/${a.id}`)}>
                          {a.name}
                        </h3>

                        <p className="favorite-location">{a.location}</p>

                        <div className="favorite-meta">
                          <span>⭐ {a.averageRating || "Chưa có"}</span>

                          {a.tags?.length > 0 && (
                            <div className="favorite-tags">
                              {a.tags.slice(0, 3).map((tag, idx) => (
                                <span key={idx} className="tag">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="favorite-actions">
                          <button
                            className="view-btn"
                            onClick={() => navigate(`/attractions/${a.id}`)}
                          >
                            Xem chi tiết
                          </button>

                          <button
                            className="remove-btn"
                            onClick={() => handleRemoveFavorite(a.id)}
                          >
                            Bỏ yêu thích
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TOUR HISTORY */}
          {activeTab === "tourHistory" && (
            <div className="tour-history-section">
              <h2>Lịch sử tạo tour của bạn</h2>

              {savedTours.length === 0 ? (
                <div className="empty-state">
                  <p>Bạn chưa tạo tour nào. Hãy tạo một tour mới!</p>
                  <button onClick={() => navigate("/service")}>
                    Tạo tour ngay
                  </button>
                </div>
              ) : (
                <div className="tour-history-timeline">
                  {savedTours.map((tour) => {
                    const createdDate = tour.created_at ? new Date(tour.created_at) : null;
                    const formattedDate = createdDate 
                      ? createdDate.toLocaleDateString('vi-VN', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })
                      : 'Ngày không xác định';
                    
                    // Estimate days based on attraction count (roughly 3-4 per day)
                    const attractionCount = tour.attraction_count || tour.attractions?.length || 0;
                    const estimatedDays = attractionCount > 0 ? Math.max(1, Math.ceil(attractionCount / 3)) : null;
                    
                    return (
                      <div key={tour.tour_id} className="tour-history-item">
                        <div className="history-timeline-marker"></div>
                        <div className="history-item-content">
                          <div className="history-item-header">
                            <h4 className="history-tour-name">
                              {tour.tour_name || `Hành trình ${estimatedDays || 'N'} Ngày`}
                            </h4>
                            <time className="history-date">{formattedDate}</time>
                          </div>
                          <div className="history-item-details">
                            <p className="history-summary">
                              📍 {attractionCount} điểm đến
                              {estimatedDays && ` • 🚶 ${estimatedDays} ngày`}
                            </p>
                            {tour.attractions && tour.attractions.length > 0 && (
                              <div className="history-attractions">
                                <span className="history-label">Điểm đến:</span>
                                <div className="attractions-list">
                                  {tour.attractions.slice(0, 5).map((attr, idx) => (
                                    <span key={attr.id || idx} className="attraction-tag">
                                      {attr.name}
                                    </span>
                                  ))}
                                  {tour.attractions.length > 5 && (
                                    <span className="attraction-tag more">
                                      +{tour.attractions.length - 5} điểm khác
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="history-item-actions">
                            <button 
                              className="view-btn" 
                              onClick={() => alert(`Đang mở chi tiết Tour ID: ${tour.tour_id}`)}
                            >
                              Xem chi tiết
                            </button>
                            <button 
                              className="delete-btn" 
                              onClick={async () => {
                                if (!window.confirm('Bạn có chắc muốn xóa hành trình này không?')) return;
                                try {
                                  const response = await tourAPI.unsaveTour(tour.tour_id, currentUser.user_id);
                                  if (response.success) {
                                    setSavedTours(prev => prev.filter(t => t.tour_id !== tour.tour_id));
                                    alert('Đã xóa hành trình thành công!');
                                  }
                                } catch (e) {
                                  alert('Lỗi khi xóa hành trình.');
                                }
                              }}
                            >
                              Xóa
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* HISTORY */}
          {activeTab === "history" && (
            <div className="history-section">
              <h2>Lịch sử đánh giá của bạn</h2>

              {reviews.length === 0 ? (
                <div className="empty-state">
                  <p>Bạn chưa viết đánh giá nào.</p>
                  <button onClick={() => navigate("/service")}>
                    Khám phá và đánh giá ngay
                  </button>
                </div>
              ) : (
                <div className="reviews-list">
                  {reviews.map((review) => (
                    <div key={review.reviewId} className="review-item">
                      <div className="review-header">
                        <div className="review-attraction">
                          {review.attraction?.imageUrl && (
                            <img
                              className="review-attraction-image"
                              src={review.attraction.imageUrl}
                              alt={review.attraction.name}
                            />
                          )}

                          <div>
                            <h3
                              className="review-attraction-name"
                              onClick={() =>
                                navigate(
                                  `/attractions/${review.attraction?.id}`
                                )
                              }
                            >
                              {review.attraction?.name ||
                                "Địa điểm không xác định"}
                            </h3>

                            <p className="review-location">
                              {review.attraction?.location}
                            </p>
                          </div>
                        </div>

                        <div className="review-rating">
                          ⭐ {review.rating}
                        </div>
                      </div>

                      <p className="review-content">{review.content}</p>

                      <div className="review-footer">
                        <time>
                          {review.createdAt &&
                            new Date(review.createdAt).toLocaleDateString(
                              "vi-VN",
                              {
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                              }
                            )}
                        </time>

                        <div className="review-actions">
                          <button
                            className="edit-btn"
                            onClick={() => handleEditReview(review)}
                          >
                            Sửa
                          </button>

                          <button
                            className="delete-btn"
                            onClick={() =>
                              handleDeleteReview(
                                review.reviewId,
                                review.attraction?.id
                              )
                            }
                          >
                            Xóa
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI, attractionsAPI, userAPI, tourAPI } from '../utils/api'; 
import './UserPage.css';

export default function UserPage({ currentUser, onLogout }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('profile'); // 'profile', 'favorites', 'reviews', 'tours'
  const [userInfo, setUserInfo] = useState(null);
  const [favorites, setFavorites] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [savedTours, setSavedTours] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    if (currentUser?.user_id) {
      loadUserData();
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  const loadUserData = async () => {
    if (!currentUser?.user_id) return;
    
    setLoading(true);
    setError('');
    
    try {
      // Load user info
      const userResponse = await authAPI.getUser(currentUser.user_id);
      if (userResponse.success) {
        setUserInfo(userResponse.user);
      }

      // Load favorites
      const favData = await userAPI.getFavorites(currentUser.user_id);
      if (favData.success) setFavorites(favData.data || []);

      // Load reviews
      const reviewData = await userAPI.getReviews(currentUser.user_id);
      if (reviewData.success) setReviews(reviewData.data || []);
      
      // Load saved tours
      const tourData = await userAPI.getSavedTours(currentUser.user_id);
      if (tourData.success) {
          setSavedTours(tourData.data || []);
      }

    } catch (err) {
      console.error('Lỗi khi tải dữ liệu người dùng:', err);
      setError(err.message || 'Không thể tải dữ liệu. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    onLogout();
    navigate('/');
  };

  const handleEditProfile = () => {
    alert('Tính năng chỉnh sửa thông tin chưa được triển khai.');
  };

  const handleGoToAttraction = (attractionId) => {
    navigate(`/attractions/${attractionId}`);
  };

  const handleDeleteFavorite = async (attractionId) => {
    if (!window.confirm('Bạn có chắc muốn xóa địa điểm này khỏi danh sách yêu thích?')) return;
    
    try {
      const response = await attractionsAPI.unfavoriteAttraction(attractionId);
      if (response.success) {
        setFavorites(prev => prev.filter(fav => fav.id !== attractionId));
        alert('Đã xóa khỏi danh sách yêu thích!');
      } else {
        alert(response.error || 'Lỗi khi xóa khỏi danh sách yêu thích.');
      }
    } catch (e) {
      alert('Lỗi kết nối hoặc không thể xóa khỏi danh sách yêu thích.');
    }
  };

  const handleEditReview = (review) => {
    alert(`Đang chỉnh sửa đánh giá cho: ${review.attraction?.name || 'Địa điểm không rõ'}`);
    // Logic thực tế sẽ chuyển hướng đến trang chỉnh sửa hoặc mở modal
  };

  const handleDeleteReview = async (reviewId, attractionId) => {
    if (!window.confirm('Bạn có chắc muốn xóa đánh giá này không?')) return;
    
    try {
      const response = await userAPI.deleteReview(reviewId, attractionId);
      if (response.success) {
        setReviews(prev => prev.filter(review => review.reviewId !== reviewId));
        alert('Đã xóa đánh giá thành công!');
      } else {
        alert(response.error || 'Lỗi khi xóa đánh giá.');
      }
    } catch (e) {
      alert('Lỗi kết nối hoặc không thể xóa đánh giá.');
    }
  };

  // Xử lý xem chi tiết tour
  const handleViewTour = (tourId) => {
    alert(`Đang mở chi tiết Tour ID: ${tourId}. Cần cài đặt route /tours/${tourId}.`);
  };
  
  // Xử lý xóa tour
  const handleDeleteTour = async (tourId) => {
      if (!window.confirm('Bạn có chắc muốn xóa hành trình này không?')) return;
      
      try {
          const response = await tourAPI.unsaveTour(tourId); 
          
          if (response.success) {
              setSavedTours(prev => prev.filter(tour => tour.tourId !== tourId));
              alert('Đã xóa hành trình thành công!');
          } else {
              alert(response.error || 'Lỗi khi xóa hành trình.');
          }
      } catch (e) {
          console.error("Lỗi xóa tour:", e);
          alert('Lỗi kết nối hoặc không thể xóa hành trình.');
      }
  };

  if (!currentUser) {
    return (
      <div className="user-page">
        <div className="user-loading">
          <p>Bạn cần đăng nhập để xem trang cá nhân.</p>
          <button onClick={() => navigate('/login')}>Đăng nhập ngay</button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="user-page">
        <div className="user-loading">
          <p>Đang tải dữ liệu người dùng...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="user-page">
        <div className="user-loading">
          <p style={{color: '#ef4444'}}>Lỗi: {error}</p>
          <button onClick={loadUserData}>Tải lại</button>
        </div>
      </div>
    );
  }

  return (
    <div className="user-page">
      <div className="user-container">
        <div className="profile-header">
          <div className="profile-avatar">
            <img 
              src={userInfo?.avatarUrl || 'default-avatar.png'} 
              alt="Avatar" 
              onError={(e) => {e.target.onerror = null; e.target.src="default-avatar.png"}}
            />
          </div>
          <div className="profile-info">
            <h2>{userInfo?.name || currentUser.username}</h2>
            <p className="profile-email">{userInfo?.email || 'Chưa cập nhật email'}</p>
            <div className="profile-stats">
              <span>💖 {favorites.length} Yêu thích</span>
              <span>📝 {reviews.length} Đánh giá</span>
              <span>🗺️ {savedTours.length} Hành trình</span> 
            </div>
            <div className="profile-actions">
              <button className="edit-profile-btn" onClick={handleEditProfile}>Sửa thông tin</button>
              <button className="logout-btn" onClick={handleLogout}>Đăng xuất</button>
            </div>
          </div>
        </div>

        <div className="profile-content">
          <div className="profile-tabs">
            <button 
              className={activeTab === 'profile' ? 'active' : ''} 
              onClick={() => setActiveTab('profile')}
            >
              Thông tin
            </button>
            <button 
              className={activeTab === 'favorites' ? 'active' : ''} 
              onClick={() => setActiveTab('favorites')}
            >
              Địa điểm Yêu thích
            </button>
            {/* Thêm tab Hành trình đã lưu */}
            <button 
                className={activeTab === 'tours' ? 'active' : ''} 
                onClick={() => setActiveTab('tours')}
            >
                Hành trình đã lưu
            </button>
            <button 
              className={activeTab === 'reviews' ? 'active' : ''} 
              onClick={() => setActiveTab('reviews')}
            >
              Đánh giá của tôi
            </button>
          </div>

          <div className="tab-content">
            {/* Tab Thông tin */}
            {activeTab === 'profile' && (
              <div className="profile-details-section">
                <h3>Chi tiết tài khoản</h3>
                <div className="detail-item">
                  <span className="label">Tên người dùng:</span>
                  <span className="value">{userInfo?.username}</span>
                </div>
                <div className="detail-item">
                  <span className="label">Email:</span>
                  <span className="value">{userInfo?.email}</span>
                </div>
                <div className="detail-item">
                  <span className="label">Số điện thoại:</span>
                  <span className="value">{userInfo?.phone || 'Chưa cập nhật'}</span>
                </div>
                <div className="detail-item">
                  <span className="label">Ngày đăng ký:</span>
                  <span className="value">
                    {userInfo?.createdAt 
                      ? new Date(userInfo.createdAt).toLocaleDateString('vi-VN') 
                      : 'N/A'}
                  </span>
                </div>
              </div>
            )}

            {/* Tab Yêu thích */}
            {activeTab === 'favorites' && (
              <div className="favorites-section">
                <h3>Địa điểm Yêu thích ({favorites.length})</h3>
                {favorites.length === 0 ? (
                  <div className="empty-state">
                    <p>Bạn chưa thêm địa điểm nào vào danh sách yêu thích.</p>
                    <button onClick={() => navigate('/attractions')}>Tìm địa điểm ngay</button>
                  </div>
                ) : (
                  <div className="favorites-list">
                    {favorites.map((fav) => (
                      <div key={fav.id} className="favorite-card">
                        <img 
                          src={fav.imageUrl || 'default-attraction.png'} 
                          alt={fav.name} 
                          className="favorite-thumb"
                        />
                        <div className="favorite-info">
                          <h4>{fav.name}</h4>
                          <p>{fav.address}</p>
                        </div>
                        <div className="favorite-actions">
                          <button 
                            className="view-btn" 
                            onClick={() => handleGoToAttraction(fav.id)}
                          >
                            Xem
                          </button>
                          <button 
                            className="delete-btn" 
                            onClick={() => handleDeleteFavorite(fav.id)}
                          >
                            Xóa
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            {/* Tab save tour */}
            {activeTab === 'tours' && (
                <div className="tours-section">
                    <h3>Hành trình đã lưu ({savedTours.length})</h3>
                    {loading ? (
                        <p className="loading-text">Đang tải tour...</p>
                    ) : savedTours.length === 0 ? (
                        <div className="empty-state">
                            <p>Bạn chưa lưu tour nào. Hãy tạo một tour mới!</p>
                            <button onClick={() => navigate('/service')}>Tạo tour ngay</button>
                        </div>
                    ) : (
                        <div className="saved-tours-list">
                            {/* tour object cần có: tourId, tourName, startDate, endDate, totalDays, totalDistanceKm, totalDestinations */}
                            {savedTours.map((tour) => (
                                <div key={tour.tourId} className="tour-card">
                                    <div className="tour-info">
                                        <h4 className="tour-name">{tour.tourName || `Hành trình ${tour.totalDays} Ngày`}</h4>
                                        <p className="tour-dates">
                                            📅 {new Date(tour.startDate).toLocaleDateString('vi-VN')} - 
                                            {tour.endDate ? ` ${new Date(tour.endDate).toLocaleDateString('vi-VN')}` : ' (Chưa kết thúc)'}
                                        </p>
                                        <p className="tour-summary">
                                            🚶 {tour.totalDays} ngày | 
                                            📍 {tour.totalDestinations || '...'} điểm đến | 
                                            🛣️ {tour.totalDistanceKm ? `${Math.round(tour.totalDistanceKm)} km` : '...'}
                                        </p>
                                    </div>
                                    <div className="tour-actions">
                                        <button className="view-btn" onClick={() => handleViewTour(tour.tourId)}>
                                            Xem chi tiết
                                        </button>
                                        <button className="delete-btn" onClick={() => handleDeleteTour(tour.tourId)}>
                                            Xóa
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}


            {/* Tab Đánh giá */}
            {activeTab === 'reviews' && (
              <div className="reviews-section">
                <h3>Đánh giá của tôi ({reviews.length})</h3>
                {reviews.length === 0 ? (
                  <div className="empty-state">
                    <p>Bạn chưa có đánh giá nào.</p>
                  </div>
                ) : (
                  <div className="reviews-list">
                    {reviews.map((review) => (
                      <div key={review.reviewId} className="review-card">
                        <div className="review-header">
                          <h4 
                            className="attraction-name"
                            onClick={() => handleGoToAttraction(review.attraction?.id)}
                          >
                            {review.attraction?.name || 'Địa điểm đã bị xóa'}
                          </h4>
                          <div className="review-rating">
                            <span>⭐ {review.rating}</span>
                          </div>
                        </div>
                        <p className="review-content">{review.content}</p>
                        <div className="review-footer">
                          <time>
                            {review.createdAt 
                              ? new Date(review.createdAt).toLocaleDateString('vi-VN', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric',
                                })
                              : ''}
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
                              onClick={() => handleDeleteReview(review.reviewId, review.attraction?.id)}
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
    </div>
  );
}
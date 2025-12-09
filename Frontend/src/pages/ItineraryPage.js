/* src/pages/ItineraryPage.js */
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import MapComponent from '../layout/MapComponent'; 
import { tourAPI } from '../utils/api'; 
import './ItineraryPage.css';

export default function ItineraryPage() {
  const location = useLocation();
  const navigate = useNavigate();
  
  // ==========================================
  // 1. STATE MANAGEMENT
  // ==========================================
  const [tourResult, setTourResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDay, setSelectedDay] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  const { selectedAttractions, startPoint, startDate, endDate } = location.state || {};

  // ==========================================
  // 2. EFFECTS & LOGIC
  // ==========================================

  useEffect(() => {
      function handleClickOutside(event) {
          if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
              setShowDropdown(false);
          }
      }
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSaveTour = async () => {
      // 1. Kiểm tra đăng nhập (dùng khóa 'currentUser' giống App.js)
      const isLoggedIn = localStorage.getItem('currentUser') || localStorage.getItem('access_token'); 
      
      if (!isLoggedIn) {
          const confirmLogin = window.confirm("Bạn cần đăng nhập để lưu hành trình này vào tài khoản. Đăng nhập ngay?");
          if (confirmLogin) {
              window.dispatchEvent(new Event("openLoginPopup"));
          }
          return;
      }

      // 2. Nếu đã đăng nhập -> Gọi API lưu
      try {
          console.log("💾 Đang lưu lịch trình...", tourResult);
          
          // Extract userId from localStorage
          const userStr = localStorage.getItem('currentUser');
          let userId = null;
          if (userStr) {
              try {
                  const user = JSON.parse(userStr);
                  userId = user.user_id || user.id;
              } catch (e) {
                  console.error("Error parsing user:", e);
              }
          }
          
          if (!userId) {
              alert("Không thể lấy thông tin người dùng. Vui lòng đăng nhập lại.");
              return;
          }
          
          // Backend expects: tourName and attractionIds
          const payload = {
              tourName: `Lịch trình ${tourResult.totalDays || 'N'} ngày`,
              attractionIds: selectedAttractions ? selectedAttractions.map(attr => attr.id) : []
          };

          // Gọi API
          const response = await tourAPI.saveTour(payload);
          
          if (response.success) {
              alert("Đã lưu hành trình thành công vào tài khoản!");
          } else {
              alert(response.error || "Lỗi khi lưu hành trình.");
          }
      } catch (e) {
          console.error("Lỗi khi lưu:", e);
          alert(e.message || "Lỗi khi lưu hành trình. Vui lòng thử lại.");
      }
  };

  // Xuất hành trình ra PDF (dùng print-to-PDF của trình duyệt)
  const handleExportPDF = () => {
      if (!tourResult) {
          alert("Chưa có dữ liệu tour để xuất PDF.");
          return;
      }

      const tripTitle = `Hành trình ${tourResult.totalDays || 1} ngày`;
      const summary = `
        <div style="margin-bottom:16px;">
          <h2 style="margin:0 0 8px 0;">${tripTitle}</h2>
          <div>Điểm đến: ${tourResult.totalDestinations || 0}</div>
          <div>Quãng đường: ${Math.round(tourResult.totalDistanceKm || 0)} km</div>
        </div>
      `;

      const timelineHtml = (tourResult.timeline || [])
        .map(item => `
          <div style="margin-bottom:12px;">
            <strong>${item.time || ''} ${item.type === 'DAY_START' ? `(Ngày ${item.day || ''})` : ''}</strong><br/>
            <div>${item.name || ''}</div>
            <div style="color:#666;">${item.detail || ''}</div>
          </div>
        `).join('');

      const html = `
        <html>
          <head>
            <title>${tripTitle}</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 24px; }
              h1, h2, h3 { margin: 0 0 12px 0; }
              .section { margin-bottom: 18px; }
              .timeline-item { margin-bottom: 12px; }
            </style>
          </head>
          <body>
            ${summary}
            <div class="section">
              <h3>Chi tiết lịch trình</h3>
              ${timelineHtml || '<div>Không có hoạt động.</div>'}
            </div>
          </body>
        </html>
      `;

      const printWindow = window.open('', '_blank', 'width=900,height=1000');
      if (!printWindow) {
          alert("Trình duyệt chặn cửa sổ mới. Vui lòng cho phép popup để xuất PDF.");
          return;
      }
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
  };

  // Tạo Key Cache duy nhất dựa trên input đầu vào
  const tripKey = useMemo(() => {
      if (!selectedAttractions || !startPoint) return null;
      
      const ids = selectedAttractions.map(i => i.id).sort().join(',');
      const start = `${startPoint.lat}_${startPoint.lon}`;
      const dates = `${startDate}_${endDate}`;
      
      return `tour_cache_${ids}_${start}_${dates}`;
  }, [selectedAttractions, startPoint, startDate, endDate]);

  // Gọi API tạo lịch trình (Hoặc lấy từ Cache)
  useEffect(() => {
    if (!selectedAttractions || selectedAttractions.length === 0) {
        navigate('/service'); 
        return;
    }

    if (tripKey) {
        const cachedData = sessionStorage.getItem(tripKey);
        if (cachedData) {
            try {
                setTourResult(JSON.parse(cachedData));
                setLoading(false);
                return;
            } catch (e) {
                sessionStorage.removeItem(tripKey);
            }
        }
    }

    const generateTour = async () => {
        try {
            setLoading(true);
            
            const formatForBackend = (dateString, isEnd = false) => {
                const time = isEnd ? '20:00' : '08:00'; 
                if (!dateString) {
                    const now = new Date();
                    if (isEnd) now.setDate(now.getDate() + 1);
                    const d = now.getDate().toString().padStart(2, '0');
                    const m = (now.getMonth() + 1).toString().padStart(2, '0');
                    const y = now.getFullYear();
                    return `${d}/${m}/${y} ${time}`;
                }
                const parts = dateString.split('-');
                if (parts.length === 3) {
                    const [year, month, day] = parts;
                    return `${day}/${month}/${year} ${time}`;
                }
                return dateString;
            };

            const params = {
                attractionIds: selectedAttractions.map(item => item.id),
                startLat: startPoint?.lat,
                startLon: startPoint?.lon,
                startTime: formatForBackend(startDate),
                endTime: formatForBackend(endDate || startDate, true)
            };

            const response = await tourAPI.createQuickTour(params);

            if (response.success) {
                setTourResult(response.data);
                if (tripKey) {
                    try {
                        sessionStorage.setItem(tripKey, JSON.stringify(response.data));
                    } catch (e) {
                        console.warn("Quota exceeded: Không thể cache tour này.");
                    }
                }
            } else {
                setError(response.error || "Không thể tạo tour. Vui lòng thử lại.");
            }
        } catch (err) {
            console.error("Lỗi kết nối:", err);
            setError(err.message || "Lỗi kết nối đến máy chủ.");
        } finally {
            setLoading(false);
        }
    };

    generateTour();
  }, [tripKey, selectedAttractions, startPoint, startDate, endDate, navigate]);

  // ==========================================
  // 3. VIEW HELPERS
  // ==========================================

  const visibleTimeline = useMemo(() => {
      if (!tourResult || !tourResult.timeline) return [];
      if (selectedDay === null) return tourResult.timeline; 
      return tourResult.timeline.filter(item => item.day === selectedDay);
  }, [tourResult, selectedDay]);

  const totalDays = tourResult?.totalDays || 1;

  const handlePrev = () => {
      if (selectedDay === null) return; 
      if (selectedDay === 1) setSelectedDay(null); 
      else setSelectedDay(selectedDay - 1);
  };

  const handleNext = () => {
      if (selectedDay === null) setSelectedDay(1); 
      else if (selectedDay < totalDays) setSelectedDay(selectedDay + 1);
  };

  // ==========================================
  // 4. MAP DATA PREPARATION
  // ==========================================
  
  const startLocationMarker = (startPoint && startPoint.lat && startPoint.lon) ? {
      id: 'start-point',
      name: `Xuất phát: ${startPoint.name}`,
      lat: startPoint.lat,
      lon: startPoint.lon,
      type: 'START',
      detail: 'Vị trí bắt đầu hành trình',
      order: 0
  } : null;

  const visitLocations = tourResult?.timeline
      ? tourResult.timeline
          .filter(t => t.type === 'VISIT' && t.lat && t.lon)
          .map((t, index) => ({
              id: t.id,
              name: t.name,
              lat: t.lat,
              lon: t.lon,
              imageUrl: t.imageUrl,
              detail: t.detail,
              type: 'DESTINATION',
              day: t.day,
              order: index + 1
          }))
      : [];

  const mapLocations = startLocationMarker 
      ? [startLocationMarker, ...visitLocations] 
      : visitLocations;

  let detailedPath = [];
  if (tourResult && tourResult.routes) {
      Object.keys(tourResult.routes).sort().forEach(day => {
          const daySegments = tourResult.routes[day];
          if (Array.isArray(daySegments)) {
              daySegments.forEach(segment => {
                  if (segment.path && Array.isArray(segment.path)) {
                      detailedPath = [...detailedPath, ...segment.path];
                  } 
                  else if (Array.isArray(segment)) {
                      detailedPath = [...detailedPath, ...segment];
                  }
              });
          }
      });
  }

  const routePath = detailedPath.length > 0 
      ? detailedPath 
      : mapLocations.map(p => [p.lat, p.lon]);

  // ==========================================
  // 5. RENDER UI
  // ==========================================

  if (loading) return (
      <div className="itinerary-loading">
          <div style={{textAlign: 'center'}}>
              <h2 style={{color: '#fff'}}>⏳ Đang thiết kế hành trình...</h2>
              <p style={{color: '#94a3b8'}}>Hệ thống đang tính toán lộ trình tối ưu nhất cho bạn</p>
          </div>
      </div>
  );

  if (error) return (
      <div className="itinerary-loading" style={{flexDirection: 'column'}}>
          <h2 style={{color: '#ef4444'}}>⚠️ Đã xảy ra lỗi</h2>
          <p style={{color: '#fff'}}>{error}</p>
          <button className="back-btn" onClick={() => navigate('/service')} style={{marginTop: 20}}>
             Quay lại trang chọn
          </button>
      </div>
  );

  if (!tourResult) return (
      <div className="itinerary-loading">
          <p style={{color: '#fff'}}>Không tìm thấy dữ liệu tour.</p>
      </div>
  );

  return (
    <div className="itinerary-page">
      {/* SIDEBAR */}
      <div className="itinerary-sidebar">
        
        {/* HEADER */}
        <div className="sidebar-header">
            <div className="header-top-row">
                <button 
                    className="back-btn-icon" 
                    onClick={() => navigate('/service')} 
                    title="Quay lại chỉnh sửa"
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 12H5M12 19l-7-7 7-7"/>
                    </svg>
                </button>
                
                <h2 className="header-title">HÀNH TRÌNH CỦA BẠN</h2>
                
                {/* NÚT LƯU TOUR */}
                <button 
                    className="save-btn-icon" 
                    onClick={handleSaveTour} 
                    title="Lưu tour"
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                        <polyline points="17 21 17 13 7 13 7 21"></polyline>
                        <polyline points="7 3 7 8 15 8"></polyline>
                    </svg>
                </button>
                
                {/* NÚT XUẤT PDF */}
                <button 
                    className="save-btn-icon" 
                    onClick={handleExportPDF} 
                    title="Xuất PDF"
                    style={{ marginLeft: 8 }}
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                        <line x1="10" y1="9" x2="8" y2="9"></line>
                    </svg>
                </button>
            </div>

            {/* Thông số tóm tắt */}
            <div className="trip-summary-badges">
                <div className="badge-item">
                    <span className="badge-label">Thời gian</span>
                    <span className="badge-value">{tourResult.totalDays} Ngày</span>
                </div>
                <div className="badge-divider"></div>
                <div className="badge-item">
                    <span className="badge-label">Điểm đến</span>
                    <span className="badge-value">{tourResult.totalDestinations}</span>
                </div>
                <div className="badge-divider"></div>
                <div className="badge-item">
                    <span className="badge-label">Quãng đường</span>
                    <span className="badge-value">{Math.round(tourResult.totalDistanceKm)} km</span>
                </div>
            </div>

            {/* Thanh điều hướng */}
            <div className="stage-navigator">
                <button 
                    className="nav-arrow" 
                    onClick={handlePrev}
                    disabled={selectedDay === null}
                    title="Lùi lại"
                >
                    ❮
                </button>
                
                <div className="stage-dropdown-wrapper" ref={dropdownRef}>
                    <div 
                        className="stage-display" 
                        onClick={() => setShowDropdown(!showDropdown)}
                        title="Chọn ngày xem chi tiết"
                    >
                        <span className="current-stage">
                            {selectedDay === null ? "Toàn cảnh chuyến đi" : `Lịch trình Ngày ${selectedDay}`}
                        </span>
                        <span className="dropdown-icon">▼</span>
                    </div>

                    {showDropdown && (
                        <ul className="stage-dropdown-menu">
                            <li 
                                className={selectedDay === null ? 'active' : ''} 
                                onClick={() => { setSelectedDay(null); setShowDropdown(false); }}
                            >
                                🗺️ Toàn cảnh
                            </li>
                            {Array.from({ length: totalDays }, (_, i) => i + 1).map(day => (
                                <li 
                                    key={day} 
                                    className={selectedDay === day ? 'active' : ''} 
                                    onClick={() => { setSelectedDay(day); setShowDropdown(false); }}
                                >
                                    📅 Ngày {day}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <button 
                    className="nav-arrow" 
                    onClick={handleNext} 
                    disabled={selectedDay === totalDays}
                    title="Tiếp theo"
                >
                    ❯
                </button>
            </div>
        </div>

        {/* TIMELINE */}
        <div className="timeline-container">
            {visibleTimeline.length > 0 ? (
                visibleTimeline.map((item, idx) => {
                    // Logic xác định điểm phụ
                    const isBonus = item.detail && (
                        item.detail.toLowerCase().includes("gợi ý") || 
                        item.detail.toLowerCase().includes("ghé thêm")
                    );

                    return (
                        <div key={idx} className={`timeline-item type-${item.type} ${isBonus ? 'item-bonus' : ''}`}>
                            <div className="time-col">
                                <div className="time-text">{item.time}</div>
                                {item.type === 'DAY_START' && <div className="date-subtext">{item.date}</div>}
                            </div>
                            
                            <div 
                                className={`content-col ${item.type === 'VISIT' ? 'clickable-card' : ''}`}
                                onClick={() => {
                                    if (item.type === 'VISIT' && item.id) {
                                        navigate(`/attractions/${item.id}`);
                                    }
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div>
                                        <h4>{isBonus ? "✨ " : ""}{item.name}</h4>
                                        <p>{item.detail}</p>
                                    </div>
                                    
                                    {item.type === 'DAY_START' && item.weather && (
                                        <div className="weather-badge">
                                            <img 
                                                src={`https://openweathermap.org/img/wn/${item.weather.icon}.png`} 
                                                alt="weather"
                                            />
                                            <div className="weather-info">
                                                <span className="temp">
                                                    {Math.round(item.weather.temp_min)}°-{Math.round(item.weather.temp_max)}°C
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {item.imageUrl && (
                                    <img src={item.imageUrl} alt={item.name} className="timeline-thumb"/>
                                )}
                            </div>
                        </div>
                    );
                })
            ) : (
                <div className="empty-state">
                    Không có hoạt động nào trong giai đoạn này.
                </div>
            )}
            
            {selectedDay === null && tourResult.invalidAttractions && tourResult.invalidAttractions.length > 0 && (
                <div className="warning-box">
                    <h4>⚠️ Điểm không phù hợp thời gian:</h4>
                    <ul>
                        {tourResult.invalidAttractions.map((inv, i) => (
                            <li key={i}><strong>{inv.name}</strong>: {inv.reason}</li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
      </div>

      {/* MAP */}
      <div className="itinerary-map">
         <MapComponent 
            locations={mapLocations}
            routes={tourResult.routes}
            routePath={routePath}
            selectedDay={selectedDay}
         />
      </div>
    </div>
  );
}
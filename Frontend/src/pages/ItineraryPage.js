import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import MapComponent from '../layout/MapComponent'; 
import { tourAPI } from '../utils/api'; 
import './ItineraryPage.css';

export default function ItineraryPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [tourResult, setTourResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Lấy dữ liệu được truyền từ Service.js thông qua navigate state
  const { selectedAttractions, startPoint, startDate, endDate } = location.state || {};

  useEffect(() => {
    // 1. Validate dữ liệu đầu vào
    if (!selectedAttractions || selectedAttractions.length === 0) {
        // Nếu người dùng truy cập trực tiếp link này mà không qua chọn địa điểm -> đá về Service
        navigate('/service'); 
        return;
    }

    const generateTour = async () => {
        try {
            setLoading(true);
            
            // 2. Hàm format ngày cho Backend
            // Input từ Service.js là dạng: yyyy-mm-dd
            const formatForBackend = (dateString, isEnd = false) => {
                const time = isEnd ? '20:00' : '08:00'; 

                if (!dateString) {
                    // Fallback: Nếu không có ngày, dùng ngày hiện tại/ngày mai
                    const now = new Date();
                    if (isEnd) now.setDate(now.getDate() + 1);
                    
                    const d = now.getDate().toString().padStart(2, '0');
                    const m = (now.getMonth() + 1).toString().padStart(2, '0');
                    const y = now.getFullYear();
                    return `${d}/${m}/${y} ${time}`;
                }

                // Parse chuỗi yyyy-mm-dd thủ công để tránh lỗi múi giờ
                const parts = dateString.split('-');
                if (parts.length === 3) {
                    const [year, month, day] = parts;
                    return `${day}/${month}/${year} ${time}`;
                }
                
                return dateString; // Fallback an toàn
            };

            // 3. Chuẩn bị params gọi API
            const params = {
                attractionIds: selectedAttractions.map(item => item.id),
                startLat: startPoint?.lat,
                startLon: startPoint?.lon,
                startTime: formatForBackend(startDate),
                endTime: formatForBackend(endDate || startDate, true)
            };

            // 4. Gọi API thông qua wrapper
            const response = await tourAPI.createQuickTour(params);

            if (response.success) {
                setTourResult(response.data);
            } else {
                setError(response.error || "Không thể tạo lịch trình. Vui lòng thử lại.");
            }
        } catch (err) {
            console.error("Lỗi:", err);
            setError(err.message || "Lỗi kết nối đến máy chủ.");
        } finally {
            setLoading(false);
        }
    };

    generateTour();
  }, [selectedAttractions, startPoint, startDate, endDate, navigate]);

  // --- RENDER STATES ---
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

  // --- PREPARE MAP DATA ---
  // 1. Markers: Lấy danh sách các điểm VISIT để hiện icon
  const mapLocations = tourResult.timeline
      ? tourResult.timeline
          .filter(t => t.type === 'VISIT' && t.lat && t.lon)
          .map(t => ({
              id: t.id,
              name: t.name,
              lat: t.lat,
              lon: t.lon,
              imageUrl: t.imageUrl,
              detail: t.detail
          }))
      : [];

  // 2. Polyline: Lấy đường đi chi tiết từ Backend
  let detailedPath = [];

  if (tourResult.routes) {
      Object.keys(tourResult.routes).sort().forEach(day => {
          const daySegments = tourResult.routes[day];
          if (Array.isArray(daySegments)) {
              daySegments.forEach(segment => {
                  detailedPath = [...detailedPath, ...segment];
              });
          }
      });
  }

  // Fallback: Nếu không có routes chi tiết, mới dùng cách cũ (nối thẳng các điểm)
  if (detailedPath.length === 0 && tourResult.timeline) {
       detailedPath = tourResult.timeline
          .filter(t => t.lat && t.lon)
          .map(t => [t.lat, t.lon]);
          
       // Thêm điểm xuất phát vào đầu nếu chưa có
       if (startPoint && startPoint.lat && detailedPath.length > 0) {
          const first = detailedPath[0];
          if (Math.abs(first[0] - startPoint.lat) > 0.0001) {
              detailedPath.unshift([startPoint.lat, startPoint.lon]);
          }
       }
  }

  const routePath = detailedPath;

  return (
    <div className="itinerary-page">
      <div className="itinerary-sidebar">
        <div className="sidebar-header">
            <button className="back-btn" onClick={() => navigate('/service')}>← Chỉnh sửa</button>
            <h2>Lịch trình gợi ý</h2>
            <div className="tour-stats">
                <span>🗓 {tourResult.totalDays || 1} Ngày</span> • 
                <span>📍 {tourResult.totalDestinations || 0} Điểm đến</span> • 
                <span>🚗 {tourResult.totalDistanceKm || 0} km</span>
            </div>
        </div>

        <div className="timeline-container">
            {tourResult.timeline && tourResult.timeline.map((item, idx) => (
                <div key={idx} className={`timeline-item type-${item.type}`}>
                    <div className="time-col">
                        <div className="time-text">{item.time}</div>
                        {item.type === 'DAY_START' && <div className="date-subtext">{item.date}</div>}
                    </div>
                    
                    <div className="content-col">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <h4>{item.name}</h4>
                                <p>{item.detail}</p>
                            </div>
                            {item.type === 'DAY_START' && item.weather && (
                                <div className="weather-badge">
                                    <img 
                                        src={`https://openweathermap.org/img/wn/${item.weather.icon}.png`} 
                                        alt="weather" 
                                        title={item.weather.description}
                                    />
                                    <div className="weather-info">
                                        <span className="temp">
                                            {Math.round(item.weather.temp_min)}°-{Math.round(item.weather.temp_max)}°C
                                        </span>
                                        <span className="desc">{item.weather.description}</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {item.imageUrl && (
                            <img src={item.imageUrl} alt="" className="timeline-thumb"/>
                        )}
                    </div>
                </div>
            ))}
            
            {tourResult.invalidAttractions && tourResult.invalidAttractions.length > 0 && (
                <div style={{padding: '15px', backgroundColor: '#451a03', borderTop: '1px solid #78350f', marginTop: '20px'}}>
                    <h4 style={{color: '#fca5a5', margin: '0 0 10px'}}>⚠️ Điểm không phù hợp thời gian:</h4>
                    <ul style={{margin: 0, paddingLeft: '20px', color: '#cbd5e1', fontSize: '0.9rem'}}>
                        {tourResult.invalidAttractions.map((inv, i) => (
                            <li key={i}><strong>{inv.name}</strong>: {inv.reason}</li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
      </div>

      <div className="itinerary-map">
         <MapComponent 
            locations={mapLocations} 
            routePath={routePath} 
         />
      </div>
    </div>
  );
}
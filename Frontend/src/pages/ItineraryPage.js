/* src/pages/ItineraryPage.js */
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import MapComponent from '../layout/MapComponent'; 
import './ItineraryPage.css';

// Dùng biến môi trường nếu có, fallback localhost
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000'; 

export default function ItineraryPage() {
  const location = useLocation();
  const navigate = useNavigate();
  
  const [tourResult, setTourResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // State lưu mảng các đoạn đường (Array of Arrays)
  const [routePaths, setRoutePaths] = useState([]);

  const [requestData] = useState(() => {
      if (location.state) {
          sessionStorage.setItem('lastTourRequest', JSON.stringify(location.state));
          return location.state;
      }
      const backup = sessionStorage.getItem('lastTourRequest');
      return backup ? JSON.parse(backup) : null;
  });

  useEffect(() => {
    if (!requestData || !requestData.selectedAttractions || requestData.selectedAttractions.length === 0) {
        navigate('/service');
        return;
    }

    const generateTour = async () => {
        try {
            setLoading(true);
            const { selectedAttractions, startPoint, startDate, endDate } = requestData;

            const queryParams = new URLSearchParams();
            selectedAttractions.forEach(item => queryParams.append('attractionIds', item.id));
            queryParams.append('startLat', startPoint.lat);
            queryParams.append('startLon', startPoint.lon);
            
            // Format Date Helper
            const fmt = (d) => {
                const date = new Date(d);
                const day = date.getDate().toString().padStart(2, '0');
                const month = (date.getMonth() + 1).toString().padStart(2, '0');
                const year = date.getFullYear();
                return `${day}/${month}/${year}`;
            }

            queryParams.append('startTime', fmt(startDate));
            queryParams.append('endTime', fmt(endDate));

            const res = await fetch(`${API_BASE_URL}/api/quick-tour-creator?${queryParams.toString()}`);
            const data = await res.json();

            if (data.success) {
                setTourResult(data.data);
                
                // Xử lý dữ liệu routes từ Backend:
                // routes: { "1": [ [lat,lon]... ], "2": ... }
                if (data.data.routes) {
                    let collectedPaths = [];
                    // Duyệt qua từng ngày để lấy path
                    Object.values(data.data.routes).forEach(dayRoutes => {
                        // dayRoutes là list các đoạn trong ngày. 
                        // Ta có thể nối chúng lại thành 1 line cho ngày đó, hoặc vẽ rời.
                        // Ở đây ta gom thành 1 line lớn cho mỗi ngày.
                        let singleDayPath = [];
                        if (Array.isArray(dayRoutes)) {
                             dayRoutes.forEach(segment => {
                                 if(Array.isArray(segment)) {
                                     singleDayPath = singleDayPath.concat(segment);
                                 }
                             });
                        }
                        if(singleDayPath.length > 0) collectedPaths.push(singleDayPath);
                    });
                    setRoutePaths(collectedPaths);
                }
            } else {
                setError(data.error || "Không thể tạo lịch trình.");
            }
        } catch (err) {
            console.error(err);
            setError("Lỗi kết nối server.");
        } finally {
            setLoading(false);
        }
    };

    generateTour();
  }, [requestData, navigate]);

  if (loading) return (
    <div className="itinerary-loading">
        <div className="spinner"></div>
        <p>AI đang tính toán lộ trình tối ưu...</p>
    </div>
  );
  
  if (error) return (
    <div className="itinerary-error">
        <h3>Đã có lỗi xảy ra</h3>
        <p>{error}</p>
        <button onClick={() => navigate('/service')}>Quay lại</button>
    </div>
  );
  
  if (!tourResult) return null;

  return (
    <div className="itinerary-page-container">
      <div className="itinerary-sidebar-panel">
        <div className="panel-header">
            <h2 className="panel-title">Lịch trình ({tourResult.totalDays} ngày)</h2>
            <div className="tour-stats">
                <span>🛣️ {tourResult.totalDistanceKm} km</span>
                <span style={{marginLeft: '15px'}}>📍 {tourResult.totalDestinations} điểm</span>
            </div>
        </div>

        <div className="panel-content">
            {tourResult.timeline.map((item, idx) => {
                if (item.type === 'DAY_START') {
                    return <div key={idx} className="day-header">{item.name}: {item.detail} ({item.date})</div>;
                }
                if (item.type === 'VISIT' || item.type === 'TRAVEL') {
                    return (
                        <div key={idx} className={`activity-item ${item.type.toLowerCase()}-type`}>
                            <div className="time-col">{item.time}</div>
                            <div className="content-col">
                                {item.type === 'VISIT' ? (
                                    <>
                                        <div className="act-name">📍 {item.name}</div>
                                        <div className="act-detail">{item.detail}</div>
                                    </>
                                ) : (
                                    <div className="travel-info">
                                        🚗 {item.name} <small>({item.detail})</small>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                }
                if (item.type === 'DAY_END') return <div key={idx} className="day-end-divider"></div>;
                return null;
            })}
            
            <div className="action-buttons">
                 <button onClick={() => navigate('/service')} className="btn-back">← Chỉnh sửa</button>
                 <button className="btn-save" onClick={() => alert('Đã lưu!')}>Lưu</button>
            </div>
        </div>
      </div>

      <div className="itinerary-map-panel">
         <MapComponent 
            locations={tourResult.timeline.filter(t => t.type === 'VISIT' && t.lat)} 
            routePaths={routePaths} 
         />
      </div>
    </div>
  );
}
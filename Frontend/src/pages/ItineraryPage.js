import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import MapComponent from '../layout/MapComponent'; 
import './ItineraryPage.css';

export default function ItineraryPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [tourResult, setTourResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Lấy dữ liệu truyền sang từ trang Service
  const { selectedAttractions, startPoint, startDate, endDate } = location.state || {};

  useEffect(() => {
    // Nếu không có dữ liệu (truy cập trực tiếp link), đẩy về trang Service
    if (!selectedAttractions || selectedAttractions.length === 0) {
        navigate('/service');
        return;
    }

    const generateTour = async () => {
        try {
            setLoading(true);
            
            // Build query params
            const queryParams = new URLSearchParams();
            selectedAttractions.forEach(item => queryParams.append('attractionIds', item.id));
            queryParams.append('startLat', startPoint.lat);
            queryParams.append('startLon', startPoint.lon);
            
            // Format date
            const fmt = (d) => {
                const date = new Date(d);
                return `${date.getDate().toString().padStart(2,'0')}/${(date.getMonth()+1).toString().padStart(2,'0')}/${date.getFullYear()} ${date.getHours().toString().padStart(2,'0')}:00`;
            }
            queryParams.append('startTime', fmt(startDate));
            queryParams.append('endTime', fmt(endDate));

            // Gọi API Backend
            const res = await fetch(`http://localhost:5000/api/quick-tour-creator?${queryParams.toString()}`);
            const data = await res.json();

            if (data.success) {
                setTourResult(data.data);
            } else {
                setError(data.error || "Không thể tạo lịch trình");
            }
        } catch (err) {
            setError("Lỗi kết nối server");
        } finally {
            setLoading(false);
        }
    };

    generateTour();
  }, [selectedAttractions, startPoint, startDate, endDate, navigate]);

  if (loading) return <div className="itinerary-loading">Thinking... Đang thiết kế lịch trình tối ưu cho bạn...</div>;
  if (error) return <div className="itinerary-error">{error} <button onClick={() => navigate('/service')}>Quay lại</button></div>;
  if (!tourResult) return null;

  return (
    <div className="itinerary-page">
      <div className="itinerary-sidebar">
        <div className="sidebar-header">
            <button className="back-btn" onClick={() => navigate('/service')}>← Chỉnh sửa</button>
            <h2>Lịch trình gợi ý</h2>
            <div className="tour-stats">
                <span>{tourResult.totalDays} Ngày</span> • 
                <span>{tourResult.totalDestinations} Điểm đến</span>
            </div>
        </div>

        <div className="timeline-container">
            {tourResult.timeline.map((item, idx) => (
                <div key={idx} className={`timeline-item type-${item.type}`}>
                    <div className="time-col">{item.time}</div>
                    <div className="content-col">
                        <h4>{item.name}</h4>
                        <p>{item.detail}</p>
                        {item.imageUrl && <img src={item.imageUrl} alt="" className="timeline-thumb"/>}
                    </div>
                </div>
            ))}
        </div>
      </div>

      <div className="itinerary-map">
         <MapComponent 
            locations={tourResult.timeline.filter(t => t.type === 'VISIT' && t.lat)} 
            routePath={tourResult.timeline .filter(t => t.lat && t.lon) .map(t => [t.lat, t.lon])} 
         />
      </div>
    </div>
  );
}
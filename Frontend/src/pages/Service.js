import React, { useState, useEffect } from 'react';
import { attractionsAPI } from '../utils/api';

export default function Service() {
  const [attractions, setAttractions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Fetch attractions from Flask API
    const fetchAttractions = async () => {
      try {
        setLoading(true);
        const response = await attractionsAPI.search("");
        if (response.success) {
          // API returns data in format: { festivals: [], culturalSpots: [], otherAttractions: [] }
          // Combine all into one array
          const allAttractions = [
            ...(response.data.festivals || []),
            ...(response.data.culturalSpots || []),
            ...(response.data.otherAttractions || [])
          ];
          setAttractions(allAttractions);
        } else {
          setError('Không thể tải danh sách điểm tham quan');
        }
      } catch (err) {
        console.error('Error fetching attractions:', err);
        setError('Lỗi kết nối đến máy chủ. Vui lòng đảm bảo Flask đang chạy trên cổng 5000.');
      } finally {
        setLoading(false);
      }
    };

    fetchAttractions();
  }, []);

  return (
    <div style={{ padding: 40, color: "white" }}>
      <h1>Service Page</h1>
      <p>Đây là trang dịch vụ.</p>
      
      {loading && <p>Đang tải điểm tham quan...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      
      {!loading && !error && (
        <div style={{ marginTop: '20px' }}>
          <h2>Điểm tham quan từ API ({attractions.length})</h2>
          {attractions.length > 0 ? (
            <ul>
              {attractions.map(attr => (
                <li key={attr.id}>
                  <strong>{attr.name}</strong>
                  {attr.url && <img src={attr.url} alt={attr.name} style={{ width: '100px', marginLeft: '10px' }} />}
                </li>
              ))}
            </ul>
          ) : (
            <p>Không có điểm tham quan nào.</p>
          )}
        </div>
      )}
    </div>
  );
}
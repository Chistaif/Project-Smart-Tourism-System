import React, { useState, useEffect } from 'react';
import './MapLoader.css';

export default function MapLoader({ message = "Đang thiết kế hành trình..." }) {
  const [subMessage, setSubMessage] = useState("Đang tìm đường tối ưu");

  useEffect(() => {
    const messages = [
      "Đang tìm đường tối ưu...",
      "Đang kiểm tra thời tiết...",
      "Đang kết nối các điểm đến...",
      "Đang tính toán khoảng cách..."
    ];
    let i = 0;
    const interval = setInterval(() => {
      i = (i + 1) % messages.length;
      setSubMessage(messages[i]);
    }, 1500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="map-loader-container">
      <div className="map-grid-bg"></div>
      <div className="map-radar"></div>

      <div className="loader-content">
        <svg className="route-svg" viewBox="0 0 300 200">
          <defs>
            <linearGradient id="gradientPath" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#2563eb" />
              <stop offset="100%" stopColor="#eab308" />
            </linearGradient>
          </defs>
          <path 
            d="M30 170 Q 140 30 270 150" 
            className="route-path"
          />
          <path 
            d="M30 170 Q 140 30 270 150" 
            className="route-active"
            stroke="url(#gradientPath)"
          />
        </svg>

        <div className="map-pin pin-1">📍</div>
        <div className="map-pin pin-2">🏛️</div>
        <div className="map-pin pin-3">🚩</div>

        {/* Phương tiện di chuyển (Máy bay hoặc Xe) */}
        <div className="moving-vehicle">
          <div className="vehicle-icon">✈️</div>
        </div>
      </div>

      {/* Text Info */}
      <div className="loading-text-container">
        <div className="loading-title">{message}</div>
        <div className="loading-subtitle">
          {subMessage}
          <span>.</span><span>.</span><span>.</span>
        </div>
      </div>
    </div>
  );
}
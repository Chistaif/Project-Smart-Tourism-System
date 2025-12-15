import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import MapComponent from '../layout/MapComponent';
import { tourAPI } from '../utils/api';
import './ItineraryPage.css';

import MapLoader from '../components/MapLoader';
import Popup from '../components/Popup';

export default function ItineraryPage() {
    const MIN_WIDTH = 450; // Kích thước tối thiểu hiện tại
    const [sidebarWidth, setSidebarWidth] = useState(MIN_WIDTH);
    const [isResizing, setIsResizing] = useState(false);

    const location = useLocation();
    const navigate = useNavigate();

    const sovereigntyMarkers = [
    {
        id: 'hoang-sa',
        name: 'Quần đảo Hoàng Sa (Việt Nam)',
        lat: 16.5350,
        lon: 111.6080,
        type: 'SPECIAL_FLAG',
        showFlag: true,
        detail: 'Huyện đảo Hoàng Sa, Thành phố Đà Nẵng'
    },
    {
        id: 'truong-sa',
        name: 'Quần đảo Trường Sa (Việt Nam)',
        lat: 9.6475,
        lon: 113.5180,
        type: 'SPECIAL_FLAG',
        showFlag: true,
        detail: 'Huyện đảo Trường Sa, Tỉnh Khánh Hòa'
    }
];

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

    // Quản lý popup nhập tên tour
    const [showNameModal, setShowNameModal] = useState(false);
    const [customTourName, setCustomTourName] = useState("");

    // Popup thông báo
    const [popup, setPopup] = useState({ show: false, message: "" });
    const showPopup = (msg) => setPopup({ show: true, message: msg });
    const closePopup = () => setPopup({ show: false, message: "" });


    // ==========================================
    // 2. EFFECTS & LOGIC
    // ==========================================

    const handleMouseDown = (e) => {
        setIsResizing(true);
        e.preventDefault();
    };

    // Logic xử lý khi đang kéo
    const handleMouseMove = useCallback((e) => {
        if (!isResizing) return;

        // Tính toán kích thước tối đa (1/2 màn hình)
        const MAX_WIDTH = window.innerWidth / 2;
        
        let newWidth = e.clientX; 
        
        // Áp dụng giới hạn
        if (newWidth < MIN_WIDTH) {
            newWidth = MIN_WIDTH;
        } else if (newWidth > MAX_WIDTH) {
            newWidth = MAX_WIDTH;
        }

        setSidebarWidth(newWidth);
    }, [isResizing]);

    // Logic xử lý khi kết thúc kéo
    const handleMouseUp = useCallback(() => {
        setIsResizing(false);
    }, []);

    // Gắn listener toàn cục để xử lý kéo
    useEffect(() => {
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [handleMouseMove, handleMouseUp]);

    // Ẩn footer bằng csss
    useEffect(() => {
        // Thêm class vào body khi component mount
        document.body.classList.add('hide-footer-on-itinerary');

        // Dọn dẹp: Xóa class khi component unmount (chuyển trang)
        return () => {
            document.body.classList.remove('hide-footer-on-itinerary');
        };
    }, []);

    // Click outside dropdown
    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowDropdown(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [])

    // --- BƯỚC 1: KHI NHẤN NÚT LƯU (Icon) ---
    const onSaveIconClick = () => {
        // 1. Kiểm tra đăng nhập
        const isLoggedIn = localStorage.getItem('currentUser') || localStorage.getItem('access_token');
        if (!isLoggedIn) {
            showPopup("Bạn cần đăng nhập để lưu hành trình. Vui lòng đăng nhập.");
            window.dispatchEvent(new Event("openLoginPopup"));
            return;
        }

        // 2. Nếu đã đăng nhập -> Mở Modal nhập tên
        // Đặt tên mặc định gợi ý
        const defaultName = `Lịch trình ${tourResult?.totalDays || 3} ngày tại Việt Nam`;
        setCustomTourName(defaultName);
        setShowNameModal(true);
    };

    // --- BƯỚC 2: KHI XÁC NHẬN LƯU (Gọi API) ---
    const handleConfirmSave = async () => {
        if (!customTourName.trim()) {
            alert("Vui lòng nhập tên cho chuyến đi!");
            return;
        }

        // Đóng modal nhập tên
        setShowNameModal(false);

        try {
            console.log("Đang lưu lịch trình:", customTourName);

            const token = localStorage.getItem('access_token');
            let userId = null;
            try {
                const userStr = localStorage.getItem('currentUser');
                if (userStr) {
                    const user = JSON.parse(userStr);
                    userId = user.user_id || user.id;
                }
            } catch (e) { console.error(e); }

            const payload = {
                tourName: customTourName.trim(),
                attractionIds: selectedAttractions.map(a => a.id),
                startDate: startDate,
                endDate: endDate,
                startLat: startPoint?.lat,
                startLon: startPoint?.lon,
                startPointName: startPoint?.name || 'Vị trí khởi hành',
                "userId": userId
            }

            if (userId) payload.userId = userId;

            const response = await tourAPI.saveTour(payload);

            if (response.success) {
                showPopup(`Đã lưu "${customTourName}" thành công!`);

                // Dispatch sự kiện để User page cập nhật
                if (response.tour) {
                    const created = response.tour;
                    const attractions = (selectedAttractions || []).map(a => ({
                        id: a.id, name: a.name,
                        lat: a.lat || a.latitude || null,
                        lon: a.lon || a.longitude || null,
                        image_url: a.imageUrl || a.image_url || null
                    }));

                    const createdTour = {
                        ...created,
                        attractions,
                        attraction_count: created.attraction_count || attractions.length
                    };
                    try { window.dispatchEvent(new CustomEvent('tourSaved', { detail: createdTour })); } catch (e) { }
                }
            } else {
                showPopup(response.error || "Lỗi khi lưu hành trình.");
            }
        } catch (e) {
            console.error("Lỗi khi lưu:", e);
            showPopup("Lỗi kết nối hoặc server.");
        }
    };

    // Xuất hành trình ra PDF (dùng print-to-PDF của trình duyệt)
    const handleExportPDF = () => {
        if (!tourResult) {
            showPopup("Chưa có dữ liệu tour để xuất PDF.");
            return;
        }

        const tripTitle = `SMART TOUR - ${tourResult.totalDays || 1} NGÀY`;
        const creationDate = new Date().toLocaleDateString('vi-VN');

        // 1. Tạo Map Rating từ selectedAttractions (để hiển thị Rating chính xác)
        const attractionDetailsMap = (selectedAttractions || []).reduce((acc, attr) => {
            acc[attr.id] = {
                rating: attr.averageRating || attr.rating || 'N/A',
                imageUrl: attr.imageUrl || attr.image_url
            };
            return acc;
        }, {});


        // 2. Tái cấu trúc Timeline thành HTML rõ ràng hơn
        const timelineHtml = (tourResult.timeline || [])
            .map(item => {
                const isDayStart = item.type === 'DAY_START';
                const isVisit = item.type === 'VISIT';

                const isBonus = isVisit && (item.detail.toLowerCase().includes("gợi ý") || item.detail.toLowerCase().includes("ghé thêm"));
                const contentClass = isBonus ? 'bonus-item' : 'primary-item';

                // Xử lý Rating
                const ratingValue = isVisit ? (attractionDetailsMap[item.id]?.rating || 'N/A') : 'N/A';
                const displayRating = typeof ratingValue === 'number' ? ratingValue.toFixed(1) : ratingValue;

                // Xử lý Ảnh
                const itemImageUrl = item.imageUrl || attractionDetailsMap[item.id]?.imageUrl;
                const imageHtml = (isVisit && itemImageUrl) ?
                    `<div class="item-image"><img src="${itemImageUrl}" alt="${item.name}" /></div>` :
                    '';

                // Xử lý tiêu đề sự kiện
                const eventName = item.name.replace('✨', '').trim();

                return `
                <div class="timeline-item ${item.type}">
                    <div class="time-col">
                        <span class="time-val">${item.time || 'N/A'}</span>
                        ${isDayStart ? `<span class="date-val">${item.date || ''}</span>` : ''}
                    </div>
                    <div class="content-col ${contentClass}">
                        ${imageHtml}
                        <h4 class="event-name ${isDayStart ? 'day-header' : ''}">
                            ${eventName}
                        </h4>
                        <p class="event-detail">
                            ${item.detail || (isVisit ? 'Tham quan địa điểm' : item.type === 'TRAVEL' ? 'Di chuyển' : '')}
                        </p>
                        ${isVisit ? `<p class="location-detail star-rating">⭐ Rating: ${displayRating}</p>` : ''}
                    </div>
                </div>
            `;
            }).join('');

        const html = `
        <html>
          <head>
            <title>${tripTitle}</title>
            <style>
              @page { size: A4; margin: 1cm; }
              body { font-family: 'Arial', sans-serif; color: #1e293b; padding: 0; margin: 0; }

              .report-header { text-align: center; margin-bottom: 25px; border-bottom: 1px solid #000; padding-bottom: 15px; }
              .main-title { color: #000; font-size: 24pt; margin-bottom: 5px; font-weight: bold; text-align: center; }
              .date-info { font-size: 9pt; color: #64748b; text-align: center; }

              .event-name { font-size: 12pt; margin: 0 0 5px 0; color: #000; font-weight: bold; text-align: left; } 
              .event-name.day-header { font-size: 14pt; color: #000; margin-top: 0; text-align: left; } 

              .summary-box { display: flex; justify-content: space-around; background: #f0f4f8; padding: 10px; border-radius: 8px; margin-bottom: 25px; }
              .summary-item { text-align: center; border-right: 1px solid #dcdcdc; padding: 0 15px; flex: 1; } 
              .summary-item:last-child { border-right: none; }
              .summary-label { font-size: 9pt; color: #64748b; margin-bottom: 3px; display: block; }
              .summary-value { font-size: 14pt; font-weight: bold; color: #0f172a; }

              .timeline-container { padding-left: 0; position: relative; } 
              .timeline-item { display: flex; margin-bottom: 20px; position: relative; gap: 10px; } 

              .timeline-item::before { content: none; } 

              .time-col { min-width: 120px; padding-right: 0; font-size: 10pt; text-align: left; } 
              
              .time-val { font-weight: bold; display: block; color: #334155; }
              .date-val { 
                  font-style: italic; 
                  color: #64748b; 
                  display: block;
                  margin-top: 2px;
              }
              
              .content-col { background: #ffffff; padding: 15px; border-radius: 8px; flex: 1; border: 1px solid #e2e8f0; }

              .primary-item { border-left: 8px solid #2563eb; } 
              .bonus-item { background: #fffbe6; border: 1px solid #fcd34d; border-left: 8px solid #f59e0b; }
              
              .item-image { 
                  width: 100%; 
                  height: 150px; 
                  overflow: hidden; 
                  margin-bottom: 10px; 
                  border-radius: 6px; 
                  box-shadow: 0 2px 4px rgba(0,0,0,0.1); 
              }
              .item-image img { 
                  width: 100%; 
                  height: 100%; 
                  object-fit: cover; 
              }
              
              .event-detail { font-size: 10pt; color: #475569; margin: 0; line-height: 1.4; }
              .location-detail { font-size: 9pt; color: #94a3b8; margin-top: 5px; }

              @media print {
                  body { background-color: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              }

            </style>
          </head>
          <body>
            <div class="report-header">
                <h1 class="main-title">${tripTitle}</h1>
                <p class="date-info">Xuất phát: ${tourResult.timeline[0]?.date || 'N/A'} | Tạo lúc: ${creationDate}</p>
            </div>
            
            <div class="summary-box">
                <div class="summary-item">
                    <span class="summary-label">Số ngày</span>
                    <span class="summary-value">${tourResult.totalDays}</span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">Điểm đến</span>
                    <span class="summary-value">${tourResult.totalDestinations}</span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">Quãng đường ước tính</span>
                    <span class="summary-value">${Math.round(tourResult.totalDistanceKm)} km</span>
                </div>
            </div>

            <div class="timeline-container">
              ${timelineHtml}
            </div>

          </body>
        </html>
      `;

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            showPopup("Trình duyệt chặn cửa sổ mới. Vui lòng cho phép mở cửa sổ để xuất PDF.");
            return;
        }
        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        // Chờ CSS load hoàn tất
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 500);
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
                try { setTourResult(JSON.parse(cachedData)); setLoading(false); return; } catch (e) { sessionStorage.removeItem(tripKey); }
            }
        }
        const generateTour = async () => {
            try {
                setLoading(true);
                const formatForBackend = (dateString, isEnd = false) => {
                    const time = isEnd ? '20:00' : '08:00';
                    if (!dateString) {
                        const now = new Date(); if (isEnd) now.setDate(now.getDate() + 1);
                        const d = now.getDate().toString().padStart(2, '0'); const m = (now.getMonth() + 1).toString().padStart(2, '0'); const y = now.getFullYear();
                        return `${d}/${m}/${y} ${time}`;
                    }
                    const parts = dateString.split('-');
                    if (parts.length === 3) { const [year, month, day] = parts; return `${day}/${month}/${year} ${time}`; }
                    return dateString;
                };
                const params = {
                    attractionIds: selectedAttractions.map(item => item.id),
                    startLat: startPoint?.lat,
                    startLon: startPoint?.lon,
                    startTime: formatForBackend(startDate),
                    endTime: formatForBackend(endDate || startDate, true),
                    startPointName: startPoint?.name || "Vị trí xuất phát"
                };
                const response = await tourAPI.createQuickTour(params);
                if (response.success) {
                    setTourResult(response.data);
                    if (tripKey) try { sessionStorage.setItem(tripKey, JSON.stringify(response.data)); } catch (e) { }
                } else { setError(response.error || "Lỗi tạo tour"); }
            } catch (err) { setError(err.message || "Lỗi kết nối"); } finally { setLoading(false); }
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

    const mapLocations = [
        ...sovereigntyMarkers,
        ...(startLocationMarker ? [startLocationMarker] : []),
        ...visitLocations
    ];

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

    if (loading) {
        return <MapLoader message="Đang thiết kế hành trình..." />;
    }

    if (error) return (
        <div className="itinerary-loading" style={{ flexDirection: 'column' }}>
            <h2 style={{ color: '#ef4444' }}>⚠️ Đã xảy ra lỗi</h2>
            <p style={{ color: '#fff' }}>{error}</p>
            <button className="back-btn" onClick={() => navigate('/service')} style={{ marginTop: 20 }}>
                Quay lại trang chọn
            </button>
        </div>
    );

    if (!tourResult) return (
        <div className="itinerary-loading">
            <p style={{ color: '#fff' }}>Không tìm thấy dữ liệu tour.</p>
        </div>
    );

    return (
        <div className="itinerary-page">
            {/* SIDEBAR */}
            <div className="itinerary-sidebar" style={{ width: sidebarWidth }}>
                <div className="resize-handle" onMouseDown={handleMouseDown}></div>
                {/* HEADER */}
                <div className="sidebar-header">
                    <div className="header-top-row">
                        <button
                            className="back-btn-icon"
                            onClick={() => navigate('/service')}
                            title="Quay lại chỉnh sửa"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M19 12H5M12 19l-7-7 7-7" />
                            </svg>
                        </button>

                        <h2 className="header-title">HÀNH TRÌNH CỦA BẠN</h2>

                        {/* NÚT LƯU TOUR */}
                        <button
                            className="save-btn-icon"
                            onClick={onSaveIconClick}
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
                                            <img src={item.imageUrl} alt={item.name} className="timeline-thumb" />
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

            <Popup
                show={popup.show}
                message={popup.message}
                onClose={closePopup}
            />

            {showNameModal && (
                <div className="name-modal-overlay">
                    <div className="name-modal-content">
                        <h3>Đặt tên cho hành trình</h3>
                        <p>Hãy đặt một cái tên dễ nhớ để lưu lại kỷ niệm này nhé!</p>
                        <input
                            type="text"
                            className="tour-name-input"
                            value={customTourName}
                            onChange={(e) => setCustomTourName(e.target.value)}
                            placeholder="VD: Chuyến đi Đà Lạt 2026..."
                            autoFocus
                        />
                        <div className="name-modal-actions">
                            <button className="cancel-btn" onClick={() => setShowNameModal(false)}>Hủy</button>
                            <button className="confirm-btn" onClick={handleConfirmSave}>Lưu hành trình</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
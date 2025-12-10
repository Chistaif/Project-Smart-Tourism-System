import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { attractionsAPI, tourPackageAPI } from '../utils/api';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import './Service.css';

import Popup from '../components/Popup';

const TYPE_OPTIONS = [
    { label: 'Lễ hội', value: 'Lễ hội' },
    { label: 'Di tích', value: 'Di tích' },
    { label: 'Bảo tàng', value: 'Bảo tàng' },
    { label: 'Làng nghề', value: 'Làng nghề' },
    { label: 'Đền / Chùa', value: 'Đền/Chùa' },
    { label: 'Thiên nhiên', value: 'Thiên nhiên' },
];

const initialSelectedTypes = [];

export default function Service({ currentUser }) {

    const [popup, setPopup] = useState({ show: false, message: "" });

    const showPopup = (msg) => {
        setPopup({ show: true, message: msg });
    };

    const closePopup = () => {
        setPopup({ show: false, message: "" });
    };

    const navigate = useNavigate();

    // --- KHÔI PHỤC DỮ LIỆU TỪ SESSION STORAGE ---
    const savedState = useMemo(() => {
        try {
            const saved = sessionStorage.getItem('service_page_draft');
            return saved ? JSON.parse(saved) : null;
        } catch (e) {
            return null;
        }
    }, []);

    // --- STATES ---
    const [searchTerm, setSearchTerm] = useState(savedState?.searchTerm || '');
    const [startPoint, setStartPoint] = useState(savedState?.startPoint || { name: '', lat: null, lon: null });
    const [startDate, setStartDate] = useState(savedState?.startDate || '');
    const [endDate, setEndDate] = useState(savedState?.endDate || '');
    const [selectedTypes, setSelectedTypes] = useState(savedState?.selectedTypes || initialSelectedTypes);
    const [selectedAttractions, setSelectedAttractions] = useState(savedState?.selectedAttractions || []);
    const [tourPackages, setTourPackages] = useState([]);
    const [customInput, setCustomInput] = useState('');
    const [showStartMenu, setShowStartMenu] = useState(false);
    const [isTypingLocation, setIsTypingLocation] = useState(false);
    const [isLocating, setIsLocating] = useState(false);
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);

    // --- AUTO-SAVE EFFECT ---
    useEffect(() => {
        const stateToSave = {
            searchTerm,
            startPoint,
            startDate,
            endDate,
            selectedTypes,
            selectedAttractions
        };
        sessionStorage.setItem('service_page_draft', JSON.stringify(stateToSave));
    }, [searchTerm, startPoint, startDate, endDate, selectedTypes, selectedAttractions]);

    // --- DEBOUNCE SEARCH ---
    useEffect(() => {
        if (!customInput || customInput.trim().length < 3) return;

        const timerId = setTimeout(async () => {
            console.log("Đang tự động tìm kiếm cho:", customInput);
            try {
                const response = await fetch(
                    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(customInput)}&limit=1&addressdetails=1&countrycodes=vn`
                );
                const data = await response.json();

                if (data && data.length > 0) {
                    const result = data[0];
                    setStartPoint(prev => ({
                        ...prev,
                        lat: parseFloat(result.lat),
                        lon: parseFloat(result.lon),
                    }));
                }
            } catch (error) {
                console.error("Lỗi tìm kiếm tự động:", error);
            }
        }, 1200);

        return () => clearTimeout(timerId);
    }, [customInput]);

    // 1. Lưu vị trí cuộn khi rời khỏi trang
    

    // 2. Khôi phục vị trí cuộn sau khi dữ liệu đã tải xong
    

    // --- FETCH DATA ---
    const fetchInitialData = useCallback(async () => {
        try {
            setLoading(true);

            // 1. Fetch tất cả các gói tour đã định nghĩa
            const packageResponse = await tourPackageAPI.getAll();
            setTourPackages(packageResponse.data || []);

            // 2. Fetch dữ liệu chung
            const attractionResponse = await attractionsAPI.search({ userId: currentUser?.user_id });
            setData(attractionResponse.data || []);

        } catch (err) {
            console.error("Lỗi tải dữ liệu khởi tạo:", err);
        } finally {
            setLoading(false);
        }
    }, [currentUser]);

    const fetchAttractions = useCallback(async (params = {}) => {
        try {
            setLoading(true);
            const typeListParam = (params.typeList && params.typeList.length > 0)
                ? params.typeList.join(',')
                : '';

            const response = await attractionsAPI.search({
                ...params,
                // currentUser?.user_id là dependency
                userId: currentUser?.user_id,
                typeList: typeListParam
            });

            if (response.success) {
                let results = response.data || [];
                setData(results);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [currentUser]);

    useEffect(() => {
        const isFilteringActive = selectedTypes.length > 0 || searchTerm.trim() !== '';

        if (!isFilteringActive) {
            fetchInitialData();
        } else {
            fetchAttractions({
                typeList: selectedTypes,
                searchTerm
            });
        }
    }, [selectedTypes, searchTerm, currentUser, fetchAttractions, fetchInitialData]);

    const handleSearch = () => {
        const params = { searchTerm: searchTerm.trim() };
        fetchAttractions(params);
    }

    // --- LOCATION LOGIC ---
    const handleGetCurrentLocation = () => {
        if (!navigator.geolocation) {
            showPopup("Trình duyệt của bạn không hỗ trợ định vị.");
            return;
        }

        setIsLocating(true);
        setShowStartMenu(false);
        setIsTypingLocation(false);

        const options = {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        };

        const success = async (position) => {
            const { latitude, longitude } = position.coords;
            try {
                const res = await fetch(
                    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
                    { headers: { 'Accept-Language': 'vi-VN' } }
                );
                const data = await res.json();
                const addr = data.address || {};
                const displayName = addr.road
                    ? `${addr.road}, ${addr.suburb || addr.quarter || addr.city_district || addr.city}`
                    : (data.display_name ? data.display_name.split(',')[0] : "Vị trí của bạn");

                setStartPoint({ name: displayName, lat: latitude, lon: longitude });
            } catch (error) {
                setStartPoint({ name: `Vị trí GPS (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`, lat: latitude, lon: longitude });
            } finally {
                setIsLocating(false);
            }
        };

        const error = (err) => {
            console.error(err);
            setIsLocating(false);
            switch (err.code) {
                case err.PERMISSION_DENIED: showPopup("Bạn đã từ chối quyền truy cập vị trí."); break;
                case err.POSITION_UNAVAILABLE: showPopup("Không thể xác định vị trí hiện tại."); break;
                case err.TIMEOUT: showPopup("Quá thời gian chờ lấy vị trí."); break;
                default: showPopup("Lỗi định vị không xác định.");
            }
        };

        navigator.geolocation.getCurrentPosition(success, error, options);
    };

    const handleSelectCustom = () => {
        setShowStartMenu(false);
        setIsTypingLocation(true);
        setCustomInput('');
    };

    const handleCustomLocationBlur = async () => {
        if (!customInput.trim()) {
            setIsTypingLocation(false);
            return;
        }
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(customInput)}&limit=1`
            );
            const data = await response.json();

            if (data && data.length > 0) {
                const result = data[0];
                setStartPoint({
                    name: result.display_name,
                    lat: parseFloat(result.lat),
                    lon: parseFloat(result.lon)
                });
            } else {
                showPopup("Không tìm thấy địa điểm này. Vui lòng nhập cụ thể hơn.");
                setStartPoint({ name: customInput, lat: null, lon: null });
            }
        } catch (error) {
            console.error("Lỗi tìm kiếm địa chỉ:", error);
        } finally {
            setIsTypingLocation(false);
        }
    };

    // --- HELPER FUNCTIONS ---
    const formatDateLocal = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const parseDateString = (dateStr) => {
        if (!dateStr) return null;
        const currentYear = new Date().getFullYear();
        const cleanStr = dateStr.split(" ")[0];
        const parts = cleanStr.split("/");
        if (parts.length >= 2) {
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1;
            const date = new Date(currentYear, month, day);
            date.setHours(0, 0, 0, 0);
            return date;
        }
        return null;
    };

    const validateDateConstraints = (start, end, attractions) => {
        if (!start && !end) return true;
        const startDateObj = start ? new Date(start) : null;
        const endDateObj = end ? new Date(end) : null;

        // 1. Ngày đi <= Ngày về
        if (startDateObj && endDateObj && startDateObj > endDateObj) {
            showPopup("Thời gian đi phải sớm hơn hoặc bằng thời gian về!");
            return false;
        }

        // 2. Logic ràng buộc Lễ hội
        for (const attr of attractions) {
            // Bỏ qua các điểm mở quanh năm
            const isYearRound = attr.datetimeStart === "12/1" && attr.datetimeEnd === "31/12";
            if (isYearRound) continue;

            // Parse ngày lễ hội (Mặc định lấy năm hiện tại khi parse)
            const festivalStart = parseDateString(attr.datetimeStart);
            const festivalEnd = parseDateString(attr.datetimeEnd);

            if (!festivalStart || !festivalEnd) continue;

            // Nếu người dùng chọn năm đi
            if (startDateObj) {
                const tripYear = startDateObj.getFullYear();

                // Gán năm chuyến đi vào năm lễ hội để so sánh
                festivalStart.setFullYear(tripYear);
                festivalEnd.setFullYear(tripYear);

                if (startDateObj > festivalEnd) {
                    festivalStart.setFullYear(tripYear + 1);
                    festivalEnd.setFullYear(tripYear + 1);
                }
            }

            // Kiểm tra 1: Ngày đi có trễ hơn ngày kết thúc lễ hội (của đợt phù hợp nhất) không?
            if (startDateObj && startDateObj > festivalEnd) {
                showPopup(
                    `Lỗi:\nBạn chọn khởi hành ngày ${formatDateLocal(startDateObj)}, nhưng ${attr.name} đã kết thúc vào ${formatDateLocal(festivalEnd)}.`
                );

                return false;
            }

            // Kiểm tra 2: Ngày về có sớm hơn ngày bắt đầu lễ hội không?
            if (endDateObj && endDateObj < festivalStart) {
                showPopup(
                    `Lưu ý:\nBạn chọn về ngày ${formatDateLocal(endDateObj)}, nhưng ${attr.name} đến ngày ${formatDateLocal(festivalStart)} mới bắt đầu.\nNếu bạn muốn tham gia lễ hội, hãy chọn ngày trong khoảng thời gian đó.`
                );

                return false;
            }
        }
        return true;
    };

    // --- HANDLERS (DatePicker) ---
    const handleStartDateChange = (date) => {
        const newStartStr = date ? formatDateLocal(date) : '';
        const isValid = validateDateConstraints(newStartStr, endDate, selectedAttractions);

        if (isValid) {
            setStartDate(newStartStr);
            if (endDate && newStartStr > endDate) setEndDate('');
        }
    };

    const handleEndDateChange = (date) => {
        const newEndStr = date ? formatDateLocal(date) : '';
        const isValid = validateDateConstraints(startDate, newEndStr, selectedAttractions);

        if (isValid) setEndDate(newEndStr);
    };

    const updateDatesBasedOnAllAttractions = (attractions) => {
        if (attractions.length === 0) {
            setStartDate('');
            setEndDate('');
            return;
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStr = formatDateLocal(today);

        let currentStart = startDate;
        if (!currentStart) {
            currentStart = todayStr;
            setStartDate(todayStr);
        }

        let minEventStart = null;
        let maxEventEnd = null;
        let hasEvent = false;

        attractions.forEach(attr => {
            const isYearRound = attr.datetimeStart === "12/1" && attr.datetimeEnd === "31/12";
            if (!isYearRound && attr.datetimeStart && attr.datetimeEnd) {
                hasEvent = true;
                let start = parseDateString(attr.datetimeStart);
                let end = parseDateString(attr.datetimeEnd);

                if (start && end) {
                    const startYear = currentStart ? new Date(currentStart).getFullYear() : today.getFullYear();
                    if (startYear > end.getFullYear()) {
                        start.setFullYear(startYear);
                        end.setFullYear(startYear);
                    } else if (end < today) {
                        start.setFullYear(startYear + 1);
                        end.setFullYear(startYear + 1);
                    }
                    if (!minEventStart || start < minEventStart) minEventStart = start;
                    if (!maxEventEnd || end > maxEventEnd) maxEventEnd = end;
                }
            }
        });

        if (hasEvent && minEventStart && maxEventEnd) {
            setStartDate(formatDateLocal(minEventStart));
            setEndDate(formatDateLocal(maxEventEnd));
        } else {
            const daysToAdd = Math.max(1, attractions.length);

            const startObj = startDate ? new Date(startDate) : new Date(today);
            const newEndObj = new Date(startObj);

            newEndObj.setDate(newEndObj.getDate() + daysToAdd);

            setEndDate(formatDateLocal(newEndObj));
        }
    };

    const handleToggleSelect = async (item) => {
        const isTourPackage = item.isPackage;

        // 1. Xác định danh sách ID cần kiểm tra
        const packageAttractionIds = isTourPackage ? (item.attractionIds || []) : [item.id];

        // 2. Kiểm tra trạng thái hiện tại dựa trên logic "ALL"
        const isFullySelected = packageAttractionIds.every(id =>
            selectedAttractions.some(p => p.id === id)
        );

        // --- TRƯỜNG HỢP 1: ĐÃ CHỌN HẾT -> HỦY CHỌN ---
        if (isFullySelected) {
            setSelectedAttractions(prev => {
                // Xóa tất cả các ID liên quan khỏi danh sách
                const newSelection = prev.filter(p => !packageAttractionIds.includes(p.id));
                updateDatesBasedOnAllAttractions(newSelection);
                return newSelection;
            });
            return;
        }

        // --- TRƯỜNG HỢP 2: CHƯA CHỌN HOẶC CHỌN THIẾU -> CHỌN THÊM ---

        // A. Nếu là Gói Tour
        if (isTourPackage) {
            setLoading(true);
            try {
                const idsParam = packageAttractionIds.join(',');

                const response = await attractionsAPI.search({ attractionIds: idsParam });

                if (response.success && response.data) {
                    const fetchedAttractions = response.data.map(attr => ({
                        id: attr.id,
                        name: attr.name,
                        lat: attr.lat,
                        lon: attr.lon,
                        imageUrl: attr.imageUrl || attr.image_url,
                        averageRating: attr.averageRating
                    }));

                    setSelectedAttractions(prev => {
                        // Tránh trùng lặp
                        const currentIds = new Set(prev.map(p => p.id));

                        // Chỉ thêm những cái chưa có
                        const toAdd = fetchedAttractions.filter(attr => !currentIds.has(attr.id));

                        const finalSelection = [...prev, ...toAdd];
                        updateDatesBasedOnAllAttractions(finalSelection);
                        return finalSelection;
                    });
                }
            } catch (error) {
                showPopup("Lỗi khi tải chi tiết gói tour.");
            } finally {
                setLoading(false);
            }
        }
        // B. Nếu là Địa điểm đơn lẻ
        else {
            setSelectedAttractions(prev => {
                const newSelection = [...prev, item];
                updateDatesBasedOnAllAttractions(newSelection);
                return newSelection;
            });
        }
    };

    const handleTypeToggle = (val) => {
        setSelectedTypes(prev => prev.includes(val) ? prev.filter(t => t !== val) : [...prev, val]);
    };

    const handleCreateTour = () => {
        if (selectedAttractions.length === 0) return showPopup("Vui lòng chọn ít nhất 1 địa điểm!");
        if (!startPoint.lat || !startPoint.lon) return showPopup("Vui lòng chọn điểm xuất phát hợp lệ!");

        if (!validateDateConstraints(startDate, endDate, selectedAttractions)) {
            return;
        }

        navigate('/itinerary', {
            state: {
                selectedAttractions,
                startPoint,
                startDate,
                endDate
            }
        });
    };

    const renderCardStars = (rating) => {
        const score = rating || 0;
        const roundedScore = Math.round(score);

        return (
            <div className="dest-rating" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ color: '#fff', fontWeight: '600', fontSize: '0.9rem' }}>
                    {score > 0 ? score.toFixed(1) : "Chưa có"}
                </span>

                <span style={{ color: '#FFD700', fontSize: '1rem' }}>
                    {'★'.repeat(roundedScore)}
                </span>

                <span style={{ color: '#fff', opacity: 0.3, fontSize: '1rem' }}>
                    {'★'.repeat(5 - roundedScore)}
                </span>
            </div>
        );
    };

    const isSelected = (item) => {
        // Nếu là Attraction đơn lẻ
        if (!item.isPackage) {
            return selectedAttractions.some(p => p.id === item.id);
        }

        // Nếu là Gói Tour
        const idsToCheck = item.attractionIds || [];
        if (idsToCheck.length === 0) return false;

        return idsToCheck.every(id => selectedAttractions.some(p => p.id === id));
    };

    const isFiltering = useMemo(() => {
        return selectedTypes.length > 0 || searchTerm.trim() !== '';
    }, [selectedTypes, searchTerm]);

    const mustVisitPlaces = useMemo(() => data.slice(0, 10), [data]);
    const suitableSuggestions = useMemo(() => data.slice(10), [data]);

    const renderAttractionCard = (item) => {
        const isPackage = item.isPackage;
        const imageSrc = item.coverImageUrl || item.imageUrl || item.image_url;
        const navigationPath = isPackage ? `/package/${item.id}` : `/attractions/${item.id}`;

        return (
            <div key={item.id} className="dest-card">
                <div
                    className={`card-select-btn ${isSelected(item) ? 'active' : ''}`}
                    onClick={(e) => { e.stopPropagation(); handleToggleSelect(item); }}
                    title={isSelected(item) ? "Bỏ chọn" : "Thêm vào lịch trình"}
                >
                    {isSelected(item) ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                    )}
                </div>
                <div className="card-nav-action" onClick={() => navigate(navigationPath)}>
                    <img src={imageSrc} alt={item.name} className="dest-img" />
                    <div className="dest-overlay">
                        {isPackage && (
                            <span className="package-tag">
                                {item.attractionIds ? item.attractionIds.length : 0} địa điểm
                            </span>
                        )}
                        <div className="dest-name">{item.name}</div>
                        {renderCardStars(item.averageRating || item.average_rating)}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="service-page">
            <div className="service-hero">
                <div className="hero-container">
                    <h1>Kiến tạo hành trình văn hóa của riêng bạn</h1>

                    <div className="hero-search-section">
                        <div className="start-point-box">
                            <span className="start-label-icon">
                                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                                    <circle cx="12" cy="10" r="3"></circle>
                                </svg>
                            </span>

                            {isTypingLocation ? (
                                <input
                                    type="text"
                                    className="custom-location-input"
                                    placeholder="Nhập địa chỉ..."
                                    autoFocus
                                    value={customInput}
                                    onChange={(e) => setCustomInput(e.target.value)}
                                    onBlur={handleCustomLocationBlur}
                                    onKeyDown={(e) => e.key === 'Enter' && handleCustomLocationBlur()}
                                />
                            ) : (
                                <button
                                    className="start-display-btn"
                                    onClick={() => setShowStartMenu(!showStartMenu)}
                                >
                                    {isLocating ? "Đang định vị..." : (startPoint.name || "Chọn xuất phát điểm")}
                                    <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>▼</span>
                                </button>
                            )}

                            {showStartMenu && (
                                <div className="start-options-dropdown">
                                    <div className="start-option-item" onClick={handleGetCurrentLocation}>
                                        <span>◎ Vị trí hiện tại của bạn</span>
                                        <small>GPS</small>
                                    </div>
                                    <div className="start-option-item" onClick={handleSelectCustom}>
                                        <span>✎ Vị trí tùy ý</span>
                                        <small>Nhập tay</small>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="main-search-box">
                            <div className="search-icon-wrapper">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </div>

                            <input
                                type="text"
                                className="search-input-field"
                                placeholder="Bạn muốn đi đâu?"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}

                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        handleSearch();
                                    }
                                }}
                            />
                            <button className="search-action-btn" onClick={handleSearch}>Tìm kiếm</button>
                        </div>
                    </div>

                    <div className="route-info-line">
                        <span style={{ color: '#ffffff' }}>Từ:</span>
                        {startPoint.name ? (
                            <span className="route-tag" style={{ borderColor: '#22c55e', color: '#22c55e' }}>
                                {startPoint.name}
                            </span>
                        ) : (
                            <span style={{ fontStyle: 'italic', opacity: 0.7, marginLeft: '5px', color: '#ffffff' }}>[Chưa có]</span>
                        )}

                        <span style={{ marginLeft: '10px', color: '#ffffff' }}>Đến:</span>
                        {selectedAttractions.length > 0 ? (
                            selectedAttractions.map(attr => (
                                <span
                                    key={attr.id}
                                    className="route-tag"
                                    style={{
                                        backgroundColor: '#ef4444',
                                        borderColor: '#b91c1c',
                                        color: '#000000',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        fontWeight: '600'
                                    }}
                                >
                                    {attr.name}
                                    <span
                                        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#000', opacity: 0.7 }}
                                        onClick={(e) => { e.stopPropagation(); handleToggleSelect(attr); }}
                                        title="Xóa địa điểm này"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                                            <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z" />
                                            <path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z" />
                                        </svg>
                                    </span>
                                </span>
                            ))
                        ) : (
                            <span style={{ fontStyle: 'italic', opacity: 0.7, marginLeft: '5px', color: '#ffffff' }}>[Chưa có]</span>
                        )}
                    </div>

                    <div className="date-picker-row">
                        <span style={{ fontWeight: 600, color: '#94a3b8' }}>Ngày đi:</span>
                        <div className="date-display custom-datepicker-wrapper">
                            <DatePicker
                                selected={startDate ? new Date(startDate) : null}
                                onChange={handleStartDateChange}
                                minDate={new Date()}
                                dateFormat="dd/MM/yyyy"
                                placeholderText="dd/mm/yyyy"
                                className="date-input-hidden"
                                onKeyDown={(e) => e.preventDefault()}
                                portalId="root"
                                popperClassName="datepicker-on-top"
                            />

                            <span style={{ margin: '0 8px' }}>-</span>

                            <DatePicker
                                selected={endDate ? new Date(endDate) : null}
                                onChange={handleEndDateChange}
                                minDate={startDate ? new Date(startDate) : new Date()}
                                dateFormat="dd/MM/yyyy"
                                placeholderText="dd/mm/yyyy"
                                disabled={!startDate}
                                className="date-input-hidden"
                                onKeyDown={(e) => e.preventDefault()}
                                portalId="root"
                                popperClassName="datepicker-on-top"
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="service-body-container">
                <aside className="sidebar">
                    <div className="filter-box">
                        <h3>Loại hình điểm đến</h3>
                        <div className="type-list">
                            {TYPE_OPTIONS.map(t => (
                                <label key={t.value} className="checkbox-item">
                                    <input
                                        type="checkbox"
                                        checked={selectedTypes.includes(t.value)}
                                        onChange={() => handleTypeToggle(t.value)}
                                    />
                                    {t.label}
                                </label>
                            ))}
                        </div>
                    </div>
                    <button className="btn-view-tour" onClick={handleCreateTour}>
                        Xem lịch trình gợi ý
                    </button>
                </aside>

                <main className="main-content">
                    {isFiltering ? (
                        <>
                            <h2 className="section-title">Các địa điểm phù hợp</h2>
                            <div className="slider-container">
                                {data.length > 0 ? (
                                    data.map(item => renderAttractionCard(item))
                                ) : (
                                    <p style={{ color: '#94a3b8', paddingLeft: '10px', fontStyle: 'italic' }}>
                                        Không tìm thấy địa điểm nào phù hợp.
                                    </p>
                                )}
                            </div>
                        </>
                    ) : (
                        <>
                            {tourPackages.length > 0 && (
                                <>
                                    <h2 className="section-title">TOUR THEO CHỦ ĐỀ</h2>
                                    <div className="slider-container">
                                        {tourPackages.map(item => renderAttractionCard(item))}
                                    </div>
                                </>
                            )}
                            <h2 className="section-title" style={{ marginTop: '40px' }}>CÁC ĐỊA ĐIỂM KHÔNG THỂ BỎ QUA</h2>
                            <div className="slider-container">
                                {mustVisitPlaces.map(item => renderAttractionCard(item))}
                            </div>
                            {suitableSuggestions.length > 0 && (
                                <>
                                    <h2 className="section-title" style={{ marginTop: '40px' }}>CÁC GỢI Ý PHÙ HỢP KHÁC</h2>
                                    <div className="slider-container">
                                        {suitableSuggestions.map(item => renderAttractionCard(item))}
                                    </div>
                                </>
                            )}
                        </>
                    )}
                </main>
            </div>

            <Popup
                show={popup.show}
                message={popup.message}
                onClose={closePopup}
            />

        </div>
    );
}
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { attractionsAPI } from '../utils/api';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css"; 
import './Service.css';

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
  const navigate = useNavigate();

  // --- KHÔI PHỤC DỮ LIỆU TỪ LOCAL STORAGE ---
  const savedState = useMemo(() => {
      try {
          const saved = localStorage.getItem('service_page_draft');
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
      localStorage.setItem('service_page_draft', JSON.stringify(stateToSave));
  }, [searchTerm, startPoint, startDate, endDate, selectedTypes, selectedAttractions]);

  // --- FETCH DATA ---
  const fetchAttractions = async (params = {}) => {
    try {
        setLoading(true);
        const typeListParam = (params.typeList && params.typeList.length > 0) 
            ? params.typeList.join(',') 
            : '';

        const response = await attractionsAPI.search({
            ...params,
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
  };

  useEffect(() => {
    fetchAttractions(); 
  }, [currentUser]); 
  
  useEffect(() => {
    fetchAttractions({
        typeList: selectedTypes,
        searchTerm
    });
  }, [selectedTypes, searchTerm]);

  const handleSearch = () => {
    const params = { searchTerm: searchTerm.trim() };
    fetchAttractions(params); 
  };

  // --- LOCATION LOGIC ---
  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert("Trình duyệt của bạn không hỗ trợ định vị.");
      return;
    }
    setIsLocating(true);
    setShowStartMenu(false);
    setIsTypingLocation(false);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
          const data = await res.json();
          const displayName = data.address.city || data.address.town || data.address.road || "Không xác định được";
          setStartPoint({ name: displayName, lat: latitude, lon: longitude });
        } catch (error) {
          console.error("Lỗi lấy tên vị trí:", error);
          setStartPoint({ name: "Vị trí hiện tại (GPS)", lat: latitude, lon: longitude });
        } finally {
          setIsLocating(false);
        }
      },
      (error) => {
        console.error(error);
        alert("Không thể lấy vị trí. Vui lòng kiểm tra quyền truy cập vị trí.");
        setIsLocating(false);
      }
    );
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
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(customInput)}&limit=1`);
        const data = await res.json();
        if (data && data.length > 0) {
            setStartPoint({ name: customInput, lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) });
        } else {
            setStartPoint({ name: customInput, lat: null, lon: null });
        }
    } catch (e) { console.error(e); }
    setIsTypingLocation(false);
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

  // --- VALIDATION LOGIC ---
  const validateDateConstraints = (start, end, attractions) => {
    if (!start && !end) return true;
    const startDateObj = start ? new Date(start) : null;
    const endDateObj = end ? new Date(end) : null;

    // 1. Ngày đi <= Ngày về
    if (startDateObj && endDateObj && startDateObj > endDateObj) {
        alert("Thời gian đi phải sớm hơn hoặc bằng thời gian về!");
        return false;
    }

    // 2. Logic ràng buộc Lễ hội
    for (const attr of attractions) {
        const isYearRound = attr.datetimeStart === "12/1" && attr.datetimeEnd === "31/12";
        if (isYearRound) continue;

        // Lấy ngày bắt đầu/kết thúc từ dữ liệu (mặc định năm hiện tại)
        const festivalStart = parseDateString(attr.datetimeStart);
        const festivalEnd = parseDateString(attr.datetimeEnd);

        if (!festivalStart || !festivalEnd) continue;

        // Logic đồng bộ năm
        if (startDateObj && startDateObj.getFullYear() > festivalStart.getFullYear()) {
            const yearDiff = startDateObj.getFullYear() - festivalStart.getFullYear();
            festivalStart.setFullYear(festivalStart.getFullYear() + yearDiff);
            festivalEnd.setFullYear(festivalEnd.getFullYear() + yearDiff);
        }

        // Kiểm tra: Ngày đi không được trễ hơn ngày kết thúc lễ hội
        if (startDateObj && startDateObj > festivalEnd) {
            alert(`Lỗi: Thời gian đi (${formatDateLocal(startDateObj)}) trễ hơn ngày kết thúc của ${attr.name} (${formatDateLocal(festivalEnd)}).`);
            return false;
        }

        // Kiểm tra: Ngày về không được sớm hơn ngày bắt đầu lễ hội
        if (endDateObj && endDateObj < festivalStart) {
            alert(`Lỗi: Thời gian về (${formatDateLocal(endDateObj)}) sớm hơn ngày bắt đầu của ${attr.name} (${formatDateLocal(festivalStart)}).`);
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

  // --- Logic tự động cập nhật ngày ---
  const updateDatesBasedOnAllAttractions = (attractions) => {
    if (attractions.length === 0) {
        setStartDate(''); 
        setEndDate('');
        return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = formatDateLocal(today);
    const currentYear = today.getFullYear();

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
        
        if (!isYearRound) {
            hasEvent = true;
            let start = parseDateString(attr.datetimeStart);
            let end = parseDateString(attr.datetimeEnd);

            if (start && end) {
                const startYear = currentStart ? new Date(currentStart).getFullYear() : currentYear;
                
                if (startYear > end.getFullYear()) {
                     start.setFullYear(startYear);
                     end.setFullYear(startYear);
                } else if (end < today) {
                     start.setFullYear(currentYear + 1);
                     end.setFullYear(currentYear + 1);
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
        if (!startDate) setStartDate(todayStr);
        if (!endDate) {
            const startObj = startDate ? new Date(startDate) : new Date(today);
            const defaultEnd = new Date(startObj);
            defaultEnd.setDate(defaultEnd.getDate() + 2);
            setEndDate(formatDateLocal(defaultEnd));
        }
    }
  };

  const handleToggleSelect = (item) => {
    setSelectedAttractions(prev => {
      const exists = prev.find(i => i.id === item.id);
      let newSelection;
      
      if (exists) {
          newSelection = prev.filter(i => i.id !== item.id);
      } else {
          newSelection = [...prev, item];
      }
      
      updateDatesBasedOnAllAttractions(newSelection);
      return newSelection;
    });
  };

  const handleTypeToggle = (val) => {
    setSelectedTypes(prev => prev.includes(val) ? prev.filter(t => t !== val) : [...prev, val]);
  };
  
  // --- [MODIFIED] CREATE TOUR HANDLER ---
  const handleCreateTour = () => {
     if(selectedAttractions.length === 0) return alert("Vui lòng chọn ít nhất 1 địa điểm!");
     if(!startPoint.lat || !startPoint.lon) return alert("Vui lòng chọn điểm xuất phát hợp lệ!");

     if (!validateDateConstraints(startDate, endDate, selectedAttractions)) {
         return;
     }

     // Thay vì fetch API trực tiếp, chuyển hướng sang trang Itinerary
     navigate('/itinerary', { 
        state: { 
            selectedAttractions,
            startPoint,
            startDate, // format: YYYY-MM-DD
            endDate    // format: YYYY-MM-DD
        } 
     });
  };

  const renderCardStars = (rating) => {
    const score = rating || 0; 
    const roundedScore = Math.round(score);
    return (
      <div className="dest-rating">
        <span style={{color: '#fff', marginRight: '2px'}}>{score > 0 ? score.toFixed(1) : "N/A"}</span>
        <span>{'★'.repeat(roundedScore)}</span>
        <span style={{opacity: 0.3}}>{'★'.repeat(5 - roundedScore)}</span>
      </div>
    );
  };

  // --- RENDER ---
  const isSelected = (id) => selectedAttractions.find(i => i.id === id);

  const isFiltering = useMemo(() => {
      return selectedTypes.length > 0 || searchTerm.trim() !== '';
  }, [selectedTypes, searchTerm]);

  const mustVisitPlaces = useMemo(() => data.slice(0, 10), [data]); 
  const suitableSuggestions = useMemo(() => data.slice(10), [data]);

  const renderAttractionCard = (item) => (
    <div key={item.id} className="dest-card">
        <div 
            className={`card-select-btn ${isSelected(item.id) ? 'active' : ''}`}
            onClick={(e) => { e.stopPropagation(); handleToggleSelect(item); }}
            title={isSelected(item.id) ? "Bỏ chọn" : "Thêm vào lịch trình"}
        >
            {isSelected(item.id) ? (
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
        <div className="card-nav-action" onClick={() => navigate(`/attractions/${item.id}`)}>
            <img src={item.imageUrl || item.image_url} alt={item.name} className="dest-img" />
            <div className="dest-overlay">
                <div className="dest-name">{item.name}</div>
                {renderCardStars(item.averageRating || item.average_rating)} 
            </div>
        </div>
    </div>
  );

  return (
    <div className="service-page">
      <div className="service-hero">
        <div className="hero-container">
          <h1>Kiến tạo hành trình văn hóa của riêng bạn</h1>
          
          <div className="hero-search-section">
            
            {/* 1. KHỐI XUẤT PHÁT ĐIỂM */}
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
                        <span style={{fontSize:'0.8rem', opacity:0.7}}>▼</span>
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

            {/* 2. KHỐI TÌM KIẾM */}
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
                />
                <button className="search-action-btn" onClick={handleSearch}>Tìm kiếm</button>
            </div>
          </div>

          {/* ROUTE INFO LINE */}
          <div className="route-info-line">
             <span style={{color: '#ffffff'}}>Từ:</span>
             {startPoint.name ? (
                <span className="route-tag" style={{borderColor: '#22c55e', color: '#22c55e'}}>
                    📍 {startPoint.name}
                </span>
             ) : (
                <span style={{fontStyle:'italic', opacity:0.7, marginLeft:'5px', color: '#ffffff'}}>[Chưa có]</span>
             )}

             <span style={{marginLeft: '10px', color: '#ffffff'}}>Đến:</span>
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
                            style={{cursor:'pointer', display: 'flex', alignItems: 'center', color: '#000', opacity: 0.7}} 
                            onClick={(e) => { e.stopPropagation(); handleToggleSelect(attr); }}
                            title="Xóa địa điểm này"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                                <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                                <path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                            </svg>
                        </span>
                     </span>
                 ))
             ) : (
                 <span style={{fontStyle:'italic', opacity:0.7, marginLeft:'5px', color: '#ffffff'}}>[Chưa có]</span>
             )}
          </div>

          <div className="date-picker-row">
            <span style={{fontWeight:600, color:'#94a3b8'}}>Ngày đi:</span>
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
                
                <span style={{margin:'0 8px'}}>-</span>
                
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
        
        {/* SIDEBAR TRÁI */}
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

        {/* CONTENT PHẢI */}
        <main className="main-content">
            {isFiltering ? (
                <>
                    <h2 className="section-title">Các địa điểm phù hợp</h2>
                    <div className="slider-container">
                        {data.length > 0 ? (
                            data.map(item => renderAttractionCard(item))
                        ) : (
                            <p style={{color: '#94a3b8', paddingLeft: '10px', fontStyle:'italic'}}>
                                Không tìm thấy địa điểm nào phù hợp.
                            </p>
                        )}
                    </div>
                </>
            ) : (
                <>
                    <h2 className="section-title">Các địa điểm không thể bỏ qua</h2>
                    <div className="slider-container">
                        {mustVisitPlaces.map(item => renderAttractionCard(item))}
                    </div>

                    <h2 className="section-title" style={{marginTop: '40px'}}>Các gợi ý phù hợp</h2>
                    <div className="slider-container">
                        {suitableSuggestions.length > 0 ? (
                            suitableSuggestions.map(item => renderAttractionCard(item))
                        ) : (
                            <p style={{color: '#94a3b8', paddingLeft: '10px', fontStyle:'italic'}}>
                                Không có gợi ý phù hợp nào khác.
                            </p>
                        )}
                    </div>
                </>
            )}
        </main>
      </div>
    </div>
  );
}
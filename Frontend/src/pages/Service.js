/* Service.js */
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { attractionsAPI } from '../utils/api';
import './Service.css';

// --- COMPONENT HIỂN THỊ KẾT QUẢ TOUR (Giữ nguyên) ---
const TourResultView = ({ tourData, onReset }) => {
    if (!tourData) return null;
    return (
        <div className="tour-result-container" style={{backgroundColor: '#0f172a'}}> 
             <div className="tour-header">
                <button onClick={onReset} className="back-btn">← Quay lại</button>
                <h2 style={{color: '#60a5fa', textTransform: 'uppercase'}}>Lịch trình gợi ý</h2>
            </div>
            <div className="tour-content-layout">
                <div className="timeline-column">
                    {tourData.timeline.map((item, index) => (
                         <div key={index} className="timeline-item">
                            <div className="time-badge">{item.time}</div>
                            <div className="timeline-content">
                                <div className="timeline-card">
                                    <h4>{item.name}</h4>
                                    <p>{item.detail}</p>
                                </div>
                            </div>
                         </div>
                    ))}
                </div>
                <div className="map-column">
                     <div dangerouslySetInnerHTML={{ __html: tourData.mapHtml }} style={{height: '100%'}} />
                </div>
            </div>
        </div>
    )
};

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
  
  // --- STATES ---
  const [searchTerm, setSearchTerm] = useState('');
  const [startPoint, setStartPoint] = useState({ name: '', lat: null, lon: null });
  const [customInput, setCustomInput] = useState(''); 
  const [showStartMenu, setShowStartMenu] = useState(false); 
  const [isTypingLocation, setIsTypingLocation] = useState(false); 
  const [isLocating, setIsLocating] = useState(false); 
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedTypes, setSelectedTypes] = useState(initialSelectedTypes); 
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAttractions, setSelectedAttractions] = useState([]);
  const [tourResult, setTourResult] = useState(null);

  // --- LOGIC FETCH DATA ---
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

  // Effects
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
          const displayName = data.address.city || data.address.town || data.address.road || "Vị trí của tôi";
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

  const handleStartDateChange = (e) => {
    const newStart = e.target.value;
    setStartDate(newStart);
    if (endDate && newStart > endDate) {
      setEndDate('');
    }
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

  const handleToggleSelect = (item) => {
    setSelectedAttractions(prev => {
      const exists = prev.find(i => i.id === item.id);
      if (exists) return prev.filter(i => i.id !== item.id);
      return [...prev, item];
    });
  };

  const handleTypeToggle = (val) => {
    setSelectedTypes(prev => prev.includes(val) ? prev.filter(t => t !== val) : [...prev, val]);
  };
  
  const handleCreateTour = async () => {
     if(selectedAttractions.length === 0) return alert("Vui lòng chọn ít nhất 1 địa điểm!");
     if(!startPoint.lat || !startPoint.lon) return alert("Vui lòng chọn điểm xuất phát hợp lệ!");

     const queryParams = new URLSearchParams({
        startLat: startPoint.lat,
        startLon: startPoint.lon,
        startTime: startDate ? `${new Date(startDate).toLocaleDateString('en-GB')} 08:00` : new Date().toLocaleDateString('en-GB') + ' 08:00',
        endTime: endDate ? `${new Date(endDate).toLocaleDateString('en-GB')} 20:00` : new Date(new Date().setDate(new Date().getDate() + 1)).toLocaleDateString('en-GB') + ' 20:00'
     });

    selectedAttractions.forEach(attr => queryParams.append('attractionIds', attr.id));

    try {
        const response = await fetch(`http://localhost:5000/api/quick-tour-creator?${queryParams.toString()}`);
        const result = await response.json();
        if(result.success) {
            setTourResult(result.data);
        } else {
            alert(result.error);
        }
    } catch (error) {
        console.error("Lỗi tạo tour:", error);
        alert("Có lỗi xảy ra khi tạo lịch trình");
    }
  };

  // --- DATA FILTERING VÀ LOGIC MỚI ---
  const isSelected = (id) => selectedAttractions.find(i => i.id === id);

  // Kiểm tra xem có đang filter hoặc search không
  const isFiltering = useMemo(() => {
      return selectedTypes.length > 0 || searchTerm.trim() !== '';
  }, [selectedTypes, searchTerm]);

  // Chia dữ liệu cho chế độ mặc định
  const mustVisitPlaces = useMemo(() => data.slice(0, 10), [data]); 
  const suitableSuggestions = useMemo(() => data.slice(10), [data]);

  // --- HÀM RENDER CARD (Tách ra để dùng chung) ---
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

  if (tourResult) return <TourResultView tourData={tourResult} onReset={() => setTourResult(null)} />;

  return (
    <div className="service-page">
      <div className="service-hero">
        <div className="hero-container">
          <h1>Kiến tạo hành trình văn hóa của riêng bạn</h1>
          
          {/* HERO SEARCH SECTION */}
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

                {/* Dropdown Menu */}
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
             <span>Từ:</span>
             {startPoint.name ? (
                <span className="route-tag" style={{borderColor: '#22c55e', color: '#22c55e'}}>
                    📍 {startPoint.name}
                </span>
             ) : (
                <span style={{fontStyle:'italic', opacity:0.6, marginLeft:'5px'}}>[Chưa có]</span>
             )}
             
             <span style={{marginLeft: '10px'}}>Đến:</span>
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
                 <span style={{fontStyle:'italic', opacity:0.6, marginLeft:'5px'}}>[Chưa có]</span>
             )}
          </div>

          <div className="date-picker-row">
            <span style={{fontWeight:600, color:'#94a3b8'}}>Ngày đi:</span>
            <div className="date-display">
                <input 
                    type="date" 
                    className="date-input-hidden" 
                    value={startDate} 
                    min={new Date().toISOString().split("T")[0]} 
                    onChange={handleStartDateChange} 
                />
                <span style={{margin:'0 8px'}}>-</span>
                <input 
                    type="date" 
                    className="date-input-hidden"
                    value={endDate}
                    min={startDate || new Date().toISOString().split("T")[0]}
                    onChange={e => setEndDate(e.target.value)}
                    disabled={!startDate}
                    style={{ opacity: !startDate ? 0.5 : 1, cursor: !startDate ? 'not-allowed' : 'pointer' }}
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

        {/* CONTENT PHẢI - LOGIC THAY ĐỔI TẠI ĐÂY */}
        <main className="main-content">
            {isFiltering ? (
                // --- TRƯỜNG HỢP CÓ FILTER/SEARCH: HIỂN THỊ 1 LIST DUY NHẤT ---
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
                // --- TRƯỜNG HỢP MẶC ĐỊNH: HIỂN THỊ 2 LIST ---
                <>
                    {/* SECTION 1 */}
                    <h2 className="section-title">Các địa điểm không thể bỏ qua</h2>
                    <div className="slider-container">
                        {mustVisitPlaces.map(item => renderAttractionCard(item))}
                    </div>

                    {/* SECTION 2 */}
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
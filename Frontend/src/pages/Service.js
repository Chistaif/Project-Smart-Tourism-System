/* src/pages/Service.js */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { attractionsAPI } from '../utils/api';
import './Service.css';

const TYPE_OPTIONS = [
  { label: 'Lễ hội', value: 'Lễ hội' },
  { label: 'Di tích', value: 'Di tích' },
  { label: 'Bảo tàng', value: 'Bảo tàng' },
  { label: 'Làng nghề', value: 'Làng nghề' },
  { label: 'Đền / Chùa', value: 'Đền/Chùa' },
  { label: 'Thiên nhiên', value: 'Thiên nhiên' },
];

function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => { setDebouncedValue(value); }, delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

export default function Service({ currentUser }) {
  const navigate = useNavigate();
  
  // --- STATES ---
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 600); 

  const [startPoint, setStartPoint] = useState({ name: '', lat: null, lon: null });
  const [customInput, setCustomInput] = useState('');
  const [showStartMenu, setShowStartMenu] = useState(false); 
  const [isTypingLocation, setIsTypingLocation] = useState(false); 
  
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  const [selectedTypes, setSelectedTypes] = useState([]); 
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedAttractions, setSelectedAttractions] = useState([]);

  // (ĐÃ XÓA: State và Effect xử lý cuộn trang isHeaderVisible)

  // --- API FETCH ---
  const fetchAttractions = useCallback(async (overrideParams = {}) => {
    try {
        setLoading(true);
        const params = {
            userId: currentUser?.user_id,
            typeList: selectedTypes.join(','),
            searchTerm: debouncedSearchTerm, 
            startDate: formatDate(overrideParams.startDate || startDate),
            endDate: formatDate(overrideParams.endDate || endDate),
            ...overrideParams
        };
        const response = await attractionsAPI.search(params);
        if (response.success) setData(response.data || []);
    } catch (err) { console.error(err); } 
    finally { setLoading(false); }
  }, [currentUser, selectedTypes, debouncedSearchTerm, startDate, endDate]);

  const formatDate = (dateStr) => {
    if(!dateStr) return '';
    const d = new Date(dateStr);
    return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`;
  }

  useEffect(() => { fetchAttractions(); }, [selectedTypes, debouncedSearchTerm, currentUser]); 

  // --- HANDLERS ---
  const handleDateChange = (type, value) => {
      let newStart = type === 'start' ? value : startDate;
      let newEnd = type === 'end' ? value : endDate;
      if (newStart && newEnd && newStart > newEnd) {
          if (type === 'start') newEnd = ''; else { alert("Ngày về phải sau ngày đi"); return; }
      }
      if (type === 'start') setStartDate(value);
      if (type === 'end') setEndDate(value);
      fetchAttractions({ startDate: type === 'start' ? value : startDate, endDate: type === 'end' ? value : endDate });
  };

  const toISODate = (d) => {
      if (!d || isNaN(d.getTime())) return '';
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
  };

  const parseItemDate = (dateStr) => {
      if (!dateStr) return null;
      const currentYear = new Date().getFullYear();
      if (dateStr.includes('-')) return new Date(dateStr);
      if (dateStr.includes('/')) {
          const parts = dateStr.split('/');
          if (parts.length >= 2) {
              const d = parseInt(parts[0], 10);
              const m = parseInt(parts[1], 10) - 1; 
              return new Date(currentYear, m, d);
          }
      }
      return null;
  };

  const handleToggleSelect = (item) => {
    const isSelecting = !selectedAttractions.find(i => i.id === item.id);
    let newSelected = isSelecting ? [...selectedAttractions, item] : selectedAttractions.filter(i => i.id !== item.id);
    setSelectedAttractions(newSelected);
    if (!isSelecting) return;

    if (item.type === 'festival') {
        const rawStart = item.timeStart || item.datetimeStart;
        const rawEnd = item.timeEnd || item.datetimeEnd;
        const fStart = parseItemDate(rawStart);
        const fEnd = parseItemDate(rawEnd);
        const today = new Date();
        today.setHours(0,0,0,0); 

        if (fStart && fEnd) {
            if (fEnd < today) { fStart.setFullYear(fStart.getFullYear() + 1); fEnd.setFullYear(fEnd.getFullYear() + 1); }
            const currentStartVal = startDate ? new Date(startDate) : null;
            const currentEndVal = endDate ? new Date(endDate) : null;
            let newStartDate = startDate;
            let newEndDate = endDate;
            let shouldUpdate = false;

            if (!currentStartVal) { newStartDate = toISODate(today); shouldUpdate = true; } 
            else if (currentStartVal > fEnd) { newStartDate = toISODate(fStart); shouldUpdate = true; }

            if (!currentEndVal || currentEndVal < fEnd) { newEndDate = toISODate(fEnd); shouldUpdate = true; }

            if (shouldUpdate) { setStartDate(newStartDate); setEndDate(newEndDate); }
        }
    } else {
        if (!startDate) setStartDate(toISODate(new Date()));
        if (!endDate) { const tmr = new Date(); tmr.setDate(tmr.getDate() + 2); setEndDate(toISODate(tmr)); }
    }
  };

  const handleLocationSearch = async () => {
    if (!customInput.trim()) { setIsTypingLocation(false); return; }
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(customInput)}&limit=1`);
        const d = await res.json();
        if (d && d.length > 0) {
            setStartPoint({ name: customInput, lat: parseFloat(d[0].lat), lon: parseFloat(d[0].lon) });
            setIsTypingLocation(false); 
        } else { alert(`Không tìm thấy địa điểm "${customInput}".`); }
    } catch (e) { alert("Lỗi kết nối bản đồ."); }
  };

  const handleKeyDown = (e) => { if (e.key === 'Enter') handleLocationSearch(); };
  
  const handleGetCurrentLocation = () => {
    setShowStartMenu(false); 
    if (!navigator.geolocation) return alert("Trình duyệt không hỗ trợ.");
    setCustomInput("Đang định vị..."); setIsTypingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10`);
          const d = await res.json();
          if (d && d.display_name) {
            const name = d.address.city || d.address.state || d.display_name.split(',')[0];
            setStartPoint({ name, lat: latitude, lon: longitude });
            setCustomInput(name); setIsTypingLocation(false);   
          }
        } catch { alert("Lỗi chuyển đổi tọa độ."); }
      },
      () => { alert("Vui lòng cấp quyền vị trí."); setCustomInput(""); }
    );
  }; 

  const handleSelectCustom = () => { setShowStartMenu(false); setIsTypingLocation(true); setCustomInput(''); };

  const handleCreateTour = () => {
     if(selectedAttractions.length === 0) return alert("Chọn ít nhất 1 địa điểm!");
     if(!startPoint.lat) return alert("Nhập điểm xuất phát!");
     const finalStart = startDate ? new Date(startDate) : new Date();
     const finalEnd = endDate ? new Date(endDate) : new Date(new Date().setDate(new Date().getDate() + 2));
     finalStart.setHours(8,0,0); finalEnd.setHours(20,0,0);
     navigate('/itinerary', { state: { selectedAttractions, startPoint, startDate: finalStart, endDate: finalEnd } });
  };

  const isSelected = (id) => selectedAttractions.find(i => i.id === id);

  return (
    <div className="service-page">
      {/* === BANNER ĐẦU TRANG (THAY CHO STICKY BAR) === */}
      <div className="search-hero-section">
          <div className="hero-content">
              <h1>Khám phá Việt Nam</h1>
              <p>Lên kế hoạch cho chuyến đi tuyệt vời của bạn</p>
          </div>
          
          <div className="search-bar-container">
            <div className="sb-item location">
                <label>Xuất phát từ</label>
                {isTypingLocation ? (
                <input autoFocus className="sb-input" placeholder="Nhập địa chỉ..."
                    value={customInput} onChange={e => setCustomInput(e.target.value)} 
                    onBlur={handleLocationSearch} onKeyDown={handleKeyDown} />
                ) : (
                    <div className="sb-value" onClick={() => setShowStartMenu(!showStartMenu)}>
                        {startPoint.name || "Chọn vị trí"}
                    </div>
                )}
                {showStartMenu && (
                    <div className="sb-dropdown">
                        <div onClick={handleGetCurrentLocation}>📍 Vị trí hiện tại</div>
                        <div onClick={handleSelectCustom}>✎ Nhập tay</div>
                    </div>
                )}
            </div>
            <div className="sb-divider"></div>
            <div className="sb-item date">
                <label>Ngày đi</label>
                <input type="date" className="sb-input-date" value={startDate} onChange={(e) => handleDateChange('start', e.target.value)} />
            </div>
            <div className="sb-divider"></div>
            <div className="sb-item date">
                <label>Ngày về</label>
                <input type="date" className="sb-input-date" value={endDate} min={startDate} onChange={(e) => handleDateChange('end', e.target.value)} />
            </div>
            <div className="sb-item keyword">
                 <label>Tìm kiếm</label>
                 <input className="sb-input" placeholder="Bạn muốn đi đâu?" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
            <button className="sb-btn-go" onClick={handleCreateTour}>Tạo lịch trình ({selectedAttractions.length})</button>
          </div>
      </div>

      <div className="service-body-container"> 
        <aside className="sidebar">
            <div className="filter-box">
                <h3>Loại hình</h3>
                <div className="type-list">
                    {TYPE_OPTIONS.map(t => (
                        <label key={t.value} className="checkbox-item">
                            <input type="checkbox" checked={selectedTypes.includes(t.value)}
                                onChange={() => setSelectedTypes(prev => prev.includes(t.value) ? prev.filter(x=>x!==t.value) : [...prev, t.value])} />
                            {t.label}
                        </label>
                    ))}
                </div>
            </div>
            {selectedAttractions.length > 0 && (
                <div className="filter-box route-summary-box" style={{marginTop:'20px'}}>
                    <h3>Lộ trình dự kiến</h3>
                    <div className="route-segment start">
                        <div className="segment-dot start-dot"></div>
                        <div className="segment-content">
                            <span className="segment-label">Từ:</span>
                            <span className="segment-value">{startPoint.name || "Chưa chọn"}</span>
                        </div>
                    </div>
                    <div className="route-line"></div>
                    <div className="route-destinations">
                        <div className="segment-dot end-dot"></div>
                        <div className="segment-content">
                            <span className="segment-label">Đến ({selectedAttractions.length}):</span>
                            <div className="tags-container">
                                {selectedAttractions.map(attr => (
                                    <div key={attr.id} className="dest-tag">
                                        {attr.name}
                                        <span className="remove-tag" onClick={() => handleToggleSelect(attr)}>×</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </aside>

        <main className="main-content">
            {loading ? <div className="loading-state">Đang tìm kiếm...</div> : (
                <>
                     <h2 className="section-title">Gợi ý dành cho bạn</h2>
                     <div className="grid-container"> 
                        {data.map(item => (
                            <div key={item.id} className={`dest-card ${isSelected(item.id) ? 'selected-border' : ''}`}
                                 onClick={() => navigate(`/attractions/${item.id}`)}>
                                <div className={`card-select-btn ${isSelected(item.id)?'active':''}`}
                                     onClick={(e) => {e.stopPropagation(); handleToggleSelect(item);}}>
                                    {isSelected(item.id) ? "✓" : "+"}
                                </div>
                                <img src={item.imageUrl} alt={item.name} className="dest-img"/>
                                <div className="dest-overlay">
                                    <div className="dest-name">{item.name}</div>
                                    <div className="dest-rating">★ {item.averageRating || 5.0}</div>
                                </div>
                            </div>
                        ))}
                     </div>
                     {data.length === 0 && <div className="empty-state">Không tìm thấy địa điểm phù hợp.</div>}
                </>
            )}
        </main>
      </div>
    </div>
  );
}
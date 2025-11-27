import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { attractionsAPI } from '../utils/api';
import './Service.css';

const DESTINATION_OPTIONS = [
  'Hà Nội',
  'Huế',
  'Đà Nẵng',
  'Quảng Nam',
  'TP. Hồ Chí Minh',
  'Cần Thơ',
  'Đà Lạt',
  'Sa Pa',
];

const TYPE_OPTIONS = [
  { label: 'Lễ hội', value: 'Lễ hội' },
  { label: 'Bảo tàng', value: 'Bảo tàng' },
  { label: 'Đền/Chùa', value: 'Đền/Chùa' },
  { label: 'Di tích', value: 'Di tích' },
  { label: 'Làng nghề', value: 'Làng nghề' },
];

const BUDGET_LEVELS = ['Tiết kiệm', 'Cân bằng', 'Thoải mái'];

export default function Service({ currentUser }) {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [departure, setDeparture] = useState('');
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [budgetLevel, setBudgetLevel] = useState(1);
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchAttractions = async (params = {}) => {
    try {
      setLoading(true);
      setError('');
      const response = await attractionsAPI.search({
        userId: currentUser?.user_id,
        ...params,
      });
      if (!response.success) {
        throw new Error(response.error || 'Không thể tải dữ liệu');
      }
      setData(response.data || []);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Không thể tải dữ liệu');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttractions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  const allAttractions = useMemo(() => {
    return (data || []).map((item) => ({
      ...item,
      category: item.type === 'festival' ? 'Lễ hội' : 'Điểm văn hóa',
    }));
  }, [data]);

  const highlightAttractions = useMemo(() => {
    return [...allAttractions]
      .sort((a, b) => (b.recommendationScore || 0) - (a.recommendationScore || 0))
      .slice(0, 10);
  }, [allAttractions]);

  const popularSuggestions = useMemo(() => {
    const highlightIds = highlightAttractions.map(item => item.id);
    return allAttractions.filter(item =>
      item.type !== 'attraction' && !highlightIds.includes(item.id)
    );
  }, [allAttractions, highlightAttractions]);

  const nearbyDestinations = useMemo(() => {
    const highlightIds = highlightAttractions.map(item => item.id);
    return allAttractions.filter(item =>
      item.type === 'attraction' && !highlightIds.includes(item.id)
    );
  }, [allAttractions, highlightAttractions]);


  const handleTypeToggle = (value) => {
    setSelectedTypes((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]
    );
  };

  const handleSearch = () => {
    const params = {
      searchTerm: searchTerm.trim() || destination || undefined,
      userId: currentUser?.user_id,
    };
    if (selectedTypes.length > 0) {
      params.typeList = selectedTypes;
    }
    fetchAttractions(params);
  };

  const handleDestinationChange = (value) => {
    setDestination(value);
    if (value) {
      setSearchTerm(value);
    }
  };

  return (
    <div className="service-page">
      <div className="service-hero">
        <div className="service-hero-content">
          <p className="eyebrow">Culture Compass</p>
          <h1>Kiến tạo hành trình văn hóa của riêng bạn</h1>
          <p className="subheading">
            Chọn xuất phát điểm, điểm đến và loại hình bạn yêu thích. Chúng tôi sẽ gợi ý những trải nghiệm không nên bỏ qua.
          </p>

          <div className="search-panel">
            <div className="search-row">
              <div className="input-group">
                <label>Chọn xuất phát điểm</label>
                <select value={departure} onChange={(e) => setDeparture(e.target.value)}>
                  <option value="">(Chưa có)</option>
                  {DESTINATION_OPTIONS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>

              <div className="input-group">
                <label>Điểm đến mong muốn</label>
                <select value={destination} onChange={(e) => handleDestinationChange(e.target.value)}>
                  <option value="">(Chưa có)</option>
                  {DESTINATION_OPTIONS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>

              <div className="input-group text">
                <label>Bạn muốn đi đâu?</label>
                <div className="text-input">
                  <input
                    type="text"
                    placeholder="Tìm theo từ khóa..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  <button onClick={handleSearch}>Tìm kiếm</button>
                </div>
              </div>
            </div>

            <div className="search-row secondary">
              <div className="input-group range">
                <label>Ngân sách</label>
                <div className="budget-slider">
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="1"
                    value={budgetLevel}
                    onChange={(e) => setBudgetLevel(Number(e.target.value))}
                  />
                  <div className="budget-labels">
                    {BUDGET_LEVELS.map((label, index) => (
                      <span key={label} className={index === budgetLevel ? 'active' : ''}>
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="input-group dates">
                <label>Chọn ngày đi</label>
                <div className="dates-wrapper">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                  <span>→</span>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
              </div>
            </div>

            <div className="type-filter">
              <p>Loại hình điểm đến:</p>
              <div className="type-pill-row">
                {TYPE_OPTIONS.map((type) => (
                  <label key={type.value} className={selectedTypes.includes(type.value) ? 'checked' : ''}>
                    <input
                      type="checkbox"
                      value={type.value}
                      checked={selectedTypes.includes(type.value)}
                      onChange={() => handleTypeToggle(type.value)}
                    />
                    {type.label}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="service-body">
        {error && <div className="service-error">{error}</div>}

        <section className="recommendation-banner">
          <p>Nếu bạn chưa biết đi đâu, đây sẽ là các gợi ý cho bạn:</p>
        </section>

        <section className="recommendation-block">
          <h2>Các địa điểm không thể bỏ qua</h2>
          {loading ? (
            <p>Đang tải dữ liệu...</p>
          ) : highlightAttractions.length > 0 ? (
            <div className="horizontal-scroll">
              {highlightAttractions.map((item) => (
                <article
                  key={item.id}
                  className="spot-card"
                  onClick={() => navigate(`/attractions/${item.id}`)}
                >
                  {item.imageUrl && (
                    <div className="spot-card-image" style={{ backgroundImage: `url(${item.imageUrl})` }}>
                      <div className="rating-overlay">⭐ {item.averageRating ?? 'Chưa có'}</div>
                    </div>
                  )}
                  <div className="spot-card-content">
                    <h3>{item.name}</h3>
                    <div className="spot-meta">
                      {item.isFavorite && <span className="favorite-pill">Yêu thích</span>}
                    </div>
                    {item.matchReason && <small className="match-reason">{item.matchReason}</small>}
                    <small>{item.category}</small>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p>Không có dữ liệu phù hợp.</p>
          )}
        </section>

        <section className="recommendation-block">
          <h2>Gợi ý phù hợp</h2>
          {loading ? (
            <p>Đang tải dữ liệu...</p>
          ) : popularSuggestions.length > 0 ? (
            <div className="card-grid">
              {popularSuggestions.map((item) => (
                <article
                  key={item.id}
                  className="spot-card"
                  onClick={() => navigate(`/attractions/${item.id}`)}
                >
                  {item.imageUrl && (
                    <div className="spot-card-image" style={{ backgroundImage: `url(${item.imageUrl})` }}>
                      <div className="rating-overlay">⭐ {item.averageRating ?? 'Chưa có'}</div>
                    </div>
                  )}
                  <div className="spot-card-content">
                    <h3>{item.name}</h3>
                    <div className="spot-meta">
                      {item.isFavorite && <span className="favorite-pill">Yêu thích</span>}
                    </div>
                    {item.matchReason && <small className="match-reason">{item.matchReason}</small>}
                    <small>{item.category}</small>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p>Không có gợi ý phổ biến.</p>
          )}
        </section>

        <section className="recommendation-block">
          <h2>Các điểm đến lân cận</h2>
          {loading ? (
            <p>Đang tải dữ liệu...</p>
          ) : nearbyDestinations.length > 0 ? (
            <div className="card-grid">
              {nearbyDestinations.map((item) => (
                <article
                  key={item.id}
                  className="spot-card"
                  onClick={() => navigate(`/attractions/${item.id}`)}
                >
                  {item.imageUrl && (
                    <div className="spot-card-image" style={{ backgroundImage: `url(${item.imageUrl})` }}>
                      <div className="rating-overlay">⭐ {item.averageRating ?? 'Chưa có'}</div>
                    </div>
                  )}
                  <div className="spot-card-content">
                    <h3>{item.name}</h3>
                    <div className="spot-meta">
                      {item.isFavorite && <span className="favorite-pill">Yêu thích</span>}
                    </div>
                    {item.matchReason && <small className="match-reason">{item.matchReason}</small>}
                    <small>{item.category}</small>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p>Không có điểm đến lân cận.</p>
          )}
        </section>

      </div>
    </div>
  );
}
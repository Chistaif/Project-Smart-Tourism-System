import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  const [data, setData] = useState({
    festivals: [],
    culturalSpots: [],
    otherAttractions: [],
  });
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
      setData({
        festivals: response.data.festivals || [],
        culturalSpots: response.data.culturalSpots || [],
        otherAttractions: response.data.otherAttractions || [],
      });
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
    const normalize = (items, category) =>
      (items || []).map((item) => ({
        ...item,
        category,
      }));
    return [
      ...normalize(data.festivals, 'Lễ hội'),
      ...normalize(data.culturalSpots, 'Điểm văn hóa'),
      ...normalize(data.otherAttractions, 'Khác'),
    ];
  }, [data]);

  const highlightAttractions = useMemo(() => {
    return [...allAttractions]
      .sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0))
      .slice(0, 4);
  }, [allAttractions]);

  const happeningFestivals = useMemo(() => {
    return (data.festivals || []).slice(0, 4);
  }, [data.festivals]);

  const getItemsForType = useCallback((label) => {
    const normalize = (items) => items || [];
    const includesText = (items, keyword) =>
      normalize(items).filter((item) => item.name?.toLowerCase().includes(keyword));

    switch (label) {
      case 'Lễ hội':
        return normalize(data.festivals);
      case 'Bảo tàng': {
        const museumMatches = includesText(data.culturalSpots, 'bảo tàng');
        return museumMatches.length > 0 ? museumMatches : normalize(data.culturalSpots);
      }
      case 'Đền/Chùa': {
        const templeMatches = includesText(data.culturalSpots, 'chùa').concat(
          includesText(data.culturalSpots, 'đền')
        );
        return templeMatches.length > 0 ? templeMatches : normalize(data.otherAttractions);
      }
      case 'Di tích':
        return normalize(data.otherAttractions);
      case 'Làng nghề': {
        const craftMatches = includesText(data.culturalSpots, 'làng').concat(
          includesText(data.otherAttractions, 'làng')
        );
        return craftMatches.length > 0 ? craftMatches : normalize(data.culturalSpots);
      }
      default:
        return allAttractions;
    }
  }, [allAttractions, data]);

  const typeRecommendations = useMemo(() => {
    return TYPE_OPTIONS.map((type) => ({
      ...type,
      items: getItemsForType(type.value).slice(0, 3),
    }));
  }, [getItemsForType]);

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
            <div className="card-grid">
              {highlightAttractions.map((item) => (
                <article
                  key={item.id}
                  className="spot-card"
                  onClick={() => navigate(`/attractions/${item.id}`)}
                >
                  {item.imageUrl && (
                    <div className="spot-card-image" style={{ backgroundImage: `url(${item.imageUrl})` }} />
                  )}
                  <div className="spot-card-content">
                    <h3>{item.name}</h3>
                    <div className="spot-meta">
                      <span>⭐ {item.averageRating ?? 'Chưa có'}</span>
                      {item.isFavorite && <span className="favorite-pill">Yêu thích</span>}
                    </div>
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
          <h2>Các lễ hội đang diễn ra</h2>
          {loading ? (
            <p>Đang tải dữ liệu...</p>
          ) : happeningFestivals.length > 0 ? (
            <div className="festival-grid">
              {happeningFestivals.map((item) => (
                <article
                  key={item.id}
                  className="festival-card"
                  onClick={() => navigate(`/attractions/${item.id}`)}
                >
                  {item.imageUrl && <img src={item.imageUrl} alt={item.name} />}
                  <div className="festival-content">
                    <h3>{item.name}</h3>
                    <p>⭐ {item.averageRating ?? 'Chưa có'} • Lễ hội</p>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p>Hiện chưa có dữ liệu lễ hội.</p>
          )}
        </section>

        <section className="recommendation-block">
          <h2>Khám phá theo sở thích</h2>
          <div className="type-columns">
            {typeRecommendations.map((group) => (
              <div key={group.value} className="type-column">
                <header>
                  <h3>{group.label}</h3>
                </header>
                {group.items.length > 0 ? (
                  group.items.map((item) => (
                    <button
                      key={item.id}
                      className="type-item"
                      onClick={() => navigate(`/attractions/${item.id}`)}
                    >
                      <span>{item.name}</span>
                      <strong>⭐ {item.averageRating ?? 'Chưa có'}</strong>
                    </button>
                  ))
                ) : (
                  <p className="empty">Chưa có dữ liệu</p>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="recommendation-block">
          <h2>Tất cả kết quả</h2>
          {loading ? (
            <p>Đang tải dữ liệu...</p>
          ) : allAttractions.length > 0 ? (
            <div className="card-grid compact">
              {allAttractions.map((item) => (
                <article
                  key={item.id}
                  className="spot-card compact"
                  onClick={() => navigate(`/attractions/${item.id}`)}
                >
                  {item.imageUrl && (
                    <div className="spot-card-image" style={{ backgroundImage: `url(${item.imageUrl})` }} />
                  )}
                  <div className="spot-card-content">
                    <div className="spot-card-header">
                      <h3>{item.name}</h3>
                      <span>⭐ {item.averageRating ?? 'Chưa có'}</span>
                    </div>
                    <small>{item.category}</small>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p>Không có điểm tham quan nào.</p>
          )}
        </section>
      </div>
    </div>
  );
}
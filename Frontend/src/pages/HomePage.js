import React, { useState, useEffect } from 'react';
import { destinationsAPI } from '../utils/api';
import test1 from '../asset/test1.png';
import test2 from '../asset/test2.png';
import test3 from '../asset/test3.png';

export default function HomePage({ handleCardClick, currentUser }) {
  const [destinations, setDestinations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Fetch destinations from Flask API
    const fetchDestinations = async () => {
      try {
        setLoading(true);
        const response = await destinationsAPI.getAll({
          userId: currentUser?.user_id,
        });
        if (response.success) {
          setDestinations(response.data);
        } else {
          setError('Failed to load destinations');
        }
      } catch (err) {
        console.error('Error fetching destinations:', err);
        setError('Error connecting to server. Make sure Flask is running on port 5000.');
      } finally {
        setLoading(false);
      }
    };

    fetchDestinations();
  }, [currentUser]);

  return (
    <main className="hero">
      <section className="left">
        <div className="eyebrow">Culture Compass</div>
        <h1>Khám phá chất Việt qua những hành trình đậm nét văn hóa</h1>
        <p className="lead">
          Trải nghiệm những truyền thống ẩn giấu, lễ hội chân thực và hành trình khó quên.
        </p>
        <a className="cta">Start now!</a>
        
        {/* Display API data */}
        {loading && <p style={{ color: 'white', marginTop: '20px' }}>Loading destinations...</p>}
        {error && <p style={{ color: 'red', marginTop: '20px' }}>{error}</p>}
        {!loading && !error && destinations.length > 0 && (
          <div style={{ marginTop: '20px', color: 'white' }}>
            <p>Found {destinations.length} destinations from API:</p>
            <ul style={{ fontSize: '0.9em', marginTop: '10px' }}>
              {destinations.slice(0, 3).map(dest => (
                <li key={dest.id}>{dest.name} - {dest.location}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <aside className="right">
        <div className="card-col">
          <div className="img-card" onClick={() => handleCardClick(`url(${test3})`)}>
            <div className="inner" style={{ backgroundImage: `url(${test3})` }} />
          </div>
        </div>

        <div className="card-col">
          <div className="img-card" onClick={() => handleCardClick(`url(${test2})`)}>
            <div className="inner" style={{ backgroundImage: `url(${test2})` }} />
          </div>
        </div>

        <div className="card-col">
          <div className="img-card" onClick={() => handleCardClick(`url(${test1})`)}>
            <div className="inner" style={{ backgroundImage: `url(${test1})` }} />
          </div>
        </div>
      </aside>
    </main>
  );
}
    
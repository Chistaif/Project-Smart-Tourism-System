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
          setAttractions(response.data);
        } else {
          setError('Failed to load attractions');
        }
      } catch (err) {
        console.error('Error fetching attractions:', err);
        setError('Error connecting to server. Make sure Flask is running on port 5000.');
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
      
      {loading && <p>Loading attractions...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      
      {!loading && !error && (
        <div style={{ marginTop: '20px' }}>
          <h2>Attractions from API ({attractions.length})</h2>
          <ul>
            {attractions.map(attr => (
              <li key={attr.id}>
                <strong>{attr.name}</strong> - {attr.location} 
                {attr.rating && ` (Rating: ${attr.rating})`}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
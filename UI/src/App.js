import React, { useState } from 'react';
import './App.css';

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import Navigation from './layout/Navigation';
import HomePage from './pages/HomePage';
import Service from './pages/Service';

import homeImg from './asset/home.png';

function App() {
  const [currentBackground, setCurrentBackground] = useState(`url(${homeImg})`);
  const [isOpen, setIsOpen] = useState(false);

  const openPopup = () => setIsOpen(true);
  const closePopup = () => setIsOpen(false);

  const handleCardClick = (bg) => {
    if (bg && bg !== 'none') setCurrentBackground(bg);
  };

  return (
    <Router>
      <div className="App" style={{ backgroundImage: currentBackground }}>
        
        <Navigation openPopup={openPopup} />

        {/* POPUP */}
        {isOpen && (
          <div className="popup-overlay">
            <div className="popup">
              <h2>Here is popup</h2>
              <button onClick={closePopup}>Close</button>
            </div>
          </div>
        )}

        {/* ROUTES */}
        <Routes>
          <Route path="/" element={<HomePage handleCardClick={handleCardClick} />} />
          <Route path="/service" element={<Service />} />
        </Routes>

        <footer>
          <small>© 2025 Culture Compass</small>
        </footer>
      </div>
    </Router>
  );
}

export default App;

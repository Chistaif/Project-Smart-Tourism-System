import React from 'react';
import { useNavigate } from 'react-router-dom';
import './AttractionList.css';

export default function AttractionList({ attractions, title = "" }) {
    const navigate = useNavigate();

    if (!attractions || attractions.length === 0) {
        return <div className="no-attractions">Không có địa điểm nào trong danh sách này.</div>;
    }

    // Xử lý khi người dùng nhấp vào một thẻ địa điểm
    const handleCardClick = (attractionId) => {
        // Chuyển hướng đến trang chi tiết địa điểm
        navigate(`/attractions/${attractionId}`);
    };

    const renderAttractionCard = (attraction) => {
        const id = attraction.id || attraction.attractionId;
        const name = attraction.name;
        const imageUrl = attraction.imageUrl || attraction.coverImageUrl;
        const location = attraction.location;
        const rating = attraction.rating;
        const spotType = attraction.spotType;
        const tags = attraction.tags || [];

        return (
            <div 
                key={id} 
                className="attraction-card" 
                onClick={() => handleCardClick(id)}
            >
                <div className="card-image-wrapper">
                    <img 
                        src={imageUrl || '/static/default_attraction.jpg'} 
                        alt={name} 
                        className="card-image" 
                    />
                    <div className="card-spot-type">{spotType}</div>
                </div>
                
                <div className="card-content">
                    <h4 className="card-name">{name}</h4>
                    <p className="card-location">🚩 {location}</p>
                    <div className="card-rating">
                        <span className="rating-score">⭐ {rating ? rating.toFixed(1) : 'N/A'}</span>
                    </div>
                    <div className="card-tags">
                        {tags.slice(0, 3).map((tag, index) => (
                            <span key={index} className="tag-item">{tag}</span>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="attraction-list-container">
            {title && <h3 className="list-title">{title}</h3>}
            <div className="attraction-cards-grid">
                {attractions.map(renderAttractionCard)}
            </div>
        </div>
    );
}
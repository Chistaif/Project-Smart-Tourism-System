import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { tourPackageAPI } from '../utils/api';
import './TourPackageDetail.css'; 

import MapComponent from '../layout/MapComponent'; 
import AttractionList from '../components/AttractionList'; 
import Popup from '../components/Popup';
export default function TourPackageDetail() {
    const { packageId } = useParams(); 
    const navigate = useNavigate();
    const [packageData, setPackageData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    // State cho Popup thông báo
    const [popup, setPopup] = useState({ show: false, message: "" });

    // --- 1. Load Data ---
    useEffect(() => {
        window.scrollTo(0, 0); 
        if (!packageId) return;
        
        const fetchDetail = async () => {
            try {
                const response = await tourPackageAPI.getById(packageId);
                if (response.success) {
                    setPackageData(response.data);
                } else {
                    setError("Không thể tải chi tiết gói tour.");
                }
            } catch (err) {
                setError("Lỗi kết nối máy chủ.");
            } finally {
                setLoading(false);
            }
        };
        fetchDetail();
    }, [packageId]);
    
    // --- 2. Xử lý Thêm vào Lịch trình ---
    const handleAddToItinerary = () => {
        if (!packageData || !packageData.attractions) return;

        try {
            // 1. Lấy dữ liệu hiện tại từ Session Storage
            const savedDraft = sessionStorage.getItem('service_page_draft');
            let currentData = savedDraft ? JSON.parse(savedDraft) : {};
            let currentAttractions = currentData.selectedAttractions || [];

            // 2. Tạo danh sách ID hiện có để tránh trùng lặp
            const existingIds = new Set(currentAttractions.map(item => item.id));

            // 3. Lọc ra những địa điểm chưa có trong danh sách
            const newAttractions = packageData.attractions.filter(attr => !existingIds.has(attr.id));

            if (newAttractions.length === 0) {
                setPopup({ show: true, message: "Bạn đã thêm gói tour này vào lịch trình rồi!" });
                return;
            }

            // 4. Gộp và Lưu lại
            const updatedAttractions = [...currentAttractions, ...newAttractions];
            
            // Cập nhật lại object draft
            const updatedDraft = {
                ...currentData,
                selectedAttractions: updatedAttractions
            };

            sessionStorage.setItem('service_page_draft', JSON.stringify(updatedDraft));
            
            setPopup({ show: true, message: `Đã thêm ${newAttractions.length} địa điểm vào lịch trình!` });

        } catch (e) {
            console.error("Lỗi khi lưu lịch trình:", e);
            setPopup({ show: true, message: "Có lỗi xảy ra khi lưu lịch trình." });
        }
    };

    // --- Helper Format Text ---
    const formatContent = (text) => {
        if (!text) return { __html: "" };
        let formatted = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        formatted = formatted.replace(/\n/g, '<br/>');
        return { __html: formatted };
    };

    // --- Helper Render Section ---
    const renderSection = (section, index) => {
        switch (section.type) {
            case 'heading':
                const LevelTag = `h${section.level || 2}`; 
                return (
                    <div key={index} className={`detail-section section-level-${section.level || 2}`}>
                        <div className="section-header-group">
                            <LevelTag className="section-title">{section.title}</LevelTag>
                            <div className="title-underline"></div>
                        </div>
                        
                        {section.imageUrl && section.imageUrl.trim() !== "" && (
                            <div className="section-image-wrapper">
                                <img src={section.imageUrl} alt={section.title} className="section-image" />
                            </div>
                        )}
                        
                        {section.content && (
                            <p className="section-content" dangerouslySetInnerHTML={formatContent(section.content)} />
                        )}
                    </div>
                );
            case 'list':
                return (
                    <div key={index} className="detail-section section-list-wrapper">
                        {section.title && <h3 className="list-title">{section.title}</h3>}
                        <ul className="custom-list">
                            {section.items && section.items.map((item, i) => (
                                <li key={i} dangerouslySetInnerHTML={formatContent(item)}></li>
                            ))}
                        </ul>
                    </div>
                );
            case 'paragraph':
            default:
                return (
                    <div key={index} className="detail-section section-paragraph">
                        {section.title && <h3 className="paragraph-title">{section.title}</h3>}
                        <p className="section-content" dangerouslySetInnerHTML={formatContent(section.content)} />
                    </div>
                );
        }
    };

    if (loading) return <div className="loading-screen">Đang tải hành trình...</div>;
    if (error) return <div className="error-screen">{error}</div>;
    if (!packageData) return null;
    
    const detailContent = packageData.detailDescription;
    const attractionsInPackage = packageData.attractions || [];

    return (
        <div className="tour-package-detail-page">
            <div className="package-hero" style={{ backgroundImage: `url(${packageData.coverImageUrl})` }}>
                <div className="hero-overlay"></div>

                <button className="back-btn" onClick={() => navigate('/service')}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                    Quay lại
                </button>

                <div className="hero-content">
                    <span className="hero-tag">Tour Chủ Đề</span>
                    <h1 className="hero-title">{packageData.name}</h1>
                    <p className="hero-brief">{packageData.briefDescription}</p>
                    
                    <div className="hero-meta">
                        <div className="meta-item">
                            <span className="icon">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon><line x1="8" y1="2" x2="8" y2="18"></line><line x1="16" y1="6" x2="16" y2="22"></line></svg>
                            </span> 
                            {packageData.location || "Nhiều điểm đến"}
                        </div>
                        <div className="meta-item">
                            <span className="icon">📅</span> {packageData.estimatedDurationDays} Ngày trải nghiệm
                        </div>
                        <div className="meta-item">
                            <span className="icon">⭐</span> {packageData.averageRating ? packageData.averageRating.toFixed(1) : 'Mới'}
                        </div>
                    </div>
                </div>
            </div>

            <div className="main-layout">
                <div className="content-column">
                    <div className="article-container">
                        {detailContent?.mainTitle && <h2 className="article-main-heading">{detailContent.mainTitle}</h2>}
                        {packageData.themeDescription && (
                            <div className="theme-intro-box"><p>{packageData.themeDescription}</p></div>
                        )}
                        <div className="article-body">
                            {detailContent?.sections && detailContent.sections.length > 0 ? (
                                detailContent.sections.map(renderSection)
                            ) : (
                                <p className="no-detail">Nội dung chi tiết đang được cập nhật...</p>
                            )}
                        </div>
                        <div className="package-actions-row">
                            <button className="action-btn btn-secondary" onClick={() => navigate('/service')}>
                                Quay lại
                            </button>
                            <button className="action-btn btn-primary" onClick={handleAddToItinerary}>
                                <span className="btn-icon">+</span> Thêm vào lịch trình
                            </button>
                        </div>
                    </div>
                </div>
        
                <div className="sidebar-column">
                    <div className="sticky-sidebar">
                        <div className="sidebar-widget map-widget">
                            <h3>Bản đồ lộ trình</h3>
                            <div className="mini-map-container">
                                <MapComponent locations={attractionsInPackage} isStatic={true} />
                            </div>
                        </div>

                        <div className="sidebar-widget attraction-widget">
                            <h3>Điểm đến trong tour ({attractionsInPackage.length})</h3>
                            <div className="sidebar-attraction-list">
                                <AttractionList attractions={attractionsInPackage} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <Popup 
                show={popup.show} 
                message={popup.message} 
                onClose={() => setPopup({ ...popup, show: false })} 
            />
        </div>
    );
}
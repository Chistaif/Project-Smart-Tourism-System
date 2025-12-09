import React from "react";
import "./Popup.css";

export default function Popup({ show, message, onClose }) {
    if (!show) return null;

    return (
        <div className="popup-overlay">
            <div className="popup-box">
                <div className="popup-message">{message}</div>

                <button className="popup-btn" onClick={onClose}>
                    OK
                </button>
            </div>
        </div>
    );
}

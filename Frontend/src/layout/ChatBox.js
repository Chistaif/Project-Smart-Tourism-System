import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import './ChatBox.css';

import chatLogo from '../asset/chatbox.png'; 

// 1. Thêm props user và openLogin vào đây
export default function ChatAssistant({ user, openLogin }) {
  const location = useLocation();
  const isBlogRoute = location.pathname.startsWith('/blogs');

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'model',
      text: isBlogRoute
        ? 'Xin chào! Tôi là trợ lý viết blog Culture Compass. Tôi có thể giúp bạn tạo nội dung blog về du lịch. Bạn muốn viết về địa điểm nào?'
        : 'Xin chào! Mình là hướng dẫn viên ảo Culture Compass. Bạn cần gợi ý gì không?'
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Auto-scroll xuống tin nhắn mới nhất
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Reset messages when route changes between blog and non-blog pages
  useEffect(() => {
    setMessages([
      {
        role: 'model',
        text: isBlogRoute
          ? 'Xin chào! Tôi là trợ lý viết blog Culture Compass. Tôi có thể giúp bạn tạo nội dung blog về du lịch. Bạn muốn viết về địa điểm nào?'
          : 'Xin chào! Mình là hướng dẫn viên ảo Culture Compass. Bạn cần gợi ý gì không?'
      }
    ]);
  }, [isBlogRoute]);

  const handleSend = async () => {
    if (!input.trim()) return;

    // Hiển thị tin nhắn user ngay lập tức
    const userMsg = { role: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      // Lấy token từ localStorage
      const token = localStorage.getItem('access_token'); 

      if (!token) {
        alert("Phiên đăng nhập hết hạn.");
        setLoading(false);
        return;
      }
        
      // Gọi API Backend
      const response = await fetch('http://127.0.0.1:5000/api/ai/chat', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message: isBlogRoute ? `[BLOG_CONTENT] ${userMsg.text}` : userMsg.text,
          history: messages.map(m => ({
            role: m.role,
            parts: [m.text]
          }))
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setMessages(prev => [...prev, { role: 'model', text: data.reply }]);
      } else {
        const errorMsg = data.error === "Token has expired" 
          ? "Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại." 
          : "Hệ thống đang bận, thử lại sau nhé!";
        setMessages(prev => [...prev, { role: 'model', text: errorMsg }]);
      }
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'model', text: "Lỗi kết nối server!" }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chat-widget">
      {/* Nút tròn góc màn hình */}
      <button className="chat-toggle" onClick={() => setIsOpen(!isOpen)}>
        {isOpen ? (
          '✕'
        ) : (
          <img src={chatLogo} alt="Chat" className="custom-chat-logo" />
        )}
      </button>

      {/* Khung chat */}
      {isOpen && (
        <div className="chat-box">
          <div className="chat-header">
            <h4>{isBlogRoute ? 'Trợ lý viết blog' : 'Trợ lý du lịch ảo'}</h4>
          </div>
          
          {/* 2. Kiểm tra USER ở đây */}
          {user ? (
            // === TRƯỜNG HỢP ĐÃ ĐĂNG NHẬP (Hiện khung chat) ===
            <>
              <div className="chat-messages">
                {messages.map((msg, idx) => (
                  <div key={idx} className={`message ${msg.role}`}>
                    {msg.text}
                  </div>
                ))}
                {loading && <div className="message model">Đang nhập...</div>}
                <div ref={messagesEndRef} />
              </div>

              <div className="chat-input-area">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                  placeholder={isBlogRoute ? "Mô tả chủ đề blog bạn muốn viết..." : "Hỏi về địa điểm, lịch trình..."}
                  disabled={loading}
                />
                <button onClick={handleSend} disabled={loading}>➤</button>
              </div>
            </>
          ) : (
            // === TRƯỜNG HỢP CHƯA ĐĂNG NHẬP (Hiện yêu cầu Login) ===
            <div className="chat-login-require">
              <p>👋 <strong>Xin chào!</strong></p>
              <p>Bạn cần đăng nhập để trò chuyện với Hướng dẫn viên AI nhé.</p>
              <button 
                className="chat-login-btn" 
                onClick={() => {
                    setIsOpen(false); // Đóng ChatBox trước
                    openLogin();      // Sau đó mở Popup đăng nhập
                }}
              >
                Đăng nhập ngay
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
import React, { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// --- BẢNG MÀU ---
const COLOR_PALETTE = ['red', 'blue', 'green', 'orange', 'violet', 'gold', 'grey', 'black'];

// Hàm tạo icon marker theo màu
const createColorIcon = (colorName) => {
  return new L.Icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${colorName}.png`,
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });
};

const vietnamFlagIcon = new L.Icon({
  iconUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/21/Flag_of_Vietnam.svg/64px-Flag_of_Vietnam.svg.png',
  iconSize: [30, 20],      // Kích thước cờ
  iconAnchor: [15, 10],    // Điểm neo (giữa cờ)
  popupAnchor: [0, -10],   // Điểm hiện popup
  className: 'vn-flag-icon' // Class để CSS thêm nếu cần
})

// Component phụ để tự động Zoom bản đồ
function ChangeView({ bounds }) {
  const map = useMap();
  useEffect(() => {
    if (bounds && bounds.length > 0) {
      try {
        map.fitBounds(bounds, { padding: [50, 50] });
      } catch (e) {
        console.warn("Lỗi fitBounds:", e);
      }
    }
  }, [bounds, map]);
  return null;
}

export default function MapComponent({ 
    locations = [], 
    routes = {}, 
    routePath = [],
    selectedDay = null 
}) {
  const defaultCenter = [16.0544, 108.2022];

  // --- HELPER: LẤY MÀU THEO NGÀY ---
  const getColorForDay = (dayNum) => {
      if (!dayNum) return 'blue';
      const index = (dayNum - 1) % COLOR_PALETTE.length;
      return COLOR_PALETTE[index];
  };

  // --- LỌC DỮ LIỆU HIỂN THỊ ---
  const { filteredLocations, filteredRoutes, bounds } = useMemo(() => {
      let fLocations = locations;
      let fRoutes = routes;

      // Nếu người dùng chọn 1 ngày cụ thể
      if (selectedDay) {
          fLocations = locations.filter(loc => loc.type === 'START' || loc.day === selectedDay);
          
          fRoutes = {};
          if (routes[selectedDay]) {
              fRoutes[selectedDay] = routes[selectedDay];
          }
      }

      let pointsForBounds = [];

      if (selectedDay && fRoutes[selectedDay]) {
          fRoutes[selectedDay].forEach(segment => {
              const path = segment.path || segment;
              if (Array.isArray(path)) pointsForBounds.push(...path);
          });
      } else if (selectedDay === null && routePath.length > 0) {
          pointsForBounds = routePath;
      }
      
      // Fallback: Nếu không có đường đi, dùng tọa độ marker
      if (pointsForBounds.length === 0 && fLocations.length > 0) {
          pointsForBounds = fLocations.map(loc => [loc.lat, loc.lon]);
      }

      // Xử lý bounds
      let newBounds = pointsForBounds;
      // Fix lỗi nếu chỉ có 1 điểm (không thể fitBounds) -> Tạo padding ảo
      if (newBounds.length === 1) {
          const [lat, lon] = newBounds[0];
          newBounds.push([lat + 0.01, lon + 0.01]);
      }

      return { filteredLocations: fLocations, filteredRoutes: fRoutes, bounds: newBounds };
  }, [locations, routes, routePath, selectedDay]);


  return (
    <div style={{ height: "100%", width: "100%", borderRadius: "0", overflow: "hidden", position: "relative", zIndex: 0 }}>
      <MapContainer 
        center={defaultCenter} 
        zoom={6} 
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Tự động Zoom */}
        {bounds.length > 0 && <ChangeView bounds={bounds} />}

        {/* --- 1. VẼ TUYẾN ĐƯỜNG --- */}
        {filteredRoutes && Object.keys(filteredRoutes).sort().map((dayStr) => {
            const dayNum = parseInt(dayStr);
            const segments = filteredRoutes[dayStr];
            
            const dayColor = getColorForDay(dayNum);

            return segments.map((segment, idx) => {
                const path = segment.path || segment; 
                const isFlight = segment.type === 'flight' || (typeof segment.type === 'string' && segment.type.startsWith('plane'));
                const isReturn = segment.is_return === true;

                if (!path || path.length === 0) return null;

                // Cấu hình Style
                // Nếu là đường về -> Màu đen. Nếu không -> Màu theo ngày
                const segmentColor = isReturn ? 'black' : dayColor;
                const dashArray = (isReturn || isFlight) ? '10, 15' : null;
                const weight = (isReturn || isFlight) ? 3 : 5;
                const opacity = isReturn ? 0.6 : 0.8;

                return (
                    <Polyline 
                        key={`route-${dayNum}-${idx}`}
                        positions={path}
                        pathOptions={{
                            color: segmentColor,
                            weight: weight,
                            opacity: opacity,
                            dashArray: dashArray
                        }}
                    >
                         <Popup>
                            {isReturn 
                              ? "Đường về điểm xuất phát" 
                              : `Ngày ${dayNum}: ${isFlight ? "Đường bay" : "Di chuyển"}`
                            }
                        </Popup>
                    </Polyline>
                );
            });
        })}

        {/* --- 2. VẼ MARKER --- */}
        {filteredLocations.map((loc, index) => {
            let iconColor = 'blue';

            // Logic màu cũ
            if (loc.type === 'START') {
                iconColor = 'black'; 
            } else {
                iconColor = getColorForDay(loc.day);
            }

            const useFlag = loc.showFlag === true || loc.type === 'SPECIAL_FLAG';

            return (
                <Marker 
                    key={`loc-${index}`} 
                    position={[loc.lat, loc.lon]}
                    icon={useFlag ? vietnamFlagIcon : createColorIcon(iconColor)}
                >
                    <Popup>
                        <div style={{ textAlign: "center", minWidth: "150px" }}>
                            <strong style={{ color: useFlag ? 'red' : iconColor, display: "block", marginBottom: "5px" }}>
                                {useFlag ? 'ĐỊA ĐIỂM ĐẶC BIỆT' : (loc.type === 'START' ? 'ĐIỂM XUẤT PHÁT' : `NGÀY ${loc.day}`)}
                            </strong>
                            
                            <div style={{fontWeight: 'bold', marginBottom: '5px'}}>{loc.name}</div>
                            
                            {loc.imageUrl && (
                                <img 
                                    src={loc.imageUrl} 
                                    alt={loc.name} 
                                    style={{ width: "100%", height: "80px", objectFit: "cover", borderRadius: "4px" }} 
                                />
                            )}
                            {loc.detail && <p style={{margin: "5px 0 0", fontSize: "0.85rem", color: "#666"}}>{loc.detail}</p>}
                        </div>
                    </Popup>
                </Marker>
            );
        })}
      </MapContainer>
    </div>
  );
}
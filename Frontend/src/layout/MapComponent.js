import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    tooltipAnchor: [16, -28],
    shadowSize: [41, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// --- Component phụ để tự động zoom bản đồ bao quát các điểm ---
function ChangeView({ bounds }) {
  const map = useMap();
  useEffect(() => {
    if (bounds && bounds.length > 0) {
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [bounds, map]);
  return null;
}

export default function MapComponent({ locations = [], routePath = [] }) {
  // locations: Danh sách điểm đến [{id, name, lat, lon, imageUrl, ...}]
  // routePath: Mảng tọa độ vẽ đường đi [[lat, lon], [lat, lon], ...]

  // Tính toán vùng hiển thị (bounds)
  let bounds = [];
  if (routePath && routePath.length > 0) {
      bounds = routePath;
  } else if (locations && locations.length > 0) {
      bounds = locations.map(loc => [loc.lat, loc.lon]);
  }
  
  const defaultCenter = [16.0544, 108.2022]; // Đà Nẵng

  return (
    <div style={{ height: "100%", width: "100%", borderRadius: "15px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)", position: "relative", zIndex: 0 }}>
      <MapContainer 
        center={defaultCenter} 
        zoom={13} 
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {bounds.length > 0 && <ChangeView bounds={bounds} />}

        {routePath && routePath.length > 0 && (
          <Polyline 
            positions={routePath} 
            color="#c4b30a" 
            weight={5} 
            opacity={0.8} 
          />
        )}

        {locations.map((loc, index) => (
          <Marker key={index} position={[loc.lat, loc.lon]}>
            <Popup>
              <div style={{ textAlign: "center", minWidth: "150px" }}>
                <strong style={{ color: "#1a2e05", display: "block", marginBottom: "5px" }}>{loc.name}</strong>
                {loc.imageUrl && (
                  <img 
                    src={loc.imageUrl} 
                    alt={loc.name} 
                    style={{ width: "100%", height: "80px", objectFit: "cover", borderRadius: "4px" }} 
                    onError={(e) => {e.target.onerror = null; e.target.src="https://via.placeholder.com/150?text=No+Image"}}
                  />
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
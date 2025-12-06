/* src/layout/MapComponent.js */
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
    popupAnchor: [1, -34]
});
L.Marker.prototype.options.icon = DefaultIcon;

// Component phụ: Chỉ Recenter khi danh sách địa điểm thay đổi
function RecenterMap({ locations }) {
    const map = useMap();

    useEffect(() => {
        if (locations && locations.length > 0) {
            const points = locations.map(l => [l.lat, l.lon]);
            const bounds = L.latLngBounds(points);
            map.fitBounds(bounds, { padding: [50, 50] });
        }
    }, [locations, map]);

    return null;
}

// COLORS cho các đường đi khác nhau (để phân biệt ngày)
const ROUTE_COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];

export default function MapComponent({ locations = [], routePaths = [] }) {
    // Mặc định: routePaths là mảng chứa các mảng tọa độ. 
    // Ví dụ: [ [[lat,lon], [lat,lon]], [[lat,lon],...] ]
    
    const defaultCenter = [16.0544, 108.2022];

    return (
        <MapContainer 
            center={defaultCenter} 
            zoom={6} 
            style={{ height: "100%", width: "100%", zIndex: 0 }}
        >
            <TileLayer
                attribution='&copy; OpenStreetMap'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* Vẽ nhiều đường Polyline riêng biệt */}
            {routePaths && routePaths.length > 0 && routePaths.map((path, idx) => (
                 <Polyline 
                    key={idx} 
                    positions={path} 
                    color={ROUTE_COLORS[idx % ROUTE_COLORS.length]} 
                    weight={5} 
                    opacity={0.8} 
                    dashArray={idx % 2 !== 0 ? '10, 10' : null} // Nét đứt cho ngày lẻ để dễ phân biệt màu
                 />
            ))}

            {locations.map((loc, idx) => (
                <Marker key={idx} position={[loc.lat, loc.lon]}>
                    <Popup>
                        <div style={{textAlign: 'center', minWidth: '150px'}}>
                            {loc.imageUrl && (
                                <img 
                                    src={loc.imageUrl} 
                                    alt={loc.name} 
                                    style={{width: '100%', height: '80px', objectFit: 'cover', borderRadius: '4px', marginBottom: '5px'}}
                                />
                            )}
                            <strong>{loc.name}</strong><br/>
                            <small>{loc.time}</small>
                        </div>
                    </Popup>
                </Marker>
            ))}

            <RecenterMap locations={locations} />
        </MapContainer>
    );
}
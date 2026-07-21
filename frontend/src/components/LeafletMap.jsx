import { MapContainer, TileLayer, Marker, Popup, Circle, useMapEvents, useMap } from "react-leaflet";
import { useEffect } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default marker icons for webpack
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function LocationPicker({ onPick }) {
  useMapEvents({
    click(e) { onPick(e.latlng.lat, e.latlng.lng); },
  });
  return null;
}

function Recenter({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView(center, map.getZoom() < 13 ? 15 : map.getZoom());
  }, [center, map]);
  return null;
}

export default function LeafletMap({
  center = [6.5244, 3.3792], // Lagos default
  zoom = 12,
  height = 380,
  marker = null,
  supervisorLocation = null,
  radiusMeters = 0,
  onPick = null,
}) {
  return (
    <div className="rounded-xl overflow-hidden border border-border" style={{ height }} data-testid="map">
      <MapContainer center={center} zoom={zoom} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='© OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Recenter center={marker || center} />
        {onPick && <LocationPicker onPick={onPick} />}
        {marker && (
          <>
            <Marker position={marker}>
              <Popup>Company location</Popup>
            </Marker>
            {radiusMeters > 0 && (
              <Circle center={marker} radius={radiusMeters}
                pathOptions={{ color: "#3b82f6", fillOpacity: 0.1 }} />
            )}
          </>
        )}
        {supervisorLocation && (
          <Marker position={supervisorLocation}>
            <Popup>Your location</Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}

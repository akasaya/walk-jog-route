import polylineDecode from "@mapbox/polyline";
import { useEffect, useRef, useState } from "react";
import { MapContainer, Marker, Polyline, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

interface RouteMapProps {
  polyline?: string | null;
  currentLocation?: { lat: number; lon: number } | null;
}

const DEFAULT_CENTER: [number, number] = [35.6894, 139.6917]; // 東京

function MapController({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length > 0) {
      map.fitBounds(positions);
    }
  }, [map, positions]);
  return null;
}

function LocationController({
  currentLocation,
  hasRoute,
}: {
  currentLocation: { lat: number; lon: number } | null | undefined;
  hasRoute: boolean;
}) {
  const map = useMap();
  const hasCenteredRef = useRef(false);
  useEffect(() => {
    if (currentLocation && !hasCenteredRef.current && !hasRoute) {
      hasCenteredRef.current = true;
      map.setView([currentLocation.lat, currentLocation.lon], 14);
    }
  }, [map, currentLocation, hasRoute]);
  return null;
}

export function RouteMap({ polyline, currentLocation }: RouteMapProps) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (!isOnline) {
    return (
      <div role="alert" style={{ padding: "1rem", textAlign: "center" }}>
        地図を表示できません
      </div>
    );
  }

  const positions: [number, number][] = polyline
    ? (polylineDecode.decode(polyline) as [number, number][])
    : [];

  return (
    <MapContainer
      center={DEFAULT_CENTER}
      zoom={14}
      style={{ height: "100%", width: "100%", minHeight: "300px" }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      {positions.length > 0 && (
        <>
          <Polyline positions={positions} pathOptions={{ color: "#2563eb", weight: 4 }} />
          <MapController positions={positions} />
        </>
      )}
      <LocationController
        currentLocation={currentLocation}
        hasRoute={positions.length > 0}
      />
      {currentLocation && (
        <Marker position={[currentLocation.lat, currentLocation.lon]} />
      )}
    </MapContainer>
  );
}

import React, { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    L: any;
  }
}

export default function MapViewSimple(): React.ReactElement {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const userMarkerRef = useRef<any>(null);
  const accuracyCircleRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadLeaflet = async () => {
      try {
        if (window.L) {
          setIsLoading(false);
          initializeMap();
          return;
        }

        const existingCSS = document.querySelector('link[href*="leaflet"]');
        if (!existingCSS) {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
          link.crossOrigin = 'anonymous';
          document.head.appendChild(link);
        }

        const existingScript = document.querySelector('script[src*="leaflet"]');
        if (!existingScript) {
          const script = document.createElement('script');
          script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
          script.crossOrigin = 'anonymous';
          script.onload = () => {
            setIsLoading(false);
            setTimeout(() => initializeMap(), 50);
          };
          script.onerror = () => {
            setError('Failed to load map library');
            setIsLoading(false);
          };
          document.head.appendChild(script);
        } else {
          setIsLoading(false);
          setTimeout(() => initializeMap(), 50);
        }
      } catch (err) {
        setError('Failed to load map library');
        setIsLoading(false);
      }
    };

    loadLeaflet();
  }, []);

  const initializeMap = () => {
    if (!mapRef.current || !window.L || mapInstanceRef.current) return;

    mapInstanceRef.current = window.L.map(mapRef.current).setView([39.8283, -98.5795], 4);

    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(mapInstanceRef.current);

    locateUser();
  };

  const locateUser = () => {
    if (!navigator.geolocation || !mapInstanceRef.current || !window.L) return;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const accuracy = pos.coords.accuracy || 0;

        if (userMarkerRef.current) {
          mapInstanceRef.current.removeLayer(userMarkerRef.current);
        }
        if (accuracyCircleRef.current) {
          mapInstanceRef.current.removeLayer(accuracyCircleRef.current);
        }

        userMarkerRef.current = window.L.marker([lat, lng], {
          title: 'Your location'
        }).addTo(mapInstanceRef.current);

        accuracyCircleRef.current = window.L.circle([lat, lng], {
          radius: accuracy,
          color: '#3b82f6',
          fillColor: '#93c5fd',
          fillOpacity: 0.3
        }).addTo(mapInstanceRef.current);

        mapInstanceRef.current.setView([lat, lng], 14);
      },
      () => {
        // keep default center
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="card">
          <div className="card-body text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading map…</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="card">
          <div className="card-body">
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              <strong>Error:</strong> {error}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-body p-0">
          <div
            ref={mapRef}
            style={{ height: '600px', width: '100%', minHeight: '600px', backgroundColor: '#f3f4f6' }}
            className="rounded-lg"
          />
        </div>
      </div>
    </div>
  );
}

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { getLocationLabel } from '../utils/locationLabel';

declare global {
  interface Window {
    L: any;
  }
}

interface UploadItem {
  _id: string;
  filename: string;
  type: string;
  note: string | null;
  fileUrl: string | null;
  transcription: string | null;
  translation: string | null;
  coords: { lat: number; lng: number } | null;
  createdAt: string;
  user: { name: string; code: string } | null;
}

const MEDIA_CONFIG: Record<string, { emoji: string; color: string; label: string }> = {
  image: { emoji: '📷', color: '#3b82f6', label: 'Image' },
  video: { emoji: '🎥', color: '#8b5cf6', label: 'Video' },
  audio: { emoji: '🎙️', color: '#ef4444', label: 'Audio' },
  other: { emoji: '📁', color: '#6b7280', label: 'File' },
};

function getMediaCategory(type: string | null): string {
  if (!type) return 'other';
  if (type.startsWith('image')) return 'image';
  if (type.startsWith('video')) return 'video';
  if (type.startsWith('audio')) return 'audio';
  return 'other';
}

function buildPopupHtml(upload: UploadItem, locationLabel?: string | null): string {
  const cat = getMediaCategory(upload.type);
  const cfg = MEDIA_CONFIG[cat];
  const mediaSrc = upload.fileUrl || '';
  const date = upload.createdAt
    ? new Date(upload.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—';

  let mediaHtml = '';
  if (mediaSrc) {
    if (cat === 'image') {
      mediaHtml = `<img src="${mediaSrc}" alt="Upload" style="width:100%;max-height:160px;object-fit:cover;border-radius:8px;margin-bottom:8px;" onerror="this.style.display='none'" />`;
    } else if (cat === 'video') {
      mediaHtml = `<video src="${mediaSrc}" controls style="width:100%;max-height:140px;border-radius:8px;margin-bottom:8px;background:#000;"></video>`;
    } else if (cat === 'audio') {
      mediaHtml = `<div style="margin-bottom:8px;"><audio src="${mediaSrc}" controls style="width:100%;"></audio></div>`;
    } else {
      mediaHtml = `<a href="${mediaSrc}" target="_blank" rel="noreferrer" style="display:inline-flex;align-items:center;gap:4px;color:#4f46e5;font-size:13px;font-weight:500;margin-bottom:8px;">📄 Open attachment</a>`;
    }
  }

  const transcriptionHtml = upload.transcription
    ? `<div style="background:#eef2ff;border:1px solid #c7d2fe;border-radius:6px;padding:8px 10px;margin-bottom:8px;">
        <div style="font-size:10px;font-weight:700;color:#4338ca;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">🎙️ Transcription</div>
        <div style="font-size:12px;color:#312e81;font-style:italic;max-height:80px;overflow-y:auto;line-height:1.4;">"${upload.transcription}"</div>
      </div>`
    : '';

  const translationHtml = upload.translation
    ? `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:8px 10px;margin-bottom:8px;">
        <div style="font-size:10px;font-weight:700;color:#166534;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">🌍 Translation</div>
        <div style="font-size:12px;color:#14532d;line-height:1.4;">"${upload.translation}"</div>
      </div>`
    : '';

  const noteHtml = upload.note
    ? `<div style="font-size:12px;color:#475569;margin-bottom:6px;"><strong>Note:</strong> ${upload.note}</div>`
    : '';

  return `
    <div style="width:260px;font-family:system-ui,-apple-system,sans-serif;">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">
        <span style="background:${cfg.color};color:white;border-radius:6px;padding:2px 8px;font-size:11px;font-weight:600;">${cfg.emoji} ${cfg.label}</span>
        <span style="font-size:11px;color:#94a3b8;">${date}</span>
      </div>
      ${mediaHtml}
      ${noteHtml}
      ${transcriptionHtml}
      ${translationHtml}
      <div style="display:flex;align-items:center;justify-content:space-between;padding-top:6px;border-top:1px solid #e2e8f0;">
        <div style="display:flex;align-items:center;gap:6px;">
          <div style="width:24px;height:24px;background:#dbeafe;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;">👤</div>
          <div>
            <div style="font-size:12px;font-weight:600;color:#1e293b;">${upload.user?.name || 'Unknown'}</div>
            <div style="font-size:10px;color:#94a3b8;">${upload.user?.code || ''}</div>
          </div>
        </div>
        <div style="font-size:10px;color:#94a3b8;max-width:120px;text-align:right;">
          📍 ${locationLabel ? `${locationLabel} (` : ''}${upload.coords?.lat?.toFixed(4)}, ${upload.coords?.lng?.toFixed(4)}${locationLabel ? ')' : ''}
        </div>
      </div>
    </div>
  `;
}

export default function MapViewSimple(): React.ReactElement {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const userMarkerRef = useRef<any>(null);
  const accuracyCircleRef = useRef<any>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [filterImages, setFilterImages] = useState(true);
  const [filterVideos, setFilterVideos] = useState(true);
  const [filterUser, setFilterUser] = useState('all');
  const [locationLabels, setLocationLabels] = useState<Record<string, string | null>>({});

  // ── Fetch uploads ────────────────────────────────────────────
  const fetchUploads = useCallback(async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;
      const res = await fetch('/api/uploads', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setUploads(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch uploads for map:', err);
    }
  }, []);

  // ── Load Leaflet via CDN ─────────────────────────────────────
  useEffect(() => {
    const loadLeaflet = async () => {
      try {
        if (window.L) {
          setIsLoading(false);
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
          script.onload = () => setIsLoading(false);
          script.onerror = () => {
            setError('Failed to load map library');
            setIsLoading(false);
          };
          document.head.appendChild(script);
        } else {
          setIsLoading(false);
        }
      } catch {
        setError('Failed to load map library');
        setIsLoading(false);
      }
    };
    loadLeaflet();
    fetchUploads();
  }, [fetchUploads]);

  // ── Initialize map once Leaflet + DOM are ready ──────────────
  useEffect(() => {
    if (isLoading || !window.L || !mapRef.current || mapInstanceRef.current) return;

    // Default center: Accra, Ghana
    mapInstanceRef.current = window.L.map(mapRef.current).setView([5.6037, -0.1870], 7);

    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(mapInstanceRef.current);
  }, [isLoading]);

  // ── Plot markers when uploads or filters change ──────────────
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !window.L) return;

    // Clear existing upload markers
    markersRef.current.forEach((m) => map.removeLayer(m));
    markersRef.current = [];

    const geoUploads = uploads.filter(
      (u) => u.coords && u.coords.lat != null && u.coords.lng != null
    );

    const filtered = geoUploads.filter((u) => {
      const cat = getMediaCategory(u.type);
      if (cat === 'image' && !filterImages) return false;
      if (cat === 'video' && !filterVideos) return false;
      if (filterUser !== 'all' && (u.user?.code || 'Unknown') !== filterUser) return false;
      return true;
    });

    const bounds: [number, number][] = [];

    filtered.forEach((upload) => {
      const lat = upload.coords!.lat;
      const lng = upload.coords!.lng;
      const cat = getMediaCategory(upload.type);
      const cfg = MEDIA_CONFIG[cat];

      const marker = window.L.marker([lat, lng], {
        icon: window.L.divIcon({
          className: 'upload-marker-icon',
          html: `<div style="
            background:${cfg.color};
            color:white;
            border-radius:50%;
            width:36px;height:36px;
            display:flex;align-items:center;justify-content:center;
            font-size:16px;
            box-shadow:0 2px 8px rgba(0,0,0,0.3);
            border:2px solid white;
            cursor:pointer;
          ">${cfg.emoji}</div>`,
          iconSize: [36, 36],
          iconAnchor: [18, 18],
          popupAnchor: [0, -20],
        }),
      });

      marker.bindPopup(buildPopupHtml(upload, locationLabels[upload._id]), {
        maxWidth: 280,
        className: 'upload-popup',
      });

      marker.addTo(map);
      markersRef.current.push(marker);
      bounds.push([lat, lng]);
    });

    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
  }, [uploads, filterImages, filterVideos, filterUser, locationLabels]);

  useEffect(() => {
    const candidates = uploads.filter((u) => u.coords?.lat != null && u.coords?.lng != null);
    candidates.forEach((u) => {
      if (locationLabels[u._id] !== undefined) return;
      getLocationLabel(Number(u.coords!.lat), Number(u.coords!.lng)).then((label) => {
        setLocationLabels((prev) => ({ ...prev, [u._id]: label }));
      });
    });
  }, [uploads, locationLabels]);

  // ── Locate user ──────────────────────────────────────────────
  const locateUser = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!navigator.geolocation || !map || !window.L) return;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const accuracy = pos.coords.accuracy || 0;

        if (userMarkerRef.current) map.removeLayer(userMarkerRef.current);
        if (accuracyCircleRef.current) map.removeLayer(accuracyCircleRef.current);

        userMarkerRef.current = window.L.marker([lat, lng], {
          icon: window.L.divIcon({
            className: 'user-location-icon',
            html: `<div style="
              background:linear-gradient(135deg,#06b6d4,#3b82f6);
              color:white;border-radius:50%;
              width:32px;height:32px;
              display:flex;align-items:center;justify-content:center;
              font-size:14px;
              box-shadow:0 0 12px rgba(59,130,246,0.5);
              border:3px solid white;
              animation:pulse 2s infinite;
            ">📍</div>`,
            iconSize: [32, 32],
            iconAnchor: [16, 16],
          }),
        })
          .addTo(map)
          .bindPopup('<strong>Your Location</strong>');

        accuracyCircleRef.current = window.L.circle([lat, lng], {
          radius: accuracy,
          color: '#3b82f6',
          fillColor: '#93c5fd',
          fillOpacity: 0.15,
          weight: 1,
        }).addTo(map);

        map.setView([lat, lng], 14);
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  // ── Derived data ─────────────────────────────────────────────
  const geoUploads = uploads.filter((u) => u.coords?.lat != null && u.coords?.lng != null);
  const uniqueUsers = Array.from(new Set(geoUploads.map((u) => u.user?.code || 'Unknown')));

  const visibleCount = geoUploads.filter((u) => {
    const cat = getMediaCategory(u.type);
    if (cat === 'image' && !filterImages) return false;
    if (cat === 'video' && !filterVideos) return false;
    if (filterUser !== 'all' && (u.user?.code || 'Unknown') !== filterUser) return false;
    return true;
  }).length;

  // ── Render ───────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="card">
          <div className="card-body text-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 font-medium">Loading map…</p>
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
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              <strong>Error:</strong> {error}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">📍 Geospatial Map</h1>
          <p className="text-sm text-gray-500 mt-1">
            Visualise salesperson uploads across the field —{' '}
            <span className="font-semibold text-blue-600">{visibleCount}</span> pinned of{' '}
            <span className="font-semibold">{geoUploads.length}</span> geolocated uploads
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchUploads}
            className="bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-xl hover:bg-gray-50 hover:shadow-sm text-sm font-medium transition-all flex items-center gap-2"
          >
            🔄 Refresh
          </button>
          <button
            onClick={locateUser}
            className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-4 py-2 rounded-xl hover:shadow-lg text-sm font-medium transition-all flex items-center gap-2"
          >
            📍 My Location
          </button>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="card">
        <div className="card-body py-3 px-5">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Filters</span>

            {/* Media type toggles */}
            {(['image', 'video'] as const).map((cat) => {
              const cfg = MEDIA_CONFIG[cat];
              const checked = cat === 'image' ? filterImages : filterVideos;
              const setter = cat === 'image' ? setFilterImages : setFilterVideos;
              return (
                <label key={cat} className="flex items-center gap-2 cursor-pointer select-none group">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => setter(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 focus:ring-2 focus:ring-blue-500"
                    style={{ accentColor: cfg.color }}
                  />
                  <span className="text-sm text-gray-700 group-hover:text-gray-900 transition-colors">
                    {cfg.emoji} {cfg.label}s
                  </span>
                </label>
              );
            })}

            {/* Separator */}
            <div className="hidden sm:block w-px h-5 bg-gray-200"></div>

            {/* User filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">👤</span>
              <select
                value={filterUser}
                onChange={(e) => setFilterUser(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Salespeople</option>
                {uniqueUsers.map((code) => (
                  <option key={code} value={code}>{code}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="card overflow-hidden">
        <div
          ref={mapRef}
          id="upload-map-container"
          style={{ height: '600px', width: '100%', minHeight: '600px', backgroundColor: '#f1f5f9' }}
          className="rounded-2xl"
        />
      </div>

      {/* Legend */}
      <div className="card">
        <div className="card-body py-3 px-5">
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Legend</span>
            {Object.entries(MEDIA_CONFIG)
              .filter(([key]) => key !== 'audio')
              .map(([key, cfg]) => (
              <div key={key} className="flex items-center gap-2">
                <span
                  className="inline-flex items-center justify-center w-6 h-6 rounded-full text-white text-xs"
                  style={{ background: cfg.color }}
                >
                  {cfg.emoji}
                </span>
                <span className="text-sm text-gray-600">{cfg.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

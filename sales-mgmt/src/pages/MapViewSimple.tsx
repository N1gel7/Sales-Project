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
  image: { emoji: '📷', color: '#639922', label: 'Image' },
  video: { emoji: '🎥', color: '#378ADD', label: 'Video' },
  audio: { emoji: '🎙️', color: '#BA7517', label: 'Audio' },
  other: { emoji: '📁', color: '#64748b', label: 'File' },
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
    <div style="width:260px;font-family:DM Sans,system-ui,sans-serif;border-radius:10px;overflow:hidden;">
      <div style="background:#0d0f14;color:#f2f0ea;padding:10px 12px;margin:-12px -12px 10px -12px;">
        <div style="font-size:11px;font-weight:600;opacity:0.85;">${cfg.emoji} ${cfg.label}</div>
        <div style="font-size:10px;opacity:0.6;margin-top:4px;">${date}</div>
      </div>
      ${mediaHtml}
      ${noteHtml}
      ${transcriptionHtml}
      ${translationHtml}
      <div style="display:flex;align-items:center;justify-content:space-between;padding-top:8px;border-top:1px solid #e8ecf1;">
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
      <div className="flex min-h-[320px] items-center justify-center rounded-xl border border-[var(--color-border-tertiary)] bg-[var(--surface)]">
        <div className="text-center">
          <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-2 border-[var(--brand-green)] border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading map…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
        {error}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0 rounded-xl border border-[var(--color-border-tertiary)] bg-[var(--surface-2)]">
      <div className="flex flex-col justify-between gap-3 border-b border-[var(--color-border-tertiary)] bg-[var(--surface)] px-4 py-3 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{visibleCount}</span> pins shown ·{' '}
            <span className="font-semibold">{geoUploads.length}</span> geolocated uploads
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={fetchUploads}
            className="rounded-lg border border-[var(--color-border-tertiary)] bg-background px-3 py-1.5 text-sm font-medium hover:bg-[var(--surface-2)]"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={locateUser}
            className="rounded-lg bg-[var(--brand-dark)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
          >
            My location
          </button>
        </div>
      </div>

      <div className="border-b border-[var(--color-border-tertiary)] bg-[var(--surface)] px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Filters</span>

            {/* Media type toggles */}
            {(['image', 'video'] as const).map((cat) => {
              const cfg = MEDIA_CONFIG[cat];
              const checked = cat === 'image' ? filterImages : filterVideos;
              const setter = cat === 'image' ? setFilterImages : setFilterVideos;
              return (
                <label key={cat} className="group flex cursor-pointer items-center gap-2 select-none">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => setter(e.target.checked)}
                    className="h-4 w-4 rounded border-input"
                    style={{ accentColor: cfg.color }}
                  />
                  <span className="text-sm text-foreground transition-colors group-hover:text-foreground">
                    {cfg.emoji} {cfg.label}s
                  </span>
                </label>
              );
            })}

            {/* Separator */}
            <div className="hidden h-5 w-px bg-[var(--color-border-tertiary)] sm:block" />

            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Rep</span>
              <select
                value={filterUser}
                onChange={(e) => setFilterUser(e.target.value)}
                className="rounded-lg border border-[var(--color-border-tertiary)] bg-background px-3 py-1.5 text-sm focus:border-[var(--brand-green)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-green)]/30"
              >
                <option value="all">All</option>
                {uniqueUsers.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </div>
          </div>
      </div>

      <div className="relative min-h-[420px] flex-1">
        <div
          ref={mapRef}
          id="upload-map-container"
          style={{ height: 'min(70vh, 640px)', width: '100%', minHeight: '420px', backgroundColor: 'var(--surface-2)' }}
          className="rounded-br-xl rounded-bl-xl"
        />
        <div className="pointer-events-none absolute bottom-4 left-4 z-[500] rounded-lg border border-[var(--color-border-tertiary)] bg-[var(--surface)] p-3 shadow-md">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Legend</p>
          <div className="flex flex-col gap-2">
            {Object.entries(MEDIA_CONFIG)
              .filter(([key]) => key !== 'audio' && key !== 'other')
              .map(([key, cfg]) => (
                <div key={key} className="flex items-center gap-2 text-sm">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: cfg.color }} />
                  <span className="text-muted-foreground">{cfg.label}</span>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}

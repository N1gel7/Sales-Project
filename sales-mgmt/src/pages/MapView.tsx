import React, { useEffect, useMemo, useState } from 'react';

type Point = { _id: string; type: 'invoice'|'upload'; lat: number; lng: number; label: string; time: string };

export default function MapView(): React.ReactElement {
  const [points, setPoints] = useState<Point[]>([]);
  const [center, setCenter] = useState<{lat:number,lng:number}>({ lat: 5.6037, lng: -0.1870 }); // Accra default

  useEffect(() => {
    (async () => {
      try {
        const [invRes, upRes] = await Promise.all([
          fetch('/api/invoices', { headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}` } }),
          fetch('/api/uploads', { headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}` } })
        ]);
        const [invoices, uploads] = await Promise.all([invRes.json(), upRes.json()]);
        const invPts: Point[] = (invoices || []).filter((i:any)=>i.location?.lat && i.location?.lng).map((i:any) => ({
          _id: i._id,
          type: 'invoice',
          lat: i.location.lat,
          lng: i.location.lng,
          label: `${i.client} • ${i.product}`,
          time: new Date(i.createdAt).toLocaleString(),
        }));
        const upPts: Point[] = (uploads || []).filter((u:any)=>u.coords?.lat && u.coords?.lng).map((u:any) => ({
          _id: u._id,
          type: 'upload',
          lat: u.coords.lat,
          lng: u.coords.lng,
          label: u.note || u.type,
          time: new Date(u.createdAt).toLocaleString(),
        }));
        const all = [...invPts, ...upPts];
        setPoints(all);
        if (all.length > 0) setCenter({ lat: all[0].lat, lng: all[0].lng });
      } catch {}
    })();
  }, []);

  const mapSrc = useMemo(() => {
    const markers = points.slice(0, 50).map(p => `${p.lat},${p.lng}`).join('|');
    // Using Google Static Maps-like format for placeholder; you can switch to Leaflet/Mapbox later
    // Here we embed OpenStreetMap with markers via www.openstreetmap.org/export/embed, limited customization
    // Fallback: show a simple list if iframe fails.
    return `https://maps.google.com/maps?q=${center.lat},${center.lng}&z=13&output=embed`;
  }, [center, points]);

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header">Map</div>
        <div className="card-body space-y-3">
          <div className="h-96 border rounded-md overflow-hidden">
            <iframe title="map" src={mapSrc} className="w-full h-full" />
          </div>
          <div className="text-xs text-gray-500">Showing last {points.length} locations. Click items below to recenter.</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">Recent Locations</div>
        <div className="card-body">
          <ul className="divide-y divide-gray-100">
            {points.map(p => (
              <li key={p._id} className="py-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">
                    {p.type === 'invoice' ? 'Invoice' : 'Upload'} • {p.label}
                  </div>
                  <GeoLabel lat={p.lat} lng={p.lng} time={p.time} />
                </div>
                <button className="h-8 px-3 rounded-md border border-gray-200 text-sm" onClick={()=>setCenter({ lat: p.lat, lng: p.lng })}>Center</button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function GeoLabel({ lat, lng, time }: { lat: number; lng: number; time: string }) {
  const [label, setLabel] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/reverse-geocode?lat=${lat}&lng=${lng}`);
        const data = await res.json();
        if (data?.display_name) setLabel(data.display_name);
      } catch {}
    })();
  }, [lat, lng]);
  return (
    <div className="text-xs text-gray-500">
      📍 {lat.toFixed(4)}, {lng.toFixed(4)} {label ? `• ${label}` : ''} • {time}
    </div>
  );
}



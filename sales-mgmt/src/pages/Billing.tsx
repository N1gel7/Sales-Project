import React, { useState } from 'react';

export default function Billing(): React.ReactElement {
  const [client, setClient] = useState('');
  const [product, setProduct] = useState('');
  const [price, setPrice] = useState('');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);

  function captureLocation(): void {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) =>
      setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
    );
  }

  function sendInvoice(): void {
    // Stub: wire to backend email service
    alert('Invoice sent to client email (stub).');
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header">Generate Invoice</div>
        <div className="card-body grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <input className="h-10 border border-gray-200 rounded-md px-3 text-sm w-full" placeholder="Client name" value={client} onChange={(e) => setClient(e.target.value)} />
            <input className="h-10 border border-gray-200 rounded-md px-3 text-sm w-full" placeholder="Product details" value={product} onChange={(e) => setProduct(e.target.value)} />
            <input className="h-10 border border-gray-200 rounded-md px-3 text-sm w-full" placeholder="Price" value={price} onChange={(e) => setPrice(e.target.value)} />
            <div className="flex items-center gap-2">
              <button onClick={captureLocation} className="h-9 px-3 rounded-md border border-gray-200 text-sm">Capture Location</button>
              {location ? <span className="text-xs text-gray-600">{location.lat.toFixed(4)}, {location.lng.toFixed(4)}</span> : <span className="text-xs text-gray-500">No location</span>}
            </div>
          </div>
          <div className="space-y-2">
            <div className="card">
              <div className="card-header">Preview</div>
              <div className="card-body text-sm space-y-1">
                <div><span className="text-gray-500">Client:</span> {client || '—'}</div>
                <div><span className="text-gray-500">Product:</span> {product || '—'}</div>
                <div><span className="text-gray-500">Price:</span> {price || '—'}</div>
                <div><span className="text-gray-500">Date/Time:</span> {new Date().toLocaleString()}</div>
                <div><span className="text-gray-500">Location:</span> {location ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : '—'}</div>
              </div>
            </div>
            <button onClick={sendInvoice} className="h-10 w-full rounded-md bg-blue-600 text-white text-sm">Email Invoice</button>
          </div>
        </div>
      </div>
    </div>
  );
}



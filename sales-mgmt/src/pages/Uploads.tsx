import React, { useRef, useState, useEffect } from 'react';

type Location = { lat: number; lng: number } | null;

export default function Uploads(): React.ReactElement {
  const [location, setLocation] = useState<Location>(null);
  const [audioText, setAudioText] = useState<string>('');
  const [items, setItems] = useState<any[]>([]);
  const [note, setNote] = useState('');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  async function load() {
    try {
      const data = await fetch('/api/uploads', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
      });
      const uploads = await data.json();
      setItems(uploads);
    } catch (error) {
      console.error('Failed to load uploads:', error);
    }
  }

  useEffect(() => { 
    load(); 
    // Auto-capture location on page load
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => setLocation(null),
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }
  }, []);

  function captureLocation(): void {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    });
  }

  async function saveUpload() {
    if (!note && !audioText) {
      alert('Please add a note or transcription');
      return;
    }
    try {
      await fetch('/api/uploads', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({ type: 'audio', note: note || audioText, coords: location })
      });
      setNote(''); setAudioText('');
      await load();
      alert('Upload saved successfully!');
    } catch (error) {
      alert('Error saving upload: ' + error.message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header">Upload Media</div>
        <div className="card-body grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Product Photos / Selfies</label>
            <input type="file" multiple accept="image/*" className="block" onClick={captureLocation} />
            <label className="text-sm font-medium">Short Videos</label>
            <input type="file" accept="video/*" className="block" onClick={captureLocation} />
            <label className="text-sm font-medium">Voice Notes</label>
            <input type="file" accept="audio/*" className="block" />
            <div className="flex items-center gap-2">
              <button className="h-9 px-3 rounded-md bg-blue-600 text-white text-sm">Transcribe</button>
              <span className="text-xs text-gray-500">Preview and translation (stub)</span>
            </div>
            {audioRef.current ? <audio ref={audioRef} controls /> : null}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Note</label>
            <input 
              value={note} 
              onChange={(e) => setNote(e.target.value)} 
              className="w-full h-10 border border-gray-200 rounded-md px-3 text-sm" 
              placeholder="Add a note about this upload" 
            />
            <label className="text-sm font-medium">Transcribed Text</label>
            <textarea value={audioText} onChange={(e) => setAudioText(e.target.value)} className="w-full h-32 border border-gray-200 rounded-md p-2 text-sm" placeholder="Transcription will appear here..." />
            <div className="text-xs text-gray-500">Location captured automatically on page load.</div>
            {location ? (
              <div className="text-sm text-green-600">📍 Lat: {location.lat.toFixed(4)}, Lng: {location.lng.toFixed(4)}</div>
            ) : (
              <div className="text-sm text-gray-500">Location not captured yet.</div>
            )}
            <button onClick={saveUpload} className="h-9 px-3 rounded-md bg-green-600 text-white text-sm">Save Upload</button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">Recent Uploads</div>
        <div className="card-body">
          <ul className="divide-y divide-gray-100">
            {items.map((upload) => (
              <li key={upload._id} className="py-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">{upload.note || 'No note'}</div>
                  <div className="text-xs text-gray-500">
                    {upload.type} • {upload.user?.code || 'Unknown'}
                    {upload.coords?.lat && upload.coords?.lng ? ` • 📍 (${upload.coords.lat.toFixed(4)}, ${upload.coords.lng.toFixed(4)})` : null}
                  </div>
                </div>
                <div className="text-xs text-gray-500">{new Date(upload.createdAt).toLocaleString()}</div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}



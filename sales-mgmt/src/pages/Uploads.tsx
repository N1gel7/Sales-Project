import React, { useRef, useState } from 'react';

type Location = { lat: number; lng: number } | null;

export default function Uploads(): React.ReactElement {
  const [location, setLocation] = useState<Location>(null);
  const [audioText, setAudioText] = useState<string>('');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  function captureLocation(): void {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    });
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
            <label className="text-sm font-medium">Transcribed Text</label>
            <textarea value={audioText} onChange={(e) => setAudioText(e.target.value)} className="w-full h-40 border border-gray-200 rounded-md p-2 text-sm" placeholder="Transcription will appear here..." />
            <div className="text-xs text-gray-500">Location captured when selecting files.</div>
            {location ? (
              <div className="text-sm">Lat: {location.lat.toFixed(5)}, Lng: {location.lng.toFixed(5)}</div>
            ) : (
              <div className="text-sm text-gray-500">Location not captured yet.</div>
            )}
            <button className="h-9 px-3 rounded-md bg-green-600 text-white text-sm">Submit</button>
          </div>
        </div>
      </div>
    </div>
  );
}



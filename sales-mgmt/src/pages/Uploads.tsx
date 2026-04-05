import React, { useState, useEffect, useRef } from 'react';

type Location = { lat: number; lng: number } | null;

export default function Uploads(): React.ReactElement {
  const [location, setLocation] = useState<Location>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  
  const [items, setItems] = useState<any[]>([]);
  const [note, setNote] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Speech Recognition State
  const [transcription, setTranscription] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);

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

  // Set up Speech Recognition on mount
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        let currentTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            currentTranscript += transcript + ' ';
          }
        }
        if (currentTranscript) {
          setTranscription((prev) => prev + currentTranscript);
        }
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        setIsRecording(false);
      };
      
      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
    } else {
      if (!recognitionRef.current) {
        alert("Your browser does not support Speech Recognition.");
        return;
      }
      // setTranscription(''); // optional to clear previous
      recognitionRef.current.start();
      setIsRecording(true);
    }
  };

  const handleLocationSuccess = (pos: GeolocationPosition) => {
    if (pos.coords.accuracy > 1500) {
      setLocationError(`Location captured, but precision is weak (${pos.coords.accuracy.toFixed(0)}m accuracy).`);
    } else {
      setLocationError(null);
    }
    setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
  };

  const handleLocationError = (err: GeolocationPositionError) => {
    let msg = 'Failed to get location';
    if (err.code === err.PERMISSION_DENIED) msg = 'Location access denied by user.';
    else if (err.code === err.POSITION_UNAVAILABLE) msg = 'Location information is unavailable.';
    else if (err.code === err.TIMEOUT) msg = 'The request to get user location timed out.';
    setLocationError(msg);
    setLocation(null);
  };

  useEffect(() => { 
    load(); 
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        handleLocationSuccess,
        handleLocationError,
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    } else {
      setLocationError("Geolocation is not supported by this browser.");
    }
  }, []);

  function captureLocation(): void {
    setLocationError(null);
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      handleLocationSuccess,
      handleLocationError,
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      const maxSize = 100 * 1024 * 1024; // 100MB
      if (file.size > maxSize) {
        alert(`File too large. Maximum size is 100MB. Your file is ${(file.size / 1024 / 1024).toFixed(2)}MB`);
        e.target.value = '';
        return;
      }
      
      setSelectedFile(file);
      captureLocation();
    }
  }

  async function uploadFile() {
    if (!selectedFile) {
      alert('Please select a file');
      return;
    }
    
    setUploading(true);
    setUploadProgress(0);
    try {
      const token = localStorage.getItem('auth_token');
      
      const payload = {
        filename: selectedFile.name,
        type: selectedFile.type.startsWith('image/') ? 'image' : 
              selectedFile.type.startsWith('video/') ? 'video' : 'audio',
        note: note,
        transcription: transcription.trim() || undefined,
        coords: location || undefined
      };
      
      const res = await fetch('/api/uploads', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Server error: ${res.status} - ${errorText}`);
      }
      
      setNote(''); 
      setTranscription('');
      setSelectedFile(null);
      await load();
      alert('Upload successful!');
    } catch (error) {
      alert('Upload failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header">Upload Media via Web</div>
        <div className="card-body grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Select File</label>
            <input 
              type="file" 
              accept="image/*,video/*,audio/*" 
              onChange={handleFileSelect}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" 
            />
            {selectedFile && (
              <div className="mt-2 p-2 bg-gray-50 rounded-md">
                <div className="text-sm font-medium">{selectedFile.name}</div>
                <div className="text-xs text-gray-500">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB • {selectedFile.type}
                </div>
                {selectedFile.type.startsWith('image/') && (
                  <img src={URL.createObjectURL(selectedFile)} alt="Preview" className="mt-2 max-w-full h-32 object-cover rounded" />
                )}
                {selectedFile.type.startsWith('video/') && (
                  <video src={URL.createObjectURL(selectedFile)} controls className="mt-2 max-w-full h-32 rounded" />
                )}
                {selectedFile.type.startsWith('audio/') && (
                  <audio src={URL.createObjectURL(selectedFile)} controls className="mt-2 w-full" />
                )}
              </div>
            )}
          </div>
          <div className="space-y-2 flex flex-col justify-between">
            <div>
              <label className="text-sm font-medium">Note / Meta</label>
              <input 
                value={note} 
                onChange={(e) => setNote(e.target.value)} 
                className="w-full h-10 border border-gray-200 rounded-md px-3 text-sm mb-3" 
                placeholder="Add a text note about this upload" 
              />
              
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium">Voice Transcription (Speech-to-Text)</label>
                <button
                  onClick={toggleRecording}
                  className={`text-xs px-2 py-1 rounded-md text-white transition-colors flex items-center ${
                    isRecording ? 'bg-red-500 animate-pulse' : 'bg-indigo-600 hover:bg-indigo-500'
                  }`}
                >
                  {isRecording ? "🔴 Recording..." : "🎙️ Speak"}
                </button>
              </div>
              
              <textarea
                value={transcription}
                onChange={(e) => setTranscription(e.target.value)}
                rows={3}
                className="w-full border border-gray-200 rounded-md p-2 text-sm"
                placeholder="Click the microphone button to dictate a voice note..."
              />
              
              <div className="mt-2 text-xs">
                {location ? (
                  <div className="text-green-600">📍 Lat: {location.lat.toFixed(4)}, Lng: {location.lng.toFixed(4)}</div>
                ) : (
                  <div className="text-gray-500">Location not captured yet.</div>
                )}
                {locationError && <div className="text-red-500 mt-1">⚠️ {locationError}</div>}
              </div>
            </div>

            <div className="pt-4">
              <button 
                onClick={uploadFile} 
                disabled={!selectedFile || uploading}
                className="w-full h-9 px-3 rounded-md bg-green-600 text-white text-sm font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {uploading ? `Uploading... ${uploadProgress}%` : 'Complete Upload'}
              </button>
              {uploading && (
                <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-green-600 h-2 rounded-full transition-all duration-300" 
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">Your Pipeline Uploads</div>
        <div className="card-body">
          <ul className="divide-y divide-gray-100">
            {items.map((upload) => (
              <li key={upload._id} className="py-3 flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="text-sm font-medium">{upload.note || 'No text note'}</div>
                  <div className="text-xs text-gray-500 mb-2">
                    {upload.type.toUpperCase()} • {upload.user?.code || 'Unknown Rep'}
                    {upload.coords?.lat && upload.coords?.lng ? ` • 📍 (${upload.coords.lat.toFixed(4)}, ${upload.coords.lng.toFixed(4)})` : null}
                  </div>
                  
                  {upload.transcription && (
                    <div className="mt-2 p-3 bg-blue-50/50 border border-blue-100 rounded-md text-sm">
                      <div className="font-semibold text-blue-900 mb-1 flex items-center gap-1">🎙️ Transcription:</div>
                      <p className="text-blue-800">"{upload.transcription}"</p>
                      {upload.translation && (
                        <>
                          <div className="font-semibold text-blue-900 mt-2 flex items-center gap-1">🌍 Translation:</div>
                          <p className="text-blue-800">"{upload.translation}"</p>
                        </>
                      )}
                    </div>
                  )}

                  {(upload.fileUrl || upload.mediaUrl) && (
                    <div className="mt-3">
                      {upload.type === 'image' && (
                        <img src={upload.fileUrl || upload.mediaUrl} alt="Upload" className="h-32 object-cover rounded-md border" />
                      )}
                      {upload.type === 'video' && (
                        <video src={upload.fileUrl || upload.mediaUrl} controls className="h-40 rounded-md bg-black" />
                      )}
                      {upload.type === 'audio' && (
                        <audio src={upload.fileUrl || upload.mediaUrl} controls className="w-full max-w-sm" />
                      )}
                    </div>
                  )}
                </div>
                <div className="text-xs text-gray-500 whitespace-nowrap">{new Date(upload.createdAt).toLocaleDateString()}</div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
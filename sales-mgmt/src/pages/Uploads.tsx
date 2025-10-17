import React, { useState, useEffect } from 'react';

type Location = { lat: number; lng: number } | null;

export default function Uploads(): React.ReactElement {
  const [location, setLocation] = useState<Location>(null);
  const [items, setItems] = useState<any[]>([]);
  const [note, setNote] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

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

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (100MB limit)
      const maxSize = 100 * 1024 * 1024; // 100MB
      if (file.size > maxSize) {
        alert(`File too large. Maximum size is 100MB. Your file is ${(file.size / 1024 / 1024).toFixed(2)}MB`);
        e.target.value = ''; // Clear the input
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
      // Get presigned URL from our API
      const token = localStorage.getItem('auth_token');
      const user = JSON.parse(localStorage.getItem('user_info') || '{}');
      
      console.log('Uploading file:', selectedFile.name, 'Type:', selectedFile.type);
      console.log('User:', user);
      console.log('Token exists:', !!token);
      
      const res = await fetch('/api/media-upload', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          type: selectedFile.type.startsWith('image/') ? 'image' : 
                selectedFile.type.startsWith('video/') ? 'video' : 'audio',
          note, 
          coords: location,
          user
        })
      });
      
      console.log('Response status:', res.status);
      if (!res.ok) {
        const errorText = await res.text();
        console.error('Response error:', errorText);
        throw new Error(`Server error: ${res.status} - ${errorText}`);
      }
      
      const { uploadUrl, uploadId, publicUrl } = await res.json();
      
      // Upload file directly to R2 with progress tracking
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const percentComplete = (e.loaded / e.total) * 100;
            setUploadProgress(Math.round(percentComplete));
            console.log(`Upload progress: ${Math.round(percentComplete)}%`);
          }
        });
        
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(xhr.response);
          } else {
            reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
          }
        });
        
        xhr.addEventListener('error', () => {
          reject(new Error('Upload failed: Network error'));
        });
        
        xhr.addEventListener('timeout', () => {
          reject(new Error('Upload failed: Timeout'));
        });
        
        xhr.open('PUT', uploadUrl);
        xhr.setRequestHeader('Content-Type', selectedFile.type);
        xhr.timeout = 300000; // 5 minutes timeout
        xhr.send(selectedFile);
      });
      
      // If it's audio, transcribe it
      if (selectedFile.type.startsWith('audio/')) {
        try {
          await fetch('/api/media-transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uploadId, audioUrl: publicUrl })
          });
        } catch (e) {
          console.warn('Transcription failed:', e);
        }
      }
      
      setNote(''); setSelectedFile(null);
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
        <div className="card-header">Upload Media</div>
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
          <div className="space-y-2">
            <label className="text-sm font-medium">Note</label>
            <input 
              value={note} 
              onChange={(e) => setNote(e.target.value)} 
              className="w-full h-10 border border-gray-200 rounded-md px-3 text-sm" 
              placeholder="Add a note about this upload" 
            />
            <div className="text-xs text-gray-500">Location captured automatically on page load.</div>
            {location ? (
              <div className="text-sm text-green-600">📍 Lat: {location.lat.toFixed(4)}, Lng: {location.lng.toFixed(4)}</div>
            ) : (
              <div className="text-sm text-gray-500">Location not captured yet.</div>
            )}
            <button 
              onClick={uploadFile} 
              disabled={!selectedFile || uploading}
              className="h-9 px-3 rounded-md bg-green-600 text-white text-sm disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {uploading ? `Uploading... ${uploadProgress}%` : 'Upload File'}
            </button>
            {uploading && (
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-green-600 h-2 rounded-full transition-all duration-300" 
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">Recent Uploads</div>
        <div className="card-body">
          <ul className="divide-y divide-gray-100">
            {items.map((upload) => (
              <li key={upload._id} className="py-3 flex items-center justify-between">
                <div className="flex-1">
                  <div className="text-sm font-medium">{upload.note || 'No note'}</div>
                  <div className="text-xs text-gray-500">
                    {upload.type} • {upload.user?.code || 'Unknown'}
                    {upload.coords?.lat && upload.coords?.lng ? ` • 📍 (${upload.coords.lat.toFixed(4)}, ${upload.coords.lng.toFixed(4)})` : null}
                  </div>
                  {upload.transcript && (
                    <div className="text-xs text-blue-600 mt-1 italic">"{upload.transcript}"</div>
                  )}
                  {upload.mediaUrl && (
                    <div className="mt-2">
                      {upload.type === 'image' && (
                        <img src={upload.mediaUrl} alt="Upload" className="h-20 w-20 object-cover rounded" />
                      )}
                      {upload.type === 'video' && (
                        <video src={upload.mediaUrl} controls className="h-20 w-32 rounded" />
                      )}
                      {upload.type === 'audio' && (
                        <audio src={upload.mediaUrl} controls className="w-full" />
                      )}
                    </div>
                  )}
                </div>
                <div className="text-xs text-gray-500 ml-4">{new Date(upload.createdAt).toLocaleString()}</div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
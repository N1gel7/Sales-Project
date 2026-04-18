import React, { useState, useEffect, useRef, useMemo } from 'react';
import { api } from '../services/api';
import LocationText from '../components/LocationText';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type Location = { lat: number; lng: number } | null;

export default function Uploads(): React.ReactElement {
  const userInfo = typeof window !== 'undefined' ? localStorage.getItem('user_info') : null;
  const user = userInfo ? JSON.parse(userInfo) : null;
  const isSales = user?.role === 'sales';
  const isAdminOrManager = user?.role === 'admin' || user?.role === 'manager';

  const [location, setLocation] = useState<Location>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  
  const [items, setItems] = useState<any[]>([]);
  const [mediaFilter, setMediaFilter] = useState<'all' | 'image' | 'video'>('all');
  const [userFilter, setUserFilter] = useState('all');
  const [note, setNote] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Speech Recognition State
  const [transcription, setTranscription] = useState('');
  const [interimTranscription, setInterimTranscription] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Audio Visualizer Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  async function load() {
    try {
      if (!localStorage.getItem('auth_token')) {
        setItems([]);
        return;
      }
      const data = await api.listUploads();
      setItems(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load uploads:', error);
      setItems([]);
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
        let currentFinalTranscript = '';
        let currentInterimTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            currentFinalTranscript += transcript + ' ';
          } else {
            currentInterimTranscript += transcript;
          }
        }
        
        if (currentFinalTranscript) {
          setTranscription((prev) => prev + currentFinalTranscript);
        }
        setInterimTranscription(currentInterimTranscript);
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        setIsRecording(false);
        stopVisualizer();
      };
      
      recognition.onend = () => {
        setIsRecording(false);
        stopVisualizer();
        setInterimTranscription('');
      };

      recognitionRef.current = recognition;
    }

    return () => {
      stopVisualizer();
    };
  }, []);

  const startVisualizer = async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioCtx;

      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }
      
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;
      
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      visualize();
      return true;
    } catch (err) {
      console.error('Error accessing mic for visualizer:', err);
      // If visualizer fails, we can still fall back and try SpeechRecognition
      return true; 
    }
  };

  const stopVisualizer = () => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (mediaStreamRef.current) mediaStreamRef.current.getTracks().forEach(track => track.stop());
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
    }
    
    const canvas = canvasRef.current;
    if (canvas) {
      const canvasCtx = canvas.getContext('2d');
      if (canvasCtx) canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const visualize = () => {
    if (!canvasRef.current || !analyserRef.current) return;
    const canvas = canvasRef.current;
    const canvasCtx = canvas.getContext('2d');
    if (!canvasCtx) return;

    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationFrameRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 2.5;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const rawValue = dataArray[i]; // 0 to 255
        
        // Scale the raw value down so it fits nicely inside the canvas height
        let scaledHeight = (rawValue / 255) * canvas.height;
        
        // Ensure there is always a tiny blip even during perfect silence
        if (scaledHeight < 2) {
          scaledHeight = 2;
        }

        // dynamic coloring based on intensity
        const r = Math.min(255, 79 + rawValue); 
        const g = 70;
        const b = 229;

        canvasCtx.fillStyle = `rgb(${r},${g},${b})`;
        canvasCtx.fillRect(x, (canvas.height - scaledHeight) / 2, barWidth, scaledHeight);

        x += barWidth + 1;
      }
    };
    draw();
  };

  const toggleRecording = async () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      stopVisualizer();
      setInterimTranscription('');
    } else {
      if (!recognitionRef.current) {
        toast.error('Speech recognition is not supported in this browser.');
        return;
      }
      
      setIsRecording(true);

      // We ensure the visualizer's getUserMedia grabs the microphone first
      // Some browsers drop SpeechRecognition if multiple inputs compete simultaneously.
      await startVisualizer();
      
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.error("Speech Recognition Engine failed to start", e);
      }
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
      const maxSize = 25 * 1024 * 1024; // keep in sync with API Multer limit (25MB)
      if (file.size > maxSize) {
        toast.error(`File too large (max 25MB). Yours is ${(file.size / 1024 / 1024).toFixed(2)}MB.`);
        e.target.value = '';
        return;
      }
      
      setSelectedFile(file);
      captureLocation();
    }
  }

  async function uploadFile() {
    if (!selectedFile) {
      toast.error('Choose a file to upload.');
      return;
    }
    
    setUploading(true);
    setUploadProgress(0);
    try {
      const token = localStorage.getItem('auth_token');

      const formData = new FormData();
      // Ensure the browser explicitly passes the filename parameter inside the blob payload
      formData.append('files', selectedFile, selectedFile.name);
      
      if (note.trim()) formData.append('note', note.trim());
      if (transcription.trim()) formData.append('transcription', transcription.trim());
      if (interimTranscription.trim()) formData.append('interimTranscription', interimTranscription.trim());
      if (location) formData.append('coords', JSON.stringify(location));

      await api.createUpload(formData);
      
      setNote(''); 
      setTranscription('');
      setInterimTranscription('');
      setSelectedFile(null);
      await load();
      toast.success('Upload complete.');
    } catch (error: any) {
      toast.error(error?.message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  const uniqueUsers = useMemo(() => {
    const map = new Map<string, string>();
    items.forEach(u => {
      if (u.user?.code) map.set(u.user.code, u.user.name || u.user.code);
    });
    return Array.from(map.entries()).map(([code, name]) => ({ code, name }));
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((upload) => {
      const t = upload.type || '';
      const isImage = t.startsWith('image/') || t === 'image';
      const isVideo = t.startsWith('video/') || t === 'video';

      let fitsMedia = true;
      if (mediaFilter === 'image') fitsMedia = isImage;
      if (mediaFilter === 'video') fitsMedia = isVideo;

      let fitsUser = true;
      if (userFilter !== 'all') {
        fitsUser = upload.user?.code === userFilter;
      }
      
      return fitsMedia && fitsUser;
    });
  }, [items, mediaFilter, userFilter]);

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      {isSales && (
        <div className="w-full shrink-0 border-[var(--color-border-tertiary)] bg-[var(--surface)] lg:w-[360px] lg:border-r lg:pr-6">
          <div className="card border-0 shadow-none lg:rounded-xl">
          <div className="card-header border-[var(--color-border-tertiary)] bg-transparent px-0 pt-0">Upload</div>
        <div className="card-body grid grid-cols-1 gap-4 px-0">
          <div className="space-y-2">
            <label className="text-sm font-medium">Select File</label>
            <input 
              type="file" 
              accept="image/*,video/*" 
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
                  <video src={URL.createObjectURL(selectedFile)} controls className="mt-2 max-h-[120px] w-full rounded-lg bg-black" />
                )}
              </div>
            )}
            
            <div className="mt-2 text-xs">
              {location ? (
                <div className="text-green-600">
                  📍 <LocationText lat={location.lat} lng={location.lng} />
                </div>
              ) : (
                <div className="text-gray-500">Location not captured yet.</div>
              )}
              {locationError && <div className="text-red-500 mt-1">⚠️ {locationError}</div>}
            </div>
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
              
              <div className="flex flex-col gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg shadow-inner">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-semibold text-slate-700">Voice Transcription</label>
                    {isRecording && <span className="flex h-2 w-2 rounded-full bg-red-500 animate-pulse"></span>}
                  </div>
                  <button
                    onClick={toggleRecording}
                    className={`text-xs px-3 py-1.5 rounded-full font-medium shadow-sm transition-all flex items-center gap-1.5 ${
                      isRecording ? 'bg-red-50 hover:bg-red-100 border border-red-200 text-red-600' : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                    }`}
                  >
                    {isRecording ? "🛑 Stop" : "🎙️ Start Recording"}
                  </button>
                </div>
                
                {/* Visualizer Canvas */}
                <div className={`w-full overflow-hidden transition-all duration-300 ${isRecording ? 'h-16 opacity-100' : 'h-0 opacity-0'}`}>
                  <canvas ref={canvasRef} className="w-full h-16 rounded bg-slate-100 border-b border-slate-200" width={400} height={64}></canvas>
                </div>
                
                {/* Live Preview Window */}
                <div className="relative mt-2">
                  <div className="absolute top-0 right-0 px-2 py-1 text-[10px] uppercase font-bold text-slate-400 bg-white rounded-bl-md border-b border-l border-slate-200">
                    Live Preview
                  </div>
                  <div className="w-full min-h-[5rem] bg-white border border-slate-200 rounded-md p-3 text-sm leading-relaxed max-h-40 overflow-y-auto">
                    {transcription === '' && interimTranscription === '' && !isRecording ? (
                      <span className="text-slate-400 italic">Click "Start Recording" to dictate a voice note...</span>
                    ) : (
                      <>
                        <span className="text-slate-800">{transcription}</span>
                        {interimTranscription && (
                          <span className="text-indigo-500 italic bg-indigo-50 px-1 rounded ml-1 animate-pulse">
                            {interimTranscription}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4">
              <button 
                onClick={uploadFile} 
                disabled={!selectedFile || uploading}
                className="w-full h-10 rounded-md bg-green-600 hover:bg-green-700 text-white text-sm font-semibold disabled:bg-slate-300 disabled:text-slate-500 shadow-sm transition-all disabled:cursor-not-allowed"
              >
                {uploading ? `Uploading... ${uploadProgress}%` : 'Upload with Metadata'}
              </button>
              {uploading && (
                <div className="mt-2 w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                  <div 
                    className="bg-green-500 h-1.5 rounded-full transition-all duration-300" 
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
              )}
            </div>
          </div>
        </div>
        </div>
      </div>
      )}

      <div className="min-w-0 flex-1 rounded-xl border border-[var(--color-border-tertiary)] bg-[var(--surface-2)] p-4">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-1">
            {(['all', 'image', 'video'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setMediaFilter(f)}
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors',
                  mediaFilter === f ? 'bg-[var(--brand-dark)] text-white' : 'bg-[var(--surface)] text-muted-foreground shadow-sm'
                )}
              >
                {f === 'all' ? 'All' : f}
              </button>
            ))}
          </div>
          {isAdminOrManager && (
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-muted-foreground">Filter by Rep:</label>
              <select
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
                className="h-8 max-w-[160px] rounded-md border border-[var(--color-border-tertiary)] bg-[var(--surface)] px-2 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand-green)]"
              >
                <option value="all">All Reps</option>
                {uniqueUsers.map(u => (
                  <option key={u.code} value={u.code}>{u.name} ({u.code})</option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="[column-fill:_balance] [column-gap:12px] md:columns-2 xl:columns-3">
            {filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center [column-span:all]">
                <svg width="120" height="100" viewBox="0 0 120 100" className="mb-4 text-muted-foreground/40" aria-hidden>
                  <rect x="10" y="20" width="45" height="35" rx="4" fill="currentColor" opacity="0.2" />
                  <rect x="65" y="15" width="40" height="50" rx="4" fill="currentColor" opacity="0.15" />
                  <circle cx="35" cy="70" r="12" fill="currentColor" opacity="0.12" />
                </svg>
                <p className="text-sm text-muted-foreground">No uploads yet</p>
              </div>
            ) : (
              filteredItems.map((upload) => {
                const t = upload.type || '';
                const isImage = t.startsWith('image/') || t === 'image';
                const isVideo = t.startsWith('video/') || t === 'video';
                const mediaSrc = upload.fileUrl || upload.mediaUrl;
                return (
                  <div key={upload._id} className="mb-3 break-inside-avoid rounded-lg border border-[var(--color-border-tertiary)] bg-[var(--surface)] p-3 shadow-sm transition-shadow hover:shadow-md">
                    <div className="group relative space-y-2">
                      <div>
                        <div className="text-sm font-semibold text-slate-800">{upload.note || 'No textual note provided'}</div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800 mr-2">
                            {(t || 'file').toUpperCase()}
                          </span>
                          Uploaded by <span className="font-medium text-slate-700">{upload.user?.code || 'Unknown Rep'}</span>
                          {upload.coords?.lat != null && upload.coords?.lng != null ? (
                            <>
                              {' '}• 📍 Location:{' '}
                              <LocationText lat={Number(upload.coords.lat)} lng={Number(upload.coords.lng)} />
                            </>
                          ) : null}
                        </div>
                      </div>

                      {upload.transcription && (
                        <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-lg shadow-sm">
                          <div className="text-xs font-bold text-indigo-900 uppercase tracking-wider mb-1 flex items-center gap-1">
                            <span className="text-sm">🎙️</span> Voice Transcription Transcript
                          </div>
                          <p className="text-indigo-800 text-sm italic leading-relaxed">&quot;{upload.transcription}&quot;</p>
                          {upload.translation && (
                            <>
                              <div className="text-xs font-bold text-indigo-900 uppercase tracking-wider mt-3 mb-1 flex items-center gap-1">
                                <span className="text-sm">🌍</span> Translation
                              </div>
                              <p className="text-indigo-800 text-sm leading-relaxed">&quot;{upload.translation}&quot;</p>
                            </>
                          )}
                        </div>
                      )}

                      {mediaSrc && (
                        <div className="relative mt-2 overflow-hidden rounded-lg border border-[var(--color-border-tertiary)] bg-[var(--surface-2)]">
                          {isImage && (
                            <img src={mediaSrc} alt="" className="max-h-56 w-full object-cover" />
                          )}
                          {isVideo && (
                            <video src={mediaSrc} controls className="max-h-56 w-full bg-black" />
                          )}
                          {!isImage && !isVideo && (
                            <div className="p-3">
                              <a href={mediaSrc} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-[var(--accent-blue)]">
                                Open file
                              </a>
                            </div>
                          )}
                          <div className="pointer-events-none absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/70 to-transparent p-3 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
                            <p className="line-clamp-2 text-xs text-white">{upload.note || '—'}</p>
                            <p className="mt-1 text-[10px] text-white/80">
                              {upload.coords?.lat != null && upload.coords?.lng != null ? (
                                <LocationText lat={Number(upload.coords.lat)} lng={Number(upload.coords.lng)} />
                              ) : (
                                '—'
                              )}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="mt-2 text-[10px] font-medium text-muted-foreground">
                      {upload.createdAt
                        ? new Date(upload.createdAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })
                        : '—'}
                    </div>
                  </div>
                );
              })
            )}
        </div>
      </div>
    </div>
  );
}
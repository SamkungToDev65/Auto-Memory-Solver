import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Video, Zap, RotateCcw, Pause, Grid, Scan, CheckCircle, Activity, Monitor, AlertTriangle, Eye, EyeOff } from 'lucide-react';

const App = () => {
  const [videoSrc, setVideoSrc] = useState(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [gridImages, setGridImages] = useState(Array(24).fill(null));
  const [threshold, setThreshold] = useState(85); 
  const [status, setStatus] = useState('พร้อมใช้งาน: เลือกแหล่งข้อมูลวิดีโอ');
  const [errorMessage, setErrorMessage] = useState('');
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const bestScoresRef = useRef(Array(24).fill(0)); 
  const requestRef = useRef();

  const ROWS = 3;
  const COLS = 8;

  // คำนวณตำแหน่ง Grid (อิงตามสัดส่วนหน้าจอเกมส่วนใหญ่)
  const getCellPosition = (index, vWidth, vHeight) => {
    const startX = vWidth * 0.05;
    const startY = vHeight * 0.22; 
    const gridW = vWidth * 0.90;
    const gridH = vHeight * 0.65;

    const cellW = gridW / COLS;
    const cellH = gridH / ROWS;

    const r = Math.floor(index / COLS);
    const c = index % COLS;

    return {
      x: startX + (c * cellW) + (cellW * 0.05),
      y: startY + (r * cellH) + (cellH * 0.05),
      w: cellW * 0.9,
      h: cellH * 0.9
    };
  };

  const processFrame = useCallback(() => {
    if (!videoRef.current || videoRef.current.paused || videoRef.current.ended) {
      requestRef.current = requestAnimationFrame(processFrame);
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (video.videoWidth > 0) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);

      let hasUpdate = false;
      const newImages = [...gridImages];

      for (let i = 0; i < 24; i++) {
        const pos = getCellPosition(i, video.videoWidth, video.videoHeight);
        if (pos.x + pos.w > canvas.width || pos.y + pos.h > canvas.height) continue;

        const imgData = ctx.getImageData(pos.x, pos.y, pos.w, pos.h);
        const data = imgData.data;
        
        let totalBrightness = 0;
        let colorfulness = 0;
        for (let j = 0; j < data.length; j += 40) {
          const r = data[j]; const g = data[j+1]; const b = data[j+2];
          totalBrightness += (r + g + b) / 3;
          colorfulness += Math.abs(r - g) + Math.abs(g - b) + Math.abs(r - b);
        }
        
        const avgBrightness = totalBrightness / (data.length / 40);
        const score = avgBrightness + (colorfulness / 10);

        // ตรวจจับเฉพาะจังหวะที่สว่าง (การ์ดหงาย)
        if (avgBrightness > threshold && score > (bestScoresRef.current[i] || 0)) {
          const cropCanvas = document.createElement('canvas');
          cropCanvas.width = 150; cropCanvas.height = 180;
          const cCtx = cropCanvas.getContext('2d');
          cCtx.drawImage(video, pos.x, pos.y, pos.w, pos.h, 0, 0, 150, 180);
          
          newImages[i] = cropCanvas.toDataURL('image/webp', 0.8);
          bestScoresRef.current[i] = score;
          hasUpdate = true;
        }
      }

      if (hasUpdate) {
        setGridImages(newImages);
        setStatus(`ตรวจพบสัญลักษณ์ใหม่! (${newImages.filter(x => x).length}/24)`);
      }
    }
    requestRef.current = requestAnimationFrame(processFrame);
  }, [gridImages, threshold]);

  useEffect(() => {
    if (isCapturing) {
      requestRef.current = requestAnimationFrame(processFrame);
    } else {
      cancelAnimationFrame(requestRef.current);
    }
    return () => cancelAnimationFrame(requestRef.current);
  }, [isCapturing, processFrame]);

  // ฟังก์ชันสแกนสด (วิธีที่ง่ายที่สุด)
  const startLiveScanner = async () => {
    setErrorMessage('');
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: "never" },
        audio: false
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play();
          setIsLive(true);
          setIsCapturing(true); // เริ่มสแกนทันทีที่แชร์จอ
          setStatus('Live Scanning: กำลังเฝ้าดูหน้าจอเกม...');
        };
      }

      stream.getVideoTracks()[0].onended = () => stopAll();
    } catch (err) {
      setErrorMessage('เข้าถึงหน้าจอไม่ได้: ' + err.message);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      stopAll();
      const url = URL.createObjectURL(file);
      setVideoSrc(url);
      setStatus('วิดีโอพร้อมแล้ว กด Start เพื่อเริ่มสแกน');
    }
  };

  const stopAll = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    setVideoSrc(null);
    setIsCapturing(false);
    setIsLive(false);
  };

  const fullReset = () => {
    stopAll();
    setGridImages(Array(24).fill(null));
    bestScoresRef.current = Array(24).fill(0);
    setErrorMessage('');
    setStatus('รีเซ็ตระบบแล้ว');
  };

  return (
    <div className="min-h-screen bg-[#0c0c0e] text-slate-200 p-4 md:p-6 font-sans">
      <div className="max-w-7xl mx-auto flex flex-col gap-5">
        
        {/* Top Navigation / Status */}
        <div className="bg-[#1a1a1e] border border-amber-500/20 p-4 rounded-3xl flex flex-col lg:flex-row justify-between items-center gap-4 shadow-2xl">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/30">
              <Zap className="text-black fill-current" size={24} />
            </div>
            <div>
              <h1 className="text-xl font-black text-amber-500 tracking-tight uppercase italic">Memory Solver</h1>
              <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold tracking-widest uppercase">
                <Activity size={12} className={isCapturing ? "text-amber-500 animate-pulse" : "text-slate-600"} />
                {isCapturing ? "Scanning Live..." : "System Idle"}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full lg:w-auto">
            <button 
              onClick={() => setIsCapturing(!isCapturing)}
              disabled={!videoSrc && !isLive}
              className={`flex-1 lg:flex-none flex items-center justify-center gap-2 px-8 py-3 rounded-2xl font-black transition-all ${
                isCapturing 
                ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' 
                : (!videoSrc && !isLive) ? 'bg-slate-800 text-slate-600 cursor-not-allowed' : 'bg-amber-500 text-black hover:bg-amber-400'
              }`}
            >
              {isCapturing ? <Pause size={18} /> : <Scan size={18} />}
              {isCapturing ? 'PAUSE SCAN' : 'RESUME SCAN'}
            </button>
            <button onClick={fullReset} className="p-3 bg-slate-800 hover:bg-slate-700 rounded-2xl border border-white/5 text-slate-400 transition-all">
              <RotateCcw size={22} />
            </button>
          </div>
        </div>

        {errorMessage && (
          <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-center gap-3 text-red-400">
            <AlertTriangle size={20} className="shrink-0" />
            <span className="text-xs font-bold">{errorMessage}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          
          <div className="lg:col-span-7 space-y-4">
            {/* Scanner Viewport */}
            <div className="relative aspect-video bg-black rounded-[2rem] overflow-hidden border border-white/5 shadow-2xl group">
              {(videoSrc || isLive) ? (
                <>
                  <video ref={videoRef} src={videoSrc || undefined} playsInline muted className="w-full h-full object-contain" />
                  
                  {/* Grid Overlay - ช่วยให้ User กะระยะง่ายขึ้น */}
                  {showGrid && (
                    <div className="absolute inset-0 pointer-events-none opacity-40">
                      <div className="absolute top-[22%] left-[5%] w-[90%] h-[65%] border-2 border-dashed border-amber-500/50 rounded-xl">
                        <div className="grid grid-cols-8 grid-rows-3 h-full w-full">
                          {Array(24).fill(0).map((_, i) => (
                            <div key={i} className="border border-white/10 flex items-center justify-center text-[8px] font-mono text-white/20">{i+1}</div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="w-full h-full flex flex-col md:flex-row items-center justify-center gap-10 p-10">
                  <button 
                    onClick={startLiveScanner}
                    className="group flex flex-col items-center gap-4 transition-transform hover:scale-105"
                  >
                    <div className="w-24 h-24 rounded-full bg-amber-500/10 border-2 border-amber-500 flex items-center justify-center group-hover:bg-amber-500 group-hover:text-black transition-all text-amber-500">
                      <Monitor size={48} />
                    </div>
                    <span className="font-black text-sm uppercase tracking-widest text-amber-500">Start Live Scan</span>
                  </button>

                  <div className="w-px h-20 bg-white/5 hidden md:block" />

                  <label className="group flex flex-col items-center gap-4 cursor-pointer transition-transform hover:scale-105">
                    <div className="w-24 h-24 rounded-full bg-slate-800 border-2 border-white/5 flex items-center justify-center group-hover:bg-white group-hover:text-black transition-all text-slate-500">
                      <Video size={48} />
                    </div>
                    <span className="font-black text-sm uppercase tracking-widest text-slate-400">Upload Video</span>
                    <input type="file" className="hidden" onChange={handleFileUpload} accept="video/*" />
                  </label>
                </div>
              )}

              {/* Toolbar เล็กๆ บนวิดีโอ */}
              {(videoSrc || isLive) && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/60 backdrop-blur-md p-2 rounded-2xl border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => setShowGrid(!showGrid)} className="p-2 hover:bg-white/10 rounded-lg text-slate-300">
                    {showGrid ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                  <div className="w-px h-4 bg-white/10" />
                  <span className="text-[10px] font-black px-2 text-amber-500">SENSITIVITY:</span>
                  <input type="range" min="40" max="150" value={threshold} onChange={(e) => setThreshold(parseInt(e.target.value))} className="w-24 accent-amber-500" />
                </div>
              )}
            </div>
            
            <div className="bg-[#18181b] p-4 rounded-2xl border border-white/5 flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full ${isCapturing ? 'bg-amber-500 animate-pulse' : 'bg-slate-700'}`} />
              <span className="text-xs font-bold text-slate-400 italic uppercase tracking-tighter">{status}</span>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="bg-[#18181b] p-5 rounded-[2rem] border border-amber-500/10 shadow-2xl h-full flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <Grid className="text-amber-500" size={20} />
                  <h2 className="text-lg font-black text-white tracking-tight uppercase">Solution Map</h2>
                </div>
                <div className="bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full text-amber-400 font-mono font-black text-sm">
                  {gridImages.filter(x => x).length} / 24
                </div>
              </div>

              <div className="grid grid-cols-8 gap-1.5 flex-1 content-start">
                {gridImages.map((img, idx) => (
                  <div 
                    key={idx}
                    className={`aspect-[3/4.2] rounded-lg border relative overflow-hidden transition-all duration-300 ${img ? 'border-amber-500/50 bg-slate-900 shadow-lg shadow-amber-500/5' : 'border-white/5 bg-black/40'}`}
                  >
                    {img ? (
                      <img src={img} alt={`card-${idx}`} className="w-full h-full object-cover animate-in fade-in zoom-in" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center opacity-5 text-[8px] font-black">{idx + 1}</div>
                    )}
                    <div className="absolute top-0 right-0 bg-black/60 px-1 rounded-bl-md text-[7px] text-slate-400 font-mono">{idx + 1}</div>
                    
                    {/* Highlight Matches */}
                    {img && gridImages.filter((x, i) => x === img && i !== idx).length > 0 && (
                      <div className="absolute inset-0 border-2 border-amber-500 animate-pulse" />
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-6 p-4 bg-amber-500/5 rounded-2xl border border-amber-500/10">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="text-amber-400" size={14} />
                  <h4 className="text-[10px] font-black text-amber-400 uppercase tracking-widest">คำแนะนำการสแกน</h4>
                </div>
                <ul className="text-[10px] text-slate-500 space-y-1 list-disc pl-4 italic">
                  <li>เลือกแชร์หน้าต่างแบบ "Window" เพื่อความแม่นยำสูงสุด</li>
                  <li>หากสแกนไม่ติด ให้ลองขยับแถบ Sensitivity (ความไว)</li>
                  <li>ระบบจะเน้นขอบสีเหลืองอัตโนมัติเมื่อพบการ์ดที่ "คู่กัน"</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default App;

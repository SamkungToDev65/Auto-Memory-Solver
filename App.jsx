import React, { useState, useRef, useEffect } from 'react';
import { Video, Zap, RotateCcw, Play, Pause, Grid, Scan, CheckCircle, Activity, Monitor, AlertTriangle } from 'lucide-react';

const App = () => {
  const [videoSrc, setVideoSrc] = useState(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [gridImages, setGridImages] = useState(Array(24).fill(null));
  const [threshold, setThreshold] = useState(85); 
  const [status, setStatus] = useState('รอนำเข้าวิดีโอหรือแชร์หน้าจอ...');
  const [isLiveStream, setIsLiveStream] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const bestScoresRef = useRef(Array(24).fill(0)); 
  const requestRef = useRef();

  const ROWS = 3;
  const COLS = 8;

  const getCellPosition = (index, vWidth, vHeight) => {
    const startX = vWidth * 0.05;
    const startY = vHeight * 0.20;
    const gridW = vWidth * 0.90;
    const gridH = vHeight * 0.68;

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

  const processFrame = () => {
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
        const imgData = ctx.getImageData(pos.x, pos.y, pos.w, pos.h);
        const data = imgData.data;
        
        let totalBrightness = 0;
        let colorfulness = 0;
        
        for (let j = 0; j < data.length; j += 40) {
          const r = data[j];
          const g = data[j+1];
          const b = data[j+2];
          totalBrightness += (r + g + b) / 3;
          colorfulness += Math.abs(r - g) + Math.abs(g - b) + Math.abs(r - b);
        }
        
        const avgBrightness = totalBrightness / (data.length / 40);
        const score = avgBrightness + (colorfulness / 10);

        if (avgBrightness > threshold && score > bestScoresRef.current[i]) {
          const cropCanvas = document.createElement('canvas');
          cropCanvas.width = 150;
          cropCanvas.height = 180;
          const cCtx = cropCanvas.getContext('2d');
          cCtx.drawImage(video, pos.x, pos.y, pos.w, pos.h, 0, 0, 150, 180);
          
          newImages[i] = cropCanvas.toDataURL('image/webp', 0.9);
          bestScoresRef.current[i] = score;
          hasUpdate = true;
        }
      }

      if (hasUpdate) {
        setGridImages(newImages);
        setStatus(`ตรวจพบการ์ดเพิ่ม! รวม ${newImages.filter(x => x).length} / 24 ใบ`);
      }
    }

    requestRef.current = requestAnimationFrame(processFrame);
  };

  useEffect(() => {
    if (isCapturing) {
      requestRef.current = requestAnimationFrame(processFrame);
    } else {
      cancelAnimationFrame(requestRef.current);
    }
    return () => cancelAnimationFrame(requestRef.current);
  }, [isCapturing, gridImages]);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setErrorMessage('');
      setIsLiveStream(false);
      setVideoSrc(URL.createObjectURL(file));
      resetMemory();
      setStatus('วิดีโอพร้อมแล้ว กด Start เพื่อเริ่มสแกน');
    }
  };

  const handleScreenCapture = async () => {
   setErrorMessage('');
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({ 
      video: { 
        cursor: "always",
        displaySurface: "window" // บังคับให้เบราว์เซอร์แสดงตัวเลือกหน้าต่างแอปฯ
      },
      audio: false 
    });
      
      setIsLiveStream(true);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // บังคับให้เล่นวิดีโอทันที
        try {
          await videoRef.current.play();
        } catch (playError) {
          console.warn("Autoplay was prevented, waiting for user interaction.");
        }
      }
      resetMemory();
      setStatus('เชื่อมต่อการแชร์หน้าจอสำเร็จ');
    } catch (err) {
      setErrorMessage('ไม่สามารถแชร์หน้าจอได้: ' + err.message);
      setIsLiveStream(false);
    }
  };

  const resetMemory = () => {
    setGridImages(Array(24).fill(null));
    bestScoresRef.current = Array(24).fill(0);
  };

  const fullReset = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setVideoSrc(null);
    setIsCapturing(false);
    setIsLiveStream(false);
    setErrorMessage('');
    resetMemory();
    setStatus('รีเซ็ตระบบแล้ว');
  };

  return (
    <div className="min-h-screen bg-[#0c0c0e] text-slate-200 p-4 md:p-6 font-sans">
      <div className="max-w-7xl mx-auto flex flex-col gap-5">
        
        {/* Amber Header */}
        <div className="bg-[#1a1a1e] border border-amber-500/10 p-4 rounded-3xl flex flex-col lg:flex-row justify-between items-center gap-4 shadow-2xl">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Zap className="text-black fill-current" size={24} />
            </div>
            <div>
              <h1 className="text-xl font-black text-amber-500 tracking-tight uppercase italic">Memory Solver Pro</h1>
              <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold tracking-widest">
                <Activity size={12} className="text-amber-500" />
                TURBO SCANNING READY
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full lg:w-auto">
            <button 
              onClick={() => setIsCapturing(!isCapturing)}
              disabled={!videoSrc && !isLiveStream}
              className={`flex-1 lg:flex-none flex items-center justify-center gap-2 px-8 py-3 rounded-2xl font-black transition-all ${
                isCapturing 
                ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' 
                : (!videoSrc && !isLiveStream) ? 'bg-slate-800 text-slate-600 cursor-not-allowed' : 'bg-amber-500 text-black hover:bg-amber-400 shadow-lg shadow-amber-500/20'
              }`}
            >
              {isCapturing ? <Pause size={18} /> : <Scan size={18} />}
              {isCapturing ? 'STOP SCAN' : 'START AUTO SCAN'}
            </button>
            <button 
              onClick={fullReset}
              className="p-3 bg-slate-800 hover:bg-slate-700 rounded-2xl border border-white/5 text-slate-400 transition-all group"
            >
              <RotateCcw size={22} className="group-active:rotate-[-180deg] transition-transform" />
            </button>
          </div>
        </div>

        {errorMessage && (
          <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-center gap-3 text-red-400 animate-in fade-in slide-in-from-top-2 duration-300">
            <AlertTriangle size={20} className="shrink-0" />
            <span className="text-xs font-bold">{errorMessage}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          
          <div className="lg:col-span-7 space-y-4">
            <div className="relative aspect-video bg-black rounded-[2rem] overflow-hidden border border-white/5 shadow-2xl">
              {videoSrc || isLiveStream ? (
                <video 
                  ref={videoRef}
                  src={!isLiveStream ? videoSrc : undefined}
                  controls={!isLiveStream}
                  autoPlay={isLiveStream}
                  playsInline
                  muted
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="w-full h-full flex flex-col md:flex-row items-center justify-center gap-6 border-2 border-dashed border-white/5 m-4 rounded-[1.5rem] bg-slate-900/20">
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center border border-white/5">
                      <Video size={30} className="text-slate-500" />
                    </div>
                    <label className="cursor-pointer bg-amber-500 text-black px-6 py-3 rounded-xl font-black text-xs hover:scale-105 transition-all uppercase">
                      Upload Video File
                      <input type="file" className="hidden" onChange={handleFileUpload} accept="video/*" />
                    </label>
                  </div>
                  <div className="w-px h-24 bg-white/5 hidden md:block" />
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center border border-white/5">
                      <Monitor size={30} className="text-slate-500" />
                    </div>
                    <button 
                      onClick={handleScreenCapture} 
                      className="bg-white text-black px-6 py-3 rounded-xl font-black text-xs hover:scale-105 transition-all uppercase"
                    >
                      Share Live Screen
                    </button>
                  </div>
                </div>
              )}
              
              {isCapturing && (
                <div className="absolute top-5 left-5 flex items-center gap-2 bg-amber-500/90 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/20">
                  <span className="w-2 h-2 bg-black rounded-full animate-ping" />
                  <span className="text-[10px] font-black text-black uppercase tracking-tighter">Scanning...</span>
                </div>
              )}
            </div>
            
            <div className="bg-[#18181b] p-4 rounded-2xl border border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={`w-2.5 h-2.5 rounded-full ${isCapturing ? 'bg-amber-500 animate-pulse' : 'bg-slate-700'}`} />
                <span className="text-xs font-bold text-slate-400 italic">{status}</span>
              </div>
              <div className="flex items-center gap-4 bg-black/30 px-4 py-2 rounded-xl border border-white/5">
                <span className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Sensitivity</span>
                <input 
                  type="range" min="40" max="150" value={threshold} 
                  onChange={(e) => setThreshold(parseInt(e.target.value))}
                  className="w-32 accent-amber-500 cursor-pointer"
                />
                <span className="text-xs font-mono text-amber-400">{threshold}</span>
              </div>
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
                      <img src={img} className="w-full h-full object-cover animate-in fade-in" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center opacity-10 text-[8px] font-black">{idx + 1}</div>
                    )}
                    <div className="absolute top-0 right-0 bg-black/60 px-1 rounded-bl-md border-white/5 text-[7px] text-slate-400 font-mono font-bold">{idx + 1}</div>
                    {img && gridImages.filter((x, i) => x === img && i !== idx).length > 0 && (
                      <div className="absolute inset-0 border-2 border-amber-500 animate-[pulse_1.5s_infinite] pointer-events-none" />
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-6 p-4 bg-amber-500/5 rounded-2xl border border-amber-500/10">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="text-amber-400" size={14} />
                  <h4 className="text-[10px] font-black text-amber-400 uppercase tracking-widest">เทคนิคการใช้</h4>
                </div>
                <p className="text-[10px] text-slate-500 leading-relaxed italic">
                  หากรันบน Vercel คุณสามารถแชร์หน้าต่างเกมสดๆ ได้เลยครับ ระบบจะสแกนหาคู่ให้โดยอัตโนมัติ
                </p>
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


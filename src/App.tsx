import { useRef, useEffect } from 'react';
import { Play, Pause, Square, Scissors, Upload } from 'lucide-react';
import { useEditorStore } from './store';

// Helper function to format seconds into HH:MM:SS
const formatTime = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return [h, m, s].map((v) => v.toString().padStart(2, '0')).join(':');
};

function App() {
  const { 
    isPlaying, togglePlay, setIsPlaying, 
    videoSrc, setVideoSrc,
    duration, setDuration,
    currentTime, setCurrentTime,
    clips,          // ✅ 新增這行：把 clips 拿出來
    splitClip       // ✅ 新增這行：把剪斷功能拿出來
  } = useEditorStore();
  
  // Refs for DOM manipulation
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  // Handle local video selection
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const objectUrl = URL.createObjectURL(file);
      setVideoSrc(objectUrl);
      setIsPlaying(false);
      setCurrentTime(0);
    }
  };

  // Sync play/pause state with the actual <video> element
  useEffect(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.play().catch(() => setIsPlaying(false));
      } else {
        videoRef.current.pause();
      }
    }
  }, [isPlaying, setIsPlaying]);

  // Handle seeking when clicking on the timeline
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current || !videoRef.current || duration === 0) return;
    
    // Calculate click position relative to the timeline width
    const rect = timelineRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = percentage * duration;
    
    // Update video and state
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  // Calculate playhead position (%)
  const playheadPosition = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex flex-col h-screen bg-neutral-900 text-white font-sans">
      
      {/* Hidden file input */}
      <input 
        type="file" 
        accept="video/*" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        className="hidden" 
      />

      {/* Top Navigation */}
      <header className="h-14 border-b border-neutral-700 flex items-center px-4 justify-between bg-neutral-800">
        <h1 className="font-bold text-lg">WebEditor Pro</h1>
        <button className="bg-blue-600 hover:bg-blue-500 px-4 py-1.5 rounded text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          Export
        </button>
      </header>

      <main className="flex-1 flex flex-col overflow-hidden">
        
        {/* Top Section (Media Library + Preview) */}
        <div className="flex-1 flex min-h-[40vh]">
          {/* Left Sidebar: Media Library (Desktop only) */}
          <aside className="w-1/4 border-r border-neutral-700 bg-neutral-800 p-4 hidden md:block">
            <h2 className="text-sm font-semibold mb-4 text-neutral-400">Local Media</h2>
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-neutral-600 rounded-lg p-8 flex flex-col justify-center items-center text-neutral-500 cursor-pointer hover:border-blue-500 hover:text-blue-400 transition-colors gap-2"
            >
              <Upload size={24} />
              <span>Click to import video</span>
            </div>
          </aside>

          {/* Center: Video Preview */}
          <section className="flex-1 flex flex-col bg-black">
            <div className="flex-1 relative overflow-hidden bg-black">
              {videoSrc ? (
                <video 
                  ref={videoRef}
                  src={videoSrc} 
                  className="absolute inset-0 w-full h-full object-contain"
                  onLoadedMetadata={(e) => {
                    const dur = e.currentTarget.duration;
                    setDuration(dur);
                    // 當影片載入時，如果還沒有片段，就建立一個涵蓋整支影片的初始片段
                    useEditorStore.getState().setClips([{ id: 'init', start: 0, end: dur }]);
                  }} 
                  onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                  onEnded={() => setIsPlaying(false)}
                />
              ) : (
                <div 
                  className="absolute inset-0 flex flex-col items-center justify-center text-neutral-600 cursor-pointer md:cursor-default"
                  onClick={() => window.innerWidth < 768 && fileInputRef.current?.click()}
                >
                  <span className="md:hidden mb-2"><Upload size={32} /></span>
                  <span>Import media to start</span>
                </div>
              )}
            </div>
            
            {/* Playback Controls */}
            <div className="h-12 border-t border-neutral-800 flex items-center justify-center gap-4 bg-neutral-900">
              <button 
                className="p-2 hover:bg-neutral-800 rounded-full transition-colors text-neutral-400 hover:text-white disabled:opacity-50"
                disabled={!videoSrc}
                onClick={() => {
                  if (videoRef.current) {
                    videoRef.current.currentTime = 0;
                    setCurrentTime(0);
                    setIsPlaying(false);
                  }
                }}
              >
                <Square size={20} />
              </button>
              <button 
                onClick={togglePlay}
                disabled={!videoSrc}
                className="p-2 hover:bg-neutral-800 rounded-full transition-colors disabled:opacity-50"
              >
                {isPlaying ? <Pause size={24} /> : <Play size={24} />}
              </button>
            </div>
          </section>
        </div>

        {/* Bottom Section: Timeline */}
        <div className="h-1/3 min-h-[250px] border-t border-neutral-700 bg-neutral-800 flex flex-col">
          {/* Timeline Toolbar */}
          <div className="h-10 border-b border-neutral-700 flex items-center px-4 gap-2">
             {/* ✅ 1. 改直接使用 splitClip */}
             <button 
               onClick={splitClip}
               disabled={!videoSrc}
               className="p-1.5 hover:bg-neutral-700 rounded text-neutral-300 disabled:opacity-50 transition-colors"
               title="Split (Ctrl+K)"
             >
                <Scissors size={18} />
             </button>
             <span className="text-xs text-neutral-500 ml-auto font-mono">
                {formatTime(currentTime)} / {formatTime(duration)}
             </span>
          </div>
          
          {/* Tracks Area */}
          <div className="flex-1 p-2 overflow-y-auto relative select-none">
             <div className="h-6 border-b border-neutral-700 mb-2"></div>
             
             <div 
               ref={timelineRef}
               className="relative w-full h-16 cursor-pointer bg-neutral-900 rounded"
               onClick={handleTimelineClick}
             >
               {videoSrc && (
                 <div className="absolute top-0 left-0 w-full h-full flex">
                    {/* ✅ 2. 直接使用 clips 變數，而不是在這邊呼叫 Hook */}
                    {clips.map((clip, index) => {
                      const widthPercent = ((clip.end - clip.start) / duration) * 100;
                      return (
                        <div 
                          key={clip.id}
                          className="h-full bg-blue-900/50 border-y border-r border-blue-500 first:border-l flex items-center px-2 text-xs text-blue-200 overflow-hidden relative hover:bg-blue-800/50 transition-colors"
                          style={{ width: `${widthPercent}%` }}
                        >
                          Clip {index + 1}
                        </div>
                      );
                    })}
                 </div>
               )}
               
               {/* 播放指針保持不變 */}
               {videoSrc && (
                 <div 
                   className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10 pointer-events-none"
                   style={{ left: `${playheadPosition}%` }}
                 >
                    <div className="absolute -top-1 -left-1.5 w-3.5 h-3.5 bg-red-500 rounded-full"></div>
                 </div>
               )}
             </div>
          </div>
        </div>

      </main>
    </div>
  );
}

export default App;
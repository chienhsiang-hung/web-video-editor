import { useRef, useEffect } from 'react';
import { Play, Pause, Square, Scissors, Upload, Trash2 } from 'lucide-react';
import { useEditorStore } from './store';

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
    clips, splitClip,
    selectedClipId, setSelectedClipId, deleteClip, reorderClips
  } = useEditorStore();
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const objectUrl = URL.createObjectURL(file);
      setVideoSrc(objectUrl);
      setIsPlaying(false);
      setCurrentTime(0);
      setSelectedClipId(null);
    }
  };

  useEffect(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.play().catch(() => setIsPlaying(false));
      } else {
        videoRef.current.pause();
      }
    }
  }, [isPlaying, setIsPlaying]);

  // 全域鍵盤監聽：按下 Delete 或 Backspace 鍵時刪除選取的片段
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedClipId) {
        deleteClip();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedClipId, deleteClip]);

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current || !videoRef.current || duration === 0) return;
    
    // 如果點擊的不是 Clip 本身（點到空白處），就取消選取
    if (!(e.target as HTMLElement).closest('.clip-element')) {
      setSelectedClipId(null);
    }

    const rect = timelineRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = percentage * duration;
    
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const playheadPosition = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex flex-col h-screen bg-neutral-900 text-white font-sans">
      <input type="file" accept="video/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />

      <header className="h-14 border-b border-neutral-700 flex items-center px-4 justify-between bg-neutral-800">
        <h1 className="font-bold text-lg">WebEditor Pro</h1>
        <button className="bg-blue-600 hover:bg-blue-500 px-4 py-1.5 rounded text-sm font-semibold transition-colors disabled:opacity-50">
          Export
        </button>
      </header>

      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 flex min-h-[40vh]">
          <aside className="w-1/4 border-r border-neutral-700 bg-neutral-800 p-4 hidden md:block">
            <h2 className="text-sm font-semibold mb-4 text-neutral-400">Local Media</h2>
            <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-neutral-600 rounded-lg p-8 flex flex-col justify-center items-center text-neutral-500 cursor-pointer hover:border-blue-500 hover:text-blue-400 transition-colors gap-2">
              <Upload size={24} />
              <span>Click to import video</span>
            </div>
          </aside>

          <section className="flex-1 flex flex-col bg-black">
            <div className="flex-1 relative overflow-hidden bg-black">
              {videoSrc ? (
                <video 
                  ref={videoRef} src={videoSrc} className="absolute inset-0 w-full h-full object-contain"
                  onLoadedMetadata={(e) => {
                    const dur = e.currentTarget.duration;
                    setDuration(dur);
                    useEditorStore.getState().setClips([{ id: 'init', start: 0, end: dur }]);
                  }} 
                  onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                  onEnded={() => setIsPlaying(false)}
                />
              ) : (
                <div onClick={() => window.innerWidth < 768 && fileInputRef.current?.click()} className="absolute inset-0 flex flex-col items-center justify-center text-neutral-600 cursor-pointer md:cursor-default">
                  <span className="md:hidden mb-2"><Upload size={32} /></span>
                  <span>Import media to start</span>
                </div>
              )}
            </div>
            
            <div className="h-12 border-t border-neutral-800 flex items-center justify-center gap-4 bg-neutral-900">
              <button disabled={!videoSrc} onClick={() => { if (videoRef.current) { videoRef.current.currentTime = 0; setCurrentTime(0); setIsPlaying(false); } }} className="p-2 hover:bg-neutral-800 rounded-full transition-colors text-neutral-400 hover:text-white disabled:opacity-50">
                <Square size={20} />
              </button>
              <button onClick={togglePlay} disabled={!videoSrc} className="p-2 hover:bg-neutral-800 rounded-full transition-colors disabled:opacity-50">
                {isPlaying ? <Pause size={24} /> : <Play size={24} />}
              </button>
            </div>
          </section>
        </div>

        <div className="h-1/3 min-h-[250px] border-t border-neutral-700 bg-neutral-800 flex flex-col">
          <div className="h-10 border-b border-neutral-700 flex items-center px-4 gap-2">
             <button onClick={splitClip} disabled={!videoSrc} className="p-1.5 hover:bg-neutral-700 rounded text-neutral-300 disabled:opacity-50 transition-colors" title="Split">
                <Scissors size={18} />
             </button>
             {/* 刪除按鈕：只有在選中片段時才亮起 */}
             <button 
               onClick={deleteClip} 
               disabled={!selectedClipId} 
               className="p-1.5 hover:bg-red-900/50 rounded text-neutral-300 disabled:opacity-50 transition-colors hover:text-red-400" 
               title="Delete Clip (Del)"
             >
                <Trash2 size={18} />
             </button>
             
             <span className="text-xs text-neutral-500 ml-auto font-mono">
                {formatTime(currentTime)} / {formatTime(duration)}
             </span>
          </div>
          
          <div className="flex-1 p-2 overflow-y-auto relative select-none">
             <div className="h-6 border-b border-neutral-700 mb-2"></div>
             
             <div ref={timelineRef} className="relative w-full h-16 cursor-pointer bg-neutral-900 rounded" onClick={handleTimelineClick}>
               {videoSrc && (
                 <div className="absolute top-0 left-0 w-full h-full flex">
                    {clips.map((clip, index) => {
                      const widthPercent = ((clip.end - clip.start) / duration) * 100;
                      const isSelected = selectedClipId === clip.id;
                      
                      return (
                        <div 
                          key={clip.id}
                          className={`clip-element h-full border-y border-r first:border-l flex items-center px-2 text-xs overflow-hidden relative transition-colors cursor-grab active:cursor-grabbing
                            ${isSelected ? 'bg-yellow-900/60 border-yellow-500 text-yellow-200 z-20' : 'bg-blue-900/50 border-blue-500 text-blue-200 hover:bg-blue-800/50 z-10'}
                          `}
                          style={{ width: `${widthPercent}%` }}
                          
                          // 點擊選取片段
                          onClick={() => setSelectedClipId(clip.id)}
                          
                          // === HTML5 拖曳功能事件 ===
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData('text/plain', clip.id);
                            setSelectedClipId(clip.id);
                          }}
                          onDragOver={(e) => e.preventDefault()} // 必須 preventDefault 才能觸發 Drop
                          onDrop={(e) => {
                            e.preventDefault();
                            const draggedId = e.dataTransfer.getData('text/plain');
                            if (draggedId) reorderClips(draggedId, clip.id);
                          }}
                        >
                          Clip {index + 1}
                        </div>
                      );
                    })}
                 </div>
               )}
               
               {videoSrc && (
                 <div className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-30 pointer-events-none" style={{ left: `${playheadPosition}%` }}>
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
import { useRef, useEffect, useMemo } from 'react';
import { Play, Pause, Square, Scissors, Upload, Trash2, Film } from 'lucide-react';
import { useEditorStore, type Media } from './store';

const formatTime = (seconds: number) => {
  if (isNaN(seconds) || seconds < 0) return '00:00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return [h, m, s].map((v) => v.toString().padStart(2, '0')).join(':');
};

function App() {
  const { 
    isPlaying, togglePlay, setIsPlaying, 
    library, clips,
    currentTime, setCurrentTime,
    selectedClipId, setSelectedClipId, splitClip, deleteClip, reorderClips
  } = useEditorStore();
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const lastClipIdRef = useRef<string | null>(null);

  // === 核心邏輯 1：計算虛擬時間軸的佈局 ===
  // 算出每個片段在時間軸上的起點和終點，以及總長度
  const timelineLayout = useMemo(() => {
    let currentOffset = 0;
    return clips.map(clip => {
      const duration = clip.sourceEnd - clip.sourceStart;
      const layout = { ...clip, timelineStart: currentOffset, timelineEnd: currentOffset + duration, duration };
      currentOffset += duration;
      return layout;
    });
  }, [clips]);

  const totalDuration = timelineLayout.length > 0 ? timelineLayout[timelineLayout.length - 1].timelineEnd : 0;

  // 找出紅線目前所在的片段，以及對應的原始素材
  const currentActiveClip = timelineLayout.find(c => currentTime >= c.timelineStart && currentTime < c.timelineEnd) || timelineLayout[timelineLayout.length - 1];
  const activeMedia = library.find(m => m.id === currentActiveClip?.mediaId);

  // === 核心邏輯 2：自己實作計時器引擎 (驅動紅線) ===
  useEffect(() => {
    let animationFrameId: number;
    let lastTime = performance.now();

    const loop = (time: number) => {
      if (isPlaying) {
        const delta = (time - lastTime) / 1000;
        setCurrentTime((prev) => {
          const nextTime = prev + delta;
          if (nextTime >= totalDuration) {
            setIsPlaying(false);
            return totalDuration;
          }
          return nextTime;
        });
      }
      lastTime = time;
      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying, totalDuration, setIsPlaying, setCurrentTime]);

  // === 核心邏輯 3：將虛擬時間軸映射到實體 <video> 標籤 (效能最佳化版) ===
  useEffect(() => {
    if (!currentActiveClip || !activeMedia || !videoRef.current) return;

    const video = videoRef.current;
    const desiredVideoTime = currentActiveClip.sourceStart + (currentTime - currentActiveClip.timelineStart);

    // 1. 如果換了影片素材 (跨越到另一部影片)，替換 src 並強制設定時間
    if (video.src !== activeMedia.url) {
      video.src = activeMedia.url;
      video.currentTime = desiredVideoTime;
      lastClipIdRef.current = currentActiveClip.id;
    }

    // 2. 判斷是否需要強制同步影片時間 (避免干擾原生順暢播放)
    const isClipChanged = lastClipIdRef.current !== currentActiveClip.id; // 跨越到下一個片段
    const isDesynced = Math.abs(video.currentTime - desiredVideoTime) > 0.5; // 誤差真的大到不行(大於0.5秒)

    // 只有在「暫停時(手動點擊)」、「片段切換時」或「嚴重脫軌時」才強制設定 currentTime
    if (!isPlaying || isClipChanged || isDesynced) {
      // 避免重複設定極微小的時間差而造成微卡頓
      if (Math.abs(video.currentTime - desiredVideoTime) > 0.05) {
        video.currentTime = desiredVideoTime;
      }
      lastClipIdRef.current = currentActiveClip.id;
    }

    // 3. 控制播放與暫停
    if (isPlaying && video.paused) {
      video.play().catch(() => setIsPlaying(false));
    } else if (!isPlaying && !video.paused) {
      video.pause();
    }
  }, [currentTime, currentActiveClip, activeMedia, isPlaying, setIsPlaying]);


  // 匯入多個影片邏輯
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const objectUrl = URL.createObjectURL(file);
      // 利用隱藏的影片標籤先讀取總長度
      const tempVideo = document.createElement('video');
      tempVideo.src = objectUrl;
      tempVideo.onloadedmetadata = () => {
        const newMedia: Media = {
          id: Math.random().toString(36).slice(2, 9),
          url: objectUrl,
          name: file.name,
          duration: tempVideo.duration
        };
        useEditorStore.getState().addMedia(newMedia); // 加入素材庫並自動放入時間軸
      };
      event.target.value = ''; // 解決無法重複上傳的問題
      setIsPlaying(false);
    }
  };

  // 鍵盤刪除
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedClipId) {
        deleteClip();
        // 刪除後稍微退回時間，避免超出總長
        setCurrentTime(Math.min(currentTime, totalDuration - 0.1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedClipId, deleteClip, currentTime, totalDuration]);

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current || totalDuration === 0) return;
    if (!(e.target as HTMLElement).closest('.clip-element')) setSelectedClipId(null);

    const rect = timelineRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    setCurrentTime(percentage * totalDuration); // 更新虛擬時間
  };

  const playheadPosition = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  return (
    <div className="flex flex-col h-screen bg-neutral-900 text-white font-sans">
      <input type="file" accept="video/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />

      <header className="h-14 border-b border-neutral-700 flex items-center px-4 justify-between bg-neutral-800">
        <h1 className="font-bold text-lg text-blue-400">WebEditor Pro</h1>
        <button className="bg-blue-600 hover:bg-blue-500 px-4 py-1.5 rounded text-sm font-semibold transition-colors disabled:opacity-50">
          Export
        </button>
      </header>

      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 flex min-h-[40vh]">
          
          {/* 左側：真實素材庫 (現在會顯示多個影片了) */}
          <aside className="w-1/4 border-r border-neutral-700 bg-neutral-800 p-4 hidden md:flex flex-col">
            <h2 className="text-sm font-semibold mb-4 text-neutral-400">Media Library</h2>
            <div className="flex-1 overflow-y-auto flex flex-col gap-2 mb-4">
              {library.map((media, i) => (
                <div key={media.id} className="bg-neutral-900 p-2 rounded flex items-center gap-2 border border-neutral-700">
                  <Film size={16} className="text-blue-400" />
                  <span className="text-xs truncate">{media.name}</span>
                </div>
              ))}
            </div>
            <button onClick={() => fileInputRef.current?.click()} className="w-full bg-neutral-700 hover:bg-neutral-600 py-3 rounded-lg flex justify-center items-center text-neutral-300 transition-colors gap-2 text-sm font-semibold">
              <Upload size={18} /> Import Video
            </button>
          </aside>

          <section className="flex-1 flex flex-col bg-black">
            <div className="flex-1 relative overflow-hidden bg-black">
              {library.length > 0 ? (
                // 影片播放器 (現在它是被引擎控制的傀儡了)
                <video 
                  ref={videoRef} 
                  className="absolute inset-0 w-full h-full object-contain" 
                  playsInline
                  webkit-playsinline="true"
                />
              ) : (
                <div onClick={() => window.innerWidth < 768 && fileInputRef.current?.click()} className="absolute inset-0 flex flex-col items-center justify-center text-neutral-600 cursor-pointer md:cursor-default">
                  <span className="md:hidden mb-2"><Upload size={32} /></span>
                  <span>Import media to start</span>
                </div>
              )}
            </div>
            
            <div className="h-12 border-t border-neutral-800 flex items-center justify-center gap-4 bg-neutral-900">
              <button disabled={clips.length === 0} onClick={() => { setCurrentTime(0); setIsPlaying(false); }} className="p-2 hover:bg-neutral-800 rounded-full transition-colors text-neutral-400 hover:text-white disabled:opacity-50">
                <Square size={20} />
              </button>
              <button onClick={togglePlay} disabled={clips.length === 0} className="p-2 hover:bg-neutral-800 rounded-full transition-colors disabled:opacity-50">
                {isPlaying ? <Pause size={24} /> : <Play size={24} />}
              </button>
            </div>
          </section>
        </div>

        <div className="h-1/3 min-h-[250px] border-t border-neutral-700 bg-neutral-800 flex flex-col">
          <div className="h-10 border-b border-neutral-700 flex items-center px-4 gap-2">
             <button onClick={splitClip} disabled={clips.length === 0} className="p-1.5 hover:bg-neutral-700 rounded text-neutral-300 disabled:opacity-50 transition-colors" title="Split">
                <Scissors size={18} />
             </button>
             <button onClick={deleteClip} disabled={!selectedClipId} className="p-1.5 hover:bg-red-900/50 rounded text-neutral-300 disabled:opacity-50 transition-colors hover:text-red-400" title="Delete Clip (Del)">
                <Trash2 size={18} />
             </button>
             <span className="text-xs text-neutral-500 ml-auto font-mono">
                {formatTime(currentTime)} / {formatTime(totalDuration)}
             </span>
          </div>
          
          <div className="flex-1 p-2 overflow-y-auto relative select-none">
             <div className="h-6 border-b border-neutral-700 mb-2"></div>
             
             <div ref={timelineRef} className="relative w-full h-16 cursor-pointer bg-neutral-900 rounded" onClick={handleTimelineClick}>
               {clips.length > 0 && (
                 <div className="absolute top-0 left-0 w-full h-full flex">
                    {timelineLayout.map((clip, index) => {
                      const widthPercent = (clip.duration / totalDuration) * 100;
                      const isSelected = selectedClipId === clip.id;
                      
                      return (
                        <div 
                          key={clip.id}
                          className={`clip-element h-full border-y border-r first:border-l flex items-center px-2 text-xs overflow-hidden relative transition-colors cursor-grab active:cursor-grabbing
                            ${isSelected ? 'bg-yellow-900/60 border-yellow-500 text-yellow-200 z-20' : 'bg-blue-900/50 border-blue-500 text-blue-200 hover:bg-blue-800/50 z-10'}
                          `}
                          style={{ width: `${widthPercent}%` }}
                          onClick={() => setSelectedClipId(clip.id)}
                          draggable
                          onDragStart={(e) => { e.dataTransfer.setData('text/plain', clip.id); setSelectedClipId(clip.id); }}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            const draggedId = e.dataTransfer.getData('text/plain');
                            if (draggedId) reorderClips(draggedId, clip.id);
                          }}
                        >
                          {library.find(m => m.id === clip.mediaId)?.name.substring(0, 10)}...
                        </div>
                      );
                    })}
                 </div>
               )}
               
               {clips.length > 0 && (
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
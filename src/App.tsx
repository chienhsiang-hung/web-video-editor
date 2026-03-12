import { useRef, useEffect, useMemo } from 'react';
import { Play, Pause, Square, Scissors, Upload, Trash2, Film, Plus } from 'lucide-react';
import { useEditorStore, type Clip } from './store';

const formatTime = (seconds: number) => {
  if (isNaN(seconds) || seconds < 0) return '00:00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return [h, m, s].map((v) => v.toString().padStart(2, '0')).join(':');
};

function App() {
  const { 
    isPlaying, togglePlay, setIsPlaying, library, clips,
    currentTime, setCurrentTime,
    selectedClipId, setSelectedClipId, splitClip, deleteClip, reorderClips
  } = useEditorStore();
  // === 新增：定義時間軸縮放比例 (1秒 = 50px) ===
  const TIME_SCALE = 50;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const lastClipIdRef = useRef<string | null>(null);

  // === 狀態 Ref (用於拖曳計算，避免觸發無謂的 React 重繪) ===
  const isScrubbingRef = useRef(false);
  const trimmingRef = useRef<{ id: string, edge: 'left'|'right', startX: number, initialStart: number, initialEnd: number, pxToSec: number, maxDuration: number } | null>(null);

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
  const currentActiveClip = timelineLayout.find(c => currentTime >= c.timelineStart && currentTime < c.timelineEnd) || timelineLayout[timelineLayout.length - 1];
  const activeMedia = library.find(m => m.id === currentActiveClip?.mediaId);

  // 播放器心跳引擎
  useEffect(() => {
    let animationFrameId: number;
    let lastTime = performance.now();
    const loop = (time: number) => {
      if (isPlaying) {
        const delta = (time - lastTime) / 1000;
        setCurrentTime((prev) => {
          const nextTime = prev + delta;
          if (nextTime >= totalDuration) { setIsPlaying(false); return totalDuration; }
          return nextTime;
        });
      }
      lastTime = time;
      animationFrameId = requestAnimationFrame(loop);
    };
    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying, totalDuration, setIsPlaying, setCurrentTime]);

  // 畫面同步引擎
  useEffect(() => {
    if (!currentActiveClip || !activeMedia || !videoRef.current) return;
    const video = videoRef.current;
    const desiredVideoTime = currentActiveClip.sourceStart + (currentTime - currentActiveClip.timelineStart);

    if (video.src !== activeMedia.url) {
      video.src = activeMedia.url;
      video.currentTime = desiredVideoTime;
      lastClipIdRef.current = currentActiveClip.id;
    }

    const isClipChanged = lastClipIdRef.current !== currentActiveClip.id;
    const isDesynced = Math.abs(video.currentTime - desiredVideoTime) > 0.5;

    // 如果正在手動拖曳紅線(Scrubbing) 或 剪裁片段(Trimming)，我們強制更新畫面以達到即時預覽
    if (!isPlaying || isClipChanged || isDesynced || isScrubbingRef.current || trimmingRef.current) {
      if (Math.abs(video.currentTime - desiredVideoTime) > 0.05) {
        video.currentTime = desiredVideoTime;
      }
      lastClipIdRef.current = currentActiveClip.id;
    }

    if (isPlaying && video.paused) video.play().catch(() => setIsPlaying(false));
    else if (!isPlaying && !video.paused) video.pause();
  }, [currentTime, currentActiveClip, activeMedia, isPlaying, setIsPlaying]);

  // 檔案上傳
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const objectUrl = URL.createObjectURL(file);
      const tempVideo = document.createElement('video');
      tempVideo.src = objectUrl;
      tempVideo.onloadedmetadata = () => {
        useEditorStore.getState().addMedia({ id: Math.random().toString(36).slice(2, 9), url: objectUrl, name: file.name, duration: tempVideo.duration });
      };
      event.target.value = '';
      setIsPlaying(false);
    }
  };

  // 鍵盤刪除
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedClipId) {
        deleteClip();
        setCurrentTime(Math.min(currentTime, totalDuration - 0.1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedClipId, deleteClip, currentTime, totalDuration]);


  // === 互動邏輯 1：紅線拖曳滑動 (Scrubbing) ===
  const updateScrubPosition = (clientX: number) => {
    if (!timelineRef.current || totalDuration === 0) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const clickX = clientX - rect.left;
    // 直接把點擊的像素座標除以 TIME_SCALE，得到秒數
    const newTime = Math.max(0, Math.min(clickX / TIME_SCALE, totalDuration));
    setCurrentTime(newTime);
  };

  const handleTimelinePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // 如果點到了黃色把手，不要觸發紅線移動
    if ((e.target as HTMLElement).closest('.trim-handle')) return;
    if (!(e.target as HTMLElement).closest('.clip-element')) setSelectedClipId(null);
    
    isScrubbingRef.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId); // 鎖定指標，讓滑鼠移出範圍也能繼續拖
    updateScrubPosition(e.clientX);
  };

  const handleTimelinePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isScrubbingRef.current) return;
    updateScrubPosition(e.clientX);
  };

  const handleTimelinePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isScrubbingRef.current) {
      isScrubbingRef.current = false;
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    }
  };

  // === 互動邏輯 2：拖曳邊緣裁切 (Trimming) ===
  const startTrim = (e: React.PointerEvent, id: string, edge: 'left'|'right', clip: Clip, mediaDuration: number) => {
    e.stopPropagation(); // 防止觸發紅線移動
    e.preventDefault();  // 防止觸發 HTML5 拖曳排序
    if (!timelineRef.current) return;

    // 計算目前的像素對應幾秒鐘 (比例尺)
    const rect = timelineRef.current.getBoundingClientRect();
    // 固定的像素與時間換算率
    const pxToSec = 1 / TIME_SCALE;

    trimmingRef.current = { id, edge, startX: e.clientX, initialStart: clip.sourceStart, initialEnd: clip.sourceEnd, pxToSec, maxDuration: mediaDuration };
    
    // 掛載全域監聽器，這樣滑鼠移出把手依然可以拖曳
    document.addEventListener('pointermove', handleTrimMove);
    document.addEventListener('pointerup', stopTrim);
  };

  const handleTrimMove = (e: PointerEvent) => {
    if (!trimmingRef.current) return;
    const { id, edge, startX, initialStart, initialEnd, pxToSec, maxDuration } = trimmingRef.current;
    
    const deltaX = e.clientX - startX;
    const deltaTime = deltaX * pxToSec;

    let newStart = initialStart;
    let newEnd = initialEnd;

    // 計算新時間，並確保不能反向交叉 (保留至少 0.2 秒長度)，也不能超出原始影片長度
    if (edge === 'left') {
      newStart = Math.max(0, Math.min(initialStart + deltaTime, initialEnd - 0.2));
    } else {
      newEnd = Math.max(initialStart + 0.2, Math.min(initialEnd + deltaTime, maxDuration));
    }

    useEditorStore.getState().updateClipTrim(id, newStart, newEnd);
  };

  const stopTrim = () => {
    trimmingRef.current = null;
    document.removeEventListener('pointermove', handleTrimMove);
    document.removeEventListener('pointerup', stopTrim);
  };

  const playheadPosition = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  return (
    <div className="flex flex-col h-screen bg-neutral-900 text-white font-sans touch-none">
      <input type="file" accept="video/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />

      <header className="h-14 border-b border-neutral-700 flex items-center px-4 justify-between bg-neutral-800 shrink-0">
        <h1 className="font-bold text-lg text-blue-400">WebEditor Pro</h1>
        <button className="bg-blue-600 hover:bg-blue-500 px-4 py-1.5 rounded text-sm font-semibold transition-colors disabled:opacity-50">Export</button>
      </header>

      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 flex min-h-[40vh]">
          
          <aside className="w-1/4 border-r border-neutral-700 bg-neutral-800 p-4 hidden md:flex flex-col">
            <h2 className="text-sm font-semibold mb-4 text-neutral-400">Media Library</h2>
            <div className="flex-1 overflow-y-auto flex flex-col gap-2 mb-4">
              {library.map((media) => (
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
                <video ref={videoRef} className="absolute inset-0 w-full h-full object-contain" playsInline webkit-playsinline="true" />
              ) : (
                <div onClick={() => window.innerWidth < 768 && fileInputRef.current?.click()} className="absolute inset-0 flex flex-col items-center justify-center text-neutral-600 cursor-pointer md:cursor-default">
                  <span className="md:hidden mb-2"><Upload size={32} /></span>
                  <span>Import media to start</span>
                </div>
              )}
            </div>
            
            <div className="h-12 border-t border-neutral-800 flex items-center justify-center gap-4 bg-neutral-900 shrink-0">
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
          <div className="h-10 border-b border-neutral-700 flex items-center px-4 gap-2 shrink-0">
             <button onClick={() => fileInputRef.current?.click()} className="md:hidden p-1.5 hover:bg-neutral-700 rounded text-blue-400 transition-colors" title="Add Video">
                <Plus size={20} />
             </button>
             <div className="w-px h-4 bg-neutral-700 md:hidden mx-1"></div> 

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
          
          {/* 加入橫向滾動 overflow-x-auto */}
          <div className="flex-1 p-2 overflow-x-auto overflow-y-hidden relative select-none">
             
             {/* 加入 Pointer 事件來監聽滑動 */}
             <div 
               ref={timelineRef} 
               className="relative h-16 cursor-pointer bg-neutral-900 rounded mt-2" 
               // 讓時間軸的總寬度 = 總秒數 * 50px (如果太短，至少撐滿畫面 min-w-full)
               style={{ width: `${totalDuration * TIME_SCALE}px`, minWidth: '100%' }}
               onPointerDown={handleTimelinePointerDown}
               onPointerMove={handleTimelinePointerMove}
               onPointerUp={handleTimelinePointerUp}
               onPointerLeave={handleTimelinePointerUp}
             >
               {clips.length > 0 && (
                 <div className="absolute top-0 left-0 h-full flex">
                    {timelineLayout.map((clip) => {
                      // 改用絕對像素寬度，而不是百分比！
                      const widthPx = clip.duration * TIME_SCALE;
                      const isSelected = selectedClipId === clip.id;
                      const media = library.find(m => m.id === clip.mediaId);
                      
                      return (
                        <div 
                          key={clip.id}
                          className={`clip-element h-full border-y border-r first:border-l flex justify-center items-center text-xs overflow-hidden relative transition-colors cursor-grab active:cursor-grabbing shrink-0
                            ${isSelected ? 'bg-yellow-900/40 border-yellow-500 text-yellow-200 z-20' : 'bg-blue-900/50 border-blue-500 text-blue-200 hover:bg-blue-800/50 z-10'}
                          `}
                          style={{ width: `${widthPx}px` }} // 👈 這裡套用絕對寬度
                          onClick={() => setSelectedClipId(clip.id)}
                          
                          draggable={!trimmingRef.current}
                          onDragStart={(e) => { e.dataTransfer.setData('text/plain', clip.id); setSelectedClipId(clip.id); }}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            const draggedId = e.dataTransfer.getData('text/plain');
                            if (draggedId) reorderClips(draggedId, clip.id);
                          }}
                        >
                          <span className="pointer-events-none truncate px-4">{media?.name.substring(0, 10)}...</span>

                          {isSelected && media && (
                            <>
                              <div 
                                className="trim-handle absolute left-0 top-0 bottom-0 w-4 bg-yellow-500 cursor-ew-resize z-30 flex items-center justify-center shadow-[2px_0_4px_rgba(0,0,0,0.5)]"
                                onPointerDown={(e) => startTrim(e, clip.id, 'left', clip, media.duration)}
                              >
                                <div className="w-0.5 h-1/3 bg-yellow-800 rounded-full pointer-events-none"></div>
                              </div>
                              <div 
                                className="trim-handle absolute right-0 top-0 bottom-0 w-4 bg-yellow-500 cursor-ew-resize z-30 flex items-center justify-center shadow-[-2px_0_4px_rgba(0,0,0,0.5)]"
                                onPointerDown={(e) => startTrim(e, clip.id, 'right', clip, media.duration)}
                              >
                                <div className="w-0.5 h-1/3 bg-yellow-800 rounded-full pointer-events-none"></div>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                 </div>
               )}
               
               {clips.length > 0 && (
                 <div 
                   className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-40 pointer-events-none" 
                   // 紅線的定位也改用 transform translateX，效能更好且絕對精準！
                   style={{ transform: `translateX(${currentTime * TIME_SCALE}px)` }} 
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
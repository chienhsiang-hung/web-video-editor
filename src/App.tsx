import { useRef, useEffect, useMemo, useState } from 'react';
import { Play, Pause, Square, Scissors, Upload, Trash2, Plus, Diamond } from 'lucide-react';
import { useGesture } from '@use-gesture/react';
import { useEditorStore, type Clip, type Transform } from './store';

const formatTime = (seconds: number) => {
  if (isNaN(seconds) || seconds < 0) return '00:00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return [h, m, s].map((v) => v.toString().padStart(2, '0')).join(':');
};

// === 核心數學：線性插值演算 (Linear Interpolation) ===
// 根據目前的時間點，計算出畫面應該要在什麼縮放與位置
const getInterpolatedTransform = (clip: Clip, timeInClip: number): Transform => {
  if (!clip.keyframes || clip.keyframes.length === 0) return clip.baseTransform;
  
  const sorted = [...clip.keyframes].sort((a, b) => a.timeOffset - b.timeOffset);
  if (sorted.length === 1) return sorted[0].transform;

  const before = sorted.filter(k => k.timeOffset <= timeInClip).pop();
  const after = sorted.find(k => k.timeOffset > timeInClip);

  if (!before) return after!.transform;
  if (!after) return before.transform;

  // 計算進度比例 (0 ~ 1)
  const progress = (timeInClip - before.timeOffset) / (after.timeOffset - before.timeOffset);
  return {
    x: before.transform.x + (after.transform.x - before.transform.x) * progress,
    y: before.transform.y + (after.transform.y - before.transform.y) * progress,
    scale: before.transform.scale + (after.transform.scale - before.transform.scale) * progress,
  };
};

function App() {
  const TIME_SCALE = 50; 
  const { 
    isPlaying, togglePlay, setIsPlaying, library, clips,
    currentTime, setCurrentTime, projectAspectRatio, setProjectAspectRatio,
    selectedClipId, setSelectedClipId, splitClip, deleteClip, reorderClips,
    updateClipTransform, toggleKeyframe
  } = useEditorStore();
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const lastClipIdRef = useRef<string | null>(null);
  const isScrubbingRef = useRef(false);
  const trimmingRef = useRef<{ id: string, edge: 'left'|'right', startX: number, initialStart: number, initialEnd: number, pxToSec: number, maxDuration: number } | null>(null);

  // 用來在 UI 上即時渲染變形的狀態
  const [currentRenderTransform, setCurrentRenderTransform] = useState<Transform>({ x: 0, y: 0, scale: 1 });

  // 👇 新增這兩行：用來解決閃爍與跑回原位的問題
  const isTransformingRef = useRef(false); // 記錄「現在是不是正在拖曳/縮放」
  const transformRef = useRef(currentRenderTransform);
  transformRef.current = currentRenderTransform; // 確保它永遠持有最新的變形數值

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

  // 計算目前在 Clip 內的相對時間 (用於關鍵幀計算)
  const timeInActiveClip = currentActiveClip ? currentActiveClip.sourceStart + (currentTime - currentActiveClip.timelineStart) : 0;

  // 播放器引擎
  useEffect(() => {
    let animationFrameId: number; let lastTime = performance.now();
    const loop = (time: number) => {
      if (isPlaying) {
        const delta = (time - lastTime) / 1000;
        setCurrentTime((prev) => {
          const nextTime = prev + delta;
          if (nextTime >= totalDuration) { setIsPlaying(false); return totalDuration; }
          return nextTime;
        });
      }
      lastTime = time; animationFrameId = requestAnimationFrame(loop);
    };
    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying, totalDuration, setIsPlaying, setCurrentTime]);

  // 畫面同步與【動畫插值更新】引擎
  useEffect(() => {
    if (!currentActiveClip || !activeMedia || !videoRef.current) return;
    const video = videoRef.current;
    
    // 🚨 關鍵修復：只有在「沒有正在手動變形」的時候，才讓引擎去算插值，避免打架！
    if (!isTransformingRef.current) {
      const interpolated = getInterpolatedTransform(currentActiveClip, timeInActiveClip);
      setCurrentRenderTransform(interpolated);
    }

    // 2. 影片時間同步邏輯 (保持不變)
    const desiredVideoTime = currentActiveClip.sourceStart + (currentTime - currentActiveClip.timelineStart);
    if (video.src !== activeMedia.url) { video.src = activeMedia.url; video.currentTime = desiredVideoTime; lastClipIdRef.current = currentActiveClip.id; }
    const isClipChanged = lastClipIdRef.current !== currentActiveClip.id;
    const isDesynced = Math.abs(video.currentTime - desiredVideoTime) > 0.5;

    if (!isPlaying || isClipChanged || isDesynced || isScrubbingRef.current || trimmingRef.current) {
      if (Math.abs(video.currentTime - desiredVideoTime) > 0.05) video.currentTime = desiredVideoTime;
      lastClipIdRef.current = currentActiveClip.id;
    }

    if (isPlaying && video.paused) video.play().catch(() => setIsPlaying(false));
    else if (!isPlaying && !video.paused) video.pause();
  }, [currentTime, currentActiveClip, activeMedia, isPlaying, setIsPlaying, timeInActiveClip]);

  // 檔案匯入 (自動抓取第一支影片比例)
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const objectUrl = URL.createObjectURL(file);
      const tempVideo = document.createElement('video');
      tempVideo.src = objectUrl;
      tempVideo.onloadedmetadata = () => {
        // 如果是第一支影片，設定專案畫布比例！
        if (library.length === 0) {
          setProjectAspectRatio(tempVideo.videoWidth / tempVideo.videoHeight);
        }
        useEditorStore.getState().addMedia({ id: Math.random().toString(36).slice(2, 9), url: objectUrl, name: file.name, duration: tempVideo.duration });
      };
      event.target.value = ''; setIsPlaying(false);
    }
  };

  // === 互動邏輯：手勢追蹤 (Pan & Zoom) ===
  const bindGestures = useGesture({
    onDragStart: () => { isTransformingRef.current = true; }, 
    onDrag: ({ offset: [x, y] }) => {
      if (!currentActiveClip || !selectedClipId || selectedClipId !== currentActiveClip.id) return;
      const newTransform = { ...transformRef.current, x, y };
      
      // 👈 關鍵改動：傳入 timeInActiveClip，觸發自動關鍵幀！
      updateClipTransform(currentActiveClip.id, newTransform, timeInActiveClip); 
      setCurrentRenderTransform(newTransform); 
    },
    onDragEnd: () => { isTransformingRef.current = false; }, 
    
    onPinchStart: () => { isTransformingRef.current = true; }, 
    onPinch: ({ offset: [scale, angle] }) => {
      if (!currentActiveClip || !selectedClipId || selectedClipId !== currentActiveClip.id) return;
      const newTransform = { ...transformRef.current, scale }; 
      
      // 👈 關鍵改動：傳入 timeInActiveClip，觸發自動關鍵幀！
      updateClipTransform(currentActiveClip.id, newTransform, timeInActiveClip); 
      setCurrentRenderTransform(newTransform);
    },
    onPinchEnd: () => { isTransformingRef.current = false; } 
  }, {
    drag: { from: () => [transformRef.current.x, transformRef.current.y] },
    pinch: { from: () => [transformRef.current.scale, 0], scaleBounds: { min: 0.1, max: 10 }, modifierKey: 'ctrlKey' } 
  });


  // (保留時間軸拖曳邏輯...)
  const updateScrubPosition = (clientX: number) => {
    if (!timelineRef.current || totalDuration === 0) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const clickX = clientX - rect.left;
    setCurrentTime(Math.max(0, Math.min(clickX / TIME_SCALE, totalDuration)));
  };
  const handleTimelinePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('.trim-handle')) return;
    if (!(e.target as HTMLElement).closest('.clip-element')) setSelectedClipId(null);
    isScrubbingRef.current = true; (e.target as HTMLElement).setPointerCapture(e.pointerId); updateScrubPosition(e.clientX);
  };
  const handleTimelinePointerMove = (e: React.PointerEvent) => { if (isScrubbingRef.current) updateScrubPosition(e.clientX); };
  const handleTimelinePointerUp = (e: React.PointerEvent) => { if (isScrubbingRef.current) { isScrubbingRef.current = false; (e.target as HTMLElement).releasePointerCapture(e.pointerId); } };

  // (保留 Trim 邏輯...)
  const startTrim = (e: React.PointerEvent, id: string, edge: 'left'|'right', clip: Clip, mediaDuration: number) => {
    e.stopPropagation(); e.preventDefault(); if (!timelineRef.current) return;
    trimmingRef.current = { id, edge, startX: e.clientX, initialStart: clip.sourceStart, initialEnd: clip.sourceEnd, pxToSec: 1/TIME_SCALE, maxDuration: mediaDuration };
    document.addEventListener('pointermove', handleTrimMove); document.addEventListener('pointerup', stopTrim);
  };
  const handleTrimMove = (e: PointerEvent) => {
    if (!trimmingRef.current) return;
    const { id, edge, startX, initialStart, initialEnd, pxToSec, maxDuration } = trimmingRef.current;
    const deltaTime = (e.clientX - startX) * pxToSec;
    let newStart = initialStart; let newEnd = initialEnd;
    if (edge === 'left') newStart = Math.max(0, Math.min(initialStart + deltaTime, initialEnd - 0.2));
    else newEnd = Math.max(initialStart + 0.2, Math.min(initialEnd + deltaTime, maxDuration));
    useEditorStore.getState().updateClipTrim(id, newStart, newEnd);
  };
  const stopTrim = () => { trimmingRef.current = null; document.removeEventListener('pointermove', handleTrimMove); document.removeEventListener('pointerup', stopTrim); };

  // 判斷目前時間點是否已經有一個關鍵幀
  const hasKeyframeHere = currentActiveClip?.keyframes.some(k => Math.abs(k.timeOffset - timeInActiveClip) < 0.1);

  return (
    <div className="flex flex-col h-screen bg-neutral-900 text-white font-sans touch-none select-none">
      <input type="file" accept="video/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />

      <header className="h-14 border-b border-neutral-700 flex items-center px-4 justify-between bg-neutral-800 shrink-0">
        <h1 className="font-bold text-lg text-blue-400">WebEditor Pro</h1>
        <button className="bg-blue-600 hover:bg-blue-500 px-4 py-1.5 rounded text-sm font-semibold transition-colors disabled:opacity-50">Export</button>
      </header>

      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 flex min-h-[40vh]">
          
          <aside className="w-1/4 border-r border-neutral-700 bg-neutral-800 p-4 hidden md:flex flex-col">
            <h2 className="text-sm font-semibold mb-4 text-neutral-400">Media Library</h2>
            <button onClick={() => fileInputRef.current?.click()} className="w-full bg-neutral-700 hover:bg-neutral-600 py-3 rounded-lg flex justify-center items-center text-neutral-300 transition-colors gap-2 text-sm font-semibold">
              <Upload size={18} /> Import Video
            </button>
          </aside>

          {/* === 核心畫面區塊：虛擬畫布 === */}
          <section className="flex-1 flex flex-col bg-neutral-950">
            <div className="flex-1 relative overflow-hidden flex items-center justify-center p-4">
              
              {library.length > 0 ? (
                // 虛擬畫布 (Canvas)：鎖定第一支影片的比例，並裁切溢出的部分
                <div 
                  className="relative bg-black ring-1 ring-neutral-700 overflow-hidden shadow-2xl touch-none" /* 👈 確保加上 touch-none */
                  style={{ 
                    aspectRatio: projectAspectRatio || '16/9',
                    maxWidth: '100%', maxHeight: '100%',
                    width: projectAspectRatio && projectAspectRatio > 1 ? '100%' : 'auto',
                    height: projectAspectRatio && projectAspectRatio <= 1 ? '100%' : 'auto',
                  }}
                  {...bindGestures()} // 👈 這次就不會報錯了！
                >
                  <video 
                    ref={videoRef} 
                    className="absolute inset-0 w-full h-full object-cover" 
                    playsInline 
                    webkit-playsinline="true" 
                    style={{
                      // 👈 套用變形矩陣，並將中心點設為正中央
                      transform: `translate(${currentRenderTransform.x}px, ${currentRenderTransform.y}px) scale(${currentRenderTransform.scale})`,
                      transformOrigin: 'center center',
                      cursor: selectedClipId === currentActiveClip?.id ? 'move' : 'default'
                    }}
                  />
                  {/* 選取狀態的框線提示 */}
                  {selectedClipId === currentActiveClip?.id && (
                    <div className="absolute inset-0 border-2 border-yellow-500 pointer-events-none z-50 mix-blend-difference"></div>
                  )}
                </div>
              ) : (
                <div onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center justify-center text-neutral-600 cursor-pointer">
                  <Upload size={48} className="mb-4" /><span>Import media to start</span>
                </div>
              )}
            </div>
            
            <div className="h-12 border-t border-neutral-800 flex items-center px-4 gap-4 bg-neutral-900 shrink-0">
              <button disabled={clips.length === 0} onClick={() => { setCurrentTime(0); setIsPlaying(false); }} className="p-2 hover:bg-neutral-800 rounded-full transition-colors text-neutral-400">
                <Square size={20} />
              </button>
              <button onClick={togglePlay} disabled={clips.length === 0} className="p-2 hover:bg-neutral-800 rounded-full transition-colors">
                {isPlaying ? <Pause size={24} /> : <Play size={24} />}
              </button>
              
              <div className="mx-auto"></div>

              {/* 關鍵幀按鈕 (菱形) */}
              <button 
                disabled={!selectedClipId || !currentActiveClip}
                onClick={() => toggleKeyframe(currentActiveClip!.id, timeInActiveClip, currentRenderTransform)}
                className={`p-2 rounded-full transition-colors flex items-center gap-2 text-sm font-semibold
                  ${hasKeyframeHere ? 'text-yellow-400 bg-yellow-900/30' : 'text-neutral-400 hover:bg-neutral-800 disabled:opacity-50'}`}
                title="Add Keyframe"
              >
                <Diamond size={20} fill={hasKeyframeHere ? "currentColor" : "none"} />
                <span className="hidden md:inline">Keyframe</span>
              </button>
            </div>
          </section>
        </div>

        {/* 時間軸區域保留，並加入關鍵幀的小白點提示 */}
        <div className="h-1/3 min-h-[250px] border-t border-neutral-700 bg-neutral-800 flex flex-col">
          <div className="h-10 border-b border-neutral-700 flex items-center px-4 gap-2 shrink-0">
             <button onClick={() => fileInputRef.current?.click()} className="md:hidden p-1.5 hover:bg-neutral-700 rounded text-blue-400"><Plus size={20} /></button>
             <div className="w-px h-4 bg-neutral-700 md:hidden mx-1"></div> 
             <button onClick={splitClip} disabled={clips.length === 0} className="p-1.5 hover:bg-neutral-700 rounded text-neutral-300 disabled:opacity-50"><Scissors size={18} /></button>
             <button onClick={deleteClip} disabled={!selectedClipId} className="p-1.5 hover:bg-red-900/50 rounded text-neutral-300 disabled:opacity-50 hover:text-red-400"><Trash2 size={18} /></button>
             <span className="text-xs text-neutral-500 ml-auto font-mono">{formatTime(currentTime)} / {formatTime(totalDuration)}</span>
          </div>
          
          <div className="flex-1 p-2 overflow-x-auto overflow-y-hidden relative select-none">
             <div ref={timelineRef} className="relative h-16 cursor-pointer bg-neutral-900 rounded mt-2" style={{ width: `${totalDuration * TIME_SCALE}px`, minWidth: '100%' }} onPointerDown={handleTimelinePointerDown} onPointerMove={handleTimelinePointerMove} onPointerUp={handleTimelinePointerUp} onPointerLeave={handleTimelinePointerUp}>
               {clips.length > 0 && (
                 <div className="absolute top-0 left-0 h-full flex">
                    {timelineLayout.map((clip) => {
                      const widthPx = clip.duration * TIME_SCALE;
                      const isSelected = selectedClipId === clip.id;
                      
                      return (
                        <div key={clip.id} className={`clip-element h-full border-y border-r first:border-l flex justify-center items-center text-xs overflow-hidden relative transition-colors shrink-0 ${isSelected ? 'bg-yellow-900/40 border-yellow-500 text-yellow-200 z-20' : 'bg-blue-900/50 border-blue-500 text-blue-200 hover:bg-blue-800/50 z-10'}`} style={{ width: `${widthPx}px` }} onClick={() => setSelectedClipId(clip.id)}>
                          
                          {/* 渲染關鍵幀的標記點 */}
                          {clip.keyframes.map(kf => (
                            <div key={kf.id} className="absolute top-1 w-2 h-2 bg-white rounded-full transform -translate-x-1/2 rotate-45 z-40 shadow" style={{ left: `${(kf.timeOffset / clip.duration) * 100}%` }}></div>
                          ))}

                          {isSelected && (
                            <>
                              <div className="trim-handle absolute left-0 top-0 bottom-0 w-4 bg-yellow-500 cursor-ew-resize z-30 flex items-center justify-center" onPointerDown={(e) => startTrim(e, clip.id, 'left', clip, library.find(m=>m.id===clip.mediaId)?.duration || 0)}><div className="w-0.5 h-1/3 bg-yellow-800 rounded-full pointer-events-none"></div></div>
                              <div className="trim-handle absolute right-0 top-0 bottom-0 w-4 bg-yellow-500 cursor-ew-resize z-30 flex items-center justify-center" onPointerDown={(e) => startTrim(e, clip.id, 'right', clip, library.find(m=>m.id===clip.mediaId)?.duration || 0)}><div className="w-0.5 h-1/3 bg-yellow-800 rounded-full pointer-events-none"></div></div>
                            </>
                          )}
                        </div>
                      );
                    })}
                 </div>
               )}
               {clips.length > 0 && (
                 <div className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-40 pointer-events-none" style={{ transform: `translateX(${currentTime * TIME_SCALE}px)` }}><div className="absolute -top-1 -left-1.5 w-3.5 h-3.5 bg-red-500 rounded-full"></div></div>
               )}
             </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
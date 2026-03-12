import { useRef, useEffect } from 'react';
import { Play, Pause, Square, Scissors, Upload } from 'lucide-react';
import { useEditorStore } from './store';

function App() {
  const { isPlaying, togglePlay, setIsPlaying, videoSrc, setVideoSrc } = useEditorStore();
  
  // 用來操作隱藏的 file input 以及 video 標籤
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // 處理影片選擇
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // 產生純前端的暫存預覽網址
      const objectUrl = URL.createObjectURL(file);
      setVideoSrc(objectUrl);
      setIsPlaying(false); // 匯入新影片時先暫停
    }
  };

  // 監聽 Zustand 的 isPlaying 狀態，來控制實際的 video 標籤播放/暫停
  useEffect(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.play().catch(() => setIsPlaying(false)); // 處理瀏覽器自動播放限制
      } else {
        videoRef.current.pause();
      }
    }
  }, [isPlaying, setIsPlaying]);

  return (
    <div className="flex flex-col h-screen bg-neutral-900 text-white font-sans">
      
      {/* 隱藏的檔案輸入框 */}
      <input 
        type="file" 
        accept="video/*" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        className="hidden" 
      />

      {/* 頂部導航列 */}
      <header className="h-14 border-b border-neutral-700 flex items-center px-4 justify-between bg-neutral-800">
        <h1 className="font-bold text-lg">WebEditor Pro</h1>
        <button className="bg-blue-600 hover:bg-blue-500 px-4 py-1.5 rounded text-sm font-semibold transition-colors">
          匯出影片
        </button>
      </header>

      <main className="flex-1 flex flex-col overflow-hidden">
        
        {/* 上半部 (素材庫 + 預覽畫面) */}
        <div className="flex-1 flex min-h-[40vh]">
          {/* 左側素材庫 (Desktop) */}
          <aside className="w-1/4 border-r border-neutral-700 bg-neutral-800 p-4 hidden md:block">
            <h2 className="text-sm font-semibold mb-4 text-neutral-400">本地素材</h2>
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-neutral-600 rounded-lg p-8 flex flex-col justify-center items-center text-neutral-500 cursor-pointer hover:border-blue-500 hover:text-blue-400 transition-colors gap-2"
            >
              <Upload size={24} />
              <span>點擊匯入影片</span>
            </div>
          </aside>

          {/* 中央預覽區 */}
          <section className="flex-1 flex flex-col bg-black">
            {/* 影片預覽 */}
            {/* 1. 父容器：設定 relative，讓裡面的元素有定位基準 */}
            <div className="flex-1 relative overflow-hidden bg-black">
              {videoSrc ? (
                <video 
                  ref={videoRef}
                  src={videoSrc} 
                  /* 2. 影片本體：用 absolute inset-0 強制貼齊父元素的上下左右，再搭配 object-contain */
                  className="absolute inset-0 w-full h-full object-contain"
                  onEnded={() => setIsPlaying(false)}
                />
              ) : (
                /* 3. 空白提示：一樣用 absolute 佔滿置中 */
                <div 
                  className="absolute inset-0 flex flex-col items-center justify-center text-neutral-600 cursor-pointer md:cursor-default"
                  onClick={() => window.innerWidth < 768 && fileInputRef.current?.click()}
                >
                  <span className="md:hidden"><Upload size={32} /></span>
                  <span>請先匯入影片素材</span>
                </div>
              )}
            </div>
            
            {/* 播放控制器 */}
            <div className="h-12 border-t border-neutral-800 flex items-center justify-center gap-4 bg-neutral-900">
              <button 
                className="p-2 hover:bg-neutral-800 rounded-full transition-colors text-neutral-400 hover:text-white disabled:opacity-50"
                disabled={!videoSrc}
                onClick={() => {
                  if (videoRef.current) {
                    videoRef.current.currentTime = 0;
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

        {/* 下半部：時間軸 (Timeline) - 暫時保持不變 */}
        <div className="h-1/3 min-h-[250px] border-t border-neutral-700 bg-neutral-800 flex flex-col">
          <div className="h-10 border-b border-neutral-700 flex items-center px-4 gap-2">
             <button className="p-1.5 hover:bg-neutral-700 rounded text-neutral-300">
                <Scissors size={18} />
             </button>
             <span className="text-xs text-neutral-500 ml-auto">00:00:00 / 00:00:00</span>
          </div>
          
          <div className="flex-1 p-2 overflow-y-auto relative">
             <div className="h-6 border-b border-neutral-700 mb-2"></div>
             <div className="h-16 bg-neutral-900 rounded mb-2 flex items-center relative overflow-hidden">
                <div className="absolute left-10 w-48 h-full bg-blue-900/50 border border-blue-500 rounded flex items-center px-2 text-xs select-none">
                   影片片段 1.mp4
                </div>
             </div>
             <div className="absolute top-0 bottom-0 left-[100px] w-0.5 bg-red-500 z-10">
                <div className="absolute -top-1 -left-1.5 w-3.5 h-3.5 bg-red-500 rounded-full"></div>
             </div>
          </div>
        </div>

      </main>
    </div>
  );
}

export default App;
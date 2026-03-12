import { useRef, useEffect } from 'react';
import { Play, Pause, Square, Scissors, Upload } from 'lucide-react';
import { useEditorStore } from './store';

function App() {
  const { isPlaying, togglePlay, setIsPlaying, videoSrc, setVideoSrc } = useEditorStore();
  
  // References for the hidden file input and the video element
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Handle video file selection
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Generate a temporary frontend-only URL for preview
      const objectUrl = URL.createObjectURL(file);
      setVideoSrc(objectUrl);
      setIsPlaying(false); // Pause when importing a new video
    }
  };

  // Sync actual video element playback with Zustand's isPlaying state
  useEffect(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.play().catch(() => setIsPlaying(false)); // Handle browser autoplay restrictions
      } else {
        videoRef.current.pause();
      }
    }
  }, [isPlaying, setIsPlaying]);

  return (
    // Use 100dvh to prevent mobile browser UI bars from hiding content
    <div className="flex flex-col h-[100dvh] bg-neutral-900 text-white font-sans overflow-hidden">
      
      {/* Hidden file input */}
      <input 
        type="file" 
        accept="video/*" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        className="hidden" 
      />

      {/* Top Navigation Bar */}
      <header className="h-14 shrink-0 border-b border-neutral-700 flex items-center px-4 justify-between bg-neutral-800">
        <h1 className="font-bold text-base md:text-lg truncate pr-2">WebEditor Pro</h1>
        <button className="bg-blue-600 hover:bg-blue-500 px-3 py-1.5 md:px-4 md:py-2 rounded text-xs md:text-sm font-semibold transition-colors shrink-0">
          Export
        </button>
      </header>

      <main className="flex-1 flex flex-col min-h-0">
        
        {/* Upper Section (Media Library + Preview) */}
        <div className="flex-1 flex flex-col md:flex-row min-h-0">
          
          {/* Left Media Library (Desktop only) */}
          <aside className="w-1/4 max-w-[250px] border-r border-neutral-700 bg-neutral-800 p-4 hidden md:flex flex-col shrink-0">
            <h2 className="text-sm font-semibold mb-4 text-neutral-400">Local Media</h2>
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-neutral-600 rounded-lg p-6 flex flex-col justify-center items-center text-neutral-500 cursor-pointer hover:border-blue-500 hover:text-blue-400 transition-colors gap-2"
            >
              <Upload size={24} />
              <span className="text-sm text-center">Click to import</span>
            </div>
          </aside>

          {/* Center Preview Area */}
          <section className="flex-1 flex flex-col bg-black min-h-0 relative">
            
            {/* Mobile Import Button (Visible only on mobile when no video) */}
            {!videoSrc && (
              <button 
                className="md:hidden absolute top-4 right-4 z-10 bg-neutral-800/80 p-2 rounded-full text-neutral-300 hover:text-white"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={20} />
              </button>
            )}

            {/* Video Preview */}
            <div className="flex-1 flex items-center justify-center relative overflow-hidden p-2">
              {videoSrc ? (
                <video 
                  ref={videoRef}
                  src={videoSrc} 
                  className="w-full h-full object-contain"
                  playsInline // Crucial for mobile iOS to prevent auto full-screen
                  onEnded={() => setIsPlaying(false)} // Pause automatically when ended
                  // TODO: Add onTimeUpdate to sync timeline playhead
                />
              ) : (
                <div 
                  className="text-neutral-600 flex flex-col items-center gap-3 cursor-pointer md:cursor-default"
                  onClick={() => window.innerWidth < 768 && fileInputRef.current?.click()}
                >
                  <span className="md:hidden"><Upload size={40} className="text-neutral-500" /></span>
                  <span className="text-sm md:text-base text-center px-4">Import a video to start editing</span>
                </div>
              )}
            </div>
            
            {/* Playback Controls */}
            <div className="h-12 shrink-0 border-t border-neutral-800 flex items-center justify-center gap-6 bg-neutral-900 px-4">
              <button 
                className="p-3 hover:bg-neutral-800 rounded-full transition-colors text-neutral-400 hover:text-white disabled:opacity-50"
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
                className="p-3 bg-neutral-800 hover:bg-neutral-700 rounded-full transition-colors disabled:opacity-50 text-white"
              >
                {isPlaying ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
              </button>
            </div>
          </section>
        </div>

        {/* Lower Section: Timeline */}
        <div className="h-[35%] md:h-1/3 min-h-[160px] md:min-h-[250px] shrink-0 border-t border-neutral-700 bg-neutral-800 flex flex-col">
          <div className="h-10 shrink-0 border-b border-neutral-700 flex items-center px-2 md:px-4 gap-2">
             <button className="p-2 hover:bg-neutral-700 rounded text-neutral-300 transition-colors">
                <Scissors size={18} />
             </button>
             <span className="text-xs text-neutral-400 font-mono ml-auto">00:00:00 / 00:00:00</span>
          </div>
          
          <div className="flex-1 p-2 md:p-4 overflow-x-auto overflow-y-hidden relative">
             {/* Timeline Track Container - allows horizontal scrolling */}
             <div className="min-w-[800px] h-full relative">
               <div className="h-6 border-b border-neutral-700 mb-2"></div>
               <div className="h-16 bg-neutral-900 rounded mb-2 flex items-center relative overflow-hidden">
                  <div className="absolute left-10 w-48 h-full bg-blue-900/50 border border-blue-500 rounded flex items-center px-2 text-xs select-none truncate">
                      Clip_1.mp4
                  </div>
               </div>
               {/* Playhead */}
               <div className="absolute top-0 bottom-0 left-[100px] w-0.5 bg-red-500 z-10 pointer-events-none">
                  <div className="absolute -top-1 -left-1.5 w-3.5 h-3.5 bg-red-500 rounded-full shadow-md"></div>
               </div>
             </div>
          </div>
        </div>

      </main>
    </div>
  );
}

export default App;
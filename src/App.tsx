import { Play, Pause, Square, Scissors } from 'lucide-react';
import { useEditorStore } from './store';

function App() {
  const { isPlaying, togglePlay } = useEditorStore();

  return (
    <div className="flex flex-col h-screen bg-neutral-900 text-white font-sans">
      
      <header className="h-14 border-b border-neutral-700 flex items-center px-4 justify-between bg-neutral-800">
        <h1 className="font-bold text-lg">WebEditor Pro</h1>
        <button className="bg-blue-600 hover:bg-blue-500 px-4 py-1.5 rounded text-sm font-semibold transition-colors">
          Export Video
        </button>
      </header>

      <main className="flex-1 flex flex-col overflow-hidden">
        
        <div className="flex-1 flex min-h-[40vh]">
          <aside className="w-1/4 border-r border-neutral-700 bg-neutral-800 p-4 hidden md:block">
            <h2 className="text-sm font-semibold mb-4 text-neutral-400">Local Materials</h2>
            <div className="border-2 border-dashed border-neutral-600 rounded-lg p-8 flex justify-center items-center text-neutral-500 cursor-pointer hover:border-blue-500 hover:text-blue-400 transition-colors">
              + Import Video
            </div>
          </aside>

          <section className="flex-1 flex flex-col bg-black">
            <div className="flex-1 flex items-center justify-center relative">
              <span className="text-neutral-600">Preview Canvas</span>
            </div>
            
            <div className="h-12 border-t border-neutral-800 flex items-center justify-center gap-4 bg-neutral-900">
              <button className="p-2 hover:bg-neutral-800 rounded-full transition-colors text-neutral-400 hover:text-white">
                <Square size={20} />
              </button>
              <button 
                onClick={togglePlay}
                className="p-2 hover:bg-neutral-800 rounded-full transition-colors"
              >
                {isPlaying ? <Pause size={24} /> : <Play size={24} />}
              </button>
            </div>
          </section>
        </div>

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
                   Video1.mp4
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
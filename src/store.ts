import { create } from 'zustand';

// 定義「影片片段」的資料結構
export interface Clip {
  id: string;
  start: number; // 片段在原始影片中的起點時間
  end: number;   // 片段在原始影片中的終點時間
}

interface EditorState {
  videoSrc: string | null;
  setVideoSrc: (src: string) => void;
  
  isPlaying: boolean;
  togglePlay: () => void;
  setIsPlaying: (playing: boolean) => void;
  
  duration: number;
  setDuration: (duration: number) => void;
  currentTime: number;
  setCurrentTime: (time: number) => void;

  // 新增：管理時間軸上的片段
  clips: Clip[];
  setClips: (clips: Clip[]) => void;
  splitClip: () => void; // 核心剪輯功能
}

export const useEditorStore = create<EditorState>((set, get) => ({
  videoSrc: null,
  setVideoSrc: (src) => set({ videoSrc: src }),
  
  isPlaying: false,
  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  
  duration: 0,
  setDuration: (duration) => set({ duration }),
  currentTime: 0,
  setCurrentTime: (time) => set({ currentTime: time }),

  // 片段狀態初始化
  clips: [],
  setClips: (clips) => set({ clips }),
  
  // 實作切開影片的邏輯
  splitClip: () => {
    const { clips, currentTime } = get();
    
    // 找出目前播放指針所在的那個片段
    const clipIndex = clips.findIndex(c => currentTime > c.start && currentTime < c.end);
    
    // 如果指針不在任何片段上，或剛好在邊緣，就不切
    if (clipIndex === -1) return;

    const clipToSplit = clips[clipIndex];
    
    // 產生兩個新片段：前半段與後半段 (用隨機字串當簡單的 ID)
    const newClip1: Clip = { ...clipToSplit, id: Math.random().toString(36).slice(2, 9), end: currentTime };
    const newClip2: Clip = { ...clipToSplit, id: Math.random().toString(36).slice(2, 9), start: currentTime };

    // 替換原本的陣列
    const newClips = [
      ...clips.slice(0, clipIndex),
      newClip1,
      newClip2,
      ...clips.slice(clipIndex + 1)
    ];

    set({ clips: newClips });
  }
}));
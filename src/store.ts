import { create } from 'zustand';

export interface Clip {
  id: string;
  start: number;
  end: number;
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

  clips: Clip[];
  setClips: (clips: Clip[]) => void;
  splitClip: () => void;
  
  // === 新增：選取、刪除與排序 ===
  selectedClipId: string | null;
  setSelectedClipId: (id: string | null) => void;
  deleteClip: () => void;
  reorderClips: (draggedId: string, targetId: string) => void;
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

  clips: [],
  setClips: (clips) => set({ clips }),
  
  splitClip: () => {
    const { clips, currentTime } = get();
    const clipIndex = clips.findIndex(c => currentTime > c.start && currentTime < c.end);
    if (clipIndex === -1) return;

    const clipToSplit = clips[clipIndex];
    const newClip1: Clip = { ...clipToSplit, id: Math.random().toString(36).slice(2, 9), end: currentTime };
    const newClip2: Clip = { ...clipToSplit, id: Math.random().toString(36).slice(2, 9), start: currentTime };

    const newClips = [
      ...clips.slice(0, clipIndex),
      newClip1,
      newClip2,
      ...clips.slice(clipIndex + 1)
    ];

    set({ clips: newClips });
  },

  // === 實作新功能 ===
  selectedClipId: null,
  setSelectedClipId: (id) => set({ selectedClipId: id }),
  
  // 刪除目前選取的片段
  deleteClip: () => set((state) => ({
    clips: state.clips.filter(c => c.id !== state.selectedClipId),
    selectedClipId: null // 刪除後清空選取狀態
  })),

  // 處理拖曳排序 (將 draggedId 移到 targetId 的位置)
  reorderClips: (draggedId, targetId) => set((state) => {
    const oldIndex = state.clips.findIndex(c => c.id === draggedId);
    const newIndex = state.clips.findIndex(c => c.id === targetId);
    
    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return state;
    
    const newClips = [...state.clips];
    const [movedClip] = newClips.splice(oldIndex, 1); // 抽出被拖曳的片段
    newClips.splice(newIndex, 0, movedClip);          // 插入到目標位置
    
    return { clips: newClips };
  })
}));
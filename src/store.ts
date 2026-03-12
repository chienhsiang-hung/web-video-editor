import { create } from 'zustand';

// 1. 定義原始素材 (例如上傳的影片檔案)
export interface Media {
  id: string;
  url: string;
  name: string;
  duration: number; // 原始影片總長度
}

// 2. 定義時間軸上的片段 (引用素材的一部分)
export interface Clip {
  id: string;
  mediaId: string; // 對應 Media 的 ID
  sourceStart: number; // 在原始影片中的擷取起點
  sourceEnd: number;   // 在原始影片中的擷取終點
}

interface EditorState {
  // 素材庫
  library: Media[];
  addMedia: (media: Media) => void;

  // 時間軸片段
  clips: Clip[];
  setClips: (clips: Clip[]) => void;

  // 播放控制
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  togglePlay: () => void;

  // 全局虛擬時間軸進度
  currentTime: number;
  setCurrentTime: (time: number | ((prev: number) => number)) => void;

  // 編輯操作
  selectedClipId: string | null;
  setSelectedClipId: (id: string | null) => void;
  splitClip: () => void;
  deleteClip: () => void;
  reorderClips: (draggedId: string, targetId: string) => void;

 // === 新增：更新片段的頭尾裁切時間 ===
  updateClipTrim: (id: string, newStart: number, newEnd: number) => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  library: [],
  // 當匯入新素材時，自動在時間軸尾端加入一個對應的 Clip
  addMedia: (media) => set((state) => ({
    library: [...state.library, media],
    clips: [...state.clips, {
      id: Math.random().toString(36).slice(2, 9),
      mediaId: media.id,
      sourceStart: 0,
      sourceEnd: media.duration
    }]
  })),

  clips: [],
  setClips: (clips) => set({ clips }),

  isPlaying: false,
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),

  currentTime: 0,
  setCurrentTime: (time) => set((state) => ({ 
    currentTime: typeof time === 'function' ? time(state.currentTime) : time 
  })),

  selectedClipId: null,
  setSelectedClipId: (id) => set({ selectedClipId: id }),

  // 升級版的剪斷邏輯 (根據虛擬時間換算原始時間)
  splitClip: () => {
    const { clips, currentTime } = get();
    let currentOffset = 0;
    let targetIndex = -1;
    let localTimeInSource = 0;

    // 尋找紅線目前踩在哪個片段上
    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i];
      const duration = clip.sourceEnd - clip.sourceStart;
      if (currentTime > currentOffset && currentTime < currentOffset + duration) {
        targetIndex = i;
        // 換算出紅線在「原始素材」中的真實秒數
        localTimeInSource = clip.sourceStart + (currentTime - currentOffset);
        break;
      }
      currentOffset += duration;
    }

    if (targetIndex === -1) return;

    const clipToSplit = clips[targetIndex];
    const newClip1: Clip = { ...clipToSplit, id: Math.random().toString(36).slice(2, 9), sourceEnd: localTimeInSource };
    const newClip2: Clip = { ...clipToSplit, id: Math.random().toString(36).slice(2, 9), sourceStart: localTimeInSource };

    const newClips = [...clips.slice(0, targetIndex), newClip1, newClip2, ...clips.slice(targetIndex + 1)];
    set({ clips: newClips });
  },

  deleteClip: () => set((state) => ({
    clips: state.clips.filter(c => c.id !== state.selectedClipId),
    selectedClipId: null
  })),

  reorderClips: (draggedId, targetId) => set((state) => {
    const oldIndex = state.clips.findIndex(c => c.id === draggedId);
    const newIndex = state.clips.findIndex(c => c.id === targetId);
    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return state;
    const newClips = [...state.clips];
    const [moved] = newClips.splice(oldIndex, 1);
    newClips.splice(newIndex, 0, moved);
    return { clips: newClips };
  }),

  // === 實作 Trim 邏輯：更新指定 Clip 的長度 ===
  updateClipTrim: (id, newStart, newEnd) => set((state) => ({
    clips: state.clips.map(c => c.id === id ? { ...c, sourceStart: newStart, sourceEnd: newEnd } : c)
  }))
}));
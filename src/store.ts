import { create } from 'zustand';

export interface Media {
  id: string;
  url: string;
  name: string;
  duration: number;
}

export interface Transform {
  x: number;     // X軸平移 (像素)
  y: number;     // Y軸平移 (像素)
  scale: number; // 縮放比例 (1 = 100%)
}

export interface Keyframe {
  id: string;
  timeOffset: number; // 關鍵幀在該 Clip 內的相對時間 (秒)
  transform: Transform;
}

export interface Clip {
  id: string;
  mediaId: string;
  sourceStart: number;
  sourceEnd: number;
  
  // === 新增：變形與關鍵幀資料 ===
  baseTransform: Transform; // 基礎變形狀態
  keyframes: Keyframe[];    // 記錄時間點上的變形狀態
}

interface EditorState {
  // 專案畫布長寬比 (例如 16/9)
  projectAspectRatio: number | null;
  setProjectAspectRatio: (ratio: number) => void;

  library: Media[];
  addMedia: (media: Media) => void;

  clips: Clip[];
  setClips: (clips: Clip[]) => void;

  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  togglePlay: () => void;

  currentTime: number;
  setCurrentTime: (time: number | ((prev: number) => number)) => void;

  selectedClipId: string | null;
  setSelectedClipId: (id: string | null) => void;
  splitClip: () => void;
  deleteClip: () => void;
  reorderClips: (draggedId: string, targetId: string) => void;
  updateClipTrim: (id: string, newStart: number, newEnd: number) => void;

  // === 新增：變形與關鍵幀操作 ===
  updateClipTransform: (clipId: string, transform: Transform) => void;
  toggleKeyframe: (clipId: string, timeOffset: number, currentTransform: Transform) => void;
}

const DEFAULT_TRANSFORM: Transform = { x: 0, y: 0, scale: 1 };

export const useEditorStore = create<EditorState>((set, get) => ({
  projectAspectRatio: null,
  setProjectAspectRatio: (ratio) => set({ projectAspectRatio: ratio }),

  library: [],
  addMedia: (media) => set((state) => ({
    library: [...state.library, media],
    clips: [...state.clips, { 
      id: Math.random().toString(36).slice(2, 9), 
      mediaId: media.id, 
      sourceStart: 0, 
      sourceEnd: media.duration,
      baseTransform: { ...DEFAULT_TRANSFORM },
      keyframes: []
    }]
  })),

  clips: [],
  setClips: (clips) => set({ clips }),

  isPlaying: false,
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),

  currentTime: 0,
  setCurrentTime: (time) => set((state) => ({ currentTime: typeof time === 'function' ? time(state.currentTime) : time })),

  selectedClipId: null,
  setSelectedClipId: (id) => set({ selectedClipId: id }),

  splitClip: () => {
    const { clips, currentTime } = get();
    let currentOffset = 0; let targetIndex = -1; let localTimeInSource = 0;
    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i]; const duration = clip.sourceEnd - clip.sourceStart;
      if (currentTime > currentOffset && currentTime < currentOffset + duration) {
        targetIndex = i; localTimeInSource = clip.sourceStart + (currentTime - currentOffset); break;
      }
      currentOffset += duration;
    }
    if (targetIndex === -1) return;
    const clipToSplit = clips[targetIndex];
    const newClip1: Clip = { ...clipToSplit, id: Math.random().toString(36).slice(2, 9), sourceEnd: localTimeInSource };
    const newClip2: Clip = { ...clipToSplit, id: Math.random().toString(36).slice(2, 9), sourceStart: localTimeInSource };
    set({ clips: [...clips.slice(0, targetIndex), newClip1, newClip2, ...clips.slice(targetIndex + 1)] });
  },

  deleteClip: () => set((state) => ({ clips: state.clips.filter(c => c.id !== state.selectedClipId), selectedClipId: null })),

  reorderClips: (draggedId, targetId) => set((state) => {
    const oldIndex = state.clips.findIndex(c => c.id === draggedId);
    const newIndex = state.clips.findIndex(c => c.id === targetId);
    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return state;
    const newClips = [...state.clips];
    const [moved] = newClips.splice(oldIndex, 1);
    newClips.splice(newIndex, 0, moved);
    return { clips: newClips };
  }),

  updateClipTrim: (id, newStart, newEnd) => set((state) => ({
    clips: state.clips.map(c => c.id === id ? { ...c, sourceStart: newStart, sourceEnd: newEnd } : c)
  })),

  // 更新目前的變形 (如果剛好在關鍵幀上，就更新該關鍵幀；否則更新基礎變形)
  updateClipTransform: (clipId, transform) => set((state) => {
    return {
      clips: state.clips.map(clip => {
        if (clip.id !== clipId) return clip;
        // 為了簡化 MVP，每次拖曳我們都直接更新 baseTransform，
        // 真實邏輯可以進化為：如果有關鍵幀，就自動插入/更新當前時間的關鍵幀
        return { ...clip, baseTransform: transform };
      })
    };
  }),

  // 新增/移除 關鍵幀 (菱形按鈕)
  toggleKeyframe: (clipId, timeOffset, currentTransform) => set((state) => {
    return {
      clips: state.clips.map(clip => {
        if (clip.id !== clipId) return clip;
        const TIME_TOLERANCE = 0.1; // 0.1秒內的關鍵幀視為同一個
        const existingIdx = clip.keyframes.findIndex(k => Math.abs(k.timeOffset - timeOffset) < TIME_TOLERANCE);
        
        let newKeyframes = [...clip.keyframes];
        if (existingIdx >= 0) {
          newKeyframes.splice(existingIdx, 1); // 如果已經有，就刪除 (Toggle off)
        } else {
          newKeyframes.push({ id: Math.random().toString(36).slice(2, 9), timeOffset, transform: currentTransform }); // 新增
        }
        return { ...clip, keyframes: newKeyframes };
      })
    };
  })
}));
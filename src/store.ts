import { create } from 'zustand';

export interface Media { id: string; url: string; name: string; duration: number; }
export interface Transform { x: number; y: number; scale: number; }
export interface Keyframe { id: string; timeOffset: number; transform: Transform; }
export interface Clip {
  id: string; mediaId: string; sourceStart: number; sourceEnd: number;
  baseTransform: Transform; keyframes: Keyframe[];
}

interface EditorState {
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

  // 編輯操作
  splitClip: () => void;
  deleteClip: () => void;
  reorderClips: (draggedId: string, targetId: string) => void;
  updateClipTrim: (id: string, newStart: number, newEnd: number) => void;
  updateClipTransform: (clipId: string, transform: Transform, timeOffset?: number) => void;
  toggleKeyframe: (clipId: string, timeOffset: number, currentTransform: Transform) => void;

  // === 🔄 新增：歷史紀錄系統 (Undo/Redo) ===
  pastHistory: Clip[][];
  futureHistory: Clip[][];
  saveHistory: () => void;
  undo: () => void;
  redo: () => void;
}

const DEFAULT_TRANSFORM: Transform = { x: 0, y: 0, scale: 1 };

export const useEditorStore = create<EditorState>((set, get) => ({
  projectAspectRatio: null,
  setProjectAspectRatio: (ratio) => set({ projectAspectRatio: ratio }),

  // 歷史紀錄狀態與方法
  pastHistory: [],
  futureHistory: [],
  saveHistory: () => set((state) => ({
    pastHistory: [...state.pastHistory, state.clips],
    futureHistory: [] // 只要有新動作，未來的紀錄就清空
  })),
  undo: () => set((state) => {
    if (state.pastHistory.length === 0) return state;
    const past = [...state.pastHistory];
    const previousClips = past.pop()!;
    return { pastHistory: past, futureHistory: [state.clips, ...state.futureHistory], clips: previousClips, selectedClipId: null };
  }),
  redo: () => set((state) => {
    if (state.futureHistory.length === 0) return state;
    const future = [...state.futureHistory];
    const nextClips = future.shift()!;
    return { pastHistory: [...state.pastHistory, state.clips], futureHistory: future, clips: nextClips, selectedClipId: null };
  }),

  library: [],
  addMedia: (media) => {
    get().saveHistory(); // 存檔
    set((state) => ({
      library: [...state.library, media],
      clips: [...state.clips, { id: Math.random().toString(36).slice(2, 9), mediaId: media.id, sourceStart: 0, sourceEnd: media.duration, baseTransform: { ...DEFAULT_TRANSFORM }, keyframes: [] }]
    }));
  },

  clips: [],
  setClips: (clips) => set({ clips }),

  isPlaying: false, setIsPlaying: (playing) => set({ isPlaying: playing }),
  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
  currentTime: 0, setCurrentTime: (time) => set((state) => ({ currentTime: typeof time === 'function' ? time(state.currentTime) : time })),
  selectedClipId: null, setSelectedClipId: (id) => set({ selectedClipId: id }),

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
    
    get().saveHistory(); // 存檔

    const clipToSplit = clips[targetIndex];
    // ✂️ 修復：剪開影片時，將關鍵幀依據時間點分給前半段與後半段
    const newClip1: Clip = { 
      ...clipToSplit, id: Math.random().toString(36).slice(2, 9), sourceEnd: localTimeInSource,
      keyframes: clipToSplit.keyframes.filter(k => k.timeOffset <= localTimeInSource)
    };
    const newClip2: Clip = { 
      ...clipToSplit, id: Math.random().toString(36).slice(2, 9), sourceStart: localTimeInSource,
      keyframes: clipToSplit.keyframes.filter(k => k.timeOffset > localTimeInSource)
    };
    set({ clips: [...clips.slice(0, targetIndex), newClip1, newClip2, ...clips.slice(targetIndex + 1)] });
  },

  deleteClip: () => {
    if (!get().selectedClipId) return;
    get().saveHistory(); // 存檔
    set((state) => ({ clips: state.clips.filter(c => c.id !== state.selectedClipId), selectedClipId: null }));
  },

  reorderClips: (draggedId, targetId) => {
    const state = get();
    const oldIndex = state.clips.findIndex(c => c.id === draggedId);
    const newIndex = state.clips.findIndex(c => c.id === targetId);
    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;
    
    get().saveHistory(); // 存檔
    set((state) => {
      const newClips = [...state.clips];
      const [moved] = newClips.splice(oldIndex, 1);
      newClips.splice(newIndex, 0, moved);
      return { clips: newClips };
    });
  },

  updateClipTrim: (id, newStart, newEnd) => set((state) => ({
    clips: state.clips.map(c => c.id === id ? { ...c, sourceStart: newStart, sourceEnd: newEnd } : c)
  })),

  updateClipTransform: (clipId, transform, timeOffset) => set((state) => {
    return {
      clips: state.clips.map(clip => {
        if (clip.id !== clipId) return clip;
        if (timeOffset === undefined || clip.keyframes.length === 0) return { ...clip, baseTransform: transform };
        const TIME_TOLERANCE = 0.1; 
        const existingIdx = clip.keyframes.findIndex(k => Math.abs(k.timeOffset - timeOffset) < TIME_TOLERANCE);
        let newKeyframes = [...clip.keyframes];
        if (existingIdx >= 0) newKeyframes[existingIdx] = { ...newKeyframes[existingIdx], transform };
        else newKeyframes.push({ id: Math.random().toString(36).slice(2, 9), timeOffset, transform });
        return { ...clip, keyframes: newKeyframes };
      })
    };
  }),

  toggleKeyframe: (clipId, timeOffset, currentTransform) => {
    get().saveHistory(); // 存檔
    set((state) => {
      return {
        clips: state.clips.map(clip => {
          if (clip.id !== clipId) return clip;
          const TIME_TOLERANCE = 0.1; 
          const existingIdx = clip.keyframes.findIndex(k => Math.abs(k.timeOffset - timeOffset) < TIME_TOLERANCE);
          let newKeyframes = [...clip.keyframes];
          if (existingIdx >= 0) newKeyframes.splice(existingIdx, 1);
          else newKeyframes.push({ id: Math.random().toString(36).slice(2, 9), timeOffset, transform: currentTransform });
          return { ...clip, keyframes: newKeyframes };
        })
      };
    });
  }
}));
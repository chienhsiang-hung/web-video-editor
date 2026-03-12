import { create } from 'zustand';

interface EditorState {
  // Video Source
  videoSrc: string | null;
  setVideoSrc: (src: string) => void;
  
  // Playback State
  isPlaying: boolean;
  togglePlay: () => void;
  setIsPlaying: (playing: boolean) => void;
  
  // Timeline Time (in seconds)
  duration: number;
  setDuration: (duration: number) => void;
  currentTime: number;
  setCurrentTime: (time: number) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  videoSrc: null,
  setVideoSrc: (src) => set({ videoSrc: src }),
  
  isPlaying: false,
  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  
  duration: 0,
  setDuration: (duration) => set({ duration }),
  currentTime: 0,
  setCurrentTime: (time) => set({ currentTime: time }),
}));
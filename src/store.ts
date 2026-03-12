import { create } from 'zustand';

interface EditorState {
  videoSrc: string | null;
  setVideoSrc: (src: string) => void;
  isPlaying: boolean;
  togglePlay: () => void;
  setIsPlaying: (playing: boolean) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  videoSrc: null,
  setVideoSrc: (src) => set({ videoSrc: src }),
  isPlaying: false,
  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
}));
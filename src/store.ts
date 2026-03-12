import { create } from 'zustand';

interface EditorState {
  isPlaying: boolean;
  currentTime: number;
  togglePlay: () => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  isPlaying: false,
  currentTime: 0,
  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
}));
import { create } from 'zustand';

export type PetType = 'cat' | 'dog' | 'robot' | 'duck' | 'ghost' | 'none';

interface PetState {
  petType: PetType;
  isEnabled: boolean;
  setPetType: (type: PetType) => void;
  toggleEnabled: () => void;
}

const PET_STORAGE_KEY = 'rokad_pet_companion';

function loadInitialPet(): { petType: PetType; isEnabled: boolean } {
  try {
    const raw = localStorage.getItem(PET_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        petType: parsed.petType || 'cat',
        isEnabled: parsed.isEnabled !== false,
      };
    }
  } catch {
    // fallback
  }
  return { petType: 'cat', isEnabled: true };
}

export const usePetStore = create<PetState>((set, get) => {
  const initial = loadInitialPet();

  return {
    petType: initial.petType,
    isEnabled: initial.isEnabled,
    setPetType: (type: PetType) => {
      const isEnabled = type !== 'none';
      set({ petType: type, isEnabled });
      localStorage.setItem(PET_STORAGE_KEY, JSON.stringify({ petType: type, isEnabled }));
    },
    toggleEnabled: () => {
      const next = !get().isEnabled;
      set({ isEnabled: next });
      localStorage.setItem(PET_STORAGE_KEY, JSON.stringify({ petType: get().petType, isEnabled: next }));
    },
  };
});

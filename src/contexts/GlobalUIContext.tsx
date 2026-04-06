import React, { createContext, useContext, useState, useEffect } from 'react';

interface GlobalUIContextType {
  isAddClientModalOpen: boolean;
  setIsAddClientModalOpen: (open: boolean) => void;
  isSearchPaletteOpen: boolean;
  setIsSearchPaletteOpen: (open: boolean) => void;
  isNotificationsOpen: boolean;
  setIsNotificationsOpen: (open: boolean) => void;
}

const GlobalUIContext = createContext<GlobalUIContextType | undefined>(undefined);

export function GlobalUIProvider({ children }: { children: React.ReactNode }) {
  const [isAddClientModalOpen, setIsAddClientModalOpen] = useState(false);
  const [isSearchPaletteOpen, setIsSearchPaletteOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <GlobalUIContext.Provider value={{
      isAddClientModalOpen, setIsAddClientModalOpen,
      isSearchPaletteOpen, setIsSearchPaletteOpen,
      isNotificationsOpen, setIsNotificationsOpen
    }}>
      {children}
    </GlobalUIContext.Provider>
  );
}

export function useGlobalUI() {
  const context = useContext(GlobalUIContext);
  if (context === undefined) {
    throw new Error('useGlobalUI must be used within a GlobalUIProvider');
  }
  return context;
}

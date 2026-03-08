'use client';

import { useEffect } from 'react';

interface KeyboardShortcut {
   key: string;
   action: () => void;
   enabled: boolean;
}

/**
 * Hook that registers keyboard shortcuts for game actions.
 * Only fires when the corresponding action is available (enabled = true).
 */
export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
   useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
         // Don't fire shortcuts when typing in inputs
         const target = e.target as HTMLElement;
         if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
            return;
         }

         const pressedKey = e.key.toLowerCase();

         for (const shortcut of shortcuts) {
            if (pressedKey === shortcut.key.toLowerCase() && shortcut.enabled) {
               e.preventDefault();
               shortcut.action();
               return;
            }
         }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
   }, [shortcuts]);
}

// Copyright 2025-2026 Kisaes LLC
// Licensed under the Elastic License 2.0 (ELv2); you may not use this file
// except in compliance with the Elastic License 2.0.
// See LICENSE file in the project root for full license text.

import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { ChatBubble } from './ChatBubble';
import { useUIStore } from '../store/uiStore';

export function AppShell() {
  const { fontSize, isDarkMode } = useUIStore();

  // Apply to <html> so rem-based Tailwind classes (text-sm etc.) scale correctly
  useEffect(() => {
    document.documentElement.style.fontSize = `${fontSize}px`;
    return () => { document.documentElement.style.fontSize = ''; };
  }, [fontSize]);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900 overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-auto h-full">
        <Outlet />
      </main>
      <ChatBubble />
    </div>
  );
}

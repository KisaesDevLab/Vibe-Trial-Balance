import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useUIStore } from '../store/uiStore';

export function AppShell() {
  const { fontSize } = useUIStore();

  // Apply to <html> so rem-based Tailwind classes (text-sm etc.) scale correctly
  useEffect(() => {
    document.documentElement.style.fontSize = `${fontSize}px`;
    return () => { document.documentElement.style.fontSize = ''; };
  }, [fontSize]);

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}

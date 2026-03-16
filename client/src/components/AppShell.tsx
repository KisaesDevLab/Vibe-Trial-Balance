import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useUIStore } from '../store/uiStore';

export function AppShell() {
  const { fontSize } = useUIStore();
  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-auto" style={{ fontSize: `${fontSize}px` }}>
        <Outlet />
      </main>
    </div>
  );
}

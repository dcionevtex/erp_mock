import { Sidebar } from './Sidebar';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 min-w-0 overflow-auto">
        {children}
      </div>
    </div>
  );
}

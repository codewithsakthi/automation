import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Bell, User, ChevronRight, LogOut, ShieldCheck } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Sidebar from './Sidebar';
import ThemeToggle from './ThemeToggle';
import MobileBottomNav from './MobileBottomNav';
import SpotlightSearch from './SpotlightSearch';
import { useThemeStore } from '../store/themeStore';
import { useAuthStore } from '../store/authStore';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const MIN_WIDTH = 200;
const MAX_WIDTH = 450;
const DEFAULT_WIDTH = 260;

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const { theme, toggleTheme } = useThemeStore();
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'Overview';
  const role = (user as any)?.role === 'admin' || (user as any)?.role?.name === 'admin' ? 'admin' : 'student';

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  const handleSpotlightSelect = (result: any) => {
    if (result.entity_type === 'student') {
      const params = new URLSearchParams(searchParams);
      params.set('rollNo', result.entity_id);
      setSearchParams(params);
    }
  };

  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const startResizing = useCallback((e: React.MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback(
    (e: MouseEvent) => {
      if (isResizing) {
        let newWidth = e.clientX;
        if (newWidth < MIN_WIDTH) newWidth = MIN_WIDTH;
        if (newWidth > MAX_WIDTH) newWidth = MAX_WIDTH;
        setWidth(newWidth);
      }
    },
    [isResizing]
  );

  useEffect(() => {
    window.addEventListener('mousemove', resize);
    window.addEventListener('mouseup', stopResizing);
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [resize, stopResizing]);

  return (
    <div className={`flex min-h-screen bg-background text-foreground transition-colors duration-300 ${isResizing ? 'cursor-col-resize' : ''}`}>
      {/* Sidebar for Desktop */}
      <div className="hidden lg:block flex-shrink-0" style={{ width }}>
        <Sidebar 
          width={width} 
          onResizeStart={startResizing} 
          isResizing={isResizing} 
        />
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col min-w-0 h-screen overflow-hidden">
        {/* Top Header Shell */}
        <header className="sticky top-0 z-30 flex h-14 w-full flex-shrink-0 items-center justify-between border-b border-border/40 bg-background/80 px-4 backdrop-blur-xl md:h-16 md:px-6">
          {/* Left: Brand on mobile, Breadcrumb on desktop */}
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-extrabold tracking-tight text-foreground md:hidden">SPARK</span>
            <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
              <span className="font-medium hover:text-foreground cursor-pointer" onClick={() => navigate('/dashboard')}>Dashboard</span>
              <ChevronRight size={14} className="opacity-40" />
              <span className="font-semibold text-foreground">
                {activeTab === 'Performance' ? 'Subject Analytics' : 
                 activeTab === 'Attendance' ? 'Attendance Insight' : 
                 activeTab === 'Profile' ? 'Profile Settings' : 
                 activeTab === 'Security' ? 'Security Access' : 
                 activeTab === 'Students' ? 'Student Management' :
                 activeTab}
              </span>
            </div>
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
            {/* Spotlight Search — admin only */}
            {role === 'admin' && (
              <SpotlightSearch onSelect={handleSpotlightSelect} />
            )}

            {/* Search — desktop only */}
            <div className="relative group hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" size={16} />
              <input
                type="text"
                placeholder="Search metrics..."
                className="w-56 rounded-full border border-border/50 bg-muted/30 py-1.5 pl-10 pr-4 text-sm outline-none transition-all focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
              />
            </div>

            <ThemeToggle theme={theme} onToggle={toggleTheme} className="scale-90 !px-2.5 !py-1.5" />

            <button className="relative rounded-full p-2 text-muted-foreground hover:bg-muted transition-colors">
              <Bell size={18} />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-background" />
            </button>

            <div className="hidden md:block h-8 w-[1px] bg-border/40" />

            {/* User menu */}
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setUserMenuOpen((v) => !v)}
                className="flex items-center gap-1.5 rounded-full p-1 hover:bg-muted transition-colors"
              >
                <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                  <User size={18} />
                </div>
                <span className="text-sm font-bold hidden lg:block pr-2">{(user as any)?.name?.split(' ')[0] || (role === 'admin' ? 'Admin' : 'Me')}</span>
              </button>

              {/* Dropdown */}
              {userMenuOpen && (
                <div className="absolute right-0 top-12 z-50 w-56 rounded-2xl border border-border/60 bg-card shadow-xl backdrop-blur-2xl overflow-hidden">
                  {/* User info */}
                  <div className="px-4 py-3 border-b border-border/40">
                    <p className="text-sm font-bold text-foreground truncate">{(user as any)?.name || 'User'}</p>
                    <p className="text-xs text-muted-foreground truncate">{(user as any)?.email || ''}</p>
                    <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-primary">
                      <ShieldCheck size={10} />
                      {role}
                    </span>
                  </div>
                  {/* Logout */}
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-3 px-4 py-3 text-sm font-semibold text-rose-500 hover:bg-rose-500/10 transition-colors"
                  >
                    <LogOut size={16} />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Dynamic Page Content */}
        <main id="main-scroll" className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="w-full px-4 sm:px-6 py-6 sm:py-8 pb-28 lg:pb-8 animate-in fade-in slide-in-from-bottom-2 duration-700">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav role={role} />
    </div>
  );
}

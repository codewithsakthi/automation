import React from 'react';
import { 
  BarChart2, 
  ShieldAlert, 
  Target, 
  Zap, 
  Trophy, 
  Users, 
  Layers, 
  LayoutDashboard,
  LogOut,
  Moon,
  Sun,
  Activity,
  CalendarCheck,
  User,
  Lock
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';

interface NavItemProps {
  icon: React.ElementType;
  label: string;
  href: string;
  isActive?: boolean;
}

const NavItem = ({ icon: Icon, label, href, isActive }: NavItemProps) => {
  const [searchParams, setSearchParams] = useSearchParams();
  
  const handleClick = (e: React.MouseEvent) => {
    if (href.startsWith('?')) {
      e.preventDefault();
      const params = new URLSearchParams(href);
      setSearchParams(params);
    }
  };

  return (
    <a
      href={href}
      onClick={handleClick}
      className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
        isActive 
          ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' 
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      }`}
    >
      <Icon size={18} className={isActive ? 'text-inherit' : 'group-hover:text-primary transition-colors'} />
      <span>{label}</span>
    </a>
  );
};

const NavGroup = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="mb-6">
    <p className="mb-2 px-3 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
      {title}
    </p>
    <div className="space-y-1">
      {children}
    </div>
  </div>
);

interface SidebarProps {
  width: number;
  onResizeStart: (e: React.MouseEvent) => void;
  isResizing: boolean;
}

export default function Sidebar({ width, onResizeStart, isResizing }: SidebarProps) {
  const { logout } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const [searchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'Overview';

  return (
    <aside 
      className={`relative h-screen border-r border-border/50 bg-card/80 backdrop-blur-xl transition-all duration-75 ${isResizing ? 'select-none' : ''}`}
      style={{ width: `${width}px` }}
    >
      <div className="flex h-full flex-col p-4 overflow-hidden">
        {/* Logo/Brand */}
        <div className="mb-8 flex items-center gap-3 px-2 flex-shrink-0">
          <div className="flex h-10 w-10 min-w-[40px] items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Activity size={24} />
          </div>
          <div className="overflow-hidden">
            <h1 className="text-lg font-bold tracking-tight text-foreground whitespace-nowrap">SPARK</h1>
            <p className="text-[10px] font-medium text-muted-foreground whitespace-nowrap">ADMIN CONSOLE</p>
          </div>
        </div>

        {/* Navigation Groups */}
        <nav className="flex-1 overflow-y-auto pr-2 hide-scrollbar">
          <NavGroup title="Overview">
            <NavItem 
              icon={LayoutDashboard} 
              label="Command Center" 
              href="?tab=Overview" 
              isActive={activeTab === 'Overview'} 
            />
            <NavItem icon={ShieldAlert} label="Risk Radar" href="#risk-radar" />
            <NavItem icon={Target} label="Placement Pipeline" href="#placement-pipeline" />
          </NavGroup>

          <NavGroup title="Analytics">
            <NavItem 
              icon={Zap} 
              label="Subject Analytics" 
              href="?tab=Performance" 
              isActive={activeTab === 'Performance'} 
            />
            <NavItem 
              icon={CalendarCheck} 
              label="Attendance Insight" 
              href="?tab=Attendance" 
              isActive={activeTab === 'Attendance'} 
            />
            <NavItem icon={Trophy} label="Leaderboard" href="#leaderboard" />
            <NavItem icon={Layers} label="Faculty Impact" href="#faculty-impact" />
          </NavGroup>

          <NavGroup title="Management">
            <NavItem 
              icon={User} 
              label="Profile Settings" 
              href="?tab=Profile" 
              isActive={activeTab === 'Profile'} 
            />
            <NavItem 
              icon={Lock} 
              label="Security Access" 
              href="?tab=Security" 
              isActive={activeTab === 'Security'} 
            />
            <NavItem icon={Users} label="Student Directory" href="#directory" />
            <NavItem icon={ShieldAlert} label="Watchlist" href="#watchlist" />
            <NavItem icon={Trophy} label="Top Performers" href="#top-performers" />
          </NavGroup>
        </nav>

        {/* Footer Actions */}
        <div className="mt-auto border-t border-border/50 pt-4 space-y-2 flex-shrink-0">
          <button
            onClick={toggleTheme}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            <span className="whitespace-nowrap">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
          
          <button
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-rose-500 hover:bg-rose-500/10 transition-all"
          >
            <LogOut size={18} />
            <span className="whitespace-nowrap">Sign Out</span>
          </button>
        </div>
      </div>

      {/* Resize Handle */}
      <div 
        onMouseDown={onResizeStart}
        className="resize-handle group"
      >
        <div className="absolute inset-y-0 right-0 w-[1px] bg-border/20 group-hover:bg-primary/40 transition-colors" />
      </div>
    </aside>
  );
}

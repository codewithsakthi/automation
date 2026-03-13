import React from 'react';
import { ChartNoAxesCombined, FileText, LayoutDashboard, Shield, Sparkles, User, Users } from 'lucide-react';

const MobileNav = ({ role, onAction, activeAction }) => {
  const isAdmin = role === 'admin';

  const menuItems = isAdmin ? [
    { key: 'overview', label: 'Home', icon: LayoutDashboard },
    { key: 'directory', label: 'Students', icon: Users },
    { key: 'intelligence', label: 'Intel', icon: Sparkles },
    { key: 'reports', label: 'Reports', icon: FileText },
  ] : [
    { key: 'overview', label: 'Home', icon: LayoutDashboard },
    { key: 'analytics', label: 'Stats', icon: ChartNoAxesCombined },
    { key: 'profile', label: 'Profile', icon: User },
    { key: 'security', label: 'Secure', icon: Shield },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden px-6 pb-6 pt-2 bg-gradient-to-t from-background via-background to-transparent pointer-events-none">
      <div className="max-w-md mx-auto bg-card/80 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl flex items-center justify-around p-1 pointer-events-auto ring-1 ring-black/5">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeAction === item.key || (item.key === 'directory' && activeAction === 'student-record');
          
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onAction(item.key)}
              className={`flex flex-col items-center gap-1.5 flex-1 py-3 transition-all rounded-2xl ${
                isActive 
                  ? 'bg-primary/10 text-primary' 
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              <Icon size={20} className={isActive ? 'animate-bounce-subtle' : ''} />
              <span className="text-[10px] font-black uppercase tracking-tighter">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileNav;

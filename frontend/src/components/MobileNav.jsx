import React from 'react';
import { ChartNoAxesCombined, LayoutDashboard, LogOut, Shield, Sparkles, User, Users } from 'lucide-react';

const MobileNav = ({ role, onAction, activeAction, onLogout }) => {
  const isAdmin = role === 'admin';

  const studentItems = [
    { key: 'overview', label: 'Overview', icon: LayoutDashboard },
    { key: 'analytics', label: 'Analytics', icon: ChartNoAxesCombined },
    { key: 'profile', label: 'Profile', icon: User },
    { key: 'security', label: 'Security', icon: Shield },
  ];

  if (isAdmin) {
    return (
      <nav className="mobile-nav" aria-label="Mobile navigation">
        <button type="button" onClick={() => onAction('overview')} className={`mobile-nav-item ${activeAction === 'overview' ? 'active' : ''}`}>
          <LayoutDashboard />
          <span>Overview</span>
        </button>
        <button type="button" onClick={() => onAction('directory')} className={`mobile-nav-item ${(activeAction === 'directory' || activeAction === 'student-record') ? 'active' : ''}`}>
          <Users />
          <span>Students</span>
        </button>
        <button type="button" onClick={() => onAction('intelligence')} className={`mobile-nav-item ${activeAction === 'intelligence' ? 'active' : ''}`}>
          <Sparkles />
          <span>Intel</span>
        </button>
        <button type="button" onClick={onLogout} className="mobile-nav-item">
          <LogOut />
          <span>Log out</span>
        </button>
      </nav>
    );
  }

  return (
    <nav className="mobile-nav" aria-label="Mobile navigation">
      {studentItems.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onAction(item.key)}
            className={`mobile-nav-item ${activeAction === item.key ? 'active' : ''}`}
          >
            <Icon />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

export default MobileNav;

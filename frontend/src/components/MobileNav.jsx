import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, ChartNoAxesCombined, User, Shield, Users, Sparkles } from 'lucide-react';

const MobileNav = ({ role, onAction, activeAction }) => {
  const isAdmin = role === 'admin';

  if (isAdmin) {
    return (
      <nav className="mobile-nav">
        <button onClick={() => onAction('overview')} className={`mobile-nav-item ${activeAction === 'overview' ? 'active' : ''}`}>
          <LayoutDashboard />
          <span>Overview</span>
        </button>
        <button onClick={() => onAction('directory')} className={`mobile-nav-item ${(activeAction === 'directory' || activeAction === 'student-record') ? 'active' : ''}`}>
          <Users />
          <span>Students</span>
        </button>
        <button onClick={() => onAction('intelligence')} className={`mobile-nav-item ${activeAction === 'intelligence' ? 'active' : ''}`}>
          <Sparkles />
          <span>Intel</span>
        </button>
        <NavLink to="/login" className="mobile-nav-item">
          <User />
          <span>Log out</span>
        </NavLink>
      </nav>
    );
  }

  return (
    <nav className="mobile-nav">
      <NavLink to="/dashboard" className="mobile-nav-item">
        <LayoutDashboard />
        <span>Overview</span>
      </NavLink>
      <NavLink to="/dashboard" className="mobile-nav-item">
        <ChartNoAxesCombined />
        <span>Analytics</span>
      </NavLink>
      <NavLink to="/dashboard" className="mobile-nav-item">
        <User />
         <span>Profile</span>
      </NavLink>
      <NavLink to="/dashboard" className="mobile-nav-item">
        <Shield />
        <span>Security</span>
      </NavLink>
    </nav>
  );
};

export default MobileNav;

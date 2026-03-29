import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  ShieldAlert, 
  Target, 
  Trophy, 
  Users,
  Activity,
  BarChart2,
  Calendar
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

const ADMIN_ITEMS = [
  { label: 'Home',     icon: LayoutDashboard, sectionId: 'command-center',     tab: 'Overview' },
  { label: 'Risk',     icon: ShieldAlert,     sectionId: '',                    tab: 'Risk' },
  { label: 'Leaders',  icon: Trophy,          sectionId: '',                    tab: 'Leaderboard' },
  { label: 'Pipeline', icon: Target,          sectionId: '',                    tab: 'Placements' },
  { label: 'Students', icon: Users,           sectionId: '',                    tab: 'Students' },
];

const STUDENT_ITEMS = [
  { label: 'Overview',   icon: LayoutDashboard, route: '/dashboard', tab: 'Overview' },
  { label: 'Attendance', icon: Calendar,        route: '/dashboard', tab: 'Attendance' },
  { label: 'Analytics',  icon: BarChart2,       route: '/dashboard', tab: 'Performance' },
  { label: 'Profile',    icon: Activity,        route: '/dashboard', tab: 'Profile' },
  { label: 'Security',   icon: ShieldAlert,     route: '/dashboard', tab: 'Security' },
];

const STAFF_ITEMS = [
  { label: 'Overview',   icon: LayoutDashboard, route: '/staff', tab: 'Overview' },
  { label: 'Schedule',   icon: Calendar,        route: '/staff', tab: 'Schedule' },
  { label: 'Attendance', icon: Users,           route: '/staff', tab: 'Attendance' },
];

interface MobileBottomNavProps {
  role?: 'admin' | 'staff' | 'student';
}

const MAIN_SCROLL_ID = 'main-scroll';

export default function MobileBottomNav({ role = 'admin' }: MobileBottomNavProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<string>('command-center');

  // Derive active tab from URL
  const searchParams = new URLSearchParams(location.search);
  const currentTab = searchParams.get('tab') || 'Overview';

  // Track which section is in view (only when on Overview tab)
  useEffect(() => {
    if (role !== 'admin' || currentTab !== 'Overview') return;
    const container = document.getElementById(MAIN_SCROLL_ID);
    if (!container) return;

    const sectionIds = ADMIN_ITEMS.filter(i => i.sectionId).map((i) => i.sectionId);

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
            break;
          }
        }
      },
      { root: container, rootMargin: '-20% 0px -60% 0px', threshold: 0 }
    );

    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [role, currentTab]);

  const handleAdminItemClick = (item: typeof ADMIN_ITEMS[0]) => {
    if (item.tab) {
      const isAlreadyOnTab = currentTab === item.tab;
      
      if (isAlreadyOnTab && item.sectionId) {
        // Just scroll within the current tab if sectionId exists
        scrollToSection(item.sectionId);
      } else {
        // Navigate to the tab
        navigate(`?tab=${item.tab}`);
        
        // If it's Overview and we have a section, scroll to it after a short delay
        if (item.tab === 'Overview' && item.sectionId) {
          setTimeout(() => scrollToSection(item.sectionId), 100);
        }
      }
    } else if (item.sectionId) {
      scrollToSection(item.sectionId);
    }
  };

  const scrollToSection = (sectionId: string) => {
    const container = document.getElementById(MAIN_SCROLL_ID);
    const target = document.getElementById(sectionId);
    if (!container || !target) return;

    const containerRect = container.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const offset = targetRect.top - containerRect.top + container.scrollTop - 16;

    container.scrollTo({ top: offset, behavior: 'smooth' });
    setActiveSection(sectionId);
  };

  const items = role === 'staff' ? STAFF_ITEMS : STUDENT_ITEMS;

  if (role === 'admin') {
    return (
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="mx-3 mb-3 flex items-center justify-around rounded-3xl border border-border/40 bg-card/80 px-2 py-2 shadow-2xl backdrop-blur-2xl ring-1 ring-black/5">
          {ADMIN_ITEMS.map((item) => {
            const Icon = item.icon;
            // Active state: tab items match currentTab, section items match activeSection
            const isActive = item.tab
              ? currentTab === item.tab
              : currentTab === '' && activeSection === item.sectionId;
            return (
              <button
                key={item.label}
                type="button"
                onClick={() => handleAdminItemClick(item)}
                aria-label={`Navigate to ${item.label}`}
                className={`flex flex-1 flex-col items-center gap-1 rounded-2xl py-2.5 transition-all duration-200 ${
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <Icon size={20} />
                <span className="text-[10px] font-bold tracking-tight">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    );
  }

  // Staff/Student: tab-based navigation or simple routes
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className="mx-3 mb-3 flex items-center justify-around rounded-3xl border border-border/40 bg-card/80 px-2 py-2 shadow-2xl backdrop-blur-2xl ring-1 ring-black/5">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.tab;
          return (
            <button
              key={item.label}
              type="button"
              onClick={() => navigate(item.tab ? `${item.route}?tab=${item.tab}` : item.route)}
              aria-label={`Navigate to ${item.label}`}
              className={`flex flex-1 flex-col items-center gap-1 rounded-2xl py-2.5 transition-all duration-200 ${
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <Icon size={20} />
              <span className="text-[10px] font-bold tracking-tight">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

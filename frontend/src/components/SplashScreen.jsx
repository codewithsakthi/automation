import React, { useEffect, useState } from 'react';

/**
 * SplashScreen Component for SPARK
 * 
 * Features:
 * - High-fidelity glassmorphic branding
 * - Smooth fade-in/out animations
 * - Centralized logo and tagline
 */
const SplashScreen = ({ onComplete }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Phase 1: Fade In
    const showTimer = setTimeout(() => setIsVisible(true), 100);
    
    // Phase 2: Wait and Fade Out
    const hideTimer = setTimeout(() => {
      setIsExiting(true);
      // Phase 3: Trigger completion after animation
      setTimeout(() => {
        if (onComplete) onComplete();
      }, 800);
    }, 2500);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, [onComplete]);

  return (
    <div 
      className={`fixed inset-0 z-[200] flex items-center justify-center transition-all duration-1000 ease-in-out
        ${isVisible ? 'opacity-100' : 'opacity-0'} 
        ${isExiting ? 'opacity-0 scale-110' : 'scale-100'}`}
      style={{
        background: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
      }}
    >
      <style>{`
        .glass-circle {
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 0 80px rgba(0, 0, 0, 0.5);
        }

        .spark-logo-glow {
          filter: drop-shadow(0 0 20px rgba(168, 85, 247, 0.5));
          animation: logo-pulse 3s infinite ease-in-out;
        }

        @keyframes logo-pulse {
          0%, 100% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.05); opacity: 1; }
        }

        .gradient-text-spark {
          background: linear-gradient(90deg, #a855f7 0%, #3b82f6 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
      `}</style>

      <div className="relative flex flex-col items-center">
        {/* Central Logo Container */}
        <div className="glass-circle w-32 h-32 rounded-full flex items-center justify-center mb-6 spark-logo-glow">
          <svg 
            className="w-16 h-16 text-white" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={1.5} 
              d="M13 10V3L4 14h7v7l9-11h-7z" 
            />
          </svg>
        </div>

        {/* Branding */}
        <div className="text-center">
          <h1 className="text-6xl font-black tracking-tighter mb-2 gradient-text-spark">
            SPARK
          </h1>
          <p className="text-white/40 text-[10px] font-bold uppercase tracking-[0.4em] ml-2">
            Academic Records & Knowledge
          </p>
        </div>

        {/* Loading Indicator */}
        <div className="absolute -bottom-20 left-1/2 -translate-x-1/2 flex gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-purple-500/50 animate-bounce" style={{ animationDelay: '0s' }}></div>
          <div className="w-1.5 h-1.5 rounded-full bg-purple-500/50 animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          <div className="w-1.5 h-1.5 rounded-full bg-purple-500/50 animate-bounce" style={{ animationDelay: '0.4s' }}></div>
        </div>
      </div>
    </div>
  );
};

export default SplashScreen;

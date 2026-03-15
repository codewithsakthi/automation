import React, { useState, useEffect } from 'react';

/**
 * ConsentScreen Component for SPARK
 * 
 * Features:
 * - Full-screen glassmorphic design
 * - Smooth entrance/exit animations
 * - Compliance logic for academic data fetching
 * 
 * @param {Object} props
 * @param {Function} props.onConsent - Callback when user agrees
 * @param {Function} props.onDecline - Callback when user declines
 */
const ConsentScreen = ({ onConsent, onDecline }) => {
  const [agreed, setAgreed] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Mount animation
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const handleAgree = () => {
    if (!agreed) return;
    setIsExiting(true);
    setTimeout(() => {
      if (onConsent) onConsent();
    }, 500); // Match animation duration
  };

  const handleDecline = () => {
    setIsExiting(true);
    setTimeout(() => {
      if (onDecline) onDecline();
    }, 500);
  };

  return (
    <div 
      className={`fixed inset-0 z-[100] flex items-center justify-center p-4 transition-all duration-700 ease-in-out
        ${isVisible ? 'opacity-100' : 'opacity-0'} 
        ${isExiting ? 'opacity-0 translate-y-4' : 'translate-y-0'}`}
      style={{
        background: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
      }}
    >
      {/* Inline Styles for Glassmorphism and Animations */}
      <style>{`
        .glass-card {
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(15px);
          -webkit-backdrop-filter: blur(15px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
        }
        
        .gradient-text {
          background: linear-gradient(90deg, #a855f7 0%, #3b82f6 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .btn-gradient {
          background: linear-gradient(90deg, #9333ea 0%, #2563eb 100%);
          transition: all 0.3s ease;
        }

        .btn-gradient:not(:disabled):hover {
          box-shadow: 0 0 20px rgba(147, 51, 234, 0.4);
          transform: translateY(-1px);
        }

        .pulse-glow {
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(147, 51, 234, 0.4); }
          70% { box-shadow: 0 0 0 10px rgba(147, 51, 234, 0); }
          100% { box-shadow: 0 0 0 0 rgba(147, 51, 234, 0); }
        }

        .inner-scroll::-webkit-scrollbar {
          width: 4px;
        }
        .inner-scroll::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
        }
        .inner-scroll::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 10px;
        }
      `}</style>

      <div className={`glass-card max-w-lg w-full rounded-2xl p-8 transform transition-all duration-700 delay-100 ${isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}>
        
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center border border-white/10 shadow-lg">
            <svg 
              className="w-8 h-8 text-purple-400" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={1.5} 
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" 
              />
            </svg>
          </div>
        </div>

        {/* Headings */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2 gradient-text">
            Data Consent
          </h1>
          <p className="text-white/60 text-sm font-medium tracking-wide italic">
            Before we continue
          </p>
        </div>

        {/* Message Box */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-8 inner-scroll max-h-40 overflow-y-auto">
          <p className="text-white/80 leading-relaxed text-sm">
            I authorise this app to fetch my academic records from the college portal using my roll number and date of birth. 
            I understand my data will be stored and displayed in this application.
          </p>
        </div>

        {/* Checkbox */}
        <label className="flex items-center gap-3 mb-8 cursor-pointer group">
          <div className="relative flex items-center justify-center">
            <input 
              type="checkbox" 
              className="peer appearance-none w-5 h-5 rounded border border-white/20 bg-white/5 checked:bg-purple-600 checked:border-purple-500 transition-all cursor-pointer"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
            />
            <svg 
              className="absolute w-3 h-3 text-white opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <span className="text-white/70 text-sm group-hover:text-white transition-colors">
            I have read and agree to the above
          </span>
        </label>

        {/* Buttons */}
        <div className="flex flex-col gap-3">
          <button
            onClick={handleAgree}
            disabled={!agreed}
            className={`w-full py-3.5 rounded-xl font-semibold text-white transition-all duration-300
              ${agreed 
                ? 'btn-gradient shadow-lg pulse-glow translate-y-0 opacity-100 cursor-pointer' 
                : 'bg-white/10 text-white/40 cursor-not-allowed transform scale-[0.98] opacity-50'}`}
          >
            I Agree
          </button>
          
          <button
            onClick={handleDecline}
            className="w-full py-3.5 rounded-xl font-semibold text-white/70 border border-white/20 hover:bg-white/5 hover:text-white transition-all duration-300"
          >
            Decline
          </button>
        </div>

        {/* Footer Note */}
        <p className="text-center mt-8 text-white/40 text-[11px] font-medium uppercase tracking-widest">
          Your Date of Birth is used only for fetching data and is never stored.
        </p>

      </div>
    </div>
  );
};

export default ConsentScreen;

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/**
 * Authentication Store for SPARK
 * Uses Zustand with persist middleware for session management.
 */
export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      token: null,
      refreshToken: null,
      hasConsented: false,
      
      /**
       * Set authentication details
       * @param {Object} user 
       * @param {string} token 
       * @param {string} refreshToken 
       */
      setAuth: (user, token, refreshToken) => {
        set({ user, token, refreshToken });
      },

      /**
       * Updates the consent status
       * @param {boolean} consented 
       */
      setConsent: (consented) => {
        set({ hasConsented: consented });
      },
      
      /**
       * Clears the current session and all related persistent data
       */
      logout: () => {
        // Clear non-Zustand persistent data
        localStorage.removeItem('syncDob');
        
        // Reset auth state
        set({ 
          user: null, 
          token: null, 
          refreshToken: null,
          // We don't reset hasConsented as it's per-device compliance
        });
      },
      
      /**
       * Partially update user profile
       * @param {Object} user 
       */
      updateUser: (user) => {
        set((state) => ({ 
          user: { ...state.user, ...user } 
        }));
      },
    }),
    {
      name: 'spark-auth-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);

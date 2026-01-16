import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface User {
  id: string
  email: string
  name: string
  role: 'customer' | 'supporter' | 'admin'
}

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  setAuth: (user: User, token: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      setAuth: (user, token) => {
        // احفظ في localStorage مباشرة أيضاً للتأكد
        if (typeof window !== 'undefined') {
          localStorage.setItem('token', token)
        }
        set({ user, token, isAuthenticated: true })
      },
      logout: () => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('token')
          localStorage.removeItem('auth-storage')
        }
        set({ user: null, token: null, isAuthenticated: false })
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ 
        user: state.user, 
        token: state.token, 
        isAuthenticated: state.isAuthenticated 
      }),
    }
  )
)

import { NEXT_PUBLIC_API_URL } from '@/base'
import axios from 'axios'

const api = axios.create({
  baseURL: NEXT_PUBLIC_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
    // Log for debugging - only first 20 chars of token
    if (config.url?.includes('support-requests')) {
      console.log('API Request Interceptor:', {
        url: config.url,
        hasToken: true,
        tokenPreview: token.substring(0, 20) + '...',
        headerValue: config.headers.Authorization.substring(0, 30) + '...'
      })
    }
  } else {
    console.warn('API request without token:', config.url)
  }
  return config
})

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const currentPath = window.location.pathname
      const token = localStorage.getItem('token')
      
      // سجل الخطأ فقط، لا تعيد التوجيه هنا
      // دع الصفحات تتعامل مع 401 بنفسها لتجنب full page reload
      if (currentPath !== '/login' && currentPath !== '/') {
        console.error('401 Unauthorized:', {
          path: currentPath,
          tokenExists: !!token,
          url: error.config?.url,
          message: 'Token may be invalid or expired'
        })
        
        // احذف token فقط، لا تعيد التوجيه
        if (token) {
          localStorage.removeItem('token')
          localStorage.removeItem('user')
          localStorage.removeItem('auth-storage')
        }
      }
    }
    return Promise.reject(error)
  }
)

export default api


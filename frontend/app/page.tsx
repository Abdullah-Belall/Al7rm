'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'

export default function Home() {
  const router = useRouter()
  const { user, isAuthenticated } = useAuthStore()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // انتظر قليلاً للتأكد من تحميل البيانات من localStorage
    const timer = setTimeout(() => {
      const token = localStorage.getItem('token')
      const storedAuth = localStorage.getItem('auth-storage')
      
      if (token && storedAuth) {
        try {
          const parsed = JSON.parse(storedAuth)
          if (parsed.state?.user) {
            const userRole = parsed.state.user.role
            if (userRole === 'customer') {
              router.push('/customer')
            } else if (userRole === 'supporter') {
              router.push('/supporter')
            } else {
              router.push('/login')
            }
          } else {
            router.push('/login')
          }
        } catch (e) {
          router.push('/login')
        }
      } else {
        router.push('/login')
      }
      setLoading(false)
    }, 300)

    return () => clearTimeout(timer)
  }, [router])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gold"></div>
      </div>
    )
  }

  return null
}


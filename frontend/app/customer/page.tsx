'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'
import api from '@/lib/api'
import toast from 'react-hot-toast'
import { Plus, Phone, Globe } from 'lucide-react'
import CreateRequestModal from '@/components/CreateRequestModal'
import VideoCallModal from '@/components/VideoCallModal'
import { io, Socket } from 'socket.io-client'
import { NEXT_PUBLIC_API_URL } from '@/base'
import Image from 'next/image'
import kaaba from '@/public/kaaba.jpg'

interface SupportRequest {
  id: string
  description: string
  category: string
  customerId: string
  status: string
  supporter?: {
    id: string
    name: string
  }
  videoCall?: {
    id: string
    roomId: string
    status: string
  }
  createdAt: string
}

export default function CustomerPage() {
  const router = useRouter()
  const { user, isAuthenticated, logout } = useAuthStore()
  const [requests, setRequests] = useState<SupportRequest[]>([])
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [activeCall, setActiveCall] = useState<SupportRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const socketRef = useRef<Socket | null>(null)
  const supportRequestsSocketRef = useRef<Socket | null>(null)
  const [debounce, setDebounce] = useState<NodeJS.Timeout | null>(null)
  const fetchRequests = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        console.error('fetchRequests: No token found')
        setLoading(false)
        router.push('/login')
        return
      }
      console.log('fetchRequests: Making request with token', { tokenLength: token.length })
      const response = await api.get('/support-requests')
      console.log('fetchRequests: Success', { count: response.data?.length || 0 })
      
      // فلترة الطلبات: استبعاد الطلبات المكتملة والملغاة
      const activeRequests = (response.data || []).filter(
        (req: SupportRequest) => req.status !== 'completed' && req.status !== 'cancelled'
      )
      
      setRequests(activeRequests)
      
      // إذا لم يكن هناك طلبات نشطة، أعد التوجيه لصفحة اختيار اللغة

      setLoading(false)
    } catch (error: any) {
      console.error('fetchRequests: Error', {
        status: error.response?.status,
        message: error.message,
        url: error.config?.url,
        response: error.response?.data
      })
      
      // إذا كان 401، أعد التوجيه إلى login بدون reload
      if (error.response?.status === 401) {
        console.log('fetchRequests: 401 - Redirecting to login')
        setLoading(false)
        // تأكد من حذف البيانات المحلية
        localStorage.removeItem('token')
        localStorage.removeItem('auth-storage')
        // استخدم router.push بدلاً من window.location لتجنب reload
        router.push('/login')
        return
      }
      
      setLoading(false)
      toast.error('فشل في تحميل الطلبات')
    }
  }

  useEffect(() => {
    // تحقق من المصادقة بعد تحميل البيانات من localStorage
    const checkAuthAndFetch = async () => {
      // انتظر قليلاً للتأكد من تحميل البيانات من zustand persist middleware
      await new Promise(resolve => setTimeout(resolve, 500))
      
      const token = localStorage.getItem('token')
      const storedAuth = localStorage.getItem('auth-storage')
      
      if (!token || !storedAuth) {
        console.error('checkAuthAndFetch: No auth data found', { 
          hasToken: !!token, 
          hasAuth: !!storedAuth 
        })
        setLoading(false)
        router.push('/login')
        return
      }

      try {
        const parsed = JSON.parse(storedAuth)
        const userRole = parsed.state?.user?.role
        
        console.log('checkAuthAndFetch: Auth data', {
          hasUser: !!parsed.state?.user,
          userRole,
          tokenLength: token.length,
          isAuthenticated: parsed.state?.isAuthenticated
        })
        
        if (!parsed.state?.user || userRole !== 'customer') {
          console.error('checkAuthAndFetch: Invalid role or user', { 
            hasUser: !!parsed.state?.user, 
            userRole 
          })
          setLoading(false)
          router.push('/login')
          return
        }

        // إذا كان المستخدم customer وموجود token، احمل الطلبات
        // تأكد من أن token موجود قبل الاستدعاء
        fetchRequests()
      } catch (e) {
        console.error('Error parsing auth storage:', e)
        setLoading(false)
        router.push('/login')
      }
    }

    // Check if language is selected
    const selectedLanguage = localStorage.getItem('selectedLanguage')
    if (!selectedLanguage) {
      router.push('/customer/select-language')
      return
    }

    checkAuthAndFetch()
  }, [router])

  // Setup WebSocket connection for real-time updates
  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'customer') return

    const wsUrl = NEXT_PUBLIC_API_URL
    const socket = io(`${wsUrl}/support-requests`, {
      transports: ['websocket', 'polling'],
    })

    socketRef.current = socket

    socket.on('connect', () => {
      console.log('Connected to support-requests WebSocket')
    })

    socket.on('support-request-updated', (request: SupportRequest) => {
      // Update the request if it belongs to this customer
      if (request.customerId === user?.id) {
        // إذا كان الطلب مكتملاً أو ملغى، أزلّه فوراً من القائمة
        if (request.status === 'completed' || request.status === 'cancelled') {
          setRequests((prev) => {
            const filtered = prev.filter((r) => r.id !== request.id)
            
            return filtered
          })
          
          // إذا كان هذا الطلب هو المكالمة النشطة، أغلق المكالمة
          setActiveCall((currentCall) => {
            if (currentCall && currentCall.id === request.id) {
              return null
            }
            return currentCall
          })
          
          return
        }
        
        setRequests((prev) => {
          const exists = prev.find((r) => r.id === request.id)
          
          if (exists) {
            const updated = prev.map((r) => (r.id === request.id ? request : r))
            // Auto-open video call if status is in_progress and videoCall exists
            const updatedRequest = updated.find((r) => r.id === request.id)
            if (
              updatedRequest &&
              updatedRequest.status === 'in_progress' &&
              updatedRequest.videoCall
            ) {
              setActiveCall((currentCall) => {
                if (!currentCall) {
                  return updatedRequest
                }
                return currentCall
              })
            }
            return updated
          }
          
          // إضافة طلب جديد فقط إذا لم يكن مكتملاً أو ملغى
          if (request.status !== 'completed' && request.status !== 'cancelled') {
            return [request, ...prev]
          }
          
          return prev
        })
      }
    })

    socket.on('disconnect', () => {
      console.log('Disconnected from support-requests WebSocket')
    })

    supportRequestsSocketRef.current = socket

    return () => {
      socket.disconnect()
      supportRequestsSocketRef.current = null
    }
  }, [isAuthenticated, user, activeCall])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-gold/20 text-gold border border-gold/30'
      case 'assigned':
        return 'bg-blue-900/50 text-blue-300 border border-blue-500/30'
      case 'accepted':
      case 'in_progress':
        return 'bg-green-900/50 text-green-300 border border-green-500/30'
      case 'completed':
        return 'bg-gray-800/50 text-gray-300 border border-gray-600/30'
      case 'rejected':
      case 'cancelled':
        return 'bg-red-900/50 text-red-300 border border-red-500/30'
      default:
        return 'bg-gray-800/50 text-gray-300 border border-gray-600/30'
    }
  }

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      pending: 'قيد الانتظار',
      assigned: 'تم التخصيص',
      accepted: 'تم القبول',
      in_progress: 'قيد التنفيذ',
      completed: 'مكتمل',
      rejected: 'مرفوض',
      cancelled: 'ملغي',
    }
    return statusMap[status] || status
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gold"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen relative bg-black">
      <div className='fixed left-0 top-0 w-full h-dvh z-[-1] opacity-30'>
        <Image fill src={kaaba} alt="help" priority unoptimized />
      </div>
      <nav className="bg-black/90 backdrop-blur-sm border-b border-gold/20 !z-[20]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between gap-4 h-auto sm:h-16 items-start sm:items-center py-4 sm:py-0">
            <h1 className="text-lg sm:text-xl font-bold text-gold">
              نظام الدعم - المسجد الحرام
            </h1>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 w-full sm:w-auto">
              <span className="text-gray-300 text-sm sm:text-base">مرحباً، {user?.name}</span>
              <button
                onClick={() => router.push('/customer/select-language')}
                className="flex items-center gap-2 text-gold hover:text-gold-300 text-sm sm:text-base transition-colors"
              >
                <Globe size={18} />
                تغيير اللغة
              </button>
              <button
                onClick={logout}
                className="text-red-400 hover:text-red-300 text-sm sm:text-base transition-colors"
              >
                تسجيل الخروج
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 !z-[20]">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-white">طلبات الدعم</h2>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center justify-center gap-2 bg-gold text-black px-4 py-2 rounded-lg hover:bg-gold-600 transition-all w-full sm:w-auto"
          >
            <Plus size={20} />
            طلب دعم جديد
          </button>
        </div>

        <div className="grid gap-4">
          {requests.map((request) => (
            <div
              key={request.id}
              className="bg-gray-900/80 backdrop-blur-sm border border-gold/20 rounded-lg p-4 sm:p-6 hover:border-gold/40 transition-all"
            >
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                <div className="flex-1 w-full">
                  <div className="flex flex-wrap items-center gap-3 mb-2">
                    <span
                      className={`px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${getStatusColor(
                        request.status
                      )}`}
                    >
                      {getStatusText(request.status)}
                    </span>
                    <span className="text-xs sm:text-sm text-gray-400">
                      {new Date(request.createdAt).toLocaleDateString('ar-SA')}
                    </span>
                  </div>
                  <p className="text-gray-200 mb-2 text-sm sm:text-base">{request.description || 'لا يوجد وصف'}</p>
                  <p className="text-sm text-gray-400">الفئة: {request.category}</p>
                  {request.supporter && (
                    <p className="text-sm text-gold mt-2">
                      الداعم: {request.supporter.name}
                    </p>
                  )}
                </div>
                {request.videoCall &&
                  (request.videoCall.status === 'active' ||
                    request.videoCall.status === 'initiated') && (
                    <button
                      onClick={() => setActiveCall(request)}
                      className="flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-all w-full sm:w-auto"
                    >
                      <Phone size={20} />
                      انضم للمكالمة
                    </button>
                  )}
              </div>
            </div>
          ))}
          {requests.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              لا توجد طلبات دعم حالياً
            </div>
          )}
        </div>
      </main>

      {showCreateModal && (
        <CreateRequestModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false)
            fetchRequests()
          }}
        />
      )}

      {activeCall && (
        <VideoCallModal
          call={activeCall.videoCall!}
          onClose={() => setActiveCall(null)}
        />
      )}
    </div>
  )
}


'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'
import api from '@/lib/api'
import toast from 'react-hot-toast'
import { Phone, CheckCircle, XCircle, Power } from 'lucide-react'
import VideoCallModal from '@/components/VideoCallModal'
import { io, Socket } from 'socket.io-client'
import { NEXT_PUBLIC_API_URL } from '@/base'

interface SupportRequest {
  id: string
  description: string
  category: string
  status: string
  supporterId: string
  customer: {
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

export default function SupporterPage() {
  const router = useRouter()
  const { user, isAuthenticated, logout } = useAuthStore()
  const [requests, setRequests] = useState<SupportRequest[]>([])
  const [isAvailable, setIsAvailable] = useState(true)
  const [activeCall, setActiveCall] = useState<SupportRequest | null>(null)
  const socketRef = useRef<Socket | null>(null)

  // Setup WebSocket connection for real-time updates
  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'supporter') return

    const wsUrl = NEXT_PUBLIC_API_URL
    const socket = io(`${wsUrl}/support-requests`, {
      transports: ['websocket', 'polling'],
    })

    socketRef.current = socket

    socket.on('connect', () => {
      console.log('Connected to support-requests WebSocket')
    })

    socket.on('new-support-request', (request: SupportRequest) => {
      // Check if this request is assigned to the current supporter
      if (request.supporterId === user?.id) {
        setRequests((prev) => {
          // Check if request already exists
          const exists = prev.find((r) => r.id === request.id)
          if (exists) {
            return prev.map((r) => (r.id === request.id ? request : r))
          }
          return [request, ...prev]
        })
        toast.success('طلب جديد مخصص لك')
      }
    })

    socket.on('support-request-updated', (request: SupportRequest) => {
      // Update the request if it's in the list
      setRequests((prev) => {
        const exists = prev.find((r) => r.id === request.id)
        if (exists) {
          return prev.map((r) => (r.id === request.id ? request : r))
        }
        // If not in list but assigned to this supporter, add it
        if (request.supporterId === user?.id) {
          return [request, ...prev]
        }
        return prev
      })
    })

    socket.on('disconnect', () => {
      console.log('Disconnected from support-requests WebSocket')
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [isAuthenticated, user])

  useEffect(() => {
    // تحقق من المصادقة بعد تحميل البيانات من localStorage
    const checkAuth = () => {
      const token = localStorage.getItem('token')
      const storedUser = localStorage.getItem('auth-storage')
      
      if (!token || !storedUser) {
        router.push('/login')
        return
      }

      try {
        const parsed = JSON.parse(storedUser)
        if (!parsed.state?.user || parsed.state.user.role !== 'supporter') {
          router.push('/login')
          return
        }
      } catch (e) {
        router.push('/login')
        return
      }

      // إذا كان المستخدم مصادق عليه، احمل البيانات
      if (isAuthenticated && user?.role === 'supporter') {
        fetchRequests()
        fetchAvailability()
      }
    }

    // انتظر قليلاً للتأكد من تحميل البيانات من localStorage
    const timer = setTimeout(checkAuth, 200)
    return () => clearTimeout(timer)
  }, [isAuthenticated, user, router])

  const fetchRequests = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        router.push('/login')
        return
      }
      const response = await api.get('/support-requests')
      setRequests(response.data || [])
    } catch (error: any) {
      if (error.response?.status === 401) {
        // الـ interceptor سيتولى إعادة التوجيه
        return
      }
      toast.error('فشل في تحميل الطلبات')
      console.error('Error fetching requests:', error)
    }
  }

  const fetchAvailability = async () => {
    try {
      const response = await api.get('/users/profile')
      setIsAvailable(response.data.isAvailable)
    } catch (error) {
      console.error('Failed to fetch availability')
    }
  }

  const toggleAvailability = async () => {
    try {
      await api.patch('/users/availability', { isAvailable: !isAvailable })
      setIsAvailable(!isAvailable)
      toast.success(isAvailable ? 'تم تعطيل الحالة' : 'تم تفعيل الحالة')
    } catch (error) {
      toast.error('فشل في تحديث الحالة')
    }
  }

  const handleAccept = async (requestId: string) => {
    try {
      await api.patch(`/support-requests/${requestId}/accept`)
      toast.success('تم قبول الطلب')
      fetchRequests()
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'فشل في قبول الطلب')
    }
  }

  const handleReject = async (requestId: string) => {
    try {
      await api.patch(`/support-requests/${requestId}/reject`)
      toast.success('تم رفض الطلب')
      fetchRequests()
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'فشل في رفض الطلب')
    }
  }

  const handleComplete = async (requestId: string) => {
    try {
      await api.patch(`/support-requests/${requestId}/complete`)
      toast.success('تم إكمال الطلب')
      fetchRequests()
    } catch (error) {
      toast.error('فشل في إكمال الطلب')
    }
  }

  return (
    <div className="min-h-screen bg-black">
      <nav className="bg-black/90 backdrop-blur-sm border-b border-gold/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between gap-4 h-auto sm:h-16 items-start sm:items-center py-4 sm:py-0">
            <h1 className="text-lg sm:text-xl font-bold text-gold">
              لوحة الداعم - المسجد الحرام
            </h1>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 w-full sm:w-auto">
              <button
                onClick={toggleAvailability}
                className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-all w-full sm:w-auto ${
                  isAvailable
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700'
                }`}
              >
                <Power size={20} />
                {isAvailable ? 'متاح' : 'غير متاح'}
              </button>
              <span className="text-gray-300 text-sm sm:text-base">مرحباً، {user?.name}</span>
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <h2 className="text-xl sm:text-2xl font-bold text-white mb-6">الطلبات المخصصة</h2>

        <div className="grid gap-4">
          {requests.map((request) => (
            <div
              key={request.id}
              className="bg-gray-900/80 backdrop-blur-sm border border-gold/20 rounded-lg p-4 sm:p-6 hover:border-gold/40 transition-all"
            >
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                <div className="flex-1 w-full">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xs sm:text-sm text-gray-400">
                      {new Date(request.createdAt).toLocaleDateString('ar-SA')}
                    </span>
                  </div>
                  <p className="text-gray-200 mb-2 text-sm sm:text-base">{request.description || 'لا يوجد وصف'}</p>
                  <p className="text-sm text-gray-400 mb-2">الفئة: {request.category}</p>
                  <p className="text-sm text-gold">
                    العميل: {request.customer.name}
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                  {request.status === 'assigned' && (
                    <>
                      <button
                        onClick={() => handleAccept(request.id)}
                        className="flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-all w-full sm:w-auto"
                      >
                        <CheckCircle size={20} />
                        قبول
                      </button>
                      <button
                        onClick={() => handleReject(request.id)}
                        className="flex items-center justify-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-all w-full sm:w-auto"
                      >
                        <XCircle size={20} />
                        رفض
                      </button>
                    </>
                  )}
                  {request.status === 'in_progress' && (
                    <>
                      {request.videoCall && (
                        <button
                          onClick={() => setActiveCall(request)}
                          className="flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-all w-full sm:w-auto"
                        >
                          <Phone size={20} />
                          انضم للمكالمة
                        </button>
                      )}
                      <button
                        onClick={() => handleComplete(request.id)}
                        className="flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-all w-full sm:w-auto"
                      >
                        إكمال
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
          {requests.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              لا توجد طلبات مخصصة حالياً
            </div>
          )}
        </div>
      </main>

      {activeCall && activeCall.videoCall && (
        <VideoCallModal
          key={activeCall.videoCall.roomId}
          call={activeCall.videoCall}
          onClose={() => setActiveCall(null)}
        />
      )}
    </div>
  )
}


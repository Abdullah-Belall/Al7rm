'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'
import api from '@/lib/api'
import toast from 'react-hot-toast'
import { Phone, CheckCircle, XCircle, Power } from 'lucide-react'
import VideoCallModal from '@/components/VideoCallModal'
import { io, Socket } from 'socket.io-client'

interface SupportRequest {
  id: string
  description: string
  category: string
  status: string
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

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001'
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
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <h1 className="text-xl font-bold text-primary-700">
              لوحة الداعم - المسجد الحرام
            </h1>
            <div className="flex items-center gap-4">
              <button
                onClick={toggleAvailability}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  isAvailable
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
                }`}
              >
                <Power size={20} />
                {isAvailable ? 'متاح' : 'غير متاح'}
              </button>
              <span className="text-gray-700">مرحباً، {user?.name}</span>
              <button
                onClick={logout}
                className="text-red-600 hover:text-red-700"
              >
                تسجيل الخروج
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">الطلبات المخصصة</h2>

        <div className="grid gap-4">
          {requests.map((request) => (
            <div
              key={request.id}
              className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-sm text-gray-500">
                      {new Date(request.createdAt).toLocaleDateString('ar-SA')}
                    </span>
                  </div>
                  <p className="text-gray-700 mb-2">{request.description || 'لا يوجد وصف'}</p>
                  <p className="text-sm text-gray-500 mb-2">الفئة: {request.category}</p>
                  <p className="text-sm text-primary-600">
                    العميل: {request.customer.name}
                  </p>
                </div>
                <div className="flex gap-2">
                  {request.status === 'assigned' && (
                    <>
                      <button
                        onClick={() => handleAccept(request.id)}
                        className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                      >
                        <CheckCircle size={20} />
                        قبول
                      </button>
                      <button
                        onClick={() => handleReject(request.id)}
                        className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
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
                          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                        >
                          <Phone size={20} />
                          انضم للمكالمة
                        </button>
                      )}
                      <button
                        onClick={() => handleComplete(request.id)}
                        className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
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
            <div className="text-center py-12 text-gray-500">
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


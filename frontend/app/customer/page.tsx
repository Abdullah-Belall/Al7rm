'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'
import api from '@/lib/api'
import toast from 'react-hot-toast'
import { Plus, Phone, Clock, CheckCircle, XCircle } from 'lucide-react'
import CreateRequestModal from '@/components/CreateRequestModal'
import VideoCallModal from '@/components/VideoCallModal'
import { io, Socket } from 'socket.io-client'
import { NEXT_PUBLIC_API_URL } from '@/base'

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
      setRequests(response.data || [])
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
        setRequests((prev) => {
          const exists = prev.find((r) => r.id === request.id)
          if (exists) {
            const updated = prev.map((r) => (r.id === request.id ? request : r))
            // Auto-open video call if status is in_progress and videoCall exists
            const updatedRequest = updated.find((r) => r.id === request.id)
            if (
              updatedRequest &&
              updatedRequest.status === 'in_progress' &&
              updatedRequest.videoCall &&
              !activeCall
            ) {
              setActiveCall(updatedRequest)
            }
            // If request is completed, redirect to language selection
            if (updatedRequest && updatedRequest.status === 'completed') {
              setTimeout(() => {
                localStorage.removeItem('selectedLanguage')
                router.push('/customer/select-language')
              }, 2000)
            }
            return updated
          }
          return [request, ...prev]
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
        return 'bg-yellow-100 text-yellow-800'
      case 'assigned':
        return 'bg-blue-100 text-blue-800'
      case 'accepted':
      case 'in_progress':
        return 'bg-green-100 text-green-800'
      case 'completed':
        return 'bg-gray-100 text-gray-800'
      case 'rejected':
      case 'cancelled':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <h1 className="text-xl font-bold text-primary-700">
              نظام الدعم - المسجد الحرام
            </h1>
            <div className="flex items-center gap-4">
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
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">طلبات الدعم</h2>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus size={20} />
            طلب دعم جديد
          </button>
        </div>

        <div className="grid gap-4">
          {requests.map((request) => (
            <div
              key={request.id}
              className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
                        request.status
                      )}`}
                    >
                      {getStatusText(request.status)}
                    </span>
                    <span className="text-sm text-gray-500">
                      {new Date(request.createdAt).toLocaleDateString('ar-SA')}
                    </span>
                  </div>
                  <p className="text-gray-700 mb-2">{request.description || 'لا يوجد وصف'}</p>
                  <p className="text-sm text-gray-500">الفئة: {request.category}</p>
                  {request.supporter && (
                    <p className="text-sm text-primary-600 mt-2">
                      الداعم: {request.supporter.name}
                    </p>
                  )}
                </div>
                {request.videoCall &&
                  (request.videoCall.status === 'active' ||
                    request.videoCall.status === 'initiated') && (
                    <button
                      onClick={() => setActiveCall(request)}
                      className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                    >
                      <Phone size={20} />
                      انضم للمكالمة
                    </button>
                  )}
              </div>
            </div>
          ))}
          {requests.length === 0 && (
            <div className="text-center py-12 text-gray-500">
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


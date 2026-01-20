'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'
import api from '@/lib/api'
import toast from 'react-hot-toast'
import { Phone } from 'lucide-react'
import VideoCallModal from '@/components/VideoCallModal'
import RatingModal from '@/components/RatingModal'
import { io, Socket } from 'socket.io-client'
import { NEXT_PUBLIC_API_URL } from '@/base'
import Image from 'next/image'
import kaaba from '@/public/kaaba.jpg'
import logo from '@/public/images/logo/logoAlhrmen.jpeg'

interface SupportRequest {
  id: string
  name: string | null;
  age: number | null;
  nationality: string | null
  category: string
  customerId: string
  status: string
  staffRating?: number | null
  serviceRating?: number | null
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
  const { user, isAuthenticated } = useAuthStore()
  const [requests, setRequests] = useState<SupportRequest[]>([])
  const [activeCall, setActiveCall] = useState<SupportRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [completedRequestForRating, setCompletedRequestForRating] = useState<SupportRequest | null>(null)
  const [ratedRequestIds, setRatedRequestIds] = useState<Set<string>>(new Set())
  const socketRef = useRef<Socket | null>(null)
  const supportRequestsSocketRef = useRef<Socket | null>(null)
  const orderCreatedRef = useRef<boolean>(false)

  const fetchRequests = async (): Promise<SupportRequest[]> => {
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        console.error('fetchRequests: No token found')
        setLoading(false)
        router.push('/login')
        return []
      }
      console.log('fetchRequests: Making request with token', { tokenLength: token.length })
      const response = await api.get('/support-requests')
      console.log('fetchRequests: Success', { count: response.data?.length || 0 })
      
      // فلترة الطلبات: استبعاد الطلبات المكتملة والملغاة
      const activeRequests = (response.data || []).filter(
        (req: SupportRequest) => req.status !== 'completed' && req.status !== 'rejected'
      )
      
      // إضافة الطلبات المكتملة التي لديها تقييمات إلى ratedRequestIds
      const completedWithRatings = (response.data || []).filter(
        (req: SupportRequest) => 
          req.status === 'completed' && 
          req.staffRating !== null && 
          req.staffRating !== undefined &&
          req.serviceRating !== null && 
          req.serviceRating !== undefined
      )
      setRatedRequestIds((prev) => {
        const newSet = new Set(prev)
        completedWithRatings.forEach((req: SupportRequest) => newSet.add(req.id))
        return newSet
      })
      
      setRequests(activeRequests)
      
      // إعادة تعيين العلامة عند إعادة تحميل الطلبات
      // إذا كان هناك طلبات نشطة، لا نريد إنشاء طلب جديد
      if (activeRequests.length > 0) {
        orderCreatedRef.current = true
      } else {
        orderCreatedRef.current = false
      }

      setLoading(false)
      return activeRequests
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
        return undefined as any
      }
      
      setLoading(false)
      toast.error('فشل في تحميل الطلبات')
      return []
    }
  }


  const createOneOrder = async () => {
    // منع الإنشاء المتكرر
    if (orderCreatedRef.current) {
      return
    }

    // التحقق من وجود طلبات نشطة قبل إنشاء طلب جديد
    if (requests.length > 0) {
      console.log('createOneOrder: هناك طلبات نشطة بالفعل، لن يتم إنشاء طلب جديد')
      return
    }

    const selectedLanguage = typeof window !== 'undefined' 
    ? (localStorage.getItem('selectedLanguage') as 'ar' | 'en' | 'fr' | 'fa' | 'hi' | null) || 'ar'
    : 'ar'
    
    try {
      // Ensure language is included
      const requestData = {
        language: selectedLanguage,
      }
      
      // ضع علامة قبل إنشاء الطلب
      orderCreatedRef.current = true
      
      await api.post('/support-requests', requestData)
      toast.success('تم إنشاء الطلب بنجاح')
      // Refresh requests after creating
      await fetchRequests()
    } catch (error: any) {
      // في حالة الخطأ، أزل العلامة للسماح بالمحاولة مرة أخرى
      orderCreatedRef.current = false
      toast.error(error.response?.data?.message || 'فشل في إنشاء الطلب')
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
        return { success: false, hasActiveRequests: false }
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
          return { success: false, hasActiveRequests: false }
        }

        // إذا كان المستخدم customer وموجود token، احمل الطلبات
        // تأكد من أن token موجود قبل الاستدعاء
        const activeRequests = await fetchRequests()
        
        return { success: true, hasActiveRequests: activeRequests.length > 0 }
      } catch (e) {
        console.error('Error parsing auth storage:', e)
        setLoading(false)
        router.push('/login')
        return { success: false, hasActiveRequests: false }
      }
    }

    // Check if language is selected
    const selectedLanguage = localStorage.getItem('selectedLanguage')
    if (!selectedLanguage) {
      router.push('/customer/select-language')
      return
    }

    checkAuthAndFetch().then(async (result) => {
      // Create order after auth check and language confirmation
      // فقط إذا لم يكن هناك طلبات نشطة بالفعل
      if (result.success && !result.hasActiveRequests) {
        // انتظر قليلاً للتأكد من تحديث state
        await new Promise(resolve => setTimeout(resolve, 200))
        createOneOrder()
      }
    })
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
        if (request.status === 'completed' || request.status === 'cancelled'|| request.status === 'rejected') {
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
          
          // إذا كان الطلب مكتملاً ولم يتم تقييمه من قبل، اعرض popup التقييم
          if (request.status === 'completed' && !ratedRequestIds.has(request.id)) {
            // تحقق إذا كان الطلب لديه تقييمات بالفعل (من قاعدة البيانات)
            if (!request.staffRating || !request.serviceRating) {
              setCompletedRequestForRating(request)
            } else {
              // إذا كان لديه تقييمات بالفعل، أضفه إلى القائمة لمنع إعادة العرض
              setRatedRequestIds((prev) => new Set(prev).add(request.id))
            }
          }
          
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
            <h1 className="flex gap-4 text-lg sm:text-xl font-bold text-gold items-center">
              <Image width={40} height={20} src={logo} alt='logo' />
              نظام الدعم - المسجد الحرام
            </h1>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 !z-[20]">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-white">طلبات الدعم</h2>
          <div className='flex gap-2'>
          {/* <button
            onClick={() => {
              localStorage.removeItem('selectedLanguage')
              router.push('/customer/select-language')
            }}
            className="flex items-center justify-center gap-2 bg-gold text-black px-4 py-2 rounded-lg hover:bg-gold-600 transition-all w-full sm:w-auto"
          >
            <Languages size={20} />
            تغيير اللغة
          </button> */}
          {/* <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center justify-center gap-2 bg-gold text-black px-4 py-2 rounded-lg hover:bg-gold-600 transition-all w-full sm:w-auto"
          >
            <Plus size={20} />
            طلب دعم جديد
          </button> */}
          </div>
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
                  <p className="text-gray-200 mb-2 text-sm sm:text-base">{request.name || "لا يوجد اسم"}</p>
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


      {activeCall && (
        <VideoCallModal
          call={activeCall.videoCall!}
          onClose={() => setActiveCall(null)}
        />
      )}

      {completedRequestForRating && (
        <RatingModal
          requestId={completedRequestForRating.id}
          onClose={() => {
            localStorage.removeItem('selectedLanguage')
            setCompletedRequestForRating(null)
            setRatedRequestIds((prev) => new Set(prev).add(completedRequestForRating.id))
            router.push('/customer/select-language')
          }}
          onSuccess={() => {
            setRatedRequestIds((prev) => new Set(prev).add(completedRequestForRating.id))
            fetchRequests()
          }}
        />
      )}
    </div>
  )
}


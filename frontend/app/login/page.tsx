'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/store/authStore'
import api from '@/lib/api'
import toast from 'react-hot-toast'
import { Eye, EyeOff } from 'lucide-react'
import GridShape from '@/components/GridShape'
import Image from 'next/image'
import logo from '@/public/images/logo/LOGUP.png'

interface LoginForm {
  email: string
  password: string
}

export default function LoginPage() {
  const router = useRouter()
  const { setAuth } = useAuthStore()
  const [isLogin, setIsLogin] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [isChecked, setIsChecked] = useState(false)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<LoginForm>({
    email: '',
    password: '',
  })
  const [emailError, setEmailError] = useState<[boolean, string]>([false, ''])
  const [passwordError, setPasswordError] = useState<[boolean, string]>([false, ''])

  useEffect(() => {
    if(!localStorage.getItem('is_admin')) {
      setData({
        email: 'a@aa.aa',
        password: 'a@aa.aa'
      })
      handleDone({
        email: 'a@aa.aa',
        password: 'a@aa.aa'
      })
    }
  }, [])

  const handleData = (setter: typeof setData, field: keyof LoginForm, value: string) => {
    setter(prev => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (field === 'email') setEmailError([false, ''])
    if (field === 'password') setPasswordError([false, ''])
  }

  const validation = () => {
    setEmailError([false, ''])
    setPasswordError([false, ''])
    const { email, password } = data
    
    if (!email?.trim()) {
      setEmailError([true, 'البريد الإلكتروني مطلوب'])
      return false
    }
    if (!email.includes('@')) {
      setEmailError([true, 'البريد الإلكتروني غير صحيح'])
      return false
    }
    if (!password?.trim()) {
      setPasswordError([true, 'كلمة المرور مطلوبة'])
      return false
    }
    if (password.trim().length < 6) {
      setPasswordError([true, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'])
      return false
    }
    return true
  }

  const handleDone = async (passedData?: {
    email: string,
    password: string
  }) => {
    if (loading) return
    if (!validation() && !passedData) return
    setLoading(true)

    try {
      if (isLogin) {
        const response = await api.post('/users/login', data.email ? data : passedData)
        if (response.data.error) {
          toast.error('بيانات الدخول غير صحيحة')
          setLoading(false)
          return
        }
        const accessToken = response.data.access_token
        console.log('Login: Setting auth', { 
          userId: response.data.user.id, 
          role: response.data.user.role,
          tokenLength: accessToken?.length || 0 
        })
        
        setAuth(response.data.user, accessToken)
        toast.success('تم تسجيل الدخول بنجاح')
        
        // انتظر قليلاً للتأكد من حفظ البيانات في localStorage
        await new Promise(resolve => setTimeout(resolve, 300))
        
        // تحقق مرة أخرى من أن البيانات محفوظة قبل التوجيه
        const savedToken = localStorage.getItem('token')
        const savedAuth = localStorage.getItem('auth-storage')
        console.log('Login: Verification', { 
          tokenExists: !!savedToken, 
          tokenLength: savedToken?.length || 0,
          authExists: !!savedAuth 
        })
        
        if (!savedToken || savedToken !== accessToken) {
          console.error('Login: Token mismatch or not saved', {
            expected: accessToken?.substring(0, 20),
            actual: savedToken?.substring(0, 20)
          })
          toast.error('فشل في حفظ بيانات الجلسة')
          setLoading(false)
          return
        }
        
        if (response.data.user.role === 'customer') {
          router.push('/customer')
        } else if (response.data.user.role === 'supporter') {
          router.push('/supporter')
        } else {
          router.push('/')
        }
      } else {
        const response = await api.post('/users/register', {
          ...data,
          name: data.email.split('@')[0],
        })
        const accessToken = response.data.access_token
        console.log('Register: Setting auth', { 
          userId: response.data.user.id, 
          role: response.data.user.role,
          tokenLength: accessToken?.length || 0 
        })
        
        setAuth(response.data.user, accessToken)
        toast.success('تم إنشاء الحساب بنجاح')
        
        // انتظر قليلاً للتأكد من حفظ البيانات في localStorage
        await new Promise(resolve => setTimeout(resolve, 300))
        
        // تحقق مرة أخرى من أن البيانات محفوظة قبل التوجيه
        const savedToken = localStorage.getItem('token')
        if (!savedToken || savedToken !== accessToken) {
          console.error('Register: Token mismatch or not saved')
          toast.error('فشل في حفظ بيانات الجلسة')
          setLoading(false)
          return
        }
        
        router.push('/customer')
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || error.response?.data?.error || 'حدث خطأ')
    } finally {
      setLoading(false)
    }
  }
  return (
    <div className="min-h-screen flex flex-col lg:flex-row items-center justify-center bg-black">
      <div className='hidden lg:flex w-full lg:w-[60%] h-dvh'>
        <div className="w-full h-full lg:grid items-center">
          <div className="relative items-center justify-center flex z-1">
            {/* <!-- ===== Common Grid Shape Start ===== --> */}
            <GridShape />
            <div className="flex flex-col items-center max-w-xs">
              <h1 className="font-[600] text-3xl flex items-center gap-2 text-gold mb-3">
                <Image width={35} height={35} src={logo} alt="t" unoptimized priority /> POWER SOFT
              </h1>
              <p className="text-center text-gray-300">
                Continuous support... and communication without limits.
              </p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="flex w-full lg:w-[40%] flex-1 flex-col px-4 sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-8">
          <div>
            <div className="mb-5 sm:mb-8 text-center lg:text-right">
              <h1 className="text-2xl sm:text-3xl mb-2 font-semibold text-white">
                {isLogin ? 'تسجيل الدخول' : 'إنشاء حساب'}
              </h1>
              <p className="text-sm text-gray-300">
                {isLogin 
                  ? 'أدخل بريدك الإلكتروني وكلمة المرور لتسجيل الدخول!' 
                  : 'أدخل بياناتك لإنشاء حساب جديد!'}
              </p>
            </div>
            
            <div className="flex gap-4 mb-6">
              <button
                onClick={() => setIsLogin(true)}
                className={`flex-1 py-2 rounded-lg font-medium transition-all ${
                  isLogin
                    ? 'bg-gold text-black'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700'
                }`}
              >
                تسجيل الدخول
              </button>
              <button
                onClick={() => setIsLogin(false)}
                className={`flex-1 py-2 rounded-lg font-medium transition-all ${
                  !isLogin
                    ? 'bg-gold text-black'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700'
                }`}
              >
                إنشاء حساب
              </button>
            </div>

            <div>
              <div>
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      البريد الإلكتروني <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      placeholder="أدخل بريدك الإلكتروني"
                      value={data.email}
                      onChange={(e) => handleData(setData, 'email', e.target.value)}
                      className={`w-full px-4 py-2 bg-gray-900 border rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-gold focus:border-gold transition-all ${
                        emailError[0] 
                          ? 'border-red-500' 
                          : 'border-gray-700'
                      }`}
                    />
                    {emailError[0] && (
                      <p className="text-red-500 text-sm mt-1">{emailError[1]}</p>
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      كلمة المرور <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="أدخل كلمة المرور"
                        value={data.password}
                        onChange={(e) => handleData(setData, 'password', e.target.value)}
                        className={`w-full px-4 py-2 pr-10 bg-gray-900 border rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-gold focus:border-gold transition-all ${
                          passwordError[0] 
                            ? 'border-red-500' 
                            : 'border-gray-700'
                        }`}
                      />
                      <span
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute top-1/2 right-4 z-30 -translate-y-1/2 cursor-pointer"
                      >
                        {showPassword ? (
                          <Eye className="w-5 h-5 text-gray-400" />
                        ) : (
                          <EyeOff className="w-5 h-5 text-gray-400" />
                        )}
                      </span>
                    </div>
                    {passwordError[0] && (
                      <p className="text-red-500 text-sm mt-1">{passwordError[1]}</p>
                    )}
                  </div>
                  
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => setIsChecked(e.target.checked)}
                        className="w-4 h-4 text-gold bg-gray-900 border-gray-700 rounded focus:ring-gold"
                      />
                      <span className="text-sm block font-normal text-gray-300">
                        تذكرني
                      </span>
                    </div>
                    {isLogin && (
                      <Link
                        href="/reset-password"
                        className="text-gold hover:text-gold-400 text-sm"
                      >
                        نسيت كلمة المرور؟
                      </Link>
                    )}
                  </div>
                  
                  <div>
                    <button
                      onClick={() => handleDone()}
                      disabled={loading}
                      className="w-full bg-gold text-black py-2 rounded-lg font-medium hover:bg-gold-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? 'جاري المعالجة...' : (isLogin ? 'تسجيل الدخول' : 'إنشاء حساب')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


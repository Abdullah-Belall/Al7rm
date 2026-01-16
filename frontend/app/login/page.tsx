'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { useAuthStore } from '@/store/authStore'
import api from '@/lib/api'
import toast from 'react-hot-toast'

interface LoginForm {
  email: string
  password: string
}

export default function LoginPage() {
  const router = useRouter()
  const { setAuth } = useAuthStore()
  const [isLogin, setIsLogin] = useState(true)
  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>()

  const onSubmit = async (data: LoginForm) => {
    try {
      if (isLogin) {
        const response = await api.post('/users/login', data)
        if (response.data.error) {
          toast.error('بيانات الدخول غير صحيحة')
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
          return
        }
        
        router.push('/customer')
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || error.response?.data?.error || 'حدث خطأ')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100">
      <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md">
        <h1 className="text-3xl font-bold text-center mb-8 text-primary-700">
          نظام الدعم - المسجد الحرام
        </h1>
        
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setIsLogin(true)}
            className={`flex-1 py-2 rounded-lg font-medium ${
              isLogin
                ? 'bg-primary-600 text-white'
                : 'bg-gray-200 text-gray-700'
            }`}
          >
            تسجيل الدخول
          </button>
          <button
            onClick={() => setIsLogin(false)}
            className={`flex-1 py-2 rounded-lg font-medium ${
              !isLogin
                ? 'bg-primary-600 text-white'
                : 'bg-gray-200 text-gray-700'
            }`}
          >
            إنشاء حساب
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              البريد الإلكتروني
            </label>
            <input
              type="email"
              {...register('email', { required: 'البريد الإلكتروني مطلوب' })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            {errors.email && (
              <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              كلمة المرور
            </label>
            <input
              type="password"
              {...register('password', { 
                required: 'كلمة المرور مطلوبة',
                minLength: { value: 6, message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' }
              })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            {errors.password && (
              <p className="text-red-500 text-sm mt-1">{errors.password.message}</p>
            )}
          </div>

          <button
            type="submit"
            className="w-full bg-primary-600 text-white py-2 rounded-lg font-medium hover:bg-primary-700 transition-colors"
          >
            {isLogin ? 'تسجيل الدخول' : 'إنشاء حساب'}
          </button>
        </form>
      </div>
    </div>
  )
}


'use client'

import { useForm } from 'react-hook-form'
import api from '@/lib/api'
import toast from 'react-hot-toast'
import { Bot, X } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface CreateRequestForm {
  language: 'ar' | 'en' | 'fr' | 'fa' | 'hi'
}

interface Props {
  onClose: () => void
  onSuccess: () => void
}

export default function CreateRequestModal({ onClose, onSuccess }: Props) {
  const router = useRouter()
  // Get selected language from localStorage
  const selectedLanguage = typeof window !== 'undefined' 
    ? (localStorage.getItem('selectedLanguage') as 'ar' | 'en' | 'fr' | 'fa' | 'hi' | null) || 'ar'
    : 'ar'

  const { register, handleSubmit, formState: { errors } } = useForm<CreateRequestForm>({
    defaultValues: {
      language: selectedLanguage,
    },
  })

  const onSubmit = async () => {
    try {
      // Ensure language is included
      const requestData = {
        language: selectedLanguage,
      }
      await api.post('/support-requests', requestData)
      toast.success('تم إنشاء الطلب بنجاح')
      onSuccess()
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'فشل في إنشاء الطلب')
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gold/30 p-6 w-full h-dvh">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">طلب دعم جديد</h2>
          {/* <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={24} />
          </button> */}
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col items-center justify-center h-full">
          <div className="flex flex-col items-center gap-8">
            <div className="flex items-center justify-center">
              <Bot size={120} className="text-gold" />
            </div>
            
            <div className="flex gap-4 w-full max-w-md">
              <button
                type="button"
                onClick={() => {
                  localStorage.removeItem('selectedLanguage')
                  router.push('/customer/select-language')
                }}
                className="flex-1 bg-gray-800 text-gray-300 py-3 px-6 rounded-lg hover:bg-gray-700 border border-gray-700 transition-all font-medium"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="flex-1 text-nowrap bg-gold text-black py-3 px-6 rounded-lg hover:bg-gold-600 transition-all font-medium"
              >
                ابدأ المحادثة
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}


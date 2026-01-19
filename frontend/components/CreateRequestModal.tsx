'use client'

import { useForm } from 'react-hook-form'
import api from '@/lib/api'
import toast from 'react-hot-toast'
import { X } from 'lucide-react'

interface CreateRequestForm {
  description: string
  category: 'prayer' | 'guidance' | 'emergency' | 'information' | 'other'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  language: 'ar' | 'en' | 'fr' | 'fa' | 'hi'
}

interface Props {
  onClose: () => void
  onSuccess: () => void
}

export default function CreateRequestModal({ onClose, onSuccess }: Props) {
  // Get selected language from localStorage
  const selectedLanguage = typeof window !== 'undefined' 
    ? (localStorage.getItem('selectedLanguage') as 'ar' | 'en' | 'fr' | 'fa' | 'hi' | null) || 'ar'
    : 'ar'

  const { register, handleSubmit, formState: { errors } } = useForm<CreateRequestForm>({
    defaultValues: {
      category: 'other',
      priority: 'medium',
      language: selectedLanguage,
    },
  })

  const onSubmit = async (data: CreateRequestForm) => {
    try {
      // Ensure language is included
      const requestData = {
        ...data,
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
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gold/30 rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">طلب دعم جديد</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              الوصف
            </label>
            <textarea
              {...register('description')}
              rows={4}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-gold focus:border-gold transition-all"
              placeholder="أدخل وصف الطلب..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              الفئة
            </label>
            <select
              {...register('category', { required: true })}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-gold focus:border-gold transition-all"
            >
              <option value="prayer">صلاة</option>
              <option value="guidance">إرشاد</option>
              <option value="emergency">طوارئ</option>
              <option value="information">معلومات</option>
              <option value="other">أخرى</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              الأولوية
            </label>
            <select
              {...register('priority', { required: true })}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-gold focus:border-gold transition-all"
            >
              <option value="low">منخفضة</option>
              <option value="medium">متوسطة</option>
              <option value="high">عالية</option>
              <option value="urgent">عاجلة</option>
            </select>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-800 text-gray-300 py-2 rounded-lg hover:bg-gray-700 border border-gray-700 transition-all"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="flex-1 bg-gold text-black py-2 rounded-lg hover:bg-gold-600 transition-all"
            >
              إنشاء طلب
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}


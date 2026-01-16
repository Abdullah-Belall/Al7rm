'use client'

import { useForm } from 'react-hook-form'
import api from '@/lib/api'
import toast from 'react-hot-toast'
import { X } from 'lucide-react'

interface CreateRequestForm {
  description: string
  category: 'prayer' | 'guidance' | 'emergency' | 'information' | 'other'
  priority: 'low' | 'medium' | 'high' | 'urgent'
}

interface Props {
  onClose: () => void
  onSuccess: () => void
}

export default function CreateRequestModal({ onClose, onSuccess }: Props) {
  const { register, handleSubmit, formState: { errors } } = useForm<CreateRequestForm>({
    defaultValues: {
      category: 'other',
      priority: 'medium',
    },
  })

  const onSubmit = async (data: CreateRequestForm) => {
    try {
      await api.post('/support-requests', data)
      toast.success('تم إنشاء الطلب بنجاح')
      onSuccess()
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'فشل في إنشاء الطلب')
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">طلب دعم جديد</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              الوصف
            </label>
            <textarea
              {...register('description')}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              الفئة
            </label>
            <select
              {...register('category', { required: true })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="prayer">صلاة</option>
              <option value="guidance">إرشاد</option>
              <option value="emergency">طوارئ</option>
              <option value="information">معلومات</option>
              <option value="other">أخرى</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              الأولوية
            </label>
            <select
              {...register('priority', { required: true })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="low">منخفضة</option>
              <option value="medium">متوسطة</option>
              <option value="high">عالية</option>
              <option value="urgent">عاجلة</option>
            </select>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300 transition-colors"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="flex-1 bg-primary-600 text-white py-2 rounded-lg hover:bg-primary-700 transition-colors"
            >
              إنشاء طلب
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}


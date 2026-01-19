'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import api from '@/lib/api'
import toast from 'react-hot-toast'
import { X, Star } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface RatingForm {
  staffRating: number
  serviceRating: number
}

interface Props {
  requestId: string
  onClose: () => void
  onSuccess: () => void
}

export default function RatingModal({ requestId, onClose, onSuccess }: Props) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const { register, handleSubmit, formState: { errors }, watch, setValue } = useForm<RatingForm>({
    defaultValues: {
      staffRating: 0,
      serviceRating: 0,
    },
  })

  const staffRating = watch('staffRating')
  const serviceRating = watch('serviceRating')

  const onSubmit = async (data: RatingForm) => {
    if (data.staffRating === 0 || data.serviceRating === 0) {
      toast.error('الرجاء اختيار التقييمات')
      return
    }

    try {
      setSubmitting(true)
      await api.patch(`/support-requests/${requestId}/rate`, {
        staffRating: Number(data.staffRating),
        serviceRating: Number(data.serviceRating),
      })
      toast.success('تم إرسال التقييم بنجاح')
      onSuccess()
      onClose()
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'فشل في إرسال التقييم')
    } finally {
      setSubmitting(false)
    }
  }

  const renderStars = (rating: number, fieldName: 'staffRating' | 'serviceRating') => {
    return (
      <div className="flex gap-2 justify-center">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => setValue(fieldName, star)}
            className="focus:outline-none transition-transform hover:scale-110"
          >
            <Star
              size={32}
              className={
                star <= rating
                  ? 'fill-gold text-gold'
                  : 'fill-gray-700 text-gray-700'
              }
            />
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gold/30 rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white">تقييم الخدمة</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <input
            type="hidden"
            {...register('staffRating', {
              required: 'الرجاء تقييم الموظف',
              min: { value: 1, message: 'التقييم يجب أن يكون من 1 إلى 5' },
              max: { value: 5, message: 'التقييم يجب أن يكون من 1 إلى 5' },
            })}
          />
          <input
            type="hidden"
            {...register('serviceRating', {
              required: 'الرجاء تقييم الخدمة',
              min: { value: 1, message: 'التقييم يجب أن يكون من 1 إلى 5' },
              max: { value: 5, message: 'التقييم يجب أن يكون من 1 إلى 5' },
            })}
          />

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3 text-center">
              تقييم الموظف
            </label>
            {renderStars(staffRating, 'staffRating')}
            {errors.staffRating && (
              <p className="text-red-400 text-sm mt-2 text-center">
                {errors.staffRating.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3 text-center">
              تقييم الخدمة
            </label>
            {renderStars(serviceRating, 'serviceRating')}
            {errors.serviceRating && (
              <p className="text-red-400 text-sm mt-2 text-center">
                {errors.serviceRating.message}
              </p>
            )}
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
              disabled={submitting || staffRating === 0 || serviceRating === 0}
              className="flex-1 bg-gold text-black py-2 rounded-lg hover:bg-gold-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'جاري الإرسال...' : 'إرسال'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}


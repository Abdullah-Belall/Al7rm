'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'
import { Languages } from 'lucide-react'

const LANGUAGES = [
  { code: 'ar', name: 'العربية', nativeName: 'العربية' },
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'fr', name: 'Français', nativeName: 'Français' },
  { code: 'fa', name: 'Persian', nativeName: 'فارسی' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
]

export default function SelectLanguagePage() {
  const router = useRouter()
  const { user, isAuthenticated } = useAuthStore()
  const [selectedLanguage, setSelectedLanguage] = useState<string>('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'customer') {
      router.push('/login')
      return
    }

    // Check if language is already selected
    const savedLanguage = localStorage.getItem('selectedLanguage')
    if (savedLanguage) {
      router.push('/customer')
      return
    }
  }, [isAuthenticated, user, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedLanguage) {
      return
    }

    setLoading(true)
    try {
      // Save language to localStorage
      localStorage.setItem('selectedLanguage', selectedLanguage)
      
      // Redirect to customer page
      router.push('/customer')
    } catch (error) {
      console.error('Error saving language:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!isAuthenticated || user?.role !== 'customer') {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 rounded-full mb-4">
            <Languages className="w-8 h-8 text-primary-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            اختر اللغة
          </h1>
          <p className="text-gray-600">
            يرجى اختيار اللغة التي تفضل التواصل بها
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3">
            {LANGUAGES.map((lang) => (
              <label
                key={lang.code}
                className={`flex items-center p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  selectedLanguage === lang.code
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-200 hover:border-primary-300 hover:bg-gray-50'
                }`}
              >
                <input
                  type="radio"
                  name="language"
                  value={lang.code}
                  checked={selectedLanguage === lang.code}
                  onChange={(e) => setSelectedLanguage(e.target.value)}
                  className="w-5 h-5 text-primary-600 focus:ring-primary-500 focus:ring-2"
                />
                <div className="ml-3 flex-1">
                  <div className="text-lg font-semibold text-gray-900">
                    {lang.nativeName}
                  </div>
                  <div className="text-sm text-gray-500">{lang.name}</div>
                </div>
              </label>
            ))}
          </div>

          <button
            type="submit"
            disabled={!selectedLanguage || loading}
            className="w-full bg-primary-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-primary-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {loading ? 'جاري التوجيه...' : 'متابعة'}
          </button>
        </form>
      </div>
    </div>
  )
}


'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'
import { Languages } from 'lucide-react'
import Image from 'next/image'
import kaaba from '@/public/kaaba.jpg'
import arFlag from '@/public/images/flags/ar.jpeg'
import enFlag from '@/public/images/flags/en.jpeg'
import frFlag from '@/public/images/flags/fr.jpeg'
import deFlag from '@/public/images/flags/de.jpeg'
import ruFlag from '@/public/images/flags/ru.jpeg'
import zhFlag from '@/public/images/flags/zh.jpeg'
import urFlag from '@/public/images/flags/ur.jpeg'

const LANGUAGES = [
  { code: 'ar', name: 'العربية', nativeName: 'العربية', flag: arFlag },
  { code: 'en', name: 'English', nativeName: 'English', flag: enFlag },
  { code: 'fr', name: 'Français', nativeName: 'Français', flag: frFlag },
  { code: 'de', name: 'Deutsch', nativeName: 'Deutsch', flag: deFlag },
  { code: 'ru', name: 'Русский', nativeName: 'Русский', flag: ruFlag },
  { code: 'zh', name: '中国人' , nativeName: '中国人', flag: zhFlag },
  { code: 'ur', name: 'اردو' , nativeName: 'اردو', flag: urFlag },
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
    <div className="relative min-h-screen bg-black flex items-center justify-center p-4">
      <div className='fixed left-0 top-0 w-full h-dvh opacity-30'>
        <Image 
          src={kaaba}
          alt="help" 
          fill
          className="object-cover"
          priority
          unoptimized
        />
      </div>
      <div className="z-[20] bg-gray-900/95 backdrop-blur-sm border border-gold/30 rounded-2xl p-4 w-full max-w-md">
        <div className="text-center mb-6 sm:mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gold/20 rounded-full mb-4 border border-gold/30">
            <Languages className="w-8 h-8 text-gold" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white mb-2">
            اختر اللغة
          </h1>
          <p className="text-sm sm:text-base text-gray-300">
            يرجى اختيار اللغة التي تفضل التواصل بها
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3 max-h-[calc(100dvh-320px)] overflow-y-scroll pr-2 custom-scrollbar">
            {LANGUAGES.map((lang) => (
              <label
                key={lang.code}
                className={`flex items-center gap-4 p-3 sm:p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  selectedLanguage === lang.code
                    ? 'border-gold bg-gold/20'
                    : 'border-gray-700 hover:border-gold/50 hover:bg-gray-800/50'
                }`}
              >
                <input
                  type="radio"
                  name="language"
                  value={lang.code}
                  checked={selectedLanguage === lang.code}
                  onChange={(e) => setSelectedLanguage(e.target.value)}
                  className="w-5 h-5 text-gold bg-gray-800 border-gray-700 focus:ring-gold focus:ring-2"
                />
                <div className="ml-3 flex-1">
                  <div className="text-base sm:text-lg font-semibold text-white">
                    {lang.nativeName}
                  </div>
                  <div className="text-xs sm:text-sm text-gray-400">{lang.name}</div>
                </div>
                <div className='mr-auto'>
                  <Image width={50} height={20} src={lang.flag} alt={lang.code} />
                </div>
              </label>
            ))}
          </div>

          <button
            type="submit"
            disabled={!selectedLanguage || loading}
            className="w-full bg-gold text-black py-3 px-4 rounded-lg font-semibold hover:bg-gold-600 transition-all disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed"
          >
            {loading ? 'جاري التوجيه...' : 'متابعة'}
          </button>
        </form>
      </div>
    </div>
  )
}


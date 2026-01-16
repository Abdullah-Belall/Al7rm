import type { Metadata } from 'next'
import './globals.css'
import { Toaster } from 'react-hot-toast'

export const metadata: Metadata = {
  title: 'نظام الدعم - المسجد الحرام',
  description: 'نظام طلبات الدعم للمسجد الحرام',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        {children}
        <Toaster position="top-center" />
      </body>
    </html>
  )
}


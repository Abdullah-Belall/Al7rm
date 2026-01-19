import type { Metadata } from 'next'
import './globals.css'
import { Toaster } from 'react-hot-toast'
import { Amiri } from "next/font/google";

export const metadata: Metadata = {
  title: 'نظام الدعم - المسجد الحرام',
  description: 'نظام طلبات الدعم للمسجد الحرام',
}

const amiri = Amiri({ subsets: ["latin"], weight: "400" });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ar" dir="rtl">
      <body className={`${amiri.className}`}>
        {children}
        <Toaster 
          position="top-center"
          toastOptions={{
            style: {
              background: '#1f2937',
              color: '#fff',
              border: '1px solid #F5BD02',
            },
            success: {
              iconTheme: {
                primary: '#F5BD02',
                secondary: '#000',
              },
            },
            error: {
              iconTheme: {
                primary: '#ef4444',
                secondary: '#fff',
              },
            },
          }}
        />
      </body>
    </html>
  )
}


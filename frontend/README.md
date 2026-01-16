# Frontend - نظام الدعم

## البنية

```
app/
├── page.tsx           # الصفحة الرئيسية (إعادة توجيه)
├── login/             # صفحة تسجيل الدخول
├── customer/          # لوحة العميل
└── supporter/         # لوحة الداعم

components/
├── CreateRequestModal.tsx  # نافذة إنشاء طلب
└── VideoCallModal.tsx      # نافذة المكالمة الفيديوية

lib/
└── api.ts            # إعدادات Axios

store/
└── authStore.ts      # إدارة حالة المصادقة
```

## المميزات

- ✅ واجهة عربية كاملة
- ✅ تصميم متجاوب (Responsive)
- ✅ إدارة حالة مع Zustand
- ✅ مكالمات فيديو مباشرة مع WebRTC
- ✅ إشعارات مع react-hot-toast

## تشغيل المشروع

```bash
npm install
npm run dev
```

التطبيق سيعمل على `http://localhost:3000`

## المتغيرات البيئية

يمكنك إنشاء ملف `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=http://localhost:3001
```


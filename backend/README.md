# Backend API - نظام الدعم

## البنية

```
src/
├── users/              # إدارة المستخدمين والمصادقة
│   ├── entities/       # User entity
│   ├── dto/           # Data Transfer Objects
│   ├── guards/        # JWT Guards
│   └── strategies/    # JWT Strategy
├── support-requests/  # إدارة طلبات الدعم
│   ├── entities/      # SupportRequest entity
│   └── dto/           # DTOs
├── video-calls/       # إدارة المكالمات الفيديوية
│   ├── entities/      # VideoCall entity
│   └── gateway.ts     # WebSocket Gateway
└── config/            # إعدادات قاعدة البيانات
```

## API Endpoints

### Authentication
- `POST /users/register` - إنشاء حساب عميل
- `POST /users/register-supporter` - إنشاء حساب داعم
- `POST /users/login` - تسجيل الدخول
- `GET /users/profile` - بيانات المستخدم (محمي)
- `PATCH /users/profile` - تحديث الملف الشخصي
- `PATCH /users/availability` - تحديث حالة التوفر (للداعمين)

### Support Requests
- `POST /support-requests` - إنشاء طلب جديد
- `GET /support-requests` - قائمة الطلبات (مفلترة حسب الدور)
- `GET /support-requests/:id` - تفاصيل طلب
- `PATCH /support-requests/:id/accept` - قبول الطلب
- `PATCH /support-requests/:id/reject` - رفض الطلب
- `PATCH /support-requests/:id/complete` - إكمال الطلب
- `PATCH /support-requests/:id/cancel` - إلغاء الطلب

### Video Calls
- `GET /video-calls/:id` - بيانات المكالمة
- `GET /video-calls/room/:roomId` - بيانات المكالمة عبر Room ID
- `PATCH /video-calls/:id/start` - بدء المكالمة
- `PATCH /video-calls/:id/end` - إنهاء المكالمة

## WebSocket Events

### Client → Server
- `join-room` - الانضمام لغرفة المكالمة
- `leave-room` - مغادرة الغرفة
- `offer` - إرسال WebRTC offer
- `answer` - إرسال WebRTC answer
- `ice-candidate` - إرسال ICE candidate

### Server → Client
- `user-joined` - انضمام مستخدم للغرفة
- `user-left` - مغادرة مستخدم للغرفة
- `call-started` - بدء المكالمة
- `call-ended` - انتهاء المكالمة
- `offer` - استقبال offer
- `answer` - استقبال answer
- `ice-candidate` - استقبال ICE candidate

## تشغيل المشروع

```bash
npm install
npm run start:dev
```

الخادم سيعمل على `http://localhost:3001`


# نظام الدعم - المسجد الحرام

نظام طلبات الدعم مع مكالمات فيديو للمسجد الحرام. يسمح للعملاء بإنشاء طلبات دعم يتم توجيهها تلقائياً للداعمين المتاحين، وإذا رفض الداعم الطلب يتم توجيهه لداعم آخر. عند قبول الطلب، يتم إنشاء مكالمة فيديو بين العميل والداعم.

## المميزات

- ✅ نظام تسجيل دخول وإنشاء حسابات
- ✅ إنشاء طلبات دعم مع فئات وأولويات
- ✅ توجيه تلقائي للطلبات للداعمين المتاحين
- ✅ نظام رفض وقبول الطلبات
- ✅ إعادة توجيه الطلبات المرفوضة لداعمين آخرين
- ✅ مكالمات فيديو مباشرة باستخدام WebRTC
- ✅ واجهة مستخدم عربية حديثة

## التقنيات المستخدمة

### Backend
- **NestJS** - إطار عمل Node.js
- **TypeORM** - ORM لقاعدة البيانات
- **PostgreSQL** - قاعدة البيانات
- **Socket.IO** - للاتصال المباشر
- **JWT** - للمصادقة

### Frontend
- **Next.js 14** - إطار عمل React
- **TypeScript** - للبرمجة الآمنة
- **Tailwind CSS** - للتصميم
- **Zustand** - لإدارة الحالة
- **Socket.IO Client** - للاتصال المباشر
- **WebRTC** - للمكالمات الفيديوية

## متطلبات التشغيل

- Node.js 18+ 
- PostgreSQL 12+
- npm أو yarn

## التثبيت

1. استنساخ المشروع:
```bash
git clone <repository-url>
cd Al7ram-2
```

2. تثبيت الاعتماديات:
```bash
npm run install:all
```

3. إعداد قاعدة البيانات:
   - إنشاء قاعدة بيانات PostgreSQL باسم `al7ram_support`
   - نسخ ملف `.env.example` في مجلد `backend` إلى `.env`
   - تحديث بيانات الاتصال بقاعدة البيانات في ملف `.env`

4. تشغيل المشروع:
```bash
# تشغيل Backend و Frontend معاً
npm run dev

# أو تشغيل كل واحد على حدة:
npm run dev:backend  # Backend على http://localhost:3001
npm run dev:frontend # Frontend على http://localhost:3000
```

## هيكل المشروع

```
.
├── backend/              # NestJS Backend
│   ├── src/
│   │   ├── users/       # إدارة المستخدمين
│   │   ├── support-requests/  # إدارة طلبات الدعم
│   │   ├── video-calls/ # إدارة المكالمات
│   │   └── config/      # إعدادات قاعدة البيانات
│   └── package.json
├── frontend/             # Next.js Frontend
│   ├── app/             # صفحات التطبيق
│   ├── components/      # المكونات
│   ├── lib/             # المكتبات المساعدة
│   └── store/           # إدارة الحالة
└── package.json
```

## API Endpoints

### Authentication
- `POST /users/register` - إنشاء حساب جديد
- `POST /users/login` - تسجيل الدخول
- `GET /users/profile` - الحصول على بيانات المستخدم

### Support Requests
- `POST /support-requests` - إنشاء طلب دعم جديد
- `GET /support-requests` - الحصول على قائمة الطلبات
- `GET /support-requests/:id` - الحصول على طلب محدد
- `PATCH /support-requests/:id/accept` - قبول الطلب
- `PATCH /support-requests/:id/reject` - رفض الطلب
- `PATCH /support-requests/:id/complete` - إكمال الطلب

### Video Calls
- `GET /video-calls/:id` - الحصول على بيانات المكالمة
- `GET /video-calls/room/:roomId` - الحصول على المكالمة عبر Room ID
- `PATCH /video-calls/:id/start` - بدء المكالمة
- `PATCH /video-calls/:id/end` - إنهاء المكالمة

## استخدام النظام

### للعملاء (Customers)
1. إنشاء حساب أو تسجيل الدخول
2. إنشاء طلب دعم جديد
3. انتظار تخصيص الطلب لداعم
4. عند قبول الداعم، يتم إنشاء مكالمة فيديو تلقائياً
5. الانضمام للمكالمة عند ظهورها

### للداعمين (Supporters)
1. تسجيل الدخول بحساب داعم
2. تفعيل حالة "متاح" لتلقي الطلبات
3. مراجعة الطلبات المخصصة
4. قبول أو رفض الطلبات
5. عند القبول، يتم إنشاء مكالمة فيديو
6. الانضمام للمكالمة والتواصل مع العميل
7. إكمال الطلب بعد انتهاء المكالمة

## ملاحظات مهمة

- تأكد من تشغيل PostgreSQL قبل تشغيل Backend
- في بيئة الإنتاج، قم بتغيير `JWT_SECRET` في ملف `.env`
- قم بتعطيل `synchronize: true` في TypeORM في الإنتاج واستخدم Migrations
- للمكالمات الفيديوية، قد تحتاج لإعداد STUN/TURN servers في الإنتاج

## الترخيص

هذا المشروع مخصص للاستخدام في المسجد الحرام.


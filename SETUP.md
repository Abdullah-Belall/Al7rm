# دليل الإعداد السريع

## الخطوات الأساسية

### 1. إعداد قاعدة البيانات

```sql
-- قم بتشغيل هذا الأمر في PostgreSQL
CREATE DATABASE al7ram_support;
```

### 2. إعداد Backend

```bash
cd backend
npm install
```

قم بإنشاء ملف `.env` في مجلد `backend`:

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=al7ram_support

# JWT
JWT_SECRET=your-secret-key-change-in-production-12345
JWT_EXPIRES_IN=24h

# Server
PORT=3001
NODE_ENV=development

# CORS
FRONTEND_URL=http://localhost:3000
```

### 3. إعداد Frontend

```bash
cd frontend
npm install
```

### 4. تشغيل المشروع

من المجلد الرئيسي:

```bash
# تثبيت جميع الاعتماديات
npm install

# تشغيل Backend و Frontend معاً
npm run dev
```

أو بشكل منفصل:

```bash
# Terminal 1 - Backend
cd backend
npm run start:dev

# Terminal 2 - Frontend  
cd frontend
npm run dev
```

### 5. إنشاء حسابات تجريبية

#### إنشاء حساب عميل:
- افتح `http://localhost:3000/login`
- اضغط على "إنشاء حساب"
- أدخل بياناتك (سيتم إنشاء حساب عميل تلقائياً)

#### إنشاء حساب داعم:
يمكنك استخدام API مباشرة:

```bash
curl -X POST http://localhost:3001/users/register-supporter \
  -H "Content-Type: application/json" \
  -d '{
    "email": "supporter@example.com",
    "password": "password123",
    "name": "داعم تجريبي",
    "specialties": ["prayer", "guidance"],
    "maxConcurrentRequests": 5
  }'
```

أو أضف endpoint في الواجهة لإنشاء داعم.

## اختبار النظام

1. سجل دخول كعميل
2. أنشئ طلب دعم جديد
3. سجل دخول كداعم في نافذة أخرى
4. فعّل حالة "متاح"
5. ستظهر لك الطلبات المخصصة
6. اضغط "قبول" على الطلب
7. سيتم إنشاء مكالمة فيديو تلقائياً
8. انضم للمكالمة من كلا الحسابين

## ملاحظات

- تأكد من تشغيل PostgreSQL قبل البدء
- في الإنتاج، قم بتغيير `JWT_SECRET` إلى قيمة آمنة
- قم بتعطيل `synchronize: true` في TypeORM في الإنتاج
- للمكالمات الفيديوية في الإنتاج، قد تحتاج لإعداد STUN/TURN servers


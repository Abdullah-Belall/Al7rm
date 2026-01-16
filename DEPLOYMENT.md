# دليل النشر على السيرفر (Deployment Guide)

## متطلبات النشر

### 1. السيرفر
- Node.js 18+ 
- PostgreSQL 12+
- Nginx (اختياري - لـ reverse proxy)

### 2. متغيرات البيئة (Environment Variables)

#### Backend (.env)

أنشئ ملف `.env` في مجلد `backend/`:

```env
# Database Configuration
DB_HOST=your-database-host
DB_PORT=5432
DB_USERNAME=your-db-username
DB_PASSWORD=your-db-password
DB_DATABASE=al7ram_support

# Server Configuration
PORT=3001
NODE_ENV=production

# Frontend URL (URL الخاص بالموقع بعد النشر)
FRONTEND_URL=https://yourdomain.com

# JWT Secret (IMPORTANT: استخدم string عشوائي قوي)
JWT_SECRET=generate-a-random-secure-string-here-min-32-chars
```

#### Frontend (.env.local أو .env.production)

أنشئ ملف `.env.local` أو `.env.production` في مجلد `frontend/`:

```env
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_WS_URL=https://api.yourdomain.com
```

**ملاحظة مهمة:** 
- `NEXT_PUBLIC_API_URL` يجب أن يكون HTTPS في production
- `NEXT_PUBLIC_WS_URL` يجب أن يكون HTTPS (WebSocket يعمل على نفس URL)

---

## خطوات النشر

### 1. إعداد قاعدة البيانات

```bash
# على السيرفر، أنشئ قاعدة بيانات PostgreSQL
sudo -u postgres psql
CREATE DATABASE al7ram_support;
CREATE USER your_username WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE al7ram_support TO your_username;
\q
```

### 2. بناء Backend

```bash
cd backend
npm install
npm run build
```

### 3. بناء Frontend

```bash
cd frontend
npm install
npm run build
```

### 4. تشغيل Backend

#### باستخدام PM2 (موصى به):

```bash
# تثبيت PM2
npm install -g pm2

# تشغيل Backend
cd backend
pm2 start dist/main.js --name al7ram-backend

# حفظ إعدادات PM2
pm2 save
pm2 startup
```

#### أو باستخدام systemd:

أنشئ ملف `/etc/systemd/system/al7ram-backend.service`:

```ini
[Unit]
Description=Al7ram Backend API
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/project/backend
ExecStart=/usr/bin/node dist/main.js
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable al7ram-backend
sudo systemctl start al7ram-backend
```

### 5. تشغيل Frontend (Next.js)

```bash
cd frontend
npm install
npm run build
pm2 start npm --name al7ram-frontend -- start
```

---

## إعداد Nginx (اختياري ولكن موصى به)

### Nginx Configuration للـ Backend API:

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Nginx Configuration للـ Frontend:

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### تفعيل HTTPS باستخدام Let's Encrypt:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d api.yourdomain.com
```

---

## إعدادات أمان إضافية

### 1. Firewall

```bash
# فتح المنافذ المطلوبة
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### 2. تحديث JWT_SECRET

**مهم جداً:** استخدم JWT Secret قوي:

```bash
# توليد secret عشوائي
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

ضع النتيجة في `JWT_SECRET` في ملف `.env`

### 3. قاعدة البيانات

- **لا تستخدم `synchronize: true` في production** ✅ (موجود في الكود)
- أنشئ migrations إذا لزم الأمر

---

## التحقق من النشر

### 1. التحقق من Backend:

```bash
curl http://localhost:3001
# أو
curl https://api.yourdomain.com
```

يجب أن ترى:
```json
{"status":"ok","message":"Al7ram Support System API"}
```

### 2. التحقق من Frontend:

افتح المتصفح على: `https://yourdomain.com`

### 3. التحقق من WebSocket:

افتح Console في المتصفح وتأكد من:
- `Connected to support-requests WebSocket`
- `VideoCall WebSocket connected`

---

## استكشاف الأخطاء

### المشكلة: Backend لا يعمل
```bash
# تحقق من الـ logs
pm2 logs al7ram-backend
# أو
sudo journalctl -u al7ram-backend -f
```

### المشكلة: Frontend لا يتصل بـ Backend
- تحقق من `NEXT_PUBLIC_API_URL` في `.env.local`
- تأكد من أن CORS في Backend يسمح بـ FRONTEND_URL الصحيح

### المشكلة: WebSocket لا يعمل
- تأكد من أن `NEXT_PUBLIC_WS_URL` يستخدم نفس URL الخاص بـ API
- في Nginx، تأكد من `proxy_set_header Upgrade` و `Connection 'upgrade'`

### المشكلة: قاعدة البيانات لا تتصل
- تحقق من بيانات الاتصال في `.env`
- تأكد من أن PostgreSQL يعمل: `sudo systemctl status postgresql`

---

## نصائح إضافية

1. **استخدم PM2** لإدارة العمليات (restart تلقائي عند التوقف)
2. **استخدم Nginx** كـ reverse proxy (أداء أفضل + HTTPS)
3. **فعّل HTTPS** (مطلوب للمكالمات الفيديوية في معظم المتصفحات)
4. **راقب الـ logs** بانتظام
5. **احفظ نسخة احتياطية** من قاعدة البيانات بانتظام

---

## أوامر مفيدة

```bash
# إعادة تشغيل Backend
pm2 restart al7ram-backend

# إعادة تشغيل Frontend
pm2 restart al7ram-frontend

# عرض الـ logs
pm2 logs

# عرض حالة العمليات
pm2 status

# إيقاف التطبيق
pm2 stop al7ram-backend
```

---

## ملاحظات مهمة

⚠️ **في Production:**
- لا تترك `synchronize: true` (موجود في الكود ✅)
- استخدم JWT_SECRET قوي
- فعّل HTTPS (مطلوب للكاميرا/الميكروفون)
- استخدم قاعدة بيانات منفصلة (ليس localhost)
- راقب الـ logs بانتظام


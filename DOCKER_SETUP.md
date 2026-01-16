# دليل إعداد Docker

## الملفات المطلوبة

✅ تم إنشاء الملفات التالية:
- `backend/Dockerfile`
- `frontend/Dockerfile`
- `docker-compose.yml` (في المجلد الرئيسي)
- `.dockerignore`
- `backend/.dockerignore`
- `frontend/.dockerignore`

## الخطوات

### 1. تحديث docker-compose.yml

قبل التشغيل، حدّث القيم التالية في `docker-compose.yml`:

```yaml
# في al7ram-backend:
FRONTEND_URL: https://al7ram.nabdtech.store  # URL الخاص بالـ Frontend
JWT_SECRET: your-secure-random-string-here    # استخدم string قوي

# في al7ram-frontend:
NEXT_PUBLIC_API_URL: https://al7ram-api.nabdtech.store  # URL الخاص بالـ Backend API
NEXT_PUBLIC_WS_URL: https://al7ram-api.nabdtech.store   # نفس URL للـ WebSocket
```

### 2. بناء وتشغيل الـ Containers

```bash
# بناء وتشغيل جميع الـ services
docker-compose up -d --build

# عرض الـ logs
docker-compose logs -f

# إيقاف الـ containers
docker-compose down

# إيقاف وحذف الـ volumes (يحذف قاعدة البيانات)
docker-compose down -v
```

### 3. إعداد Nginx (في reverse-proxy)

أضف الـ server blocks التالية في `nginx.conf`:

```nginx
# Frontend - al7ram.nabdtech.store
server {
  listen 443 ssl http2;
  server_name al7ram.nabdtech.store www.al7ram.nabdtech.store;

  ssl_certificate /etc/letsencrypt/live/al7ram.nabdtech.store/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/al7ram.nabdtech.store/privkey.pem;

  location / {
    proxy_pass http://al7ram-frontend-server:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}

# Backend API - al7ram-api.nabdtech.store
server {
  listen 443 ssl http2;
  server_name al7ram-api.nabdtech.store www.al7ram-api.nabdtech.store;

  ssl_certificate /etc/letsencrypt/live/al7ram-api.nabdtech.store/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/al7ram-api.nabdtech.store/privkey.pem;

  location / {
    proxy_pass http://al7ram-backend-server:3001;
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

# Redirect HTTP to HTTPS
server {
  listen 80;
  server_name al7ram.nabdtech.store www.al7ram.nabdtech.store al7ram-api.nabdtech.store www.al7ram-api.nabdtech.store;
  return 301 https://$host$request_uri;
}
```

### 4. إنشاء SSL Certificates

```bash
# للـ Frontend
sudo certbot certonly --nginx -d al7ram.nabdtech.store -d www.al7ram.nabdtech.store

# للـ Backend API
sudo certbot certonly --nginx -d al7ram-api.nabdtech.store -d www.al7ram-api.nabdtech.store
```

### 5. إعادة تحميل Nginx

```bash
cd reverse-proxy
docker-compose exec nginx nginx -t  # اختبار الإعدادات
docker-compose exec nginx nginx -s reload  # إعادة التحميل
```

## معلومات الـ Containers

### Container Names:
- `al7ram-backend-server` - Backend API
- `al7ram-frontend-server` - Frontend (Next.js)
- `al7ram-db` - PostgreSQL Database

### Ports (Internal to Network):
- Backend: `3001` → Exposed as `3002` on host
- Frontend: `3000` → Exposed as `3003` on host
- Database: `5432` (Internal only)

### Network:
- `central-net` (external network)

## الأوامر المفيدة

```bash
# عرض حالة الـ containers
docker-compose ps

# عرض الـ logs
docker-compose logs -f al7ram-backend
docker-compose logs -f al7ram-frontend

# إعادة بناء service معين
docker-compose up -d --build al7ram-backend

# الدخول إلى container
docker exec -it al7ram-backend-server sh
docker exec -it al7ram-db psql -U postgres -d al7ram_support

# عرض حجم الـ images
docker images | grep al7ram

# تنظيف الـ images غير المستخدمة
docker system prune -a
```

## ملاحظات مهمة

1. **JWT_SECRET**: يجب تغييره إلى string عشوائي قوي (32+ حرف)
   ```bash
   # توليد secret
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. **قاعدة البيانات**: البيانات محفوظة في volume `al7ram_db_data`
   - لحذف قاعدة البيانات: `docker-compose down -v`
   - لنسخ احتياطي: `docker exec al7ram-db pg_dump -U postgres al7ram_support > backup.sql`

3. **Environment Variables**: يمكنك نقلها إلى ملف `.env` واستخدام `env_file` في docker-compose

4. **HTTPS ضروري**: للمكالمات الفيديوية، HTTPS مطلوب (الكاميرا/الميكروفون لا تعمل على HTTP)

## استكشاف الأخطاء

### المشكلة: Container لا يبدأ
```bash
docker-compose logs al7ram-backend
docker-compose logs al7ram-frontend
```

### المشكلة: Backend لا يتصل بقاعدة البيانات
```bash
# تحقق من أن al7ram-db يعمل
docker-compose ps

# تحقق من الاتصال
docker exec -it al7ram-backend-server ping al7ram-db
```

### المشكلة: Frontend لا يتصل بـ Backend
- تحقق من `NEXT_PUBLIC_API_URL` في docker-compose.yml
- تأكد من أن Nginx يوجه بشكل صحيح

### المشكلة: WebSocket لا يعمل
- تأكد من إضافة `proxy_set_header Upgrade` و `Connection 'upgrade'` في Nginx
- تحقق من أن `NEXT_PUBLIC_WS_URL` يستخدم HTTPS


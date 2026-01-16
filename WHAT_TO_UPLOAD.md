# ما يجب رفعه على VPS

## ✅ الملفات والمجلدات المطلوبة:

```
Al7ram_2/
├── backend/                    ✅ كامل (بدون node_modules)
│   ├── src/                    ✅
│   ├── package.json            ✅
│   ├── tsconfig.json           ✅
│   ├── nest-cli.json           ✅
│   └── Dockerfile              ✅
│
├── frontend/                   ✅ كامل (بدون node_modules)
│   ├── app/                    ✅
│   ├── components/             ✅
│   ├── lib/                    ✅
│   ├── store/                  ✅
│   ├── package.json            ✅
│   ├── tsconfig.json           ✅
│   ├── next.config.js          ✅
│   ├── tailwind.config.js      ✅
│   ├── postcss.config.js       ✅
│   └── Dockerfile              ✅
│
├── docker-compose.yml          ✅
├── .dockerignore              ✅ (اختياري)
└── scripts/                    ✅ (إذا استخدمتها)
```

## ❌ **لا ترفع** هذه الملفات/المجلدات:

```
❌ node_modules/          (سيتم تثبيتها في الـ container)
❌ dist/                  (سيتم بناؤها في الـ container)
❌ .next/                 (سيتم بناؤها في الـ container)
❌ .env                   (أنشئها على VPS)
❌ .env.local             (أنشئها على VPS)
❌ .git/                  (اختياري - لا حاجة له)
❌ *.log                  (ملفات الـ logs)
❌ coverage/              (تقارير الـ tests)
❌ .vscode/               (إعدادات VS Code)
❌ .idea/                 (إعدادات IntelliJ)
```

## 📋 خطوات الرفع:

### الطريقة 1: استخدام Git (موصى به)

```bash
# على الـ VPS
cd ~
git clone https://your-repo-url.git al7ram-2
cd al7ram-2
```

### الطريقة 2: استخدام SCP/SFTP

```bash
# من جهازك المحلي
scp -r backend frontend docker-compose.yml .dockerignore user@your-vps-ip:~/al7ram-2/
```

### الطريقة 3: استخدام rsync (الأفضل للمشاريع الكبيرة)

```bash
# من جهازك المحلي
rsync -avz --exclude 'node_modules' --exclude 'dist' --exclude '.next' \
  --exclude '.env' --exclude '.git' \
  ./ user@your-vps-ip:~/al7ram-2/
```

## ⚙️ بعد الرفع على VPS:

### 1. تحديث docker-compose.yml

```bash
cd ~/al7ram-2
nano docker-compose.yml
```

عدّل:
- `JWT_SECRET` → استخدم string قوي
- `FRONTEND_URL` → URL الخاص بك
- `NEXT_PUBLIC_API_URL` → URL الـ Backend

### 2. إنشاء الـ network (إذا لم تكن موجودة)

```bash
docker network create central-net
```

### 3. بناء وتشغيل

```bash
cd ~/al7ram-2
docker-compose up -d --build
```

## 📝 ملاحظات:

1. **لا حاجة لـ `node_modules`**: سيتم تثبيتها داخل الـ containers
2. **لا حاجة لـ `.env`**: استخدم environment variables في `docker-compose.yml`
3. **الـ build يحدث في الـ container**: لا حاجة لرفع `dist/` أو `.next/`
4. **استخدم `.gitignore`**: لتجنب رفع الملفات غير الضرورية

## 🔒 ملفات الحساسية:

⚠️ **لا ترفع أبداً:**
- `.env` و `.env.local`
- `JWT_SECRET`
- كلمات مرور قاعدة البيانات
- SSH keys

استخدم environment variables في `docker-compose.yml` أو أنشئ `.env` على VPS مباشرة.


# حل مشكلة الاتصال بين شبكات مختلفة (TURN Server)

## المشكلة
عندما يكون الداعم والمعتمر على شبكات مختلفة، لا يتم الاتصال بينهم.

## السبب
المشكلة في إعدادات TURN Server على VPS. TURN Server ضروري للاتصال عندما يكون الطرفان على شبكات مختلفة.

## الحل

### 1. تعديل ملف إعدادات TURN Server

افتح الملف على VPS:
```bash
sudo nano /etc/turnserver.conf
```

استبدل المحتوى بالكامل بما يلي:

```conf
listening-port=3478
listening-ip=0.0.0.0
tls-listening-port=5349
cert=/etc/letsencrypt/live/al7ram.nabdtech.store/fullchain.pem
pkey=/etc/letsencrypt/live/al7ram.nabdtech.store/privkey.pem

# Authentication - مهم جداً
lt-cred-mech
realm=al7ram.nabdtech.store
server-name=al7ram.nabdtech.store
user=turnuser:turnpassword

# Network settings - مهم جداً للاتصال بين شبكات مختلفة
external-ip=91.99.83.210
relay-ip=91.99.83.210

# Port range for media relay - مهم جداً
min-port=49152
max-port=65535

# Security settings
no-loopback-peers
no-multicast-peers
no-cli

# Logging
log-file=/var/log/turn.log
simple-log
verbose
```

**ملاحظات مهمة:**
- احذف السطر `fingerprint` إذا كان موجوداً بدون قيمة
- تأكد من أن `external-ip` و `relay-ip` يحتويان على IP الصحيح لـ VPS
- تأكد من أن `realm` و `server-name` متطابقان

### 2. فتح المنافذ في Firewall

هذا **مهم جداً**! يجب فتح المنافذ التالية:

```bash
# منفذ TURN (UDP)
sudo ufw allow 3478/udp

# منفذ TURN (TCP)
sudo ufw allow 3478/tcp

# منفذ TURNS (TLS)
sudo ufw allow 5349/tcp

# نطاق المنافذ للـ Media Relay (مهم جداً!)
sudo ufw allow 49152:65535/udp
sudo ufw allow 49152:65535/tcp

# تحقق من حالة Firewall
sudo ufw status
```

### 3. إعادة تشغيل TURN Server

```bash
sudo systemctl restart coturn
```

### 4. التحقق من أن TURN Server يعمل

```bash
# تحقق من حالة الخدمة
sudo systemctl status coturn

# شاهد السجلات
sudo tail -f /var/log/turn.log
```

إذا رأيت أي أخطاء في السجلات، راجع الإعدادات مرة أخرى.

### 5. اختبار الاتصال

1. افتح الموقع في متصفحين مختلفين (أو متصفح ونافذة خاصة)
2. سجل دخول كداعم في أحدهما وكمعتمر في الآخر
3. ابدأ مكالمة فيديو
4. افتح Developer Console (F12) في كلا المتصفحين
5. ابحث عن رسالة: "✅ RELAY candidate found - TURN server is working!"

إذا رأيت هذه الرسالة، فهذا يعني أن TURN Server يعمل بشكل صحيح!

### 6. استكشاف الأخطاء

#### إذا لم يظهر "RELAY candidate":
- تحقق من أن TURN Server يعمل: `sudo systemctl status coturn`
- تحقق من السجلات: `sudo tail -f /var/log/turn.log`
- تحقق من Firewall: `sudo ufw status`
- تأكد من أن المنافذ مفتوحة في iptables أيضاً (إذا كنت تستخدمه)

#### إذا رأيت أخطاء في السجلات:
- تحقق من أن الشهادات SSL صحيحة
- تحقق من أن `external-ip` صحيح
- تأكد من أن `user` و `realm` متطابقان مع الكود

### 7. التحقق من الإعدادات في الكود

الكود مُحدّث تلقائياً. لا حاجة لتغيير أي شيء في الكود.

إذا كنت تريد تغيير إعدادات TURN Server من متغيرات البيئة:

أنشئ ملف `.env.local` في مجلد `frontend/`:
```env
NEXT_PUBLIC_TURN_HOST=al7ram.nabdtech.store
NEXT_PUBLIC_TURN_USERNAME=turnuser
NEXT_PUBLIC_TURN_CREDENTIAL=turnpassword
```

## ملخص التغييرات

1. ✅ تحديث `/etc/turnserver.conf` بإعدادات صحيحة
2. ✅ فتح المنافذ في Firewall
3. ✅ إعادة تشغيل TURN Server
4. ✅ تحسين الكود لاستخدام TURN بشكل أفضل

بعد تطبيق هذه التغييرات، يجب أن يعمل الاتصال بين شبكات مختلفة بشكل صحيح!


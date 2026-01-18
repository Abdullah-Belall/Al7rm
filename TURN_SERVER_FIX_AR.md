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
# إذا كان VPS خلف NAT أو له IP داخلي أيضاً، استخدم: external-ip=public-ip/private-ip
# إذا كان VPS له IP واحد فقط، استخدم: external-ip=public-ip
external-ip=91.99.83.210
relay-ip=91.99.83.210

# إذا كان VPS خلف NAT، قد تحتاج إلى:
# external-ip=91.99.83.210/10.0.0.5  (استبدل 10.0.0.5 بـ IP الداخلي الحقيقي)

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

هذا **مهم جداً جداً**! يجب فتح المنافذ التالية:

```bash
# منفذ TURN (UDP) - مهم جداً
sudo ufw allow 3478/udp

# منفذ TURN (TCP)
sudo ufw allow 3478/tcp

# منفذ TURNS (TLS)
sudo ufw allow 5349/tcp

# نطاق المنافذ للـ Media Relay (مهم جداً - هذا السبب الرئيسي لفشل الاتصال!)
# هذه المنافذ ضرورية جداً للـ UDP relay
sudo ufw allow 49152:65535/udp
sudo ufw allow 49152:65535/tcp

# تحقق من حالة Firewall
sudo ufw status

# إذا كنت تستخدم iptables مباشرة، أضف:
# sudo iptables -A INPUT -p udp --dport 3478 -j ACCEPT
# sudo iptables -A INPUT -p tcp --dport 3478 -j ACCEPT
# sudo iptables -A INPUT -p tcp --dport 5349 -j ACCEPT
# sudo iptables -A INPUT -p udp --dport 49152:65535 -j ACCEPT
# sudo iptables -A INPUT -p tcp --dport 49152:65535 -j ACCEPT
```

**ملاحظة مهمة جداً:** بعض مزودي VPS يطبقون firewall إضافي على مستوى Cloud Provider. تأكد من فتح هذه المنافذ في:
- Cloud Provider Firewall (DigitalOcean, AWS, etc.)
- UFW (Ubuntu Firewall)
- iptables (إذا كان مستخدماً)

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
- تحقق من أن `external-ip` صحيح - إذا كان VPS خلف NAT، قد تحتاج إلى `external-ip=public-ip/private-ip`
- تأكد من أن `user` و `realm` متطابقان مع الكود

#### إذا كان TURN relay candidates موجودة لكن الاتصال يفشل:
- **السبب الأكثر احتمالاً:** المنافذ UDP (49152-65535) غير مفتوحة بشكل صحيح
- تحقق من Firewall على مستوى Cloud Provider (DigitalOcean, AWS, etc.)
- تأكد من أن UFW و iptables يسمحان بهذه المنافذ
- قد تحتاج إلى استخدام TCP/TLS بدلاً من UDP (الكود يدعم turns:)

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
2. ✅ فتح المنافذ في Firewall (خاصة UDP 49152-65535)
3. ✅ إعادة تشغيل TURN Server
4. ✅ تحسين الكود لاستخدام TURN بشكل أفضل

بعد تطبيق هذه التغييرات، يجب أن يعمل الاتصال بين شبكات مختلفة بشكل صحيح!

---

## المشكلة الشائعة: TURN relay candidates موجودة لكن الاتصال يفشل

إذا رأيت في console المتصفح:
- ✅ `RELAY candidate found - TURN server is working!`
- لكن الاتصال يفشل بعد ذلك

**السبب الأكثر احتمالاً:** المنافذ UDP (49152-65535) غير مفتوحة بشكل صحيح في Firewall.

### الحل السريع:

1. **افتح Cloud Provider Firewall** (DigitalOcean, AWS, etc.):
   - اذهب إلى إعدادات VPS → Networking → Firewall
   - أضف قاعدة: UDP port range 49152-65535 من أي مصدر (0.0.0.0/0)

2. **افتح UFW Firewall على VPS**:
   ```bash
   sudo ufw allow 49152:65535/udp
   sudo ufw allow 49152:65535/tcp
   sudo ufw status
   ```

3. **تحقق من iptables** (إذا كان مستخدماً):
   ```bash
   sudo iptables -L -n | grep 49152
   ```

4. **أعد تشغيل TURN Server**:
   ```bash
   sudo systemctl restart coturn
   ```

5. **اختبر مرة أخرى** - يجب أن يعمل الآن!


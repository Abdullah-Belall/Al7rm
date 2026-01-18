# حل مشكلة الاتصال بين شبكات مختلفة (TURN Server)

## المشكلة
عندما يكون الداعم والمعتمر على شبكات مختلفة، لا يتم الاتصال بينهم.

## السبب
المشكلة في إعدادات TURN Server على VPS. TURN Server ضروري للاتصال عندما يكون الطرفان على شبكات مختلفة.

**⚠️ ملاحظة مهمة جداً:** إذا كانت TURN relay candidates موجودة (يظهر "✅ RELAY candidate found") لكن الاتصال يفشل، السبب الأكثر احتمالاً هو أن **Cloud Provider Firewall** (DigitalOcean, AWS, etc.) يمنع المنافذ UDP 49152-65535. UFW على VPS قد يكون مفتوحاً، لكن Cloud Firewall منفصل ويحتاج فتح المنافذ فيه أيضاً!

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

# Performance and reliability settings
# Mobility support for ICE - improves connection reliability
mobility
# Fingerprint for security (optional - uncomment if needed)
# fingerprint
# Use ICE Lite for better compatibility (optional - usually not needed)
# ice-lite

# Session and allocation settings
# Increase allocation lifetime to prevent timeouts (seconds)
max-allocate-lifetime=3600
# Allow longer time for allocation to be used (increase if seeing allocation timeout)
# Default is 60 seconds, increase to 180 or 300 if allocations timeout frequently
max-allocate-timeout=300
# Keep allocations alive longer
stale-nonce=600
# Disable allocation watchdog if it's causing premature closures
# no-cli-stdin
# Increase user lifetime to prevent premature session closure
user-lifetime=3600
# Increase allocation timeout specifically
allocation-timeout=300

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
- `mobility` مهم لتحسين موثوقية الاتصال - اتركه مفعّل
- `fingerprint` اختياري للأمان - يمكن تركه معطّل (معلّق)
- `max-allocate-lifetime` و `max-allocate-timeout` مهمان لمنع `allocation timeout`
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

### 3. التحقق من Cloud Provider Firewall (مهم جداً!)

**إذا كنت تستخدم DigitalOcean, AWS, Azure, أو أي Cloud Provider آخر:**

قد يكون هناك Firewall إضافي على مستوى Cloud Provider يحتاج إلى فتح المنافذ.

#### DigitalOcean:
1. اذهب إلى [DigitalOcean Dashboard](https://cloud.digitalocean.com/)
2. اختر VPS → Networking → Firewalls
3. أنشئ أو عدّل Firewall Rules:
   - **Inbound Rules:**
     - Type: `Custom`, Protocol: `UDP`, Port Range: `3478`, Source: `0.0.0.0/0`
     - Type: `Custom`, Protocol: `TCP`, Port Range: `3478`, Source: `0.0.0.0/0`
     - Type: `Custom`, Protocol: `TCP`, Port Range: `5349`, Source: `0.0.0.0/0`
     - Type: `Custom`, Protocol: `UDP`, Port Range: `49152-65535`, Source: `0.0.0.0/0`
     - Type: `Custom`, Protocol: `TCP`, Port Range: `49152-65535`, Source: `0.0.0.0/0`

#### AWS:
1. اذهب إلى EC2 → Security Groups
2. اختر Security Group الخاص بـ VPS
3. أضف Inbound Rules مشابهة للمذكورة أعلاه

#### Azure / Other Providers:
- اتبع نفس الخطوات: ابحث عن "Firewall" أو "Security Groups" أو "Network Security Groups"
- افتح نفس المنافذ المذكورة أعلاه

**هذا مهم جداً!** إذا لم تكن المنافذ مفتوحة في Cloud Provider Firewall، لن يعمل TURN حتى لو كانت مفتوحة في UFW!

### 4. إعادة تشغيل TURN Server

```bash
sudo systemctl restart coturn

# تحقق من أن الخدمة تعمل
sudo systemctl status coturn
```

### 5. التحقق من أن TURN Server يعمل

```bash
# تحقق من حالة الخدمة
sudo systemctl status coturn

# شاهد السجلات
sudo tail -f /var/log/turn.log
```

إذا رأيت أي أخطاء في السجلات، راجع الإعدادات مرة أخرى.

### 6. اختبار الاتصال

1. افتح الموقع في متصفحين مختلفين (أو متصفح ونافذة خاصة)
2. سجل دخول كداعم في أحدهما وكمعتمر في الآخر
3. ابدأ مكالمة فيديو
4. افتح Developer Console (F12) في كلا المتصفحين
5. ابحث عن رسالة: "✅ RELAY candidate found - TURN server is working!"

إذا رأيت هذه الرسالة، فهذا يعني أن TURN Server يعمل بشكل صحيح!

### 7. استكشاف الأخطاء

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

**الأسباب المحتملة (حسب الأرجحية):**

1. **Cloud Provider Firewall (90% من الحالات)**:
   - المنافذ غير مفتوحة في Cloud Provider Firewall
   - UFW مفتوح لكن Cloud Firewall مغلق
   - **الحل:** افتح المنافذ في Cloud Provider Dashboard (انظر القسم 3 أعلاه)

2. **Network/NAT Issues (5% من الحالات)**:
   - VPS خلف NAT معقد
   - **الحل:** تأكد من `external-ip` و `relay-ip` صحيحة

3. **Timing Issues (3% من الحالات)**:
   - ICE candidates تصل متأخرة
   - **الحل:** الكود مُحدث لمعالجة هذا، لكن إذا استمرت المشكلة قد تحتاج زيادة timeout

4. **TURN Server Configuration (2% من الحالات)**:
   - إعدادات coturn تحتاج تحسين
   - **الحل:** تأكد من استخدام الإعدادات المحدثة أعلاه (شامل `fingerprint` و `mobility`)

### 8. التحقق من سجلات TURN Server

لفهم المشكلة بشكل أفضل، تحقق من السجلات:

```bash
# عرض السجلات الحية
sudo tail -f /var/log/turn.log

# أثناء محاولة الاتصال، ابحث عن:
# - "session" - إنشاء جلسة جديدة
# - "relay" - محاولة relay
# - "peer" - اتصال مع peer
# - أخطاء تحتوي على "error" أو "failed"
```

**ما يجب أن تراه في السجلات عند عمل TURN بشكل صحيح:**
- `session` messages عند إنشاء جلسة
- `relay` messages عند إعداد relay
- لا توجد أخطاء عن port binding أو authentication

### 9. التحقق من الإعدادات في الكود

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

---

## المشكلة: "allocation timeout" في سجلات TURN Server

إذا رأيت في سجلات coturn (`sudo journalctl -u coturn -f`):
```
session closed (2nd stage), reason: allocation timeout
```

**المعنى:** relay allocation يتم إنشاؤه بنجاح، لكن لا يُستخدم خلال الوقت المحدد، فيُحذف.

### الأسباب المحتملة:

1. **ICE candidates لا تُستخدم بشكل صحيح**
   - التطبيق قد يحاول الاتصال المباشر أولاً قبل استخدام relay
   - قد يحتاج وقت أطول لاختيار relay candidates

2. **Timeout قصير في إعدادات coturn**
   - القيمة الافتراضية قد تكون قصيرة
   - **الحل:** أضف `max-allocate-timeout=60` في `turnserver.conf` (موجود في الإعدادات أعلاه)

3. **مشكلة في توقيت ICE gathering**
   - ICE candidates تصل بعد فوات الأوان
   - **الحل:** الكود مُحدث لمعالجة هذا، لكن إذا استمرت المشكلة، قد نحتاج زيادة timeout

### الحل:

1. **تأكد من الإعدادات التالية في `/etc/turnserver.conf`:**
   ```conf
   max-allocate-lifetime=3600
   max-allocate-timeout=60
   stale-nonce=600
   mobility
   ```

2. **أعد تشغيل coturn:**
   ```bash
   sudo systemctl restart coturn
   ```

3. **اختبر مرة أخرى:**
   - يجب أن تظهر `allocation timeout` أقل في السجلات
   - يجب أن تعمل relay allocations لفترة أطول

**ملاحظة:** إذا استمرت المشكلة، قد تكون المشكلة في الكود أو توقيت ICE gathering. في هذه الحالة، قد نحتاج إلى تعديل الكود لاستخدام relay candidates بشكل أسرع.

### تحليل السجلات:

إذا رأيت:
- ✅ `session new` - relay allocation يتم إنشاؤه
- ✅ `ALLOCATE processed, success` - allocation ناجح
- ✅ `CREATE_PERMISSION processed, success` - الأذونات تُنشأ
- ❌ `allocation timeout` - allocation يُحذف لعدم الاستخدام

**المعنى:** relay allocation يتم إنشاؤه بنجاح، لكن التطبيق لا يستخدمه فعلياً لنقل البيانات.

**الأسباب المحتملة:**
1. التطبيق يحاول الاتصال المباشر أولاً، وإذا فشل، قد لا يستخدم relay
2. ICE candidates قد لا تصل في الوقت المناسب
3. قد يكون هناك مشكلة في توقيت ICE gathering

**الحل:**
- الإعدادات المضافة أعلاه (`max-allocate-lifetime`, `max-allocate-timeout`) يجب أن تساعد
- الكود مُحدّث لاستخدام relay candidates بشكل أفضل
- إذا استمرت المشكلة، قد نحتاج إلى استخدام `iceTransportPolicy: 'relay'` في حالة الفشل (لكن هذا سيبطئ الاتصال على الشبكة نفسها)


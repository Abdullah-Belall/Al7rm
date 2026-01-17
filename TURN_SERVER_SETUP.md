# دليل إعداد TURN Server للمكالمات الفيديوية

## المشكلة

عندما يكون العميل والدعم على شبكات WiFi مختلفة (مثل واحد على WiFi الحرم والآخر على 4G/5G)، قد يفشل الاتصال المباشر بسبب NAT Traversal. الحل هو استخدام TURN server كوسيط (relay) لتمرير البيانات.

## الحل الحالي

الكود يستخدم حالياً خوادم TURN عامة مجانية كبديل. هذه الخوادم قد تكون:
- محدودة في الاستخدام اليومي
- بطيئة في بعض الأحيان
- محظورة في بعض الدول/الشبكات

## الحل الموصى به: إعداد TURN Server خاص

### الخطوة 1: شراء VPS

استخدم VPS رخيص (5-10 دولار/شهر):
- **DigitalOcean**: https://www.digitalocean.com
- **AWS EC2**: https://aws.amazon.com/ec2
- **Linode**: https://www.linode.com
- **Vultr**: https://www.vultr.com

**اختر منطقة قريبة**: مثل الشرق الأوسط (Frankfurt, London) لتقليل latency.

### الخطوة 2: تثبيت coturn

```bash
# على Ubuntu/Debian
sudo apt update
sudo apt install coturn -y
```

### الخطوة 3: إعداد coturn

افتح ملف الإعدادات:
```bash
sudo nano /etc/turnserver.conf
```

أضف/عدل الإعدادات التالية:

```conf
# البورت الافتراضي
listening-port=3478

# تفعيل المصادقة
lt-cred-mech
use-auth-secret

# Secret قوي (استخدم UUID أو string عشوائي)
static-auth-secret=YOUR_STRONG_SECRET_HERE

# اسم الدومين (استخدم IP أو domain)
realm=yourdomain.com

# IP السيرفر العام (استبدله بـ IP سيرفرك)
external-ip=YOUR_SERVER_PUBLIC_IP

# للـ logging أثناء الاختبار
verbose

# اختياري: ركز على UDP (أسرع)
# no-tcp-relay
```

### الخطوة 4: فتح البورتات في Firewall

```bash
# فتح بورت STUN/TURN
sudo ufw allow 3478/tcp
sudo ufw allow 3478/udp

# فتح بورتات الـ media (UDP range)
sudo ufw allow 49152:65535/udp

# أو إذا كنت تستخدم iptables
sudo iptables -A INPUT -p udp --dport 3478 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 3478 -j ACCEPT
sudo iptables -A INPUT -p udp --dport 49152:65535 -j ACCEPT
```

### الخطوة 5: تشغيل coturn

```bash
# تفعيل الخدمة
sudo systemctl enable coturn

# بدء الخدمة
sudo systemctl start coturn

# التحقق من الحالة
sudo systemctl status coturn
```

### الخطوة 6: اختبار TURN Server

استخدم أداة Trickle ICE:
1. افتح: https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/
2. أضف ICE servers:
   ```
   STUN: stun:YOUR_SERVER_IP:3478
   TURN: turn:YOUR_SERVER_IP:3478?transport=udp
   TURN: turn:YOUR_SERVER_IP:3478?transport=tcp
   ```
3. Username: أي قيمة (مثل `test`)
4. Password: `YOUR_STRONG_SECRET_HERE`
5. اضغط "Gather candidates"
6. تأكد من ظهور "relay" candidates

### الخطوة 7: إضافة في الكود

في ملف `.env` في frontend:

```env
NEXT_PUBLIC_TURN_URLS=turn:YOUR_SERVER_IP:3478?transport=udp,turn:YOUR_SERVER_IP:3478?transport=tcp
NEXT_PUBLIC_TURN_USERNAME=test
NEXT_PUBLIC_TURN_CREDENTIAL=YOUR_STRONG_SECRET_HERE
```

أعد بناء frontend:
```bash
cd frontend
npm run build
```

## بدائل مدفوعة (أسهل)

إذا كنت تفضل حل جاهز بدون إعداد:

### 1. Twilio TURN
- السعر: ~$0.40 لكل 1GB
- الموقع: https://www.twilio.com/stun-turn
- سهل الإعداد، موثوق جداً

### 2. Metered.ca
- السعر: من $10/شهر
- الموقع: https://www.metered.ca/tools/openrelay/
- جيد للمشاريع الصغيرة

### 3. Xirsys
- السعر: من $10/شهر
- الموقع: https://xirsys.com
- موثوق وسهل

## التحقق من أن TURN يعمل

في console المتصفح، ابحث عن:
- `✅ RELAY candidate found - TURN server is working!`
- `✅ Using TURN relay - cross-network connection is working!`

إذا رأيت هذه الرسائل، TURN يعمل بشكل صحيح!

## استكشاف الأخطاء

### المشكلة: لا تظهر relay candidates
- تحقق من أن coturn يعمل: `sudo systemctl status coturn`
- تحقق من البورتات: `sudo netstat -tulpn | grep 3478`
- تحقق من الـ firewall
- تحقق من الـ credentials في الكود

### المشكلة: الاتصال بطيء
- استخدم VPS أقرب جغرافياً
- تأكد من استخدام UDP (أسرع من TCP)
- تحقق من bandwidth السيرفر

### المشكلة: لا يعمل في بعض الشبكات
- بعض الشبكات تحظر TURN servers
- جرب استخدام TCP بدلاً من UDP
- أو استخدم خدمة مدفوعة موثوقة

## ملاحظات أمنية

- **لا تشارك secret في الكود**: استخدم environment variables
- **استخدم HTTPS**: في الإنتاج، استخدم `turns:` بدلاً من `turn:`
- **راقب الاستخدام**: TURN servers تستهلك bandwidth

## مراجع

- [coturn Documentation](https://github.com/coturn/coturn)
- [WebRTC TURN Server Guide](https://webrtc.org/getting-started/turn-server)
- [Trickle ICE Tool](https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/)


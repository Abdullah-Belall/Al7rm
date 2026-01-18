# إصلاح مشكلة TURN Server للاتصال بين شبكات مختلفة

## المشكلة
عندما يكون الداعم والمعتمر على شبكات مختلفة، لا يتم الاتصال بينهم. هذا يعني أن TURN server لا يعمل بشكل صحيح.

## المشاكل المحتملة في turnserver.conf

### 1. سطر `fingerprint` بدون قيمة
السطر `fingerprint` بدون قيمة قد يسبب مشاكل. يجب حذفه إذا لم تكن تستخدم fingerprint validation.

### 2. إعدادات TURN Server المصححة

قم بتحديث `/etc/turnserver.conf` على VPS بالشكل التالي:

```conf
listening-port=3478
listening-ip=0.0.0.0
tls-listening-port=5349
cert=/etc/letsencrypt/live/al7ram.nabdtech.store/fullchain.pem
pkey=/etc/letsencrypt/live/al7ram.nabdtech.store/privkey.pem

# Authentication
lt-cred-mech
realm=al7ram.nabdtech.store
server-name=al7ram.nabdtech.store
user=turnuser:turnpassword

# Network settings - IMPORTANT for cross-network connectivity
external-ip=91.99.83.210
relay-ip=91.99.83.210

# Port range for media relay
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

### 3. تحقق من Firewall

تأكد من فتح المنافذ التالية في Firewall:

```bash
# UDP port for TURN
sudo ufw allow 3478/udp

# TCP port for TURN
sudo ufw allow 3478/tcp

# TLS port for TURNS
sudo ufw allow 5349/tcp

# Port range for media relay (IMPORTANT!)
sudo ufw allow 49152:65535/udp
sudo ufw allow 49152:65535/tcp
```

### 4. إعادة تشغيل TURN Server

```bash
sudo systemctl restart coturn
# أو
sudo service coturn restart
```

### 5. اختبار TURN Server

يمكنك اختبار TURN server باستخدام:

```bash
# Check if TURN server is running
sudo systemctl status coturn

# Check logs
sudo tail -f /var/log/turn.log

# Test from browser console (run in browser developer tools):
# const pc = new RTCPeerConnection({
#   iceServers: [{
#     urls: 'turn:al7ram.nabdtech.store:3478',
#     username: 'turnuser',
#     credential: 'turnpassword'
#   }]
# });
# pc.createDataChannel('test');
# pc.createOffer().then(offer => pc.setLocalDescription(offer));
# // Watch for 'relay' candidates in pc.onicecandidate
```

### 6. ملاحظات إضافية

- إذا كان VPS خلف NAT أو Load Balancer، تأكد من إعداد `external-ip` و `relay-ip` بشكل صحيح
- تأكد من أن الشهادات SSL صحيحة ومحدثة
- تأكد من أن `realm` و `server-name` متطابقان
- في الكود، TURN server مُكوّن بشكل صحيح في `VideoCallModal.tsx`

## التحقق من أن TURN يعمل

1. افتح Developer Console في المتصفح (F12)
2. أثناء المكالمة، ابحث عن log messages التي تحتوي على "RELAY candidate"
3. إذا رأيت "✅ RELAY candidate found - TURN server is working!" فهذا يعني أن TURN يعمل
4. إذا رأيت "⚠️ No relay candidates" فهذا يعني أن TURN server لا يعمل بشكل صحيح


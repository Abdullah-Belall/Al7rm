#!/bin/bash
# سكريبت Bash لإنشاء حساب داعم على Linux/Mac

API_URL="http://localhost:3001/users/register-supporter"

curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "supporter@test.com",
    "password": "123456",
    "name": "داعم تجريبي",
    "specialties": ["prayer", "guidance", "emergency"],
    "maxConcurrentRequests": 5
  }'

echo ""
echo "✅ تم إنشاء حساب الداعم!"
echo "البريد: supporter@test.com"
echo "كلمة المرور: 123456"


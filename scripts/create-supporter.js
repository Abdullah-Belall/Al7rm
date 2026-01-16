/**
 * Script لإنشاء حساب داعم تجريبي
 * استخدم: node scripts/create-supporter.js
 */

const axios = require('axios');

const API_URL = process.env.API_URL || 'http://localhost:3001';

async function createSupporter() {
  try {
    const response = await axios.post(`${API_URL}/users/register-supporter`, {
      email: 'supporter@al7ram.com',
      password: 'password123',
      name: 'داعم تجريبي',
      specialties: ['prayer', 'guidance', 'emergency'],
      maxConcurrentRequests: 5,
      isAvailable: true,
    });

    console.log('✅ تم إنشاء حساب الداعم بنجاح!');
    console.log('البريد الإلكتروني:', response.data.user.email);
    console.log('Token:', response.data.access_token);
  } catch (error) {
    if (error.response) {
      console.error('❌ خطأ:', error.response.data.message || error.response.data);
    } else {
      console.error('❌ خطأ في الاتصال بالخادم');
    }
  }
}

createSupporter();


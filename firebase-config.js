// firebase-config.js
// تهيئة Firebase باستخدام firebaseConfig المعرف عالمياً
// (تم تعريفه الآن مباشرة في ملفات HTML: index.html و chat.html)
if (typeof firebaseConfig !== 'undefined' && firebase.apps.length === 0) {
    firebase.initializeApp(firebaseConfig);
    console.log('Firebase initialized successfully from inline config.');
} else if (firebase.apps.length > 0) {
    console.log('Firebase already initialized.');
} else {
    // هذه الحالة لا يجب أن تحدث إذا تم تعريف firebaseConfig بشكل صحيح في HTML
    console.error('firebaseConfig غير معرف أو Firebase لم يتم تهيئتها. يرجى التحقق من ملفات HTML.');
    alert('خطأ في إعدادات Firebase. يرجى التأكد من تعريفها في HTML.');
}

// الحصول على مرجع لقاعدة البيانات
const database = firebase.database();

// دالة مساعدة لتنسيق الوقت
function formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
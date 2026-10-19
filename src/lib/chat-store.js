import fs from "fs";
import path from "path";
import crypto from "crypto";

// Persistent fayl joylashuvi
const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "chat-data.json");

// Xotiradagi holat
let state = {
  users: [],
  messages: [],
  sessions: {},
  nicknames: {}, // { [userId]: { [contactId]: customNickname } }
  chatSettings: {}, // { [userId]: { [chatKey]: { isArchived: boolean, isHidden: boolean, clearedAt: number } } }
  groupSettings: {
    title: "Umumiy guruh",
    updatedAt: null,
    updatedBy: null,
  },
};

// Obunachilar (SSE oqimlari): clientId -> { userId, send }
const subscribers = new Map();

// Typing holatlari: `${senderId}:${recipientId}` -> timeout
const typingStates = new Map();

// WebRTC faol qo'ng'iroqlar: callId -> { callerId, calleeId, callType, status, startedAt, timeoutTimer }
const activeCalls = new Map();

// Deduplikatsiya xotirasi: clientTempId -> messageId (oxirgi 60 soniya)
const recentTempIds = new Map();

// Rate limiting xotirasi: userId -> { count, resetAt }
const rateLimits = new Map();

function checkRateLimit(userId, maxRequests = 25, windowMs = 10000) {
  if (!userId) return true;
  const now = Date.now();
  const record = rateLimits.get(userId) || { count: 0, resetAt: now + windowMs };
  if (now > record.resetAt) {
    record.count = 1;
    record.resetAt = now + windowMs;
  } else {
    record.count++;
  }
  rateLimits.set(userId, record);
  return record.count <= maxRequests;
}

// Fayldan yuklash
function loadFromDisk() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed.users && parsed.messages) {
        state.users = parsed.users;
        state.messages = parsed.messages.map((m) => ({
          ...m,
          status: m.status || "read",
          deletedFor: Array.isArray(m.deletedFor) ? m.deletedFor : [],
          isEdited: !!m.isEdited,
          editedAt: m.editedAt || null,
        }));
        state.sessions = parsed.sessions || {};
        state.nicknames = parsed.nicknames || {};
        state.chatSettings = parsed.chatSettings || {};
        state.groupSettings = parsed.groupSettings || {
          title: "Umumiy guruh",
          updatedAt: null,
          updatedBy: null,
        };
      }
    } else {
      saveToDisk();
    }
  } catch (err) {
    console.error("Chat data yuklashda xatolik:", err);
  }
}

// Faylga xavfsiz saqlash (debounced)
let saveTimeout = null;
function saveToDisk() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2), "utf-8");
      } catch (e) {
        console.error("Faylga yozishda xatolik:", e);
      }
    }, 100);
  } catch (err) {
    console.error("Chat data saqlashda xatolik:", err);
  }
}

// Dastlabki yuklash
loadFromDisk();

// Real-time xabarnoma tarqatish
function broadcast(eventType, data, targetUserId = null) {
  const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const [, sub] of subscribers.entries()) {
    if (!targetUserId || sub.userId === targetUserId) {
      try {
        sub.send(payload);
      } catch (err) {
        console.error("Klientga xabar uzatishda xatolik:", err);
      }
    }
  }
}

// Store API metodlari
export const chatStore = {
  // Rate limit tekshirish
  checkLimit(userId) {
    return checkRateLimit(userId);
  },

  // Guruh sozlamalari
  getGroupSettings() {
    return state.groupSettings || { title: "Umumiy guruh" };
  },

  setGroupTitle(userId, newTitle) {
    const user = this.getUserById(userId);
    const title = newTitle?.trim();
    if (!title) throw new Error("Guruh nomi bo'sh bo'lishi mumkin emas");

    state.groupSettings = {
      title,
      updatedAt: new Date().toISOString(),
      updatedBy: user ? user.displayName : "Foydalanuvchi",
    };
    saveToDisk();

    broadcast("group_update", state.groupSettings);
    return state.groupSettings;
  },

  // Shaxsiy kontakt nickname belgilash (faqat shu user uchun ko'rinadi)
  setContactNickname(userId, contactId, customNickname) {
    if (!userId || !contactId) throw new Error("Foydalanuvchi identifikatori kerak");
    if (!state.nicknames[userId]) {
      state.nicknames[userId] = {};
    }

    const trimmed = customNickname?.trim();
    if (trimmed) {
      state.nicknames[userId][contactId] = trimmed.slice(0, 60);
    } else {
      delete state.nicknames[userId][contactId];
    }
    saveToDisk();

    return {
      contactId,
      customNickname: state.nicknames[userId][contactId] || null,
    };
  },

  // Foydalanuvchilarni olish (FAQAT haqiqiy yozishmalar mavjud bo'lgan suhbatlar)
  getUsers(currentUserId = null) {
    if (!currentUserId) return [];

    const onlineUserIds = new Set();
    for (const [, sub] of subscribers.entries()) {
      if (sub.userId && sub.userId !== "public-user") {
        onlineUserIds.add(sub.userId);
      }
    }

    const userNicknames = state.nicknames[currentUserId] || {};
    const userChatSettings = state.chatSettings[currentUserId] || {};

    // Faqat joriy foydalanuvchi bilan yozishma qilgan boshqa foydalanuvchilarni topish
    const conversedUserIds = new Set();
    for (const m of state.messages) {
      if (m.recipientId && m.recipientId !== "public") {
        if (m.senderId === currentUserId && m.recipientId && m.recipientId !== currentUserId) {
          conversedUserIds.add(m.recipientId);
        } else if (m.recipientId === currentUserId && m.senderId && m.senderId !== currentUserId) {
          conversedUserIds.add(m.senderId);
        }
      }
    }

    // Agar hech qanday suhbat bo'lmasa, bo'sh ro'yxat qaytariladi
    if (conversedUserIds.size === 0) {
      return [];
    }

    const list = state.users
      .filter((u) => u.id !== currentUserId && conversedUserIds.has(u.id))
      .map((u) => {
        // Oxirgi xabarni topish (currentUserId bilan u.id orasida)
        let lastMsg = null;
        const conversationMsgs = state.messages.filter(
          (m) =>
            !m.deletedFor?.includes(currentUserId) &&
            !m.isDeletedForEveryone &&
            ((m.senderId === currentUserId && m.recipientId === u.id) ||
              (m.senderId === u.id && m.recipientId === currentUserId))
        );
        if (conversationMsgs.length > 0) {
          lastMsg = conversationMsgs[conversationMsgs.length - 1];
        }

        const isArchived = !!userChatSettings[u.id]?.isArchived;
        const isHidden = !!userChatSettings[u.id]?.isHidden;

        return {
          ...u,
          originalDisplayName: u.displayName,
          displayName: userNicknames[u.id] || u.displayName,
          customNickname: userNicknames[u.id] || null,
          isOnline: onlineUserIds.has(u.id),
          isSelf: false,
          isArchived,
          isHidden,
          lastMessage: lastMsg
            ? {
                body: lastMsg.body || "",
                type: lastMsg.type || "text",
                createdAt: lastMsg.createdAt,
                isMe: lastMsg.senderId === currentUserId,
              }
            : null,
        };
      })
      .filter((u) => !u.isHidden || u.lastMessage !== null);

    // So'nggi xabar vaqtiga qarab tartiblash (oxirgi yozishganlar tepada)
    return list.sort((a, b) => {
      const timeA = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0;
      const timeB = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0;
      return timeB - timeA;
    });
  },

  getUserById(id) {
    return state.users.find((u) => u.id === id) || null;
  },

  getUserByToken(token) {
    if (!token) return null;
    const userId = state.sessions[token];
    if (!userId) return null;
    return this.getUserById(userId);
  },

  // Kirish yoki ro'yxatdan o'tish
  authenticate(username, displayName) {
    const cleanUsername = username.trim().toLowerCase();
    let user = state.users.find((u) => u.username === cleanUsername);

    const colors = [
      "from-blue-500 to-indigo-600",
      "from-emerald-500 to-teal-600",
      "from-violet-500 to-purple-600",
      "from-rose-500 to-pink-600",
      "from-amber-500 to-orange-600",
      "from-cyan-500 to-blue-600",
    ];

    if (!user) {
      const name = displayName?.trim() || username.trim();
      const initials = name
        .split(" ")
        .map((p) => p[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);

      user = {
        id: "user-" + crypto.randomUUID().slice(0, 8),
        username: cleanUsername,
        displayName: name,
        avatarBg: colors[Math.floor(Math.random() * colors.length)],
        avatarText: initials || cleanUsername.slice(0, 2).toUpperCase(),
        isOnline: true,
        lastSeen: new Date().toISOString(),
      };
      state.users.push(user);
    } else if (displayName && displayName.trim() !== user.displayName) {
      user.displayName = displayName.trim();
    }

    const token = crypto.randomBytes(24).toString("hex");
    state.sessions[token] = user.id;
    saveToDisk();

    broadcast("users_update", this.getUsers());

    return { user, token };
  },

  validateSession(token) {
    const user = this.getUserByToken(token);
    if (!user) return null;
    return user;
  },

  // Barcha umumiy xabarlar tarixini olish
  getAllMessages(viewerId = null) {
    return state.messages
      .filter((m) => {
        if (m.recipientId && m.recipientId !== "public") return false;
        if (viewerId && m.deletedFor?.includes(viewerId)) return false;
        return true;
      })
      .map((m) => ({
        _id: m.id,
        id: m.id,
        author: m.author || m.senderName,
        senderId: m.senderId || null,
        body: m.text || m.body || "",
        type: m.type || "text",
        status: m.status || "delivered",
        isEdited: !!m.isEdited,
        editedAt: m.editedAt || null,
        isDeletedForEveryone: !!m.isDeletedForEveryone,
        storageId: m.storageId || null,
        mediaUrl: m.mediaUrl || null,
        createdAt: m.createdAt,
        _creationTime: new Date(m.createdAt).getTime(),
      }));
  },

  // 1-on-1 yoki umumiy xabarlarni olish
  getMessages(userId1, userId2) {
    if (!userId2 || userId2 === "public") {
      return this.getAllMessages(userId1);
    }

    const clearedAt = state.chatSettings[userId1]?.[userId2]?.clearedAt || 0;

    return state.messages
      .filter((m) => {
        if (m.deletedFor?.includes(userId1)) return false;
        const msgTime = new Date(m.createdAt).getTime();
        if (clearedAt && msgTime <= clearedAt) return false;

        return (
          (m.senderId === userId1 && m.recipientId === userId2) ||
          (m.senderId === userId2 && m.recipientId === userId1)
        );
      })
      .map((m) => ({
        _id: m.id,
        id: m.id,
        author: m.author || m.senderName,
        senderId: m.senderId,
        recipientId: m.recipientId,
        body: m.text || m.body || "",
        type: m.type || "text",
        status: m.status || "sent",
        isEdited: !!m.isEdited,
        editedAt: m.editedAt || null,
        isDeletedForEveryone: !!m.isDeletedForEveryone,
        storageId: m.storageId || null,
        mediaUrl: m.mediaUrl || null,
        createdAt: m.createdAt,
        _creationTime: new Date(m.createdAt).getTime(),
      }));
  },

  // Xabarni tahrirlash (faqat o'zining matnli xabari)
  editMessage({ userId, messageId, newText }) {
    if (!checkRateLimit(userId, 30, 60000)) {
      throw new Error("Juda ko'p tahrirlash so'rovlari. Biroz kuting.");
    }

    const msg = state.messages.find((m) => m.id === messageId || m._id === messageId);
    if (!msg) throw new Error("Xabar topilmadi");

    if (msg.senderId !== userId) {
      throw new Error("Faqat o'zingiz yuborgan xabarni tahrirlashingiz mumkin");
    }

    if (msg.type !== "text") {
      throw new Error("Faqat oddiy matnli xabarlarni tahrirlash mumkin");
    }

    const cleanText = newText?.trim();
    if (!cleanText) {
      throw new Error("Xabar matni bo'sh bo'lishi mumkin emas");
    }
    if (cleanText.length > 5000) {
      throw new Error("Xabar matni juda uzun (maksimal 5000 belgi)");
    }

    msg.body = cleanText;
    msg.text = cleanText;
    msg.isEdited = true;
    msg.editedAt = new Date().toISOString();

    saveToDisk();

    const editPayload = {
      messageId: msg.id,
      newBody: msg.body,
      isEdited: true,
      editedAt: msg.editedAt,
    };

    if (msg.recipientId && msg.recipientId !== "public") {
      broadcast("message_edit", editPayload, msg.recipientId);
      broadcast("message_edit", editPayload, msg.senderId);
    } else {
      broadcast("message_edit", editPayload);
    }

    return msg;
  },

  // Xabarni o'chirish
  deleteMessage({ userId, messageId, forEveryone = false }) {
    const msg = state.messages.find((m) => m.id === messageId || m._id === messageId);
    if (!msg) throw new Error("Xabar topilmadi");

    if (forEveryone) {
      // Faqat xabar egasi hamma uchun o'chira oladi
      if (msg.senderId !== userId) {
        throw new Error("Boshqa foydalanuvchining xabarini barcha uchun o'chira olmaysiz");
      }

      msg.isDeletedForEveryone = true;
      msg.body = "Ushbu xabar o'chirildi";
      msg.text = "Ushbu xabar o'chirildi";
      msg.type = "deleted";
      msg.storageId = null;
      msg.mediaUrl = null;

      saveToDisk();

      const deletePayload = {
        messageId: msg.id,
        forEveryone: true,
      };

      if (msg.recipientId && msg.recipientId !== "public") {
        broadcast("message_delete", deletePayload, msg.recipientId);
        broadcast("message_delete", deletePayload, msg.senderId);
      } else {
        broadcast("message_delete", deletePayload);
      }

      return { success: true, messageId: msg.id, forEveryone: true };
    }

    // Faqat o'zim uchun o'chirish
    if (!Array.isArray(msg.deletedFor)) {
      msg.deletedFor = [];
    }
    if (!msg.deletedFor.includes(userId)) {
      msg.deletedFor.push(userId);
    }

    saveToDisk();

    // Faqat o'ziga signal yuborish
    broadcast("message_delete", { messageId: msg.id, forEveryone: false }, userId);

    return { success: true, messageId: msg.id, forEveryone: false };
  },

  // Chatni arxivlash / arxivdan chiqarish
  archiveChat(userId, chatKey, isArchived) {
    if (!state.chatSettings[userId]) {
      state.chatSettings[userId] = {};
    }
    if (!state.chatSettings[userId][chatKey]) {
      state.chatSettings[userId][chatKey] = {};
    }

    state.chatSettings[userId][chatKey].isArchived = !!isArchived;
    saveToDisk();

    return { chatKey, isArchived: !!isArchived };
  },

  // Suhbat tarixini tozalash (faqat joriy foydalanuvchi uchun)
  clearChatHistory(userId, chatKey) {
    if (!state.chatSettings[userId]) {
      state.chatSettings[userId] = {};
    }
    if (!state.chatSettings[userId][chatKey]) {
      state.chatSettings[userId][chatKey] = {};
    }

    const now = Date.now();
    state.chatSettings[userId][chatKey].clearedAt = now;

    // Ushbu chatdagi barcha xabarlarga deletedFor qo'shish
    for (const msg of state.messages) {
      if (
        chatKey === "public"
          ? !msg.recipientId || msg.recipientId === "public"
          : (msg.senderId === userId && msg.recipientId === chatKey) ||
            (msg.senderId === chatKey && msg.recipientId === userId)
      ) {
        if (!Array.isArray(msg.deletedFor)) msg.deletedFor = [];
        if (!msg.deletedFor.includes(userId)) msg.deletedFor.push(userId);
      }
    }

    saveToDisk();

    broadcast("chat_cleared", { chatKey, clearedAt: now }, userId);
    return { success: true, chatKey, clearedAt: now };
  },

  // Chatni o'chirish (o'zi uchun yoki ikkala tomon uchun)
  deleteChat(userId, chatKey, forEveryone = false) {
    if (!state.chatSettings[userId]) {
      state.chatSettings[userId] = {};
    }
    if (!state.chatSettings[userId][chatKey]) {
      state.chatSettings[userId][chatKey] = {};
    }

    if (forEveryone && chatKey !== "public") {
      // Ikkala tomon uchun ham barcha xabarlarni o'chirish
      for (const msg of state.messages) {
        if (
          (msg.senderId === userId && msg.recipientId === chatKey) ||
          (msg.senderId === chatKey && msg.recipientId === userId)
        ) {
          msg.isDeletedForEveryone = true;
          msg.body = "Ushbu xabar o'chirildi";
          msg.text = "Ushbu xabar o'chirildi";
          msg.type = "deleted";
          msg.storageId = null;
          msg.mediaUrl = null;
        }
      }

      saveToDisk();

      broadcast("chat_deleted", { chatKey, forEveryone: true }, userId);
      broadcast("chat_deleted", { chatKey: userId, forEveryone: true }, chatKey);

      return { success: true, chatKey, forEveryone: true };
    }

    // Faqat o'zim uchun chatni yashirish va tozalash
    this.clearChatHistory(userId, chatKey);
    state.chatSettings[userId][chatKey].isHidden = true;
    saveToDisk();

    broadcast("chat_deleted", { chatKey, forEveryone: false }, userId);
    return { success: true, chatKey, forEveryone: false };
  },

  // Xabarlarni o'qilgan deb belgilash
  markMessagesAsRead(viewerId, otherUserId) {
    let updatedCount = 0;
    const updatedIds = [];

    for (const msg of state.messages) {
      if (
        otherUserId && otherUserId !== "public"
          ? msg.senderId === otherUserId && msg.recipientId === viewerId && msg.status !== "read"
          : (!msg.recipientId || msg.recipientId === "public") && msg.senderId !== viewerId && msg.status !== "read"
      ) {
        msg.status = "read";
        updatedCount++;
        updatedIds.push(msg.id);
      }
    }

    if (updatedCount > 0) {
      saveToDisk();
      const target = otherUserId && otherUserId !== "public" ? otherUserId : null;
      broadcast(
        "message_status",
        {
          messageIds: updatedIds,
          status: "read",
          readBy: viewerId,
        },
        target
      );
    }

    return { updatedCount, updatedIds };
  },

  // Umumiy chatga xabar yuborish
  addPublicMessage({ author, body, type = "text", storageId = null, mediaUrl = null, clientTempId = null, senderId = null }) {
    if (clientTempId && recentTempIds.has(clientTempId)) {
      const existingId = recentTempIds.get(clientTempId);
      const existingMsg = state.messages.find((m) => m.id === existingId);
      if (existingMsg) return existingMsg;
    }

    const newMessage = {
      id: "msg-" + crypto.randomUUID(),
      senderId: senderId || null,
      author: author || "Anonim",
      senderName: author || "Anonim",
      recipientId: "public",
      body: body || "",
      text: body || "",
      type,
      status: "delivered",
      isEdited: false,
      editedAt: null,
      deletedFor: [],
      storageId,
      mediaUrl,
      createdAt: new Date().toISOString(),
    };

    state.messages.push(newMessage);
    if (clientTempId) {
      recentTempIds.set(clientTempId, newMessage.id);
      setTimeout(() => recentTempIds.delete(clientTempId), 60000);
    }
    saveToDisk();

    broadcast("message", {
      _id: newMessage.id,
      id: newMessage.id,
      author: newMessage.author,
      senderId: newMessage.senderId,
      recipientId: "public",
      body: newMessage.body,
      type: newMessage.type,
      status: newMessage.status,
      isEdited: false,
      editedAt: null,
      storageId: newMessage.storageId,
      mediaUrl: newMessage.mediaUrl,
      createdAt: newMessage.createdAt,
      _creationTime: new Date(newMessage.createdAt).getTime(),
      clientTempId,
    });

    return newMessage;
  },

  // Shaxsiy xabar yuborish (1-on-1)
  sendMessage({ senderId, recipientId, text, type = "text", storageId = null, mediaUrl = null, clientTempId = null }) {
    if (!text && !storageId && !mediaUrl) {
      throw new Error("Xabar matni yoki media bo'sh bo'lishi mumkin emas");
    }
    const sender = this.getUserById(senderId);
    if (!sender) {
      throw new Error("Yuboruvchi topilmadi");
    }
    const recipient = this.getUserById(recipientId);
    if (!recipient) {
      throw new Error("Qabul qiluvchi topilmadi");
    }

    if (clientTempId && recentTempIds.has(clientTempId)) {
      const existingId = recentTempIds.get(clientTempId);
      const existingMsg = state.messages.find((m) => m.id === existingId);
      if (existingMsg) return existingMsg;
    }

    // Agar recipient ushbu chatni yashirgan bo'lsa, yangi xabar kelishi bilan yashirish bekor qilinadi
    if (state.chatSettings[recipientId]?.[senderId]?.isHidden) {
      state.chatSettings[recipientId][senderId].isHidden = false;
    }

    const recipientOnline = this.isUserOnline(recipientId);

    const newMessage = {
      id: "msg-" + crypto.randomUUID(),
      senderId,
      senderName: sender.displayName,
      author: sender.displayName,
      recipientId,
      text: text ? text.trim() : "",
      body: text ? text.trim() : "",
      type,
      status: recipientOnline ? "delivered" : "sent",
      isEdited: false,
      editedAt: null,
      deletedFor: [],
      storageId,
      mediaUrl,
      createdAt: new Date().toISOString(),
    };

    state.messages.push(newMessage);
    if (clientTempId) {
      recentTempIds.set(clientTempId, newMessage.id);
      setTimeout(() => recentTempIds.delete(clientTempId), 60000);
    }
    saveToDisk();

    const formatted = {
      _id: newMessage.id,
      id: newMessage.id,
      senderId: newMessage.senderId,
      author: newMessage.author,
      recipientId: newMessage.recipientId,
      body: newMessage.body,
      type: newMessage.type,
      status: newMessage.status,
      isEdited: false,
      editedAt: null,
      storageId: newMessage.storageId,
      mediaUrl: newMessage.mediaUrl,
      createdAt: newMessage.createdAt,
      _creationTime: new Date(newMessage.createdAt).getTime(),
      clientTempId,
    };

    broadcast("message", formatted, recipientId);
    broadcast("message", formatted, senderId);

    // Ro'yxatdagi so'nggi xabarni yangilash uchun users_update tarqatish
    broadcast("users_update", this.getUsers());

    this.setTyping(senderId, recipientId, false);

    return newMessage;
  },

  isUserOnline(userId) {
    for (const [, sub] of subscribers.entries()) {
      if (sub.userId === userId) return true;
    }
    return false;
  },

  setTyping(senderId, recipientId, isTyping) {
    const key = `${senderId}:${recipientId}`;
    if (typingStates.has(key)) {
      clearTimeout(typingStates.get(key));
      typingStates.delete(key);
    }

    const sender = this.getUserById(senderId);
    const senderName = sender ? sender.displayName : "Foydalanuvchi";

    if (recipientId && recipientId !== "public") {
      broadcast(
        "typing",
        {
          senderId,
          senderName,
          recipientId,
          isTyping,
        },
        recipientId
      );
    } else {
      broadcast("typing", {
        senderId,
        senderName,
        recipientId: "public",
        isTyping,
      });
    }

    if (isTyping) {
      const timer = setTimeout(() => {
        this.setTyping(senderId, recipientId, false);
      }, 3500);
      typingStates.set(key, timer);
    }
  },

  handleCallSignal(senderId, payload) {
    const { action, targetUserId, callId, callType, sdp, candidate, reason } = payload;
    const sender = this.getUserById(senderId);
    if (!sender) {
      throw new Error("Yaroqsiz foydalanuvchi");
    }

    switch (action) {
      case "call_initiate": {
        if (!targetUserId || targetUserId === senderId) {
          throw new Error("Noto'g'ri qabul qiluvchi");
        }
        const targetUser = this.getUserById(targetUserId);
        if (!targetUser) {
          throw new Error("Qo'ng'iroq qilinayotgan foydalanuvchi topilmadi");
        }

        for (const [, call] of activeCalls.entries()) {
          if (
            (call.callerId === targetUserId || call.calleeId === targetUserId) &&
            call.status !== "ended"
          ) {
            broadcast(
              "call_signal",
              {
                action: "call_busy",
                callId,
                targetUserId: senderId,
                reason: "Foydalanuvchi boshqa qo'ng'iroqda band",
              },
              senderId
            );
            return { status: "busy" };
          }
        }

        const newCallId = callId || "call-" + crypto.randomUUID();

        const timeoutTimer = setTimeout(() => {
          const c = activeCalls.get(newCallId);
          if (c && c.status === "ringing") {
            c.status = "timeout";
            broadcast(
              "call_signal",
              {
                action: "call_timeout",
                callId: newCallId,
                reason: "Javob berilmadi",
              },
              senderId
            );
            broadcast(
              "call_signal",
              {
                action: "call_timeout",
                callId: newCallId,
                reason: "Javob berilmadi",
              },
              targetUserId
            );
            activeCalls.delete(newCallId);
          }
        }, 35000);

        activeCalls.set(newCallId, {
          callId: newCallId,
          callerId: senderId,
          callerName: sender.displayName,
          callerAvatarBg: sender.avatarBg,
          calleeId: targetUserId,
          callType: callType || "video",
          status: "ringing",
          startedAt: Date.now(),
          timeoutTimer,
        });

        broadcast(
          "call_signal",
          {
            action: "call_incoming",
            callId: newCallId,
            callerId: senderId,
            callerName: sender.displayName,
            callerAvatarBg: sender.avatarBg,
            callType: callType || "video",
            sdp,
          },
          targetUserId
        );

        return { status: "ringing", callId: newCallId };
      }

      case "call_accept": {
        const call = activeCalls.get(callId);
        if (!call) {
          throw new Error("Qo'ng'iroq topilmadi yoki muddati o'tgan");
        }
        if (call.calleeId !== senderId) {
          throw new Error("Ruxsatsiz amal");
        }
        if (call.timeoutTimer) clearTimeout(call.timeoutTimer);

        call.status = "connected";

        broadcast(
          "call_signal",
          {
            action: "call_accepted",
            callId,
            calleeId: senderId,
            sdp,
          },
          call.callerId
        );

        return { status: "connected" };
      }

      case "call_reject": {
        const call = activeCalls.get(callId);
        if (call) {
          if (call.timeoutTimer) clearTimeout(call.timeoutTimer);
          activeCalls.delete(callId);
          broadcast(
            "call_signal",
            {
              action: "call_rejected",
              callId,
              reason: reason || "Qo'ng'iroq rad etildi",
            },
            call.callerId
          );
        }
        return { status: "rejected" };
      }

      case "call_end": {
        const call = activeCalls.get(callId);
        if (call) {
          if (call.timeoutTimer) clearTimeout(call.timeoutTimer);
          activeCalls.delete(callId);
          const otherUserId = call.callerId === senderId ? call.calleeId : call.callerId;
          broadcast(
            "call_signal",
            {
              action: "call_ended",
              callId,
              endedBy: senderId,
            },
            otherUserId
          );
        }
        return { status: "ended" };
      }

      case "ice_candidate": {
        const call = activeCalls.get(callId);
        if (call) {
          const otherUserId = call.callerId === senderId ? call.calleeId : call.callerId;
          broadcast(
            "call_signal",
            {
              action: "ice_candidate",
              callId,
              candidate,
            },
            otherUserId
          );
        }
        return { status: "candidate_relayed" };
      }

      default:
        throw new Error("Noma'lum signal harakati: " + action);
    }
  },

  subscribe(userId, sendFn) {
    const clientId = crypto.randomUUID();
    const actualUserId = userId || "anonymous-" + clientId.slice(0, 8);
    subscribers.set(clientId, { userId: actualUserId, send: sendFn });

    if (actualUserId && actualUserId !== "public-user") {
      const user = this.getUserById(actualUserId);
      if (user) {
        user.isOnline = true;
        saveToDisk();
      }
      broadcast("presence", { userId: actualUserId, isOnline: true, lastSeen: new Date().toISOString() });
      broadcast("users_update", this.getUsers());
    }

    return clientId;
  },

  unsubscribe(clientId) {
    const sub = subscribers.get(clientId);
    if (!sub) return;

    subscribers.delete(clientId);
    const userId = sub.userId;

    let hasOtherTabs = false;
    for (const [, otherSub] of subscribers.entries()) {
      if (otherSub.userId === userId) {
        hasOtherTabs = true;
        break;
      }
    }

    if (!hasOtherTabs && userId && userId !== "public-user") {
      const user = this.getUserById(userId);
      if (user) {
        user.lastSeen = new Date().toISOString();
        saveToDisk();
      }
      broadcast("presence", { userId, isOnline: false, lastSeen: new Date().toISOString() });
      broadcast("users_update", this.getUsers());

      for (const [callId, call] of activeCalls.entries()) {
        if (call.callerId === userId || call.calleeId === userId) {
          if (call.timeoutTimer) clearTimeout(call.timeoutTimer);
          activeCalls.delete(callId);
          const otherId = call.callerId === userId ? call.calleeId : call.callerId;
          broadcast(
            "call_signal",
            {
              action: "call_ended",
              callId,
              reason: "Suhbatdosh tarmoqdan uzildi",
            },
            otherId
          );
        }
      }
    }
  },
};

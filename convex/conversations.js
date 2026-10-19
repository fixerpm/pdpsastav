import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

function resolveOnlineStatus(user) {
  if (!user || !user.isOnline) return false;
  if (!user.lastSeen) return false;
  const diff = Date.now() - new Date(user.lastSeen).getTime();
  return diff < 150000; // 2.5 daqiqa ichida faol bo'lsa online
}

// Guruh sozlamalarini olish
export const getGroupSettings = query({
  args: {},
  handler: async (ctx) => {
    const setting = await ctx.db
      .query("groupSettings")
      .withIndex("by_key", (q) => q.eq("key", "main_group"))
      .first();

    return setting || { title: "Umumiy guruh" };
  },
});

// Guruh nomini tahrirlash
export const setGroupTitle = mutation({
  args: {
    userId: v.string(),
    userName: v.string(),
    newTitle: v.string(),
  },
  handler: async (ctx, args) => {
    const cleanTitle = args.newTitle.trim();
    if (!cleanTitle) throw new Error("Guruh nomi bo'sh bo'lishi mumkin emas");

    const existing = await ctx.db
      .query("groupSettings")
      .withIndex("by_key", (q) => q.eq("key", "main_group"))
      .first();

    const updateData = {
      key: "main_group",
      title: cleanTitle,
      updatedAt: new Date().toISOString(),
      updatedBy: args.userName,
    };

    if (existing) {
      await ctx.db.patch(existing._id, updateData);
    } else {
      await ctx.db.insert("groupSettings", updateData);
    }

    return { success: true, title: cleanTitle };
  },
});

// Shaxsiy kontakt taxallusini belgilash
export const setNickname = mutation({
  args: {
    userId: v.string(),
    contactId: v.string(),
    nickname: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("conversations")
      .withIndex("by_user_chat", (q) => q.eq("userId", args.userId).eq("chatKey", args.contactId))
      .first();

    const cleanNick = args.nickname.trim();

    if (existing) {
      await ctx.db.patch(existing._id, {
        customNickname: cleanNick || undefined,
      });
    } else {
      await ctx.db.insert("conversations", {
        userId: args.userId,
        chatKey: args.contactId,
        customNickname: cleanNick || undefined,
      });
    }

    return { success: true, nickname: cleanNick };
  },
});

// Chatni arxivlash / arxivdan chiqarish
export const archive = mutation({
  args: {
    userId: v.string(),
    chatKey: v.string(),
    isArchived: v.boolean(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("conversations")
      .withIndex("by_user_chat", (q) => q.eq("userId", args.userId).eq("chatKey", args.chatKey))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { isArchived: args.isArchived });
    } else {
      await ctx.db.insert("conversations", {
        userId: args.userId,
        chatKey: args.chatKey,
        isArchived: args.isArchived,
      });
    }

    return { success: true, isArchived: args.isArchived };
  },
});

// Suhbat tarixini tozalash (faqat shu foydalanuvchi uchun)
export const clearHistory = mutation({
  args: {
    userId: v.string(),
    chatKey: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("conversations")
      .withIndex("by_user_chat", (q) => q.eq("userId", args.userId).eq("chatKey", args.chatKey))
      .first();

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { clearedAt: now });
    } else {
      await ctx.db.insert("conversations", {
        userId: args.userId,
        chatKey: args.chatKey,
        clearedAt: now,
      });
    }

    return { success: true, clearedAt: now };
  },
});

// Chatni o'chirish (o'zi uchun yoki ikkala tomon uchun)
export const deleteChat = mutation({
  args: {
    userId: v.string(),
    chatKey: v.string(),
    forEveryone: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    if (args.forEveryone && args.chatKey !== "public") {
      const messages1 = await ctx.db
        .query("messages")
        .withIndex("by_sender", (q) => q.eq("senderId", args.userId))
        .filter((q) => q.eq(q.field("recipientId"), args.chatKey))
        .collect();

      const messages2 = await ctx.db
        .query("messages")
        .withIndex("by_sender", (q) => q.eq("senderId", args.chatKey))
        .filter((q) => q.eq(q.field("recipientId"), args.userId))
        .collect();

      for (const m of [...messages1, ...messages2]) {
        await ctx.db.patch(m._id, {
          isDeletedForEveryone: true,
          body: "Ushbu xabar o'chirildi",
          type: "deleted",
          storageId: undefined,
          mediaUrl: undefined,
        });
      }
    }

    const existing = await ctx.db
      .query("conversations")
      .withIndex("by_user_chat", (q) => q.eq("userId", args.userId).eq("chatKey", args.chatKey))
      .first();

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        isHidden: true,
        clearedAt: now,
      });
    } else {
      await ctx.db.insert("conversations", {
        userId: args.userId,
        chatKey: args.chatKey,
        isHidden: true,
        clearedAt: now,
      });
    }

    return { success: true };
  },
});

// Foydalanuvchining haqiqiy suhbatlar ro'yxatini olish (FAQAT haqiqiy yozishmalar mavjud bo'lgan suhbatlar)
export const listConversations = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    if (!args.userId) return [];

    // 1. Foydalanuvchi ishtirok etgan barcha shaxsiy xabarlarni olish
    const sent = await ctx.db
      .query("messages")
      .withIndex("by_sender", (q) => q.eq("senderId", args.userId))
      .collect();

    const received = await ctx.db
      .query("messages")
      .withIndex("by_recipient", (q) => q.eq("recipientId", args.userId))
      .collect();

    // 2. Foydalanuvchining conversation sozlamalari (arxiv, yashirish, tozalash vaqti)
    const convSettings = await ctx.db
      .query("conversations")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const settingsMap = new Map();
    for (const c of convSettings) {
      settingsMap.set(c.chatKey, c);
    }

    // 3. Foydalanuvchining kontaktlarini olish
    const userContacts = await ctx.db
      .query("contacts")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    const contactMap = new Map();
    for (const c of userContacts) {
      contactMap.set(c.contactUserId, c);
    }

    // 4. Barcha 1-on-1 xabarlarni saralash (faqat shaxsiy suhbatlar, public va guruh xabarlarisiz)
    const allPersonal = [...sent, ...received].filter(
      (m) => !m.groupId && m.recipientId && m.recipientId !== "public" && m.senderId && m.senderId !== m.recipientId
    );

    const conversationMap = new Map(); // otherUserId -> messages[]

    for (const m of allPersonal) {
      const otherUserId = m.senderId === args.userId ? m.recipientId : m.senderId;
      if (!otherUserId || otherUserId === args.userId) continue;

      // O'chirilgan xabarlarni hisobga olmaslik
      if (Array.isArray(m.deletedFor) && m.deletedFor.includes(args.userId)) {
        continue;
      }

      // Tarix tozalangan bo'lsa, tozalangan vaqtdan oldingi xabarlarni tashlab yuborish
      const setting = settingsMap.get(otherUserId);
      if (setting?.clearedAt && m._creationTime <= setting.clearedAt) {
        continue;
      }

      if (!conversationMap.has(otherUserId)) {
        conversationMap.set(otherUserId, []);
      }
      conversationMap.get(otherUserId).push(m);
    }

    // Agar hech qanday haqiqiy suhbat bo'lmasa, bo'sh massiv qaytariladi (hech qachon soxta yoki begona foydalanuvchilar chiqmaydi)
    if (conversationMap.size === 0) {
      return [];
    }

    // Ishtirokchilarning profil ma'lumotlarini olish
    const allUsers = await ctx.db.query("users").collect();
    const userMap = new Map();
    for (const u of allUsers) {
      userMap.set(u.userId, u);
    }

    const conversations = [];

    for (const [otherUserId, msgs] of conversationMap.entries()) {
      const user = userMap.get(otherUserId);
      if (!user) continue;

      const setting = settingsMap.get(otherUserId);
      const contact = contactMap.get(otherUserId);

      // Agar suhbat butunlay yashirilgan bo'lsa va xabarlar yo'q bo'lsa
      if (setting?.isHidden && msgs.length === 0) {
        continue;
      }

      // Oxirgi xabarni aniqlash
      msgs.sort((a, b) => a._creationTime - b._creationTime);
      const lastMsg = msgs[msgs.length - 1];

      // O'qilmagan xabarlar soni
      const unreadCount = msgs.filter(
        (m) => m.senderId === otherUserId && m.status !== "read"
      ).length;

      // Ism va taxallus
      const displayName =
        setting?.customNickname ||
        contact?.customNickname ||
        user.displayName ||
        user.username;

      const isOnline = resolveOnlineStatus(user);

      conversations.push({
        id: user.userId,
        userId: user.userId,
        username: user.username,
        displayName,
        originalDisplayName: user.displayName,
        avatarBg: user.avatarBg,
        avatarText: user.avatarText,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        isOnline,
        lastSeen: user.privacySettings?.showLastSeen === "nobody" ? null : user.lastSeen,
        isContact: Boolean(contact),
        isArchived: Boolean(setting?.isArchived),
        isHidden: Boolean(setting?.isHidden),
        unreadCount,
        lastMessage: lastMsg
          ? {
              body: lastMsg.body || "",
              type: lastMsg.type || "text",
              createdAt: new Date(lastMsg._creationTime).toISOString(),
              isMe: lastMsg.senderId === args.userId,
            }
          : null,
        lastMessageTime: lastMsg?._creationTime || 0,
      });
    }

    return conversations.sort((a, b) => b.lastMessageTime - a.lastMessageTime);
  },
});

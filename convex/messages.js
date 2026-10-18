import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Fayl (audio/video/media) yuklash uchun Convex storage upload URL yaratish
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    if (ctx.storage && typeof ctx.storage.generateUploadUrl === "function") {
      return await ctx.storage.generateUploadUrl();
    }
    return null;
  },
});

// Xabarlar ro'yxatini real-time olish (1-on-1, Guruh yoki Public)
export const list = query({
  args: {
    recipientId: v.optional(v.string()),
    viewerId: v.optional(v.string()),
    groupId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let messages = [];

    if (args.groupId) {
      // Guruh xabarlari
      messages = await ctx.db
        .query("messages")
        .withIndex("by_group", (q) => q.eq("groupId", args.groupId))
        .collect();
      messages.sort((a, b) => a._creationTime - b._creationTime);
    } else if (args.recipientId && args.recipientId !== "public") {
      // 1-on-1 xabarlar
      const list1 = await ctx.db
        .query("messages")
        .withIndex("by_recipient", (q) => q.eq("recipientId", args.recipientId))
        .collect();

      const list2 = args.viewerId
        ? await ctx.db
            .query("messages")
            .withIndex("by_recipient", (q) => q.eq("recipientId", args.viewerId))
            .collect()
        : [];

      const combined = [...list1, ...list2].filter((m) => {
        if (m.groupId) return false;
        if (!args.viewerId) {
          return false;
        }
        return (
          (m.senderId === args.viewerId && m.recipientId === args.recipientId) ||
          (m.senderId === args.recipientId && m.recipientId === args.viewerId)
        );
      });

      const seen = new Set();
      const unique = [];
      for (const m of combined) {
        if (!seen.has(m._id)) {
          seen.add(m._id);
          unique.push(m);
        }
      }
      unique.sort((a, b) => a._creationTime - b._creationTime);
      messages = unique;
    } else {
      // Public umumiy xabarlar
      const all = await ctx.db
        .query("messages")
        .withIndex("by_recipient", (q) => q.eq("recipientId", "public"))
        .order("desc")
        .take(150);
      messages = all.reverse().filter((m) => !m.groupId);
    }

    // viewerId uchun o'chirilgan xabarlarni filtrlash
    const filtered = messages.filter((m) => {
      if (args.viewerId && Array.isArray(m.deletedFor) && m.deletedFor.includes(args.viewerId)) {
        return false;
      }
      return true;
    });

    // Storage ID larga tegishli doimiy URL manzillarni hal qilish
    const resolved = await Promise.all(
      filtered.map(async (msg) => {
        let mediaUrl = msg.mediaUrl;
        if (msg.storageId && ctx.storage && typeof ctx.storage.getUrl === "function") {
          const url = await ctx.storage.getUrl(msg.storageId);
          if (url) mediaUrl = url;
        }
        return {
          ...msg,
          mediaUrl,
        };
      })
    );

    return resolved;
  },
});

// Yangi xabar yuborish (text, sticker, voice, video, file, reply)
export const send = mutation({
  args: {
    author: v.string(),
    senderId: v.optional(v.string()),
    recipientId: v.optional(v.string()),
    groupId: v.optional(v.string()),
    body: v.string(),
    type: v.optional(v.string()),
    status: v.optional(v.string()),
    storageId: v.optional(v.string()),
    mediaUrl: v.optional(v.string()),
    replyToId: v.optional(v.string()),
    replyToSnapshot: v.optional(
      v.object({
        id: v.string(),
        author: v.string(),
        body: v.string(),
        type: v.optional(v.string()),
      })
    ),
    fileName: v.optional(v.string()),
    fileSize: v.optional(v.number()),
    duration: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const author = args.author.trim() || "Anonim";
    const body = args.body.trim();
    const type = args.type || "text";

    if (!body && !args.storageId && !args.mediaUrl) {
      throw new Error("Xabar bo'sh bo'lishi mumkin emas");
    }

    // Guruhga xabar yuborishda a'zolikni tekshirish
    if (args.groupId) {
      const group = await ctx.db
        .query("groups")
        .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
        .first();
      if (!group) throw new Error("Guruh topilmadi");
      if (args.senderId) {
        const isMember = group.memberIds.includes(args.senderId) || group.ownerId === args.senderId;
        if (!isMember) {
          throw new Error("Siz ushbu guruh a'zosi emassiz");
        }
      }
    }

    // 1-on-1 xabarlarda autentifikatsiya va bloklanganlikni tekshirish
    if (!args.groupId && args.recipientId && args.recipientId !== "public") {
      if (!args.senderId) {
        throw new Error("Shaxsiy xabar yuborish uchun tizimga kirish shart");
      }
      const recipient = await ctx.db
        .query("users")
        .withIndex("by_userId", (q) => q.eq("userId", args.recipientId))
        .first();
      if (recipient && Array.isArray(recipient.blockedUserIds) && recipient.blockedUserIds.includes(args.senderId)) {
        throw new Error("Ushbu foydalanuvchi sizni bloklagan");
      }
    }

    const messageId = await ctx.db.insert("messages", {
      author,
      senderId: args.senderId,
      recipientId: args.groupId ? undefined : args.recipientId || "public",
      groupId: args.groupId,
      body,
      type,
      status: args.status || "delivered",
      isEdited: false,
      isDeletedForEveryone: false,
      deletedFor: [],
      storageId: args.storageId,
      mediaUrl: args.mediaUrl,
      replyToId: args.replyToId,
      replyToSnapshot: args.replyToSnapshot,
      reactions: [],
      isPinned: false,
      fileName: args.fileName,
      fileSize: args.fileSize,
      duration: args.duration,
    });

    // Agar 1-on-1 xabar bo'lsa va qabul qiluvchi bor bo'lsa, bildirishnoma yaratish
    if (!args.groupId && args.recipientId && args.recipientId !== "public" && args.senderId) {
      await ctx.db.insert("notifications", {
        userId: args.recipientId,
        type: "message",
        title: `Yangi xabar: ${author}`,
        body: type === "text" ? body : `[${type} xabari]`,
        data: JSON.stringify({ senderId: args.senderId }),
        isRead: false,
        createdAt: new Date().toISOString(),
      });
    }

    return messageId;
  },
});

// Emojili reaksiya bildirish (toggle emoji reaction)
export const react = mutation({
  args: {
    messageId: v.id("messages"),
    userId: v.string(),
    author: v.string(),
    emoji: v.string(),
  },
  handler: async (ctx, args) => {
    const msg = await ctx.db.get(args.messageId);
    if (!msg) throw new Error("Xabar topilmadi");

    const currentReactions = Array.isArray(msg.reactions) ? [...msg.reactions] : [];
    const existingIndex = currentReactions.findIndex((r) => r.userId === args.userId);

    if (existingIndex >= 0) {
      if (currentReactions[existingIndex].emoji === args.emoji) {
        // Bir xil emojini qayta bosganda olib tashlash
        currentReactions.splice(existingIndex, 1);
      } else {
        // Boshqa emojiga almashtirish
        currentReactions[existingIndex] = {
          emoji: args.emoji,
          userId: args.userId,
          author: args.author,
        };
      }
    } else {
      currentReactions.push({
        emoji: args.emoji,
        userId: args.userId,
        author: args.author,
      });
    }

    await ctx.db.patch(args.messageId, {
      reactions: currentReactions,
    });

    return { success: true, reactions: currentReactions };
  },
});

// Xabarni mahkamlash (pin / unpin)
export const togglePin = mutation({
  args: {
    messageId: v.id("messages"),
    userId: v.string(),
    shouldPin: v.boolean(),
  },
  handler: async (ctx, args) => {
    const msg = await ctx.db.get(args.messageId);
    if (!msg) throw new Error("Xabar topilmadi");

    await ctx.db.patch(args.messageId, {
      isPinned: args.shouldPin,
      pinnedAt: args.shouldPin ? new Date().toISOString() : undefined,
      pinnedBy: args.shouldPin ? args.userId : undefined,
    });

    return { success: true, isPinned: args.shouldPin };
  },
});

// Xabarlarni qidirish
export const searchMessages = query({
  args: {
    query: v.string(),
    viewerId: v.string(),
    recipientId: v.optional(v.string()),
    groupId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const q = args.query.trim().toLowerCase();
    if (!q) return [];

    let messages = [];
    if (args.groupId) {
      messages = await ctx.db
        .query("messages")
        .withIndex("by_group", (ind) => ind.eq("groupId", args.groupId))
        .collect();
    } else if (args.recipientId) {
      const list1 = await ctx.db
        .query("messages")
        .withIndex("by_recipient", (ind) => ind.eq("recipientId", args.recipientId))
        .collect();
      const list2 = await ctx.db
        .query("messages")
        .withIndex("by_recipient", (ind) => ind.eq("recipientId", args.viewerId))
        .collect();
      messages = [...list1, ...list2].filter(
        (m) =>
          (m.senderId === args.viewerId && m.recipientId === args.recipientId) ||
          (m.senderId === args.recipientId && m.recipientId === args.viewerId)
      );
    } else {
      messages = await ctx.db.query("messages").order("desc").take(300);
    }

    return messages
      .filter((m) => {
        if (m.type === "deleted" || m.isDeletedForEveryone) return false;
        if (Array.isArray(m.deletedFor) && m.deletedFor.includes(args.viewerId)) return false;
        return m.body && m.body.toLowerCase().includes(q);
      })
      .slice(0, 30);
  },
});

// Xabarni tahrirlash (faqat muallif matnli xabarni tahrirlashi mumkin)
export const edit = mutation({
  args: {
    messageId: v.id("messages"),
    userId: v.string(),
    newText: v.string(),
  },
  handler: async (ctx, args) => {
    const msg = await ctx.db.get(args.messageId);
    if (!msg) throw new Error("Xabar topilmadi");

    if (msg.senderId !== args.userId) {
      throw new Error("Faqat o'zingiz yuborgan xabarni tahrirlashingiz mumkin");
    }

    if (msg.type !== "text") {
      throw new Error("Faqat oddiy matnli xabarlarni tahrirlash mumkin");
    }

    const cleanText = args.newText.trim();
    if (!cleanText) throw new Error("Xabar matni bo'sh bo'lishi mumkin emas");

    await ctx.db.patch(args.messageId, {
      body: cleanText,
      isEdited: true,
      editedAt: new Date().toISOString(),
    });

    return { success: true };
  },
});

// Xabarni o'chirish (o'zi uchun yoki hamma uchun)
export const deleteMessage = mutation({
  args: {
    messageId: v.id("messages"),
    userId: v.string(),
    forEveryone: v.boolean(),
  },
  handler: async (ctx, args) => {
    const msg = await ctx.db.get(args.messageId);
    if (!msg) throw new Error("Xabar topilmadi");

    if (args.forEveryone) {
      if (msg.senderId !== args.userId) {
        throw new Error("Boshqa foydalanuvchining xabarini barcha uchun o'chira olmaysiz");
      }

      await ctx.db.patch(args.messageId, {
        body: "Ushbu xabar o‘chirildi",
        type: "deleted",
        isDeletedForEveryone: true,
        storageId: undefined,
        mediaUrl: undefined,
      });

      return { success: true, forEveryone: true };
    }

    // Faqat o'zi uchun o'chirish
    const currentDeletedFor = Array.isArray(msg.deletedFor) ? msg.deletedFor : [];
    if (!currentDeletedFor.includes(args.userId)) {
      await ctx.db.patch(args.messageId, {
        deletedFor: [...currentDeletedFor, args.userId],
      });
    }

    return { success: true, forEveryone: false };
  },
});

// Xabarlarni o'qilgan deb belgilash
export const markAsRead = mutation({
  args: {
    viewerId: v.string(),
    chatWithId: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.chatWithId === "public") return;

    const unreadMessages = await ctx.db
      .query("messages")
      .withIndex("by_recipient", (q) => q.eq("recipientId", args.viewerId))
      .filter((q) => q.and(q.eq(q.field("senderId"), args.chatWithId), q.neq(q.field("status"), "read")))
      .collect();

    for (const msg of unreadMessages) {
      await ctx.db.patch(msg._id, { status: "read" });
    }

    return { updatedCount: unreadMessages.length };
  },
});

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Fayl (audio/video) yuklash uchun Convex storage upload URL yaratish
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    if (ctx.storage && typeof ctx.storage.generateUploadUrl === "function") {
      return await ctx.storage.generateUploadUrl();
    }
    return null;
  },
});

// Xabarlar ro'yxatini real-time olish
export const list = query({
  args: {
    recipientId: v.optional(v.string()),
    viewerId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let messagesQuery;

    if (args.recipientId && args.recipientId !== "public") {
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

      const combined = [...list1, ...list2].filter(
        (m) =>
          (m.senderId === args.viewerId && m.recipientId === args.recipientId) ||
          (m.senderId === args.recipientId && m.recipientId === args.viewerId)
      );

      // Unique bo'yicha filter
      const seen = new Set();
      const unique = [];
      for (const m of combined) {
        if (!seen.has(m._id)) {
          seen.add(m._id);
          unique.push(m);
        }
      }
      unique.sort((a, b) => a._creationTime - b._creationTime);
      messagesQuery = unique;
    } else {
      // Umumiy guruh xabarlari
      const all = await ctx.db
        .query("messages")
        .withIndex("by_recipient", (q) => q.eq("recipientId", "public"))
        .order("desc")
        .take(150);
      messagesQuery = all.reverse();
    }

    // viewerId uchun o'chirilgan xabarlarni filtrlash
    const filtered = messagesQuery.filter((m) => {
      if (args.viewerId && Array.isArray(m.deletedFor) && m.deletedFor.includes(args.viewerId)) {
        return false;
      }
      return true;
    });

    // Storage ID larga tegishli doimiy CDN URL manzillarni aniqlash
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

// Yangi xabar yuborish (text, sticker, voice, video)
export const send = mutation({
  args: {
    author: v.string(),
    senderId: v.optional(v.string()),
    recipientId: v.optional(v.string()),
    body: v.string(),
    type: v.optional(v.string()),
    status: v.optional(v.string()),
    storageId: v.optional(v.string()),
    mediaUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const author = args.author.trim() || "Anonim";
    const body = args.body.trim();
    const type = args.type || "text";

    if (!body && !args.storageId && !args.mediaUrl) {
      throw new Error("Xabar bo'sh bo'lishi mumkin emas");
    }

    const messageId = await ctx.db.insert("messages", {
      author,
      senderId: args.senderId,
      recipientId: args.recipientId || "public",
      body,
      type,
      status: args.status || "delivered",
      isEdited: false,
      isDeletedForEveryone: false,
      deletedFor: [],
      storageId: args.storageId,
      mediaUrl: args.mediaUrl,
    });

    return messageId;
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

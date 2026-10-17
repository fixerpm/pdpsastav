import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

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

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Foydalanuvchining bildirishnomalari (so'nggi 50 ta)
export const list = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(50);

    return notifications;
  },
});

// O'qilmagan bildirishnomalar soni
export const unreadCount = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_user_unread", (q) => q.eq("userId", args.userId).eq("isRead", false))
      .collect();

    return unread.length;
  },
});

// Bildirishnomani o'qilgan deb belgilash
export const markAsRead = mutation({
  args: {
    notificationId: v.id("notifications"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const notif = await ctx.db.get(args.notificationId);
    if (notif && notif.userId === args.userId) {
      await ctx.db.patch(args.notificationId, { isRead: true });
    }
    return { success: true };
  },
});

// Barcha bildirishnomalarni o'qilgan deb belgilash
export const markAllAsRead = mutation({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_user_unread", (q) => q.eq("userId", args.userId).eq("isRead", false))
      .collect();

    for (const notif of unread) {
      await ctx.db.patch(notif._id, { isRead: true });
    }

    return { count: unread.length };
  },
});

// Bildirishnomani o'chirish
export const deleteNotification = mutation({
  args: {
    notificationId: v.id("notifications"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const notif = await ctx.db.get(args.notificationId);
    if (notif && notif.userId === args.userId) {
      await ctx.db.delete(args.notificationId);
    }
    return { success: true };
  },
});

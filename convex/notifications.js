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

// WebRTC 1-on-1 qo'ng'iroq signal bildirishnomasi
export const sendCallNotification = mutation({
  args: {
    recipientId: v.string(),
    callerId: v.string(),
    callerName: v.string(),
    callerAvatarBg: v.optional(v.string()),
    callId: v.string(),
    callType: v.string(),
    sdp: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    // Eski o'qilmagan qo'ng'iroqlarni o'qilgan deb belgilaymiz
    const oldCalls = await ctx.db
      .query("notifications")
      .withIndex("by_user_unread", (q) => q.eq("userId", args.recipientId).eq("isRead", false))
      .filter((q) => q.eq(q.field("type"), "call"))
      .collect();
    for (const old of oldCalls) {
      await ctx.db.patch(old._id, { isRead: true });
    }

    const notifId = await ctx.db.insert("notifications", {
      userId: args.recipientId,
      type: "call",
      title: `${args.callerName} dan ${args.callType === "video" ? "video" : "ovozli"} qo‘ng‘iroq`,
      body: `Kiruvchi ${args.callType === "video" ? "video" : "ovozli"} qo‘ng‘iroq...`,
      data: JSON.stringify({
        callId: args.callId,
        callerId: args.callerId,
        callerName: args.callerName,
        callerAvatarBg: args.callerAvatarBg,
        callType: args.callType,
        sdp: args.sdp,
      }),
      isRead: false,
      createdAt: new Date().toISOString(),
    });

    return { success: true, notificationId: notifId };
  },
});


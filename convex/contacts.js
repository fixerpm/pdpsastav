import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Foydalanuvchining kontaktlarini real-time olish
export const listContacts = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const contactEntries = await ctx.db
      .query("contacts")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    const contactUserIds = contactEntries.map((c) => c.contactUserId);
    if (contactUserIds.length === 0) return [];

    const allUsers = await ctx.db.query("users").collect();
    const userMap = new Map();
    for (const u of allUsers) {
      userMap.set(u.userId, u);
    }

    return contactEntries
      .map((entry) => {
        const u = userMap.get(entry.contactUserId);
        if (!u) return null;
        return {
          id: u.userId,
          contactRecordId: entry._id,
          userId: u.userId,
          username: u.username,
          displayName: entry.customNickname || u.displayName,
          realDisplayName: u.displayName,
          avatarBg: u.avatarBg,
          avatarText: u.avatarText,
          avatarUrl: u.avatarUrl,
          bio: u.bio,
          isOnline: u.isOnline,
          lastSeen: u.lastSeen,
          isBlocked: entry.isBlocked || false,
          customNickname: entry.customNickname,
          createdAt: entry.createdAt,
        };
      })
      .filter(Boolean);
  },
});

// Kontakt so'rovlarini olish (kiruvchi va chiquvchi)
export const listRequests = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const incoming = await ctx.db
      .query("contactRequests")
      .withIndex("by_toUserId", (q) => q.eq("toUserId", args.userId))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .collect();

    const outgoing = await ctx.db
      .query("contactRequests")
      .withIndex("by_fromUserId", (q) => q.eq("fromUserId", args.userId))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .collect();

    const allUsers = await ctx.db.query("users").collect();
    const userMap = new Map();
    for (const u of allUsers) {
      userMap.set(u.userId, u);
    }

    const mapWithUser = (req, targetKey) => {
      const u = userMap.get(req[targetKey]);
      return {
        id: req._id,
        status: req.status,
        createdAt: req.createdAt,
        user: u
          ? {
              id: u.userId,
              username: u.username,
              displayName: u.displayName,
              avatarBg: u.avatarBg,
              avatarText: u.avatarText,
              avatarUrl: u.avatarUrl,
              bio: u.bio,
            }
          : null,
      };
    };

    return {
      incoming: incoming.map((req) => mapWithUser(req, "fromUserId")).filter((r) => r.user),
      outgoing: outgoing.map((req) => mapWithUser(req, "toUserId")).filter((r) => r.user),
    };
  },
});

// Foydalanuvchilar o'rtasidagi kontakt holatini aniqlash
export const getContactStatus = query({
  args: {
    userId: v.string(),
    targetUserId: v.string(),
  },
  handler: async (ctx, args) => {
    if (!args.userId || !args.targetUserId) return { status: "none" };
    if (args.userId === args.targetUserId) return { status: "self" };

    const contact = await ctx.db
      .query("contacts")
      .withIndex("by_user_contact", (q) =>
        q.eq("userId", args.userId).eq("contactUserId", args.targetUserId)
      )
      .first();

    if (contact) {
      return { status: "accepted", isBlocked: Boolean(contact.isBlocked) };
    }

    const outgoing = await ctx.db
      .query("contactRequests")
      .withIndex("by_pair", (q) =>
        q.eq("fromUserId", args.userId).eq("toUserId", args.targetUserId)
      )
      .filter((q) => q.eq(q.field("status"), "pending"))
      .first();

    if (outgoing) {
      return { status: "pending_sent", requestId: outgoing._id };
    }

    const incoming = await ctx.db
      .query("contactRequests")
      .withIndex("by_pair", (q) =>
        q.eq("fromUserId", args.targetUserId).eq("toUserId", args.userId)
      )
      .filter((q) => q.eq(q.field("status"), "pending"))
      .first();

    if (incoming) {
      return { status: "pending_received", requestId: incoming._id };
    }

    const targetUser = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", args.targetUserId))
      .first();

    if (targetUser?.blockedUserIds && targetUser.blockedUserIds.includes(args.userId)) {
      return { status: "blocked" };
    }

    return { status: "none" };
  },
});

// Kontakt so'rovi yuborish
export const sendRequest = mutation({
  args: {
    fromUserId: v.string(),
    targetUsername: v.string(),
    targetUserId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const cleanUsername = args.targetUsername.trim().toLowerCase().replace(/^@+/, "");
    if (!cleanUsername && !args.targetUserId) {
      throw new Error("Foydalanuvchi nomi kiritilishi shart");
    }

    let targetUser = null;
    if (args.targetUserId) {
      targetUser = await ctx.db
        .query("users")
        .withIndex("by_userId", (q) => q.eq("userId", args.targetUserId))
        .first();
    }

    if (!targetUser) {
      targetUser = await ctx.db
        .query("users")
        .withIndex("by_username", (q) => q.eq("username", cleanUsername))
        .first();
    }

    if (!targetUser) {
      throw new Error(`@${cleanUsername} nomli foydalanuvchi topilmadi`);
    }

    if (targetUser.userId === args.fromUserId) {
      throw new Error("O'zingizga kontakt so'rovi yubora olmaysiz");
    }

    // Allaqachon kontaktda bormi?
    const existingContact = await ctx.db
      .query("contacts")
      .withIndex("by_user_contact", (q) =>
        q.eq("userId", args.fromUserId).eq("contactUserId", targetUser.userId)
      )
      .first();

    if (existingContact) {
      throw new Error(`@${targetUser.username} allaqachon kontaktingizda mavjud`);
    }

    // Bloklanganmi?
    if (targetUser.blockedUserIds && targetUser.blockedUserIds.includes(args.fromUserId)) {
      throw new Error("Bu foydalanuvchiga so'rov yuborish imkoni yo'q");
    }

    // Kutilayotgan so'rov mavjudmi?
    const existingReq = await ctx.db
      .query("contactRequests")
      .withIndex("by_pair", (q) =>
        q.eq("fromUserId", args.fromUserId).eq("toUserId", targetUser.userId)
      )
      .filter((q) => q.eq(q.field("status"), "pending"))
      .first();

    if (existingReq) {
      throw new Error("So'rov allaqachon yuborilgan");
    }

    // Qarama-qarshi so'rov bormi? Agar u allaqachon so'rov yuborgan bo'lsa, avtomatik qabul qilish
    const reverseReq = await ctx.db
      .query("contactRequests")
      .withIndex("by_pair", (q) =>
        q.eq("fromUserId", targetUser.userId).eq("toUserId", args.fromUserId)
      )
      .filter((q) => q.eq(q.field("status"), "pending"))
      .first();

    if (reverseReq) {
      // Ikki tomonlama qabul
      await ctx.db.patch(reverseReq._id, { status: "accepted", updatedAt: new Date().toISOString() });
      const now = new Date().toISOString();

      await ctx.db.insert("contacts", {
        userId: args.fromUserId,
        contactUserId: targetUser.userId,
        isBlocked: false,
        createdAt: now,
      });

      await ctx.db.insert("contacts", {
        userId: targetUser.userId,
        contactUserId: args.fromUserId,
        isBlocked: false,
        createdAt: now,
      });

      return {
        success: true,
        autoAccepted: true,
        requestId: reverseReq._id,
        message: `@${targetUser.username} allaqachon sizga so'rov yuborgan edi, so'rov avtomatik qabul qilindi!`,
      };
    }

    // Yangi so'rov yaratish
    const requestId = await ctx.db.insert("contactRequests", {
      fromUserId: args.fromUserId,
      toUserId: targetUser.userId,
      status: "pending",
      createdAt: new Date().toISOString(),
    });

    // Bildirishnoma yaratish
    const sender = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", args.fromUserId))
      .first();

    await ctx.db.insert("notifications", {
      userId: targetUser.userId,
      type: "contact_request",
      title: "Yangi kontakt so'rovi",
      body: `${sender ? sender.displayName : "Foydalanuvchi"} sizga kontakt so'rovi yubordi`,
      data: JSON.stringify({ fromUserId: args.fromUserId, requestId }),
      isRead: false,
      createdAt: new Date().toISOString(),
    });

    return { success: true, requestId, message: `@${targetUser.username} ga so'rov muvaffaqiyatli yuborildi` };
  },
});

// So'rovga javob berish (qabul qilish yoki rad etish)
export const respondRequest = mutation({
  args: {
    requestId: v.id("contactRequests"),
    action: v.string(), // "accept" | "reject" | "cancel"
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const req = await ctx.db.get(args.requestId);
    if (!req) throw new Error("So'rov topilmadi");

    if (args.action === "cancel") {
      if (req.fromUserId !== args.userId) {
        throw new Error("Faqat o'zingiz yuborgan so'rovni bekor qila olasiz");
      }
      await ctx.db.delete(args.requestId);
      return { success: true, action: "cancelled" };
    }

    if (req.toUserId !== args.userId) {
      throw new Error("Siz bu so'rovga javob berish huquqiga ega emassiz");
    }

    if (args.action === "reject") {
      await ctx.db.patch(args.requestId, {
        status: "rejected",
        updatedAt: new Date().toISOString(),
      });
      return { success: true, action: "rejected" };
    }

    if (args.action === "accept") {
      await ctx.db.patch(args.requestId, {
        status: "accepted",
        updatedAt: new Date().toISOString(),
      });

      const now = new Date().toISOString();

      // Ikkala foydalanuvchining kontakt ro'yxatiga qo'shish
      const existing1 = await ctx.db
        .query("contacts")
        .withIndex("by_user_contact", (q) =>
          q.eq("userId", req.fromUserId).eq("contactUserId", req.toUserId)
        )
        .first();

      if (!existing1) {
        await ctx.db.insert("contacts", {
          userId: req.fromUserId,
          contactUserId: req.toUserId,
          isBlocked: false,
          createdAt: now,
        });
      }

      const existing2 = await ctx.db
        .query("contacts")
        .withIndex("by_user_contact", (q) =>
          q.eq("userId", req.toUserId).eq("contactUserId", req.fromUserId)
        )
        .first();

      if (!existing2) {
        await ctx.db.insert("contacts", {
          userId: req.toUserId,
          contactUserId: req.fromUserId,
          isBlocked: false,
          createdAt: now,
        });
      }

      // So'rov jo'natuvchisiga bildirishnoma
      const accepter = await ctx.db
        .query("users")
        .withIndex("by_userId", (q) => q.eq("userId", req.toUserId))
        .first();

      await ctx.db.insert("notifications", {
        userId: req.fromUserId,
        type: "contact_accepted",
        title: "Kontakt qabul qilindi",
        body: `${accepter ? accepter.displayName : "Foydalanuvchi"} sizning so'rovingizni qabul qildi`,
        data: JSON.stringify({ userId: req.toUserId }),
        isRead: false,
        createdAt: now,
      });

      return { success: true, action: "accepted" };
    }

    throw new Error("Noto'g'ri amal");
  },
});

// Kontakt uchun shaxsiy laqab (nickname) belgilash
export const setNickname = mutation({
  args: {
    userId: v.string(),
    contactUserId: v.string(),
    nickname: v.string(),
  },
  handler: async (ctx, args) => {
    const contact = await ctx.db
      .query("contacts")
      .withIndex("by_user_contact", (q) =>
        q.eq("userId", args.userId).eq("contactUserId", args.contactUserId)
      )
      .first();

    if (!contact) throw new Error("Kontakt topilmadi");

    await ctx.db.patch(contact._id, {
      customNickname: args.nickname.trim() || undefined,
    });

    return { success: true };
  },
});

// Kontaktni o'chirish
export const removeContact = mutation({
  args: {
    userId: v.string(),
    contactUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const c1 = await ctx.db
      .query("contacts")
      .withIndex("by_user_contact", (q) =>
        q.eq("userId", args.userId).eq("contactUserId", args.contactUserId)
      )
      .first();

    if (c1) await ctx.db.delete(c1._id);

    return { success: true };
  },
});

// Foydalanuvchini bloklash / blokdan chiqarish
export const toggleBlock = mutation({
  args: {
    userId: v.string(),
    targetUserId: v.string(),
    shouldBlock: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    if (!user) throw new Error("Foydalanuvchi topilmadi");

    const blocked = new Set(user.blockedUserIds || []);
    if (args.shouldBlock) {
      blocked.add(args.targetUserId);
    } else {
      blocked.delete(args.targetUserId);
    }

    await ctx.db.patch(user._id, {
      blockedUserIds: Array.from(blocked),
    });

    // Kontaktdagi statusni ham yangilash
    const contact = await ctx.db
      .query("contacts")
      .withIndex("by_user_contact", (q) =>
        q.eq("userId", args.userId).eq("contactUserId", args.targetUserId)
      )
      .first();

    if (contact) {
      await ctx.db.patch(contact._id, {
        isBlocked: args.shouldBlock,
      });
    }

    return { success: true, isBlocked: args.shouldBlock };
  },
});

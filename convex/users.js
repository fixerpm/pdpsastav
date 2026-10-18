import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { hashPassword, verifyPassword } from "./lib/crypto";

const AVATAR_COLORS = [
  "from-cyan-500 to-blue-600",
  "from-emerald-500 to-teal-600",
  "from-violet-500 to-purple-600",
  "from-rose-500 to-pink-600",
  "from-amber-500 to-orange-600",
  "from-indigo-500 to-blue-700",
];

// Foydalanuvchilar ro'yxatini olish
export const list = query({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    return users.map((u) => ({
      id: u.userId,
      username: u.username,
      displayName: u.displayName,
      avatarBg: u.avatarBg,
      avatarText: u.avatarText,
      avatarUrl: u.avatarUrl,
      bio: u.bio,
      isOnline: u.isOnline,
      lastSeen: u.lastSeen,
    }));
  },
});

// Foydalanuvchini @username yoki ism bo'yicha qidirish
export const search = query({
  args: {
    searchQuery: v.string(),
    viewerId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const q = args.searchQuery.trim().toLowerCase().replace(/^@+/, "");
    if (!q) return [];

    let contactsSet = new Set();
    let outgoingReqMap = new Map();
    let incomingReqMap = new Map();

    if (args.viewerId) {
      const contacts = await ctx.db
        .query("contacts")
        .withIndex("by_userId", (q) => q.eq("userId", args.viewerId))
        .collect();
      contactsSet = new Set(contacts.map((c) => c.contactUserId));

      const outgoing = await ctx.db
        .query("contactRequests")
        .withIndex("by_fromUserId", (q) => q.eq("fromUserId", args.viewerId))
        .filter((q) => q.eq(q.field("status"), "pending"))
        .collect();
      for (const o of outgoing) outgoingReqMap.set(o.toUserId, o._id);

      const incoming = await ctx.db
        .query("contactRequests")
        .withIndex("by_toUserId", (q) => q.eq("toUserId", args.viewerId))
        .filter((q) => q.eq(q.field("status"), "pending"))
        .collect();
      for (const inc of incoming) incomingReqMap.set(inc.fromUserId, inc._id);
    }

    const allUsers = await ctx.db.query("users").collect();
    const results = allUsers
      .filter((u) => {
        if (args.viewerId && u.userId === args.viewerId) return false;
        const matchesUsername = u.username.toLowerCase().includes(q);
        const matchesName = u.displayName.toLowerCase().includes(q);
        return matchesUsername || matchesName;
      })
      .slice(0, 20)
      .map((u) => {
        let contactStatus = "none";
        let requestId = undefined;

        if (contactsSet.has(u.userId)) {
          contactStatus = "accepted";
        } else if (outgoingReqMap.has(u.userId)) {
          contactStatus = "pending_sent";
          requestId = outgoingReqMap.get(u.userId);
        } else if (incomingReqMap.has(u.userId)) {
          contactStatus = "pending_received";
          requestId = incomingReqMap.get(u.userId);
        }

        return {
          id: u.userId,
          username: u.username,
          displayName: u.displayName,
          avatarBg: u.avatarBg,
          avatarText: u.avatarText,
          avatarUrl: u.avatarUrl,
          bio: u.bio,
          isOnline: u.isOnline,
          lastSeen: u.privacySettings?.showLastSeen === "nobody" ? null : u.lastSeen,
          contactStatus,
          requestId,
        };
      });

    return results;
  },
});

// Profil ma'lumotlarini olish (maxfiylik qoidalari bilan)
export const getProfile = query({
  args: {
    userId: v.string(),
    viewerId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    if (!user) return null;

    const isSelf = args.viewerId === user.userId;
    const privacy = user.privacySettings || { whoCanCall: "everyone", showLastSeen: "everyone" };

    return {
      id: user.userId,
      username: user.username,
      displayName: user.displayName,
      avatarBg: user.avatarBg,
      avatarText: user.avatarText,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      email: isSelf ? user.email : undefined,
      phone: isSelf ? user.phone : undefined,
      isOnline: user.isOnline,
      lastSeen: privacy.showLastSeen === "nobody" && !isSelf ? null : user.lastSeen,
      privacySettings: isSelf ? privacy : undefined,
      blockedUserIds: isSelf ? user.blockedUserIds || [] : undefined,
    };
  },
});

// Yangi foydalanuvchini ro'yxatdan o'tkazish (To'liq Auth)
export const register = mutation({
  args: {
    username: v.string(),
    displayName: v.string(),
    password: v.string(),
    bio: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const cleanUsername = args.username.trim().toLowerCase().replace(/^@/, "");
    if (!cleanUsername || cleanUsername.length < 3) {
      throw new Error("Username kamida 3 ta belgidan iborat bo‘lishi kerak");
    }
    if (!/^[a-zA-Z0-9_]+$/.test(cleanUsername)) {
      throw new Error("Username faqat harflar, raqamlar va pastki chiziqdan iborat bo‘lishi mumkin");
    }
    if (!args.password || args.password.length < 4) {
      throw new Error("Parol kamida 4 ta belgidan iborat bo‘lishi kerak");
    }

    const existing = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", cleanUsername))
      .first();

    if (existing) {
      throw new Error(`@${cleanUsername} allaqachon ro'yxatdan o'tgan. Iltimos boshqa username tanlang.`);
    }

    const name = args.displayName.trim() || cleanUsername;
    const initials = name
      .split(" ")
      .map((p) => p[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

    const userId = "user-" + Math.random().toString(36).slice(2, 11);
    const passwordHash = await hashPassword(args.password);

    const newUser = {
      userId,
      username: cleanUsername,
      displayName: name,
      avatarBg: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
      avatarText: initials || cleanUsername.slice(0, 2).toUpperCase(),
      avatarUrl: args.avatarUrl,
      bio: args.bio || "",
      passwordHash,
      email: args.email,
      phone: args.phone,
      isOnline: true,
      lastSeen: new Date().toISOString(),
      blockedUserIds: [],
      privacySettings: {
        whoCanCall: "everyone",
        showLastSeen: "everyone",
      },
      createdAt: new Date().toISOString(),
    };

    await ctx.db.insert("users", newUser);

    return {
      success: true,
      user: {
        id: userId,
        userId: userId,
        username: cleanUsername,
        displayName: name,
        avatarBg: newUser.avatarBg,
        avatarText: newUser.avatarText,
        avatarUrl: newUser.avatarUrl,
        bio: newUser.bio,
        isOnline: true,
        lastSeen: newUser.lastSeen,
      },
    };
  },
});

// Foydalanuvchi tizimga kirishi (Login)
export const login = mutation({
  args: {
    username: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const cleanUsername = args.username.trim().toLowerCase().replace(/^@/, "");
    const user = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", cleanUsername))
      .first();

    if (!user) {
      throw new Error("Bunday foydalanuvchi topilmadi. Username yoki parolni tekshiring.");
    }

    if (user.passwordHash) {
      const isValid = await verifyPassword(args.password, user.passwordHash);
      if (!isValid) {
        throw new Error("Kiritilgan parol noto‘g‘ri");
      }
    }

    await ctx.db.patch(user._id, {
      isOnline: true,
      lastSeen: new Date().toISOString(),
    });

    return {
      success: true,
      user: {
        id: user.userId,
        userId: user.userId,
        username: user.username,
        displayName: user.displayName,
        avatarBg: user.avatarBg,
        avatarText: user.avatarText,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        isOnline: true,
        lastSeen: user.lastSeen,
      },
    };
  },
});

// Haqiqiy sessiyani tasdiqlash va foydalanuvchi ma'lumotlarini olish
export const validateSession = query({
  args: {
    userId: v.optional(v.string()),
    username: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let user = null;
    if (args.userId) {
      user = await ctx.db
        .query("users")
        .withIndex("by_userId", (q) => q.eq("userId", args.userId))
        .first();
    }
    if (!user && args.username) {
      const cleanUsername = args.username.trim().toLowerCase().replace(/^@/, "");
      user = await ctx.db
        .query("users")
        .withIndex("by_username", (q) => q.eq("username", cleanUsername))
        .first();
    }

    if (!user) return null;

    return {
      id: user.userId,
      userId: user.userId,
      username: user.username,
      displayName: user.displayName,
      avatarBg: user.avatarBg,
      avatarText: user.avatarText,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      isOnline: user.isOnline,
      lastSeen: user.lastSeen,
      privacySettings: user.privacySettings,
      hasPassword: Boolean(user.passwordHash),
    };
  },
});

// Eski va sodda autentifikatsiya metodi (faqat yangi anonim / mehmonga ruxsat, parollangan akkauntni o'g'irlashni to'sadi)
export const authenticate = mutation({
  args: {
    username: v.string(),
    displayName: v.string(),
  },
  handler: async (ctx, args) => {
    const cleanUsername = args.username.trim().toLowerCase().replace(/^@/, "");
    const existing = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", cleanUsername))
      .first();

    if (existing && existing.passwordHash) {
      throw new Error("Ushbu akkaunt parollangan. Iltimos, parolingiz bilan tizimga kiring.");
    }

    if (!existing) {
      const name = args.displayName?.trim() || cleanUsername;
      const initials = name
        .split(" ")
        .map((p) => p[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);

      const userId = "user-" + Math.random().toString(36).slice(2, 10);
      const user = {
        userId,
        username: cleanUsername,
        displayName: name,
        avatarBg: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
        avatarText: initials || cleanUsername.slice(0, 2).toUpperCase(),
        isOnline: true,
        lastSeen: new Date().toISOString(),
        blockedUserIds: [],
        createdAt: new Date().toISOString(),
      };

      await ctx.db.insert("users", user);
      return { user: { ...user, id: userId } };
    }

    await ctx.db.patch(existing._id, {
      isOnline: true,
      lastSeen: new Date().toISOString(),
      ...(args.displayName && args.displayName.trim() !== existing.displayName
        ? { displayName: args.displayName.trim() }
        : {}),
    });

    return {
      user: {
        id: existing.userId,
        username: existing.username,
        displayName: args.displayName?.trim() || existing.displayName,
        avatarBg: existing.avatarBg,
        avatarText: existing.avatarText,
        avatarUrl: existing.avatarUrl,
        isOnline: true,
        lastSeen: existing.lastSeen,
      },
    };
  },
});

// Profil ma'lumotlarini yangilash
export const updateProfile = mutation({
  args: {
    userId: v.string(),
    displayName: v.optional(v.string()),
    bio: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    avatarBg: v.optional(v.string()),
    privacySettings: v.optional(
      v.object({
        whoCanCall: v.optional(v.string()),
        showLastSeen: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    if (!user) throw new Error("Foydalanuvchi topilmadi");

    const patchData = {};
    if (args.displayName) {
      patchData.displayName = args.displayName.trim();
      patchData.avatarText = args.displayName
        .trim()
        .split(" ")
        .map((p) => p[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    if (args.bio !== undefined) patchData.bio = args.bio.trim();
    if (args.avatarUrl !== undefined) patchData.avatarUrl = args.avatarUrl;
    if (args.avatarBg !== undefined) patchData.avatarBg = args.avatarBg;
    if (args.privacySettings) {
      patchData.privacySettings = {
        ...(user.privacySettings || {}),
        ...args.privacySettings,
      };
    }

    await ctx.db.patch(user._id, patchData);
    return { success: true };
  },
});

// Onlayn holatini yangilash / Logout
export const setOnlineStatus = mutation({
  args: {
    userId: v.string(),
    isOnline: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    if (user) {
      await ctx.db.patch(user._id, {
        isOnline: args.isOnline,
        lastSeen: new Date().toISOString(),
      });
    }
    return { success: true };
  },
});

// Parolni o'zgartirish
export const changePassword = mutation({
  args: {
    userId: v.string(),
    oldPassword: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    if (!user) throw new Error("Foydalanuvchi topilmadi");

    if (user.passwordHash) {
      const isValid = await verifyPassword(args.oldPassword, user.passwordHash);
      if (!isValid) throw new Error("Eski parol noto‘g‘ri kiritildi");
    }

    if (!args.newPassword || args.newPassword.length < 4) {
      throw new Error("Yangi parol kamida 4 belgidan iborat bo‘lishi lozim");
    }

    const newHash = await hashPassword(args.newPassword);
    await ctx.db.patch(user._id, { passwordHash: newHash });

    return { success: true };
  },
});

// Akkauntni butunlay o'chirish
export const deleteAccount = mutation({
  args: {
    userId: v.string(),
    password: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    if (!user) throw new Error("Foydalanuvchi topilmadi");

    if (user.passwordHash && args.password) {
      const isValid = await verifyPassword(args.password, user.passwordHash);
      if (!isValid) throw new Error("Parol noto‘g‘ri kiritildi");
    }

    // Foydalanuvchiga tegishli kontaktlar va suhbatlarni tozalash
    const contacts = await ctx.db
      .query("contacts")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    for (const c of contacts) {
      await ctx.db.delete(c._id);
    }

    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    for (const conv of conversations) {
      await ctx.db.delete(conv._id);
    }

    // Oxirida user yozuvini o'chirish
    await ctx.db.delete(user._id);

    return { success: true };
  },
});

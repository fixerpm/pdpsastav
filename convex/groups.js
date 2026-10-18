import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Foydalanuvchi a'zo bo'lgan guruhlar ro'yxatini olish
export const listGroups = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const allGroups = await ctx.db.query("groups").collect();
    return allGroups.filter(
      (g) => g.memberIds.includes(args.userId) || g.ownerId === args.userId
    );
  },
});

// Guruh ma'lumotlarini to'liq olish (a'zolari va rollari bilan)
export const getGroup = query({
  args: {
    groupId: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const group = await ctx.db
      .query("groups")
      .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
      .first();

    if (!group) return null;

    const isMember = group.memberIds.includes(args.userId) || group.ownerId === args.userId;
    if (!isMember) {
      throw new Error("Siz bu guruh a'zosi emassiz");
    }

    const allUsers = await ctx.db.query("users").collect();
    const userMapByUserId = new Map();
    const userMapByUsername = new Map();
    for (const u of allUsers) {
      userMapByUserId.set(u.userId, u);
      if (u.username) userMapByUsername.set(u.username.toLowerCase(), u);
    }

    // Guruh egasini aniqlash (userId yoki username orqali)
    const ownerUser =
      userMapByUserId.get(group.ownerId) ||
      userMapByUsername.get(group.ownerId.toLowerCase());

    const members = group.memberIds.map((mId) => {
      const u = userMapByUserId.get(mId) || userMapByUsername.get(mId.toLowerCase());
      const isOwner = group.ownerId === mId || (ownerUser && u && u.userId === ownerUser.userId);
      const isAdmin = group.adminIds.includes(mId) || isOwner;
      return {
        userId: u ? u.userId : mId,
        displayName: u ? u.displayName : (isOwner && ownerUser ? ownerUser.displayName : "Noma'lum foydalanuvchi"),
        username: u ? u.username : (isOwner && ownerUser ? ownerUser.username : ""),
        avatarBg: u ? u.avatarBg : "from-cyan-500 to-blue-600",
        avatarText: u ? u.avatarText : (isOwner ? "👑" : "?"),
        avatarUrl: u ? u.avatarUrl : null,
        isOnline: u ? u.isOnline : false,
        role: isOwner ? "owner" : isAdmin ? "admin" : "member",
      };
    });

    // Guruh egasi har doim a'zolar ro'yxatida ko'rinishini ta'minlash
    if (ownerUser && !members.some((m) => m.userId === ownerUser.userId)) {
      members.unshift({
        userId: ownerUser.userId,
        displayName: ownerUser.displayName,
        username: ownerUser.username,
        avatarBg: ownerUser.avatarBg,
        avatarText: ownerUser.avatarText,
        avatarUrl: ownerUser.avatarUrl,
        isOnline: ownerUser.isOnline,
        role: "owner",
      });
    }

    return {
      ...group,
      members,
      owner: ownerUser
        ? {
            userId: ownerUser.userId,
            displayName: ownerUser.displayName,
            username: ownerUser.username,
            avatarBg: ownerUser.avatarBg,
            avatarText: ownerUser.avatarText,
            avatarUrl: ownerUser.avatarUrl,
          }
        : null,
      isOwner: group.ownerId === args.userId || (ownerUser && ownerUser.userId === args.userId),
      isAdmin: group.adminIds.includes(args.userId) || (ownerUser && ownerUser.userId === args.userId),
    };
  },
});

// Yangi guruh yaratish
export const createGroup = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    ownerId: v.string(),
    memberUserIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const name = args.name.trim();
    if (!name) throw new Error("Guruh nomi kiritilishi shart");

    // Guruh egasini haqiqiy autentifikatsiyadan olingan user yozuvidan tekshirish
    let owner = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", args.ownerId))
      .first();

    if (!owner) {
      owner = await ctx.db
        .query("users")
        .withIndex("by_username", (q) => q.eq("username", args.ownerId.toLowerCase().replace(/^@+/, "")))
        .first();
    }

    const actualOwnerId = owner ? owner.userId : args.ownerId;
    const groupId = "group-" + Math.random().toString(36).slice(2, 10);
    const inviteCode = Math.random().toString(36).slice(2, 8).toUpperCase();

    const uniqueMembers = Array.from(new Set([actualOwnerId, ...args.memberUserIds]));

    const colors = [
      "from-cyan-500 to-blue-600",
      "from-emerald-500 to-teal-600",
      "from-violet-500 to-purple-600",
      "from-amber-500 to-orange-600",
      "from-rose-500 to-pink-600",
    ];

    const newGroup = {
      groupId,
      name,
      description: args.description?.trim() || "",
      avatarUrl: undefined,
      avatarBg: colors[Math.floor(Math.random() * colors.length)],
      ownerId: actualOwnerId,
      adminIds: [actualOwnerId],
      memberIds: uniqueMembers,
      inviteCode,
      isPrivate: false,
      createdAt: new Date().toISOString(),
    };

    await ctx.db.insert("groups", newGroup);

    // Guruhga yangi a'zolik haqida tizim xabari
    await ctx.db.insert("messages", {
      author: "Tizim",
      senderId: actualOwnerId,
      groupId,
      body: `"${name}" guruhi ${owner ? owner.displayName : "Admin"} tomonidan yaratildi.`,
      type: "text",
      status: "delivered",
      isEdited: false,
      isDeletedForEveryone: false,
      deletedFor: [],
    });

    // Taklif qilingan har bir a'zoga bildirishnoma
    for (const mId of uniqueMembers) {
      if (mId !== actualOwnerId) {
        await ctx.db.insert("notifications", {
          userId: mId,
          type: "group_invite",
          title: "Yangi guruh",
          body: `Siz "${name}" guruhiga qo'shildingiz`,
          data: JSON.stringify({ groupId }),
          isRead: false,
          createdAt: new Date().toISOString(),
        });
      }
    }

    return { groupId, inviteCode, ownerId: actualOwnerId };
  },
});

// Taklif kodi orqali guruhga qo'shilish
export const joinByInviteCode = mutation({
  args: {
    inviteCode: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const code = args.inviteCode.trim().toUpperCase();
    const group = await ctx.db
      .query("groups")
      .withIndex("by_inviteCode", (q) => q.eq("inviteCode", code))
      .first();

    if (!group) throw new Error("Yaroqsiz taklif kodi");

    if (group.memberIds.includes(args.userId)) {
      return { success: true, groupId: group.groupId, alreadyMember: true };
    }

    const updatedMembers = [...group.memberIds, args.userId];
    await ctx.db.patch(group._id, {
      memberIds: updatedMembers,
      updatedAt: new Date().toISOString(),
    });

    const user = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    await ctx.db.insert("messages", {
      author: "Tizim",
      senderId: args.userId,
      groupId: group.groupId,
      body: `${user ? user.displayName : "Yangi a'zo"} taklif havolasi orqali guruhga qo'shildi`,
      type: "text",
      status: "delivered",
      isEdited: false,
      isDeletedForEveryone: false,
      deletedFor: [],
    });

    return { success: true, groupId: group.groupId };
  },
});

// Yangi a'zoni qo'shish (admin ruxsati bilan)
export const addMember = mutation({
  args: {
    groupId: v.string(),
    adminUserId: v.string(),
    targetUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const group = await ctx.db
      .query("groups")
      .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
      .first();

    if (!group) throw new Error("Guruh topilmadi");

    if (!group.adminIds.includes(args.adminUserId)) {
      throw new Error("Faqat guruh adminlari a'zo qo'sha oladi");
    }

    if (group.memberIds.includes(args.targetUserId)) {
      throw new Error("Foydalanuvchi allaqachon ushbu guruh a'zosi");
    }

    await ctx.db.patch(group._id, {
      memberIds: [...group.memberIds, args.targetUserId],
      updatedAt: new Date().toISOString(),
    });

    const user = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", args.targetUserId))
      .first();

    await ctx.db.insert("messages", {
      author: "Tizim",
      senderId: args.adminUserId,
      groupId: group.groupId,
      body: `${user ? user.displayName : "Foydalanuvchi"} guruhga qo'shildi`,
      type: "text",
      status: "delivered",
      isEdited: false,
      isDeletedForEveryone: false,
      deletedFor: [],
    });

    return { success: true };
  },
});

// A'zoni guruhdan chiqarish yoki o'zi chiqishi
export const removeMember = mutation({
  args: {
    groupId: v.string(),
    requesterId: v.string(),
    targetUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const group = await ctx.db
      .query("groups")
      .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
      .first();

    if (!group) throw new Error("Guruh topilmadi");

    const isSelf = args.requesterId === args.targetUserId;
    const isAdmin = group.adminIds.includes(args.requesterId);

    if (!isSelf && !isAdmin) {
      throw new Error("A'zoni chiqarish uchun admin ruxsati kerak");
    }

    if (args.targetUserId === group.ownerId && !isSelf) {
      throw new Error("Guruh egasini chiqarib bo'lmaydi");
    }

    let newOwnerId = group.ownerId;
    let newAdminIds = group.adminIds.filter((id) => id !== args.targetUserId);
    const newMemberIds = group.memberIds.filter((id) => id !== args.targetUserId);

    // Agar guruh egasi chiqib ketsa, keyingi adminga yoki a'zoga egalikni o'tkazish
    if (isSelf && args.targetUserId === group.ownerId && newMemberIds.length > 0) {
      newOwnerId = newAdminIds[0] || newMemberIds[0];
      if (!newAdminIds.includes(newOwnerId)) {
        newAdminIds.push(newOwnerId);
      }
    }

    await ctx.db.patch(group._id, {
      ownerId: newOwnerId,
      adminIds: newAdminIds,
      memberIds: newMemberIds,
      updatedAt: new Date().toISOString(),
    });

    const user = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", args.targetUserId))
      .first();

    await ctx.db.insert("messages", {
      author: "Tizim",
      senderId: args.requesterId,
      groupId: group.groupId,
      body: isSelf
        ? `${user ? user.displayName : "A'zo"} guruhni tark etdi`
        : `${user ? user.displayName : "A'zo"} guruhdan chiqarildi`,
      type: "text",
      status: "delivered",
      isEdited: false,
      isDeletedForEveryone: false,
      deletedFor: [],
    });

    return { success: true };
  },
});

// Adminlik maqomini berish yoki bekor qilish (Faqat guruh egasi)
export const setAdminRole = mutation({
  args: {
    groupId: v.string(),
    ownerId: v.string(),
    targetUserId: v.string(),
    shouldBeAdmin: v.boolean(),
  },
  handler: async (ctx, args) => {
    const group = await ctx.db
      .query("groups")
      .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
      .first();

    if (!group) throw new Error("Guruh topilmadi");

    if (group.ownerId !== args.ownerId) {
      throw new Error("Faqat guruh egasi adminlarni tayinlashi mumkin");
    }

    const currentAdmins = new Set(group.adminIds);
    if (args.shouldBeAdmin) {
      currentAdmins.add(args.targetUserId);
    } else {
      if (args.targetUserId !== group.ownerId) {
        currentAdmins.delete(args.targetUserId);
      }
    }

    await ctx.db.patch(group._id, {
      adminIds: Array.from(currentAdmins),
      updatedAt: new Date().toISOString(),
    });

    return { success: true };
  },
});

// Guruh ma'lumotlarini (nom, tavsif, avatar) tahrirlash
export const updateGroup = mutation({
  args: {
    groupId: v.string(),
    adminUserId: v.string(),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const group = await ctx.db
      .query("groups")
      .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
      .first();

    if (!group) throw new Error("Guruh topilmadi");

    if (!group.adminIds.includes(args.adminUserId)) {
      throw new Error("Faqat guruh adminlari ma'lumotlarni o'zgartira oladi");
    }

    const patchData = { updatedAt: new Date().toISOString() };
    if (args.name) patchData.name = args.name.trim();
    if (args.description !== undefined) patchData.description = args.description.trim();
    if (args.avatarUrl !== undefined) patchData.avatarUrl = args.avatarUrl;

    await ctx.db.patch(group._id, patchData);
    return { success: true };
  },
});

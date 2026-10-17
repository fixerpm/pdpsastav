import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

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
      isOnline: u.isOnline,
      lastSeen: u.lastSeen,
    }));
  },
});

// Foydalanuvchini ro'yxatdan o'tkazish yoki kirish
export const authenticate = mutation({
  args: {
    username: v.string(),
    displayName: v.string(),
  },
  handler: async (ctx, args) => {
    const cleanUsername = args.username.trim().toLowerCase();
    const existing = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", cleanUsername))
      .first();

    const colors = [
      "from-blue-500 to-indigo-600",
      "from-emerald-500 to-teal-600",
      "from-violet-500 to-purple-600",
      "from-rose-500 to-pink-600",
      "from-amber-500 to-orange-600",
      "from-cyan-500 to-blue-600",
    ];

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
        avatarBg: colors[Math.floor(Math.random() * colors.length)],
        avatarText: initials || cleanUsername.slice(0, 2).toUpperCase(),
        isOnline: true,
        lastSeen: new Date().toISOString(),
      };

      await ctx.db.insert("users", user);
      return { user: { ...user, id: userId } };
    }

    if (args.displayName && args.displayName.trim() !== existing.displayName) {
      await ctx.db.patch(existing._id, {
        displayName: args.displayName.trim(),
        isOnline: true,
        lastSeen: new Date().toISOString(),
      });
      existing.displayName = args.displayName.trim();
    } else {
      await ctx.db.patch(existing._id, {
        isOnline: true,
        lastSeen: new Date().toISOString(),
      });
    }

    return {
      user: {
        id: existing.userId,
        username: existing.username,
        displayName: existing.displayName,
        avatarBg: existing.avatarBg,
        avatarText: existing.avatarText,
        isOnline: true,
        lastSeen: existing.lastSeen,
      },
    };
  },
});

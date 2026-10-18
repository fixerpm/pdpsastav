import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Uchrashuv ma'lumotlarini olish (real-time ishtirokchilar va holat)
export const getMeeting = query({
  args: {
    meetingId: v.string(),
  },
  handler: async (ctx, args) => {
    const meeting = await ctx.db
      .query("meetings")
      .withIndex("by_meetingId", (q) => q.eq("meetingId", args.meetingId))
      .first();

    return meeting;
  },
});

// Guruh uchun faol uchrashuvni tekshirish
export const getActiveGroupMeeting = query({
  args: {
    groupId: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const group = await ctx.db
      .query("groups")
      .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
      .first();

    if (!group || !group.memberIds.includes(args.userId)) {
      return null;
    }

    const activeMeetings = await ctx.db
      .query("meetings")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();

    return activeMeetings.find((m) => m.groupId === args.groupId) || null;
  },
});

// Yangi uchrashuv yaratish (Google Meet uslubida)
export const createMeeting = mutation({
  args: {
    title: v.string(),
    hostUserId: v.string(),
    hostName: v.string(),
    groupId: v.optional(v.string()),
    isAudioOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Agar guruhga tegishli bo'lsa, guruh a'zoligi va mavjud faol uchrashuvni tekshirish
    if (args.groupId) {
      const group = await ctx.db
        .query("groups")
        .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
        .first();

      if (!group) {
        throw new Error("Guruh topilmadi");
      }

      const isMember = group.memberIds.includes(args.hostUserId) || group.ownerId === args.hostUserId;
      if (!isMember) {
        throw new Error("Faqat guruh a'zolari ushbu guruh uchun uchrashuv yarata oladi");
      }

      // Takroriy uchrashuv yaratishning oldini olish:
      const activeMeetings = await ctx.db
        .query("meetings")
        .withIndex("by_status", (q) => q.eq("status", "active"))
        .collect();

      const existingActive = activeMeetings.find((m) => m.groupId === args.groupId);
      if (existingActive) {
        return {
          meetingId: existingActive.meetingId,
          title: existingActive.title,
          alreadyActive: true,
        };
      }
    }

    const rawCode = Math.random().toString(36).slice(2, 5) + "-" + Math.random().toString(36).slice(2, 6);
    const meetingId = `pdp-${rawCode}`;

    const hostParticipant = {
      userId: args.hostUserId,
      displayName: args.hostName,
      avatarUrl: undefined,
      isMuted: false,
      isVideoOff: args.isAudioOnly || false,
      isScreenSharing: false,
      joinedAt: new Date().toISOString(),
    };

    const newMeeting = {
      meetingId,
      title: args.title.trim() || `PDP Uchrashuv (${meetingId})`,
      hostUserId: args.hostUserId,
      hostName: args.hostName,
      groupId: args.groupId,
      status: "active",
      isAudioOnly: args.isAudioOnly || false,
      participants: [hostParticipant],
      createdAt: new Date().toISOString(),
    };

    await ctx.db.insert("meetings", newMeeting);

    return { meetingId, title: newMeeting.title };
  },
});

// Uchrashuvga qo'shilish
export const joinMeeting = mutation({
  args: {
    meetingId: v.string(),
    userId: v.string(),
    displayName: v.string(),
    avatarUrl: v.optional(v.string()),
    isAudioOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const meeting = await ctx.db
      .query("meetings")
      .withIndex("by_meetingId", (q) => q.eq("meetingId", args.meetingId))
      .first();

    if (!meeting) throw new Error("Uchrashuv topilmadi yoki yakunlangan");
    if (meeting.status === "ended") throw new Error("Bu uchrashuv yakunlangan");

    // Agar yopiq guruh uchrashuvi bo'lsa, a'zolikni tekshirish
    if (meeting.groupId) {
      const group = await ctx.db
        .query("groups")
        .withIndex("by_groupId", (q) => q.eq("groupId", meeting.groupId))
        .first();

      if (group) {
        const isMember = group.memberIds.includes(args.userId) || group.ownerId === args.userId;
        if (!isMember) {
          throw new Error("Siz ushbu guruh a'zosi emassiz. Yopiq uchrashuvga kirish taqiqlangan.");
        }
      }
    }

    const currentParticipants = [...meeting.participants];
    const existingIndex = currentParticipants.findIndex((p) => p.userId === args.userId);

    const participantData = {
      userId: args.userId,
      displayName: args.displayName,
      avatarUrl: args.avatarUrl,
      isMuted: false,
      isVideoOff: args.isAudioOnly || false,
      isScreenSharing: false,
      joinedAt: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      currentParticipants[existingIndex] = {
        ...currentParticipants[existingIndex],
        ...participantData,
      };
    } else {
      currentParticipants.push(participantData);
    }

    await ctx.db.patch(meeting._id, {
      participants: currentParticipants,
    });

    return { success: true, meeting };
  },
});

// Ishtirokchining media holatini yangilash (mute, video off, screen sharing)
export const updateMediaState = mutation({
  args: {
    meetingId: v.string(),
    userId: v.string(),
    isMuted: v.optional(v.boolean()),
    isVideoOff: v.optional(v.boolean()),
    isScreenSharing: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const meeting = await ctx.db
      .query("meetings")
      .withIndex("by_meetingId", (q) => q.eq("meetingId", args.meetingId))
      .first();

    if (!meeting || meeting.status === "ended") return { success: false };

    const updated = meeting.participants.map((p) => {
      if (p.userId === args.userId) {
        return {
          ...p,
          ...(args.isMuted !== undefined ? { isMuted: args.isMuted } : {}),
          ...(args.isVideoOff !== undefined ? { isVideoOff: args.isVideoOff } : {}),
          ...(args.isScreenSharing !== undefined ? { isScreenSharing: args.isScreenSharing } : {}),
        };
      }
      return p;
    });

    await ctx.db.patch(meeting._id, {
      participants: updated,
    });

    return { success: true };
  },
});

// Uchrashuvdan chiqish
export const leaveMeeting = mutation({
  args: {
    meetingId: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const meeting = await ctx.db
      .query("meetings")
      .withIndex("by_meetingId", (q) => q.eq("meetingId", args.meetingId))
      .first();

    if (!meeting) return { success: true };

    const updated = meeting.participants.filter((p) => p.userId !== args.userId);
    const patchData = { participants: updated };

    // Agar barcha chiqib ketsa yoki host chiqsa
    if (updated.length === 0) {
      patchData.status = "ended";
      patchData.endedAt = new Date().toISOString();
    }

    await ctx.db.patch(meeting._id, patchData);
    return { success: true };
  },
});

// Uchrashuvni tashkilotchi tomonidan yakunlash
export const endMeeting = mutation({
  args: {
    meetingId: v.string(),
    hostUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const meeting = await ctx.db
      .query("meetings")
      .withIndex("by_meetingId", (q) => q.eq("meetingId", args.meetingId))
      .first();

    if (!meeting) throw new Error("Uchrashuv topilmadi");
    if (meeting.hostUserId !== args.hostUserId) {
      throw new Error("Faqat tashkilotchi uchrashuvni barcha uchun yakunlashi mumkin");
    }

    await ctx.db.patch(meeting._id, {
      status: "ended",
      participants: [],
      endedAt: new Date().toISOString(),
    });

    return { success: true };
  },
});

// WebRTC signal yuborish (mesh call / multi-peer conference)
export const sendSignal = mutation({
  args: {
    meetingId: v.string(),
    senderId: v.string(),
    targetId: v.string(),
    type: v.string(),
    payload: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("meetingSignals", {
      meetingId: args.meetingId,
      senderId: args.senderId,
      targetId: args.targetId,
      type: args.type,
      payload: args.payload,
      timestamp: Date.now(),
    });

    return { success: true };
  },
});

// Kiruvchi signallarni olish
export const getSignals = query({
  args: {
    meetingId: v.string(),
    targetId: v.string(),
    sinceTimestamp: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const since = args.sinceTimestamp || 0;
    const signals = await ctx.db
      .query("meetingSignals")
      .withIndex("by_meeting_target", (q) =>
        q.eq("meetingId", args.meetingId).eq("targetId", args.targetId)
      )
      .filter((q) => q.gt(q.field("timestamp"), since))
      .collect();

    return signals;
  },
});

// Signallarni tozalash (qo'ng'iroq / uchrashuv tugaganda)
export const clearSignals = mutation({
  args: {
    meetingId: v.string(),
  },
  handler: async (ctx, args) => {
    const signals = await ctx.db
      .query("meetingSignals")
      .withIndex("by_meeting", (q) => q.eq("meetingId", args.meetingId))
      .collect();
    for (const s of signals) {
      await ctx.db.delete(s._id);
    }
    return { success: true };
  },
});

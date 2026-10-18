import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  messages: defineTable({
    author: v.string(),
    senderId: v.optional(v.string()),
    recipientId: v.optional(v.string()),
    groupId: v.optional(v.string()),
    body: v.string(),
    type: v.optional(v.string()), // "text", "sticker", "voice", "video", "deleted", "file"
    status: v.optional(v.string()), // "sent", "delivered", "read"
    isEdited: v.optional(v.boolean()),
    editedAt: v.optional(v.string()),
    isDeletedForEveryone: v.optional(v.boolean()),
    deletedFor: v.optional(v.array(v.string())),
    storageId: v.optional(v.string()), // Convex Storage file ID
    mediaUrl: v.optional(v.string()), // Resolved direct media URL
    replyToId: v.optional(v.string()),
    replyToSnapshot: v.optional(v.object({
      id: v.string(),
      author: v.string(),
      body: v.string(),
      type: v.optional(v.string()),
    })),
    reactions: v.optional(v.array(v.object({
      emoji: v.string(),
      userId: v.string(),
      author: v.string(),
    }))),
    isPinned: v.optional(v.boolean()),
    pinnedAt: v.optional(v.string()),
    pinnedBy: v.optional(v.string()),
    fileName: v.optional(v.string()),
    fileSize: v.optional(v.number()),
    duration: v.optional(v.number()),
  })
    .index("by_recipient", ["recipientId"])
    .index("by_sender", ["senderId"])
    .index("by_group", ["groupId"]),

  conversations: defineTable({
    userId: v.string(),
    chatKey: v.string(),
    customNickname: v.optional(v.string()),
    isArchived: v.optional(v.boolean()),
    isHidden: v.optional(v.boolean()),
    clearedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_user_chat", ["userId", "chatKey"]),

  users: defineTable({
    userId: v.string(),
    username: v.string(),
    displayName: v.string(),
    avatarBg: v.string(),
    avatarText: v.string(),
    avatarUrl: v.optional(v.string()),
    bio: v.optional(v.string()),
    passwordHash: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    isOnline: v.boolean(),
    lastSeen: v.string(),
    blockedUserIds: v.optional(v.array(v.string())),
    privacySettings: v.optional(v.object({
      whoCanCall: v.optional(v.string()), // "everyone", "contacts", "nobody"
      showLastSeen: v.optional(v.string()), // "everyone", "contacts", "nobody"
    })),
    createdAt: v.optional(v.string()),
  })
    .index("by_userId", ["userId"])
    .index("by_username", ["username"]),

  contactRequests: defineTable({
    fromUserId: v.string(),
    toUserId: v.string(),
    status: v.string(), // "pending", "accepted", "rejected", "cancelled"
    createdAt: v.string(),
    updatedAt: v.optional(v.string()),
  })
    .index("by_toUserId", ["toUserId"])
    .index("by_fromUserId", ["fromUserId"])
    .index("by_pair", ["fromUserId", "toUserId"]),

  contacts: defineTable({
    userId: v.string(),
    contactUserId: v.string(),
    customNickname: v.optional(v.string()),
    isBlocked: v.optional(v.boolean()),
    createdAt: v.string(),
  })
    .index("by_userId", ["userId"])
    .index("by_user_contact", ["userId", "contactUserId"]),

  groups: defineTable({
    groupId: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    avatarBg: v.optional(v.string()),
    ownerId: v.string(),
    adminIds: v.array(v.string()),
    memberIds: v.array(v.string()),
    inviteCode: v.optional(v.string()),
    isPrivate: v.optional(v.boolean()),
    createdAt: v.string(),
    updatedAt: v.optional(v.string()),
  })
    .index("by_groupId", ["groupId"])
    .index("by_owner", ["ownerId"])
    .index("by_inviteCode", ["inviteCode"]),

  meetings: defineTable({
    meetingId: v.string(),
    title: v.string(),
    hostUserId: v.string(),
    hostName: v.string(),
    groupId: v.optional(v.string()),
    status: v.string(), // "active", "ended"
    isAudioOnly: v.optional(v.boolean()),
    participants: v.array(v.object({
      userId: v.string(),
      displayName: v.string(),
      avatarUrl: v.optional(v.string()),
      isMuted: v.boolean(),
      isVideoOff: v.boolean(),
      isScreenSharing: v.boolean(),
      joinedAt: v.string(),
    })),
    createdAt: v.string(),
    endedAt: v.optional(v.string()),
  })
    .index("by_meetingId", ["meetingId"])
    .index("by_status", ["status"]),

  meetingSignals: defineTable({
    meetingId: v.string(),
    senderId: v.string(),
    targetId: v.string(),
    type: v.string(), // "offer", "answer", "candidate", "peer-join", "peer-leave"
    payload: v.string(),
    timestamp: v.number(),
  })
    .index("by_meeting_target", ["meetingId", "targetId"])
    .index("by_meeting", ["meetingId"]),

  notifications: defineTable({
    userId: v.string(),
    type: v.string(), // "message", "contact_request", "contact_accepted", "group_invite", "call", "meeting"
    title: v.string(),
    body: v.string(),
    data: v.optional(v.string()),
    isRead: v.boolean(),
    createdAt: v.string(),
  })
    .index("by_user", ["userId"])
    .index("by_user_unread", ["userId", "isRead"]),

  groupSettings: defineTable({
    key: v.string(),
    title: v.string(),
    updatedAt: v.optional(v.string()),
    updatedBy: v.optional(v.string()),
  }).index("by_key", ["key"]),
});


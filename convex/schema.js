import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  messages: defineTable({
    author: v.string(),
    senderId: v.optional(v.string()),
    recipientId: v.optional(v.string()),
    body: v.string(),
    type: v.optional(v.string()), // "text", "sticker", "voice", "video", "deleted"
    status: v.optional(v.string()), // "sent", "delivered", "read"
    isEdited: v.optional(v.boolean()),
    editedAt: v.optional(v.string()),
    isDeletedForEveryone: v.optional(v.boolean()),
    deletedFor: v.optional(v.array(v.string())),
    storageId: v.optional(v.string()), // Convex Storage file ID
    mediaUrl: v.optional(v.string()), // Resolved direct media URL
  })
    .index("by_recipient", ["recipientId"])
    .index("by_sender", ["senderId"]),

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
    isOnline: v.boolean(),
    lastSeen: v.string(),
  })
    .index("by_userId", ["userId"])
    .index("by_username", ["username"]),

  groupSettings: defineTable({
    key: v.string(),
    title: v.string(),
    updatedAt: v.optional(v.string()),
    updatedBy: v.optional(v.string()),
  }).index("by_key", ["key"]),
});

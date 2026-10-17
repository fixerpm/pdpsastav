import { mutation } from "./_generated/server";
import { v } from "convex/values";

// Lokal JSON ma'lumotlarini Convex Cloud ga xavfsiz import qilish
export const importBatch = mutation({
  args: {
    messages: v.array(
      v.object({
        author: v.string(),
        senderId: v.optional(v.string()),
        recipientId: v.optional(v.string()),
        body: v.string(),
        type: v.optional(v.string()),
        status: v.optional(v.string()),
        isEdited: v.optional(v.boolean()),
        editedAt: v.optional(v.string()),
        isDeletedForEveryone: v.optional(v.boolean()),
        deletedFor: v.optional(v.array(v.string())),
        storageId: v.optional(v.string()),
        mediaUrl: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    let inserted = 0;

    for (const msg of args.messages) {
      await ctx.db.insert("messages", {
        author: msg.author,
        senderId: msg.senderId,
        recipientId: msg.recipientId || "public",
        body: msg.body,
        type: msg.type || "text",
        status: msg.status || "delivered",
        isEdited: !!msg.isEdited,
        editedAt: msg.editedAt,
        isDeletedForEveryone: !!msg.isDeletedForEveryone,
        deletedFor: msg.deletedFor || [],
        storageId: msg.storageId,
        mediaUrl: msg.mediaUrl,
      });
      inserted++;
    }

    return { success: true, count: inserted };
  },
});

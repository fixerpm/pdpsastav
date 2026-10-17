import { NextResponse } from "next/server";
import { chatStore } from "@/lib/chat-store";

export async function GET(req) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    const currentUser = token ? chatStore.validateSession(token) : null;

    if (!currentUser) {
      return NextResponse.json({ error: "Ruxsat berilmagan" }, { status: 401 });
    }

    const groupSettings = chatStore.getGroupSettings();
    return NextResponse.json({
      success: true,
      groupSettings,
    });
  } catch (error) {
    console.error("Conversations GET error:", error);
    return NextResponse.json(
      { error: "Ma'lumotlarni olishda xatolik" },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    const currentUser = token ? chatStore.validateSession(token) : null;

    if (!currentUser) {
      return NextResponse.json({ error: "Ruxsat berilmagan" }, { status: 401 });
    }

    const body = await req.json();
    const { action } = body;

    switch (action) {
      case "set_nickname": {
        const { contactId, nickname } = body;
        if (!contactId) {
          return NextResponse.json({ error: "contactId kiritilishi kerak" }, { status: 400 });
        }
        const result = chatStore.setContactNickname(currentUser.id, contactId, nickname);
        return NextResponse.json({ success: true, ...result });
      }

      case "set_group_title": {
        const { title } = body;
        const result = chatStore.setGroupTitle(currentUser.id, title);
        return NextResponse.json({ success: true, ...result });
      }

      case "archive_chat": {
        const { chatKey, isArchived } = body;
        if (!chatKey) {
          return NextResponse.json({ error: "chatKey kiritilishi kerak" }, { status: 400 });
        }
        const result = chatStore.archiveChat(currentUser.id, chatKey, !!isArchived);
        return NextResponse.json({ success: true, ...result });
      }

      case "clear_history": {
        const { chatKey } = body;
        if (!chatKey) {
          return NextResponse.json({ error: "chatKey kiritilishi kerak" }, { status: 400 });
        }
        const result = chatStore.clearChatHistory(currentUser.id, chatKey);
        return NextResponse.json({ success: true, ...result });
      }

      case "delete_chat": {
        const { chatKey, forEveryone } = body;
        if (!chatKey) {
          return NextResponse.json({ error: "chatKey kiritilishi kerak" }, { status: 400 });
        }
        const result = chatStore.deleteChat(currentUser.id, chatKey, !!forEveryone);
        return NextResponse.json({ success: true, ...result });
      }

      default:
        return NextResponse.json(
          { error: "Noma'lum harakat: " + action },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Conversation action error:", error);
    return NextResponse.json(
      { error: error.message || "Amalni bajarishda xatolik yuz berdi" },
      { status: 500 }
    );
  }
}

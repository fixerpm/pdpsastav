import { NextResponse } from "next/server";
import { chatStore } from "@/lib/chat-store";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const recipientId = searchParams.get("recipientId");
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    const currentUser = token ? chatStore.validateSession(token) : null;

    if (recipientId && recipientId !== "public") {
      if (!currentUser) {
        return NextResponse.json({ error: "Yaroqsiz sessiya" }, { status: 401 });
      }
      const messages = chatStore.getMessages(currentUser.id, recipientId);

      // Suhbatdoshdan kelgan xabarlarni o'qilgan deb belgilash
      chatStore.markMessagesAsRead(currentUser.id, recipientId);

      return NextResponse.json({ messages });
    }

    // Umumiy chat xabarlari
    const messages = chatStore.getAllMessages(currentUser ? currentUser.id : null);

    // Agar foydalanuvchi tizimda bo'lsa umumiy chatni ham o'qilgan qilish
    if (currentUser) {
      chatStore.markMessagesAsRead(currentUser.id, "public");
    }

    return NextResponse.json({ messages });
  } catch (error) {
    console.error("Messages fetch error:", error);
    return NextResponse.json(
      { error: "Xabarlarni yuklashda xatolik" },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { author, body: textBody, type, storageId, mediaUrl, recipientId, clientTempId } = body;

    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    const currentUser = token ? chatStore.validateSession(token) : null;

    if (currentUser && !chatStore.checkLimit(currentUser.id)) {
      return NextResponse.json(
        { error: "Juda ko'p xabar yuborildi. Iltimos bir necha soniya kuting." },
        { status: 429 }
      );
    }

    // Input validatsiyasi
    if (!textBody && !storageId && !mediaUrl) {
      return NextResponse.json(
        { error: "Xabar matni yoki media bo'sh bo'lishi mumkin emas" },
        { status: 400 }
      );
    }

    if (textBody && typeof textBody === "string" && textBody.length > 5000) {
      return NextResponse.json(
        { error: "Xabar matni juda uzun (maksimal 5000 belgi)" },
        { status: 400 }
      );
    }

    // Agar shaxsiy xabar bo'lsa (1-on-1)
    if (recipientId && recipientId !== "public") {
      if (!currentUser) {
        return NextResponse.json({ error: "Shaxsiy xabar yuborish uchun tizimga kirish shart" }, { status: 401 });
      }
      const message = chatStore.sendMessage({
        senderId: currentUser.id,
        recipientId,
        text: textBody,
        type: type || "text",
        storageId,
        mediaUrl,
        clientTempId,
      });
      return NextResponse.json({ success: true, message });
    }

    // Umumiy chat xabari
    const senderName = currentUser ? currentUser.displayName : (author?.trim() || "Anonim");
    const message = chatStore.addPublicMessage({
      author: senderName,
      senderId: currentUser ? currentUser.id : null,
      body: textBody || "",
      type: type || "text",
      storageId,
      mediaUrl,
      clientTempId,
    });

    return NextResponse.json({ success: true, message });
  } catch (error) {
    console.error("Send message error:", error);
    return NextResponse.json(
      { error: error.message || "Xabar yuborishda xatolik yuz berdi" },
      { status: 500 }
    );
  }
}

// Xabarni tahrirlash (PUT)
export async function PUT(req) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    const currentUser = token ? chatStore.validateSession(token) : null;

    if (!currentUser) {
      return NextResponse.json({ error: "Ruxsat berilmagan" }, { status: 401 });
    }

    const body = await req.json();
    const { messageId, text } = body;

    if (!messageId || typeof text !== "string") {
      return NextResponse.json(
        { error: "messageId va yangi matn kiritilishi shart" },
        { status: 400 }
      );
    }

    const updated = chatStore.editMessage({
      userId: currentUser.id,
      messageId,
      newText: text,
    });

    return NextResponse.json({ success: true, message: updated });
  } catch (error) {
    console.error("Edit message error:", error);
    return NextResponse.json(
      { error: error.message || "Xabarni tahrirlashda xatolik" },
      { status: 400 }
    );
  }
}

// Xabarni o'chirish (DELETE)
export async function DELETE(req) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    const currentUser = token ? chatStore.validateSession(token) : null;

    if (!currentUser) {
      return NextResponse.json({ error: "Ruxsat berilmagan" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const messageId = searchParams.get("messageId");
    const forEveryone = searchParams.get("forEveryone") === "true";

    if (!messageId) {
      return NextResponse.json({ error: "messageId ko'rsatilishi kerak" }, { status: 400 });
    }

    const result = chatStore.deleteMessage({
      userId: currentUser.id,
      messageId,
      forEveryone,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Delete message error:", error);
    return NextResponse.json(
      { error: error.message || "Xabarni o'chirishda xatolik" },
      { status: 400 }
    );
  }
}

// Xabarlarni o'qilgan deb belgilash (PATCH)
export async function PATCH(req) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    const currentUser = token ? chatStore.validateSession(token) : null;

    if (!currentUser) {
      return NextResponse.json({ error: "Ruxsat berilmagan" }, { status: 401 });
    }

    const body = await req.json();
    const { chatWithId } = body;

    const result = chatStore.markMessagesAsRead(currentUser.id, chatWithId);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Mark read error:", error);
    return NextResponse.json(
      { error: "Xabarlarni yangilashda xatolik" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { chatStore } from "@/lib/chat-store";

export async function POST(req) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json({ error: "Ruxsat berilmagan" }, { status: 401 });
    }

    const currentUser = chatStore.validateSession(token);
    if (!currentUser) {
      return NextResponse.json({ error: "Yaroqsiz sessiya" }, { status: 401 });
    }

    const body = await req.json();
    const { recipientId, isTyping } = body;

    if (!recipientId) {
      return NextResponse.json(
        { error: "recipientId ko'rsatilishi kerak" },
        { status: 400 }
      );
    }

    chatStore.setTyping(currentUser.id, recipientId, !!isTyping);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Typing status error:", error);
    return NextResponse.json(
      { error: "Typing holatini yangilashda xatolik" },
      { status: 500 }
    );
  }
}

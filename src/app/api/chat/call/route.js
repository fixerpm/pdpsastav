import { NextResponse } from "next/server";
import { chatStore } from "@/lib/chat-store";

export async function POST(req) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    const payload = await req.json();

    let currentUser = token ? chatStore.validateSession(token) : null;
    if (!currentUser && payload.callerId) {
      currentUser = chatStore.getUserById(payload.callerId) || {
        id: payload.callerId,
        displayName: payload.callerName || "Foydalanuvchi",
      };
    }

    if (!currentUser) {
      return NextResponse.json({ error: "Qo'ng'iroq qilish uchun tizimga kirish shart" }, { status: 401 });
    }

    const result = chatStore.handleCallSignal(currentUser.id, payload);

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Call signaling error:", error);
    return NextResponse.json(
      { error: error.message || "Signalizatsiyada xatolik yuz berdi" },
      { status: 500 }
    );
  }
}

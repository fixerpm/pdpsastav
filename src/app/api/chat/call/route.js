import { NextResponse } from "next/server";
import { chatStore } from "@/lib/chat-store";

export async function POST(req) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    const currentUser = token ? chatStore.validateSession(token) : null;

    if (!currentUser) {
      return NextResponse.json({ error: "Qo'ng'iroq qilish uchun tizimga kirish shart" }, { status: 401 });
    }

    const payload = await req.json();
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

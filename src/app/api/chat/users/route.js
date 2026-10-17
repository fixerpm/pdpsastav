import { NextResponse } from "next/server";
import { chatStore } from "@/lib/chat-store";

export async function GET(req) {
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

    const users = chatStore.getUsers(currentUser.id);
    return NextResponse.json({ users, currentUser });
  } catch (error) {
    if (error?.digest === "NEXT_PRERENDER_INTERRUPTED") {
      throw error;
    }
    console.error("Users fetch error:", error);
    return NextResponse.json(
      { error: "Foydalanuvchilarni yuklashda xatolik" },
      { status: 500 }
    );
  }
}

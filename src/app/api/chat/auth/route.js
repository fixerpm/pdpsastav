import { NextResponse } from "next/server";
import { chatStore } from "@/lib/chat-store";

export async function POST(req) {
  try {
    const body = await req.json();
    const { username, displayName } = body;

    if (!username || typeof username !== "string" || !username.trim()) {
      return NextResponse.json(
        { error: "Foydalanuvchi nomi kiritilishi shart" },
        { status: 400 }
      );
    }

    const { user, token } = chatStore.authenticate(username, displayName);

    return NextResponse.json({
      success: true,
      user,
      token,
    });
  } catch (error) {
    console.error("Auth error:", error);
    return NextResponse.json(
      { error: "Tizimga kirishda xatolik yuz berdi" },
      { status: 500 }
    );
  }
}

export async function GET(req) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    const user = chatStore.validateSession(token);
    if (!user) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    return NextResponse.json({
      authenticated: true,
      user,
    });
  } catch (error) {
    console.error("Session check error:", error);
    return NextResponse.json(
      { error: "Sessiyani tekshirishda xatolik" },
      { status: 500 }
    );
  }
}

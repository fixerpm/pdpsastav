import { chatStore } from "@/lib/chat-store";

export async function GET(req) {
  const encoder = new TextEncoder();
  let clientId = null;
  let intervalId = null;

  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  // Xavfsizlik: userId faqat haqiqiy sessiya tokeni orqali tasdiqlanadi.
  // URL parametrida boshqa odamning userId'sini yuborib tinglash imkoniyati to'liq bloklangan.
  let authenticatedUserId = "public-user";
  if (token) {
    const user = chatStore.validateSession(token);
    if (user) {
      authenticatedUserId = user.id;
    }
  }

  const stream = new ReadableStream({
    start(controller) {
      // Obunachini faqat tasdiqlangan identifikator bilan qo'shish
      clientId = chatStore.subscribe(authenticatedUserId, (payload) => {
        try {
          controller.enqueue(encoder.encode(payload));
        } catch (e) {
          console.error("Stream enqueue error:", e);
        }
      });

      // Boshlang'ich ulanish tasdig'i
      try {
        controller.enqueue(
          encoder.encode(
            `event: connected\ndata: ${JSON.stringify({
              status: "connected",
              userId: authenticatedUserId,
              time: Date.now(),
            })}\n\n`
          )
        );
      } catch (e) {
        // stream yopilgan bo'lsa
      }

      // Keep-alive ping har 15 soniyada
      intervalId = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch (e) {
          clearInterval(intervalId);
        }
      }, 15000);
    },
    cancel() {
      if (intervalId) clearInterval(intervalId);
      if (clientId) chatStore.unsubscribe(clientId);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

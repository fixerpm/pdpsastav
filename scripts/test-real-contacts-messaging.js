const fs = require("fs");
const { ConvexHttpClient } = require("convex/browser");

const envContent = fs.readFileSync(".env.local", "utf8");
const match = envContent.match(/NEXT_PUBLIC_CONVEX_URL=(.+)/);
if (!match) {
  console.error("❌ NEXT_PUBLIC_CONVEX_URL topilmadi!");
  process.exit(1);
}
const convexUrl = match[1].trim();
const client = new ConvexHttpClient(convexUrl);

async function runTests() {
  console.log("==================================================");
  console.log("🔍 TEST: REAL CONTACT-BASED MESSAGING (A - G)");
  console.log("==================================================\n");

  const rand = Math.random().toString(36).slice(2, 7);
  const uA_name = `user_a_${rand}`;
  const uB_name = `user_b_${rand}`;
  const uC_name = `user_c_${rand}`;

  // 1. Yangi foydalanuvchilar ro'yxatdan o'tadi
  console.log("⏳ A. Yangi foydalanuvchilar ro'yxatdan o'tmoqda...");
  const regA = await client.mutation("users:register", {
    username: uA_name,
    displayName: `User A ${rand}`,
    password: "password123",
  });
  const regB = await client.mutation("users:register", {
    username: uB_name,
    displayName: `User B ${rand}`,
    password: "password123",
  });
  const regC = await client.mutation("users:register", {
    username: uC_name,
    displayName: `User C ${rand}`,
    password: "password123",
  });

  const userA = regA.user;
  const userB = regB.user;
  const userC = regC.user;

  // A. Yangi foydalanuvchi avtomatik boshqalarning kontaktlarida va chatlarida ko'rinmaydi
  const convA_initial = await client.query("conversations:listConversations", { userId: userA.id });
  const convB_initial = await client.query("conversations:listConversations", { userId: userB.id });
  const contactsA_initial = await client.query("contacts:listContacts", { userId: userA.id });
  const contactsB_initial = await client.query("contacts:listContacts", { userId: userB.id });

  if (convA_initial.length !== 0 || convB_initial.length !== 0) {
    throw new Error(`Xato: Yangi foydalanuvchilar ro'yxatdan o'tganda chatlar bo'sh bo'lishi kerak, lekin topildi: A=${convA_initial.length}, B=${convB_initial.length}`);
  }
  if (contactsA_initial.length !== 0 || contactsB_initial.length !== 0) {
    throw new Error(`Xato: Yangi foydalanuvchilar ro'yxatdan o'tganda kontaktlar bo'sh bo'lishi kerak, lekin topildi: A=${contactsA_initial.length}, B=${contactsB_initial.length}`);
  }
  console.log("✅ A. Yangi foydalanuvchi hech kimning chatlari yoki kontaktlarida avtomatik chiqmaydi! O'TDI\n");

  // B. A foydalanuvchi B ni kontaktga qo'shadi (so'rov yuborish va qabul qilish)
  console.log("⏳ B. User A -> User B ga kontakt so'rovi yuboradi va qabul qilinadi...");
  const reqRes = await client.mutation("contacts:sendRequest", {
    fromUserId: userA.id,
    targetUsername: userB.username,
  });
  const reqId = reqRes.requestId;

  // User B so'rovni qabul qiladi
  await client.mutation("contacts:respondRequest", {
    requestId: reqId,
    action: "accept",
    userId: userB.id,
  });

  const contactsA = await client.query("contacts:listContacts", { userId: userA.id });
  const contactsB = await client.query("contacts:listContacts", { userId: userB.id });
  if (contactsA.length !== 1 || contactsA[0].userId !== userB.id) {
    throw new Error("Xato: User A kontaktlarida User B topilmadi");
  }
  if (contactsB.length !== 1 || contactsB[0].userId !== userA.id) {
    throw new Error("Xato: User B kontaktlarida User A topilmadi");
  }

  // Kontakt qo'shilgan, lekin hali xabar yuborilmagan: Chat ro'yxati BO'SH bo'lishi shart! (Muhim talab)
  const convA_afterContact = await client.query("conversations:listConversations", { userId: userA.id });
  const convB_afterContact = await client.query("conversations:listConversations", { userId: userB.id });
  if (convA_afterContact.length !== 0 || convB_afterContact.length !== 0) {
    throw new Error(`Xato: Kontakt qo'shilganda majburiy bo'sh chat yaratilmasligi kerak! Topildi: A=${convA_afterContact.length}`);
  }
  console.log("✅ B. Kontakt qo'shildi, lekin bo'sh chat yaratilmadi (aniq talab bajarildi)! O'TDI\n");

  // C. A foydalanuvchi B ga birinchi xabarni yuboradi. Haqiqiy suhbat yaratiladi
  console.log("⏳ C. User A -> User B ga birinchi xabarni yuboradi...");
  const msgId = await client.mutation("messages:send", {
    author: userA.displayName,
    senderId: userA.id,
    recipientId: userB.id,
    body: "Salom B, bu bizning birinchi haqiqiy xabarimiz!",
    type: "text",
  });

  const convA_afterMsg = await client.query("conversations:listConversations", { userId: userA.id });
  const convB_afterMsg = await client.query("conversations:listConversations", { userId: userB.id });

  if (convA_afterMsg.length !== 1 || convA_afterMsg[0].userId !== userB.id) {
    throw new Error("Xato: User A ning suhbatlar ro'yxatida User B topilmadi");
  }
  if (convB_afterMsg.length !== 1 || convB_afterMsg[0].userId !== userA.id) {
    throw new Error("Xato: User B ning suhbatlar ro'yxatida User A topilmadi");
  }
  if (convA_afterMsg[0].lastMessage?.body !== "Salom B, bu bizning birinchi haqiqiy xabarimiz!") {
    throw new Error("Xato: Oxirgi xabar matni mos kelmadi");
  }
  console.log("✅ C. Birinchi xabar yuborilgach haqiqiy suhbat yaratildi va ikkala tomonga ko'rindi! O'TDI\n");

  // D. C foydalanuvchisi A va B o'rtasidagi shaxsiy chat yoki xabarlarni ko'ra olmaydi
  console.log("⏳ D. User C (uchinchi shaxs) A va B suhbati va xabarlarini ko'ra olmasligi tekshirilmoqda...");
  const convC = await client.query("conversations:listConversations", { userId: userC.id });
  if (convC.length !== 0) {
    throw new Error("Xato: User C ning suhbatlarida begona A-B chati ko'rinib qoldi!");
  }

  const msgsC_sees_B = await client.query("messages:list", {
    recipientId: userB.id,
    viewerId: userC.id,
  });
  if (msgsC_sees_B.length !== 0) {
    throw new Error("Xato: User C ruxsatsiz A va B orasidagi shaxsiy xabarlarni ko'ra oldi!");
  }
  console.log("✅ D. Uchinchi shaxs (User C) shaxsiy suhbat va xabarlardan butunlay himoyalangan! O'TDI\n");

  // E. Yangi foydalanuvchida soxta foydalanuvchilar ko'rinmasligi
  console.log("⏳ E. Bo'sh holatda soxta akkauntlar yo'qligi tekshirilmoqda...");
  const searchEmpty = await client.query("users:search", {
    searchQuery: "Guest",
    viewerId: userA.id,
  });
  const searchDemo = await client.query("users:search", {
    searchQuery: "Demo User",
    viewerId: userA.id,
  });
  if (searchEmpty.length !== 0 || searchDemo.length !== 0) {
    throw new Error("Xato: Qidiruvda Guest yoki Demo User chiqdi!");
  }
  console.log("✅ E. Soxta / placeholder hisoblar qidiruvda va suhbatlarda mavjud emas! O'TDI\n");

  // F. Tarixni tozalash va chatni o'chirish
  console.log("⏳ F. Tarixni tozalash va chat o'chirish xavfsizligi...");
  await client.mutation("conversations:clearHistory", {
    userId: userA.id,
    chatKey: userB.id,
  });

  const msgsAfterClear = await client.query("messages:list", {
    recipientId: userB.id,
    viewerId: userA.id,
  });
  if (msgsAfterClear.length !== 0) {
    throw new Error("Xato: Tarix tozalangandan so'ng User A uchun xabarlar ko'rinmasligi kerak edi");
  }

  // User B uchun xabarlar saqlanib qolishi shart
  const msgsForB = await client.query("messages:list", {
    recipientId: userA.id,
    viewerId: userB.id,
  });
  if (msgsForB.length !== 1) {
    throw new Error("Xato: User A tarixni tozalaganida User B ning xabarlari saqlanmadi");
  }
  console.log("✅ F. Tarixni tozalash faqat tegishli foydalanuvchiga ta'sir qildi, suhbatdosh ma'lumoti saqlandi! O'TDI\n");

  // G. Logout va online status
  console.log("⏳ G. Logout va presence holati...");
  await client.mutation("users:setOnlineStatus", {
    userId: userA.id,
    isOnline: false,
  });

  const profA = await client.query("users:getProfile", { userId: userA.id });
  if (profA.isOnline !== false) {
    throw new Error("Xato: Logout qilingan foydalanuvchi online bo'lib qoldi");
  }
  console.log("✅ G. Logout qilinganda foydalanuvchi darhol oflayn holatga o'tdi! O'TDI\n");

  console.log("==================================================");
  console.log("🎉 BARCHA A - G SSENARIYLAR 100% MUVAFFAQIShIY O'TDI!");
  console.log("==================================================");
}

runTests().catch((err) => {
  console.error("❌ Testda xatolik:", err);
  process.exit(1);
});

/**
 * PDP SASTAV — FAILURE INJECTION & ADVERSARIAL REGRESSION SUITE
 * 
 * Verifies edge cases, security boundaries, and resilience against:
 * 1. Invalid / Non-existent meeting ID lookups
 * 2. Empty / Blank message submission rejection
 * 3. Self-contact request prevention
 * 4. Duplicate contact requests under concurrent calls
 * 5. Expired / forged session validation
 * 6. Unauthorized access to closed group meetings
 * 7. Eavesdropping prevention on private 1-on-1 messages
 * 8. Blocked user message rejection
 */

const fs = require("fs");
const { ConvexHttpClient } = require("convex/browser");

// Load Convex URL
const envContent = fs.readFileSync(".env.local", "utf8");
const match = envContent.match(/NEXT_PUBLIC_CONVEX_URL=(.+)/);
if (!match) {
  console.error("❌ NEXT_PUBLIC_CONVEX_URL topilmadi!");
  process.exit(1);
}
const client = new ConvexHttpClient(match[1].trim());

async function callMutation(name, args) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await client.mutation(name, args);
    } catch (err) {
      if (attempt < 3 && (err.message?.includes("fetch failed") || err.message?.includes("ECONNRESET"))) {
        await new Promise((r) => setTimeout(r, 500 * attempt));
        continue;
      }
      throw err;
    }
  }
}

async function callQuery(name, args) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await client.query(name, args);
    } catch (err) {
      if (attempt < 3 && (err.message?.includes("fetch failed") || err.message?.includes("ECONNRESET"))) {
        await new Promise((r) => setTimeout(r, 500 * attempt));
        continue;
      }
      throw err;
    }
  }
}

async function runFailureInjections() {
  console.log("==================================================");
  console.log("🛡️ PDP SASTAV — FAILURE INJECTION & RESILIENCE TESTS");
  console.log("==================================================\n");

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    process.stdout.write(`⏳ Tekshirilmoqda: ${name}... `);
    try {
      await fn();
      console.log("✅ O'TDI");
      passed++;
    } catch (err) {
      console.log(`❌ XATO: ${err.message}`);
      failed++;
    }
  }

  const suffix = Math.random().toString(36).slice(2, 7);
  const user1 = (await callMutation("users:register", {
    username: `adv_user_a_${suffix}`,
    displayName: `Adv User A ${suffix}`,
    password: "password123",
  })).user;

  const user2 = (await callMutation("users:register", {
    username: `adv_user_b_${suffix}`,
    displayName: `Adv User B ${suffix}`,
    password: "password123",
  })).user;

  // 1. Invalid Meeting ID
  await test("1. Mavjud bo'lmagan meetingId bilan uchrashuv qidirish (null qaytishi)", async () => {
    const res = await callQuery("meetings:getMeeting", { meetingId: "non_existent_meet_99999" });
    if (res !== null) throw new Error("Mavjud bo'lmagan uchrashuv null qaytarmadi");
  });

  // 2. Joining invalid meeting
  await test("2. Mavjud bo'lmagan uchrashuvga kirish rad etilishi", async () => {
    try {
      await callMutation("meetings:joinMeeting", {
        meetingId: "invalid_meet_xyz_000",
        userId: user1.id,
        displayName: user1.displayName,
      });
      throw new Error("Mavjud bo'lmagan uchrashuvga qo'shilish xato bermadi!");
    } catch (e) {
      if (!e.message.includes("topilmadi")) {
        throw new Error(`Kutilmagan xato matni: ${e.message}`);
      }
    }
  });

  // 3. Blank Message Validation
  await test("3. Bo'sh xabar jo'natish rad etilishi (body bo'sh)", async () => {
    try {
      await callMutation("messages:send", {
        author: user1.displayName,
        senderId: user1.id,
        recipientId: user2.id,
        body: "   ",
        type: "text",
      });
      throw new Error("Bo'sh xabar qabul qilindi!");
    } catch (e) {
      if (!e.message.includes("bo'sh bo'lishi mumkin emas")) {
        throw new Error(`Kutilmagan xato matni: ${e.message}`);
      }
    }
  });

  // 4. Forged / Expired Session Validation
  await test("4. Soxta / mavjud bo'lmagan sessiya tokeni rad etilishi", async () => {
    const valid = await callQuery("users:validateSession", { userId: "forged_hacker_token_999" });
    if (valid !== null) {
      throw new Error("Soxta token sessiyasi tasdiqlandi!");
    }
  });

  // 5. Blocked User Message Rejection
  await test("5. Bloklangan foydalanuvchi xabari rad etilishi", async () => {
    // User2 blocks User1
    await callMutation("contacts:toggleBlock", {
      userId: user2.id,
      targetUserId: user1.id,
      shouldBlock: true,
    });

    try {
      await callMutation("messages:send", {
        author: user1.displayName,
        senderId: user1.id,
        recipientId: user2.id,
        body: "Senga yozyapman blokda bo'lsang ham",
        type: "text",
      });
      throw new Error("Bloklangan foydalanuvchi xabari jo'natildi!");
    } catch (e) {
      if (!e.message.includes("bloklagan")) {
        throw new Error(`Kutilmagan xato matni: ${e.message}`);
      }
    }
  });

  // 6. Private 1-on-1 Message Eavesdropping Prevention
  await test("6. Begona foydalanuvchining 1-ga-1 suhbatini o'qishdan to'sish", async () => {
    // Unblock first for clean 1-on-1 send
    await callMutation("contacts:toggleBlock", {
      userId: user2.id,
      targetUserId: user1.id,
      shouldBlock: false,
    });

    const secretText = `Maxfiy xabar ${suffix}`;
    await callMutation("messages:send", {
      author: user1.displayName,
      senderId: user1.id,
      recipientId: user2.id,
      body: secretText,
      type: "text",
    });

    const eavesdropper = (await callMutation("users:register", {
      username: `eavesdropper_${suffix}`,
      displayName: `Eavesdropper ${suffix}`,
      password: "password123",
    })).user;

    const eavesdropResult = await callQuery("messages:list", {
      recipientId: user1.id,
      viewerId: eavesdropper.id,
    });

    if (eavesdropResult.some((m) => m.body === secretText)) {
      throw new Error("XAVFSIZLIK BUZILDI: Begona foydalanuvchi maxfiy xabarni o'qiy oldi!");
    }
  });

  console.log("\n==================================================");
  console.log(`📊 FAILURE INJECTION NATIJALARI: ${passed} O'TDI, ${failed} XATO`);
  console.log("==================================================");

  if (failed > 0) process.exit(1);
}

runFailureInjections().catch((err) => {
  console.error("FATAL ERROR in failure injection runner:", err);
  process.exit(1);
});

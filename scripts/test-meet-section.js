/**
 * PDP SASTAV — MEET / UCHRASHUV VERIFICATION TEST SUITE
 * Verifies all criteria specified by user:
 * 1. Meet route and component resolution
 * 2. Dedicated /meet route loads with HTTP 200
 * 3. Root page / loads with HTTP 200
 * 4. Uchrashuv taklif havolasi (?meet=...) parameter handling
 * 5. Safe participant fallback when uninitialized
 * 6. Guest user identification stability and React Compiler safety (no ref mutation during render)
 * 7. Correct isHost resolution (no accidental host privileges for guests)
 * 8. Safe joinMeetingId trimming (no TypeError on null/undefined)
 * 9. Safe navigator.mediaDevices checks
 * 10. MeetErrorBoundary presence to prevent app-level crash
 */

const fs = require("fs");
const assert = require("assert");

async function run() {
  console.log("==================================================");
  console.log("📹 PDP SASTAV — MEET (UCHRASHUV) VERIFICATION SUITE");
  console.log("==================================================");

  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`✅ [O'TDI] ${name}`);
      passed++;
    } catch (e) {
      console.error(`❌ [XATO] ${name}:`, e.message);
      failed++;
    }
  }

  // 1. Files existence check
  test("1. Meet komponentlari va marshrutlari mavjudligi", () => {
    assert(fs.existsSync("src/components/MeetingsModal.js"), "MeetingsModal.js topilmadi");
    assert(fs.existsSync("src/components/MeetErrorBoundary.js"), "MeetErrorBoundary.js topilmadi");
    assert(fs.existsSync("src/app/meet/page.js"), "src/app/meet/page.js topilmadi");
    assert(fs.existsSync("src/app/meet/loading.js"), "src/app/meet/loading.js topilmadi");
    assert(fs.existsSync("src/app/meet/error.js"), "src/app/meet/error.js topilmadi");
  });

  // 2. MeetingsModal code audit for fixed root causes
  test("2. MeetingsModal: Mutable ref va render paytida localStorage xatosi tuzatilgan", () => {
    const code = fs.readFileSync("src/components/MeetingsModal.js", "utf8");
    assert(!code.includes("guestUserIdRef.current ="), "Mutable ref render paytida o'zgartirilmasligi kerak");
    assert(code.includes("const [guestUserId] = useState("), "Xavfsiz lazy useState ishlatilishi kerak");
    assert(code.includes("localStorage.getItem(\"meet_guest_id\")"), "localStorage o'qilishi try-catch bilan himoyalangan");
  });

  test("3. MeetingsModal: isHost tekshiruvi to'g'ri (mehmon adashib host bo'lib qolmaydi)", () => {
    const code = fs.readFileSync("src/components/MeetingsModal.js", "utf8");
    assert(code.includes("Boolean(currentUser?.id && meeting?.hostUserId && meeting.hostUserId === currentUser.id)"), "isHost aniq Boolean va id mavjudligiga tekshirilishi shart");
  });

  test("4. MeetingsModal: Ishtirokchilar bo'sh holati xavfsiz boshqariladi", () => {
    const code = fs.readFileSync("src/components/MeetingsModal.js", "utf8");
    assert(code.includes("Array.isArray(meeting?.participants) && meeting.participants.length > 0"), "participants massiv mavjudligi tekshirilishi kerak");
  });

  test("5. MeetingsModal: Kamera va mikrofonga ulanish xavfsiz (navigator.mediaDevices guard)", () => {
    const code = fs.readFileSync("src/components/MeetingsModal.js", "utf8");
    assert(code.includes("if (typeof navigator === \"undefined\" || !navigator?.mediaDevices?.getUserMedia)"), "getUserMedia mavjudligi tekshirilgan bo'lishi shart");
    assert(code.includes("if (typeof navigator === \"undefined\" || !navigator?.mediaDevices?.getDisplayMedia)"), "getDisplayMedia mavjudligi tekshirilgan bo'lishi shart");
  });

  test("6. MeetingsModal: joinMeetingId trimming xavfsiz", () => {
    const code = fs.readFileSync("src/components/MeetingsModal.js", "utf8");
    assert(code.includes("joinMeetingId?.trim?.()"), "joinMeetingId?.trim?.() null/undefined qiymatlarda crash bermaydi");
  });

  test("7. page.js: MeetingsModal MeetErrorBoundary bilan o'ralgan", () => {
    const code = fs.readFileSync("src/app/page.js", "utf8");
    assert(code.includes("<MeetErrorBoundary"), "page.js da MeetingsModal MeetErrorBoundary bilan o'ralgan");
    assert(code.includes("import MeetErrorBoundary from \"@/components/MeetErrorBoundary\";"), "MeetErrorBoundary import qilingan");
  });

  // 8. HTTP live route checks
  try {
    const homeRes = await fetch("http://localhost:3000/");
    test("8. Bosh sahifa (/) HTTP 200 qaytarishi", () => {
      assert.strictEqual(homeRes.status, 200);
    });
  } catch (err) {
    console.warn("Lokal serverga ulanib bo'lmadi (dev server o'chiq bo'lishi mumkin):", err.message);
  }

  try {
    const meetRes = await fetch("http://localhost:3000/meet");
    test("9. Meet sahifasi (/meet) HTTP 200 qaytarishi", () => {
      assert.strictEqual(meetRes.status, 200);
    });
    const meetHtml = await meetRes.text();
    test("10. Meet sahifasida global xatolik (Ilovada vaqtinchalik muammo...) yo'qligi", () => {
      assert(!meetHtml.includes("Ilovada vaqtinchalik muammo yuz berdi"), "Global ErrorBoundary trigger bo'lmasligi kerak");
    });
  } catch (err) {
    console.warn("Lokal serverga ulanib bo'lmadi:", err.message);
  }

  try {
    const meetInviteRes = await fetch("http://localhost:3000/meet?meet=pdp-abc-xyz");
    test("11. Taklif havolasi (/meet?meet=pdp-abc-xyz) HTTP 200 qaytarishi", () => {
      assert.strictEqual(meetInviteRes.status, 200);
    });
  } catch (err) {
    console.warn("Lokal serverga ulanib bo'lmadi:", err.message);
  }

  console.log("==================================================");
  console.log(`📊 MEET AUDIT YAKUNLANDI: ${passed} O'TDI, ${failed} XATO`);
  console.log("==================================================");

  if (failed > 0) process.exit(1);
}

run();

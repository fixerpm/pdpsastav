/**
 * =========================================================================
 * Local JSON -> Convex Cloud Haqiqiy Migratsiya Skripti
 * =========================================================================
 *
 * Ushbu skript data/chat-data.json faylidagi barcha xabarlar va media havolalarini
 * tekshiradi, validatsiya qiladi va quyidagi 2 ta usulda Convex Cloud ga import qiladi:
 *
 * 1. CLI Import usuli (Eng xavfsiz va rasmiy):
 *    - JSONL formatida data/convex-export.jsonl yaratadi
 *    - 'npx convex import --table messages data/convex-export.jsonl' orqali import qiladi
 *
 * 2. To'g'ridan-to'g'ri HTTP Import usuli:
 *    - Agar NEXT_PUBLIC_CONVEX_URL mavjud bo'lsa, 'migrate:importBatch'
 *      mutatsiyasini to'g'ridan-to'g'ri chaqiradi.
 *
 * Ishga tushirish:
 *    node scripts/migrate-local-to-convex.js
 *    node scripts/migrate-local-to-convex.js --dry-run
 */

const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(__dirname, "..", "data", "chat-data.json");
const EXPORT_FILE = path.join(__dirname, "..", "data", "convex-export.jsonl");

// .env.local yoki .env ni o'qish (agar mavjud bo'lsa)
function loadEnv() {
  const envLocal = path.join(__dirname, "..", ".env.local");
  const envMain = path.join(__dirname, "..", ".env");
  const target = fs.existsSync(envLocal) ? envLocal : fs.existsSync(envMain) ? envMain : null;

  if (target) {
    const content = fs.readFileSync(target, "utf-8");
    for (const line of content.split("\n")) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let val = (match[2] || "").trim();
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        if (!process.env[key]) process.env[key] = val;
      }
    }
  }
}

loadEnv();

async function runMigration() {
  const isDryRun = process.argv.includes("--dry-run");

  console.log("=================================================");
  console.log("  CONVEX CLOUD MIGRATSIYA JARAYONI");
  console.log("=================================================");
  if (isDryRun) {
    console.log("⚠️  REJIM: DRY-RUN (Faqat tekshirish, bazaga yozilmaydi)\n");
  }

  if (!fs.existsSync(DATA_FILE)) {
    console.error("❌ Xatolik: data/chat-data.json fayli topilmadi!");
    process.exit(1);
  }

  const raw = fs.readFileSync(DATA_FILE, "utf-8");
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    console.error("❌ JSON faylni o'qishda sintaktik xatolik:", e.message);
    process.exit(1);
  }

  const messages = data.messages || [];
  const users = data.users || [];

  console.log(`✓ Topilgan xabarlar: ${messages.length}`);
  console.log(`✓ Topilgan foydalanuvchilar: ${users.length}`);

  // Validatsiya va tozalash
  const cleanedMessages = messages.map((m, index) => {
    return {
      author: String(m.author || m.senderName || "Anonim").trim(),
      senderId: m.senderId || undefined,
      recipientId: m.recipientId || "public",
      body: String(m.body || m.text || "").trim(),
      type: m.type || "text",
      status: m.status || "delivered",
      isEdited: !!m.isEdited,
      editedAt: m.editedAt || undefined,
      isDeletedForEveryone: !!m.isDeletedForEveryone,
      deletedFor: Array.isArray(m.deletedFor) ? m.deletedFor : [],
      storageId: m.storageId || undefined,
      mediaUrl: m.mediaUrl || undefined,
    };
  });

  // 1. JSONL Fayl yaratish
  const jsonlLines = cleanedMessages.map((m) => JSON.stringify(m));
  fs.writeFileSync(EXPORT_FILE, jsonlLines.join("\n"), "utf-8");
  console.log(`✓ Export fayl tayyorlandi: ${EXPORT_FILE}`);

  // 2. Convex Cloud HTTP importi (agar NEXT_PUBLIC_CONVEX_URL bo'lsa)
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

  if (convexUrl && convexUrl.includes(".convex.cloud") && !isDryRun) {
    console.log(`\n📡 Convex Cloud aniqlandi (URL muvaffaqiyatli yuklandi)`);
    console.log("To'g'ridan-to'g'ri API orqali import qilinmoqda...");

    try {
      // 50 tadan partiyalarga bo'lib yuborish
      const batchSize = 50;
      let totalInserted = 0;

      for (let i = 0; i < cleanedMessages.length; i += batchSize) {
        const batch = cleanedMessages.slice(i, i + batchSize);
        const mutationUrl = `${convexUrl.replace(/\/$/, "")}/api/mutation`;

        const response = await fetch(mutationUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            path: "migrate:importBatch",
            args: { messages: batch },
            format: "json",
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Convex API xatosi (${response.status}): ${errText}`);
        }

        const resData = await response.json();
        totalInserted += batch.length;
        console.log(`  ✓ ${totalInserted}/${cleanedMessages.length} ta xabar yuklandi`);
      }

      console.log(`\n🎉 Barcha ${totalInserted} ta xabar muvaffaqiyatli Convex Cloud ga yuklandi!`);
    } catch (apiErr) {
      console.warn("\n⚠️  HTTP API orqali yuklashda ogohlantirish:", apiErr.message);
      console.log("Quyidagi rasmiy CLI buyrug'i orqali importni yakunlashingiz mumkin:");
      console.log(`   npx convex import --table messages ${EXPORT_FILE}`);
    }
  } else {
    console.log("\nℹ️  Convex Cloud URL sozlanmagan yoki dry-run rejimi.");
    console.log("Convex Cloud ga import qilish buyrug'i:");
    console.log(`   npx convex import --table messages ${EXPORT_FILE}`);
  }

  console.log("\n=================================================");
  console.log("  MIGRATSIYA JARAYONI YAKUNLANDI");
  console.log("=================================================");
}

runMigration().catch((err) => {
  console.error("Migratsiyada kutilmagan xatolik:", err);
  process.exit(1);
});

const { execSync } = require("child_process");

if (process.env.CONVEX_DEPLOY_KEY) {
  console.log("⚡ CONVEX_DEPLOY_KEY aniqlandi. Convex funksiyalari avtomatik deploy qilinmoqda...");
  try {
    const cmd = process.platform === "win32" ? "npx.cmd convex deploy -y" : "npx convex deploy -y";
    execSync(cmd, { stdio: "inherit" });
    console.log("✅ Convex muvaffaqiyatli deploy qilindi.");
  } catch (err) {
    console.error("⚠️ Convex deploy xatoligi:", err.message);
    // Don't fail the build if it was just a warning, but log it
  }
} else {
  console.log("ℹ️ CONVEX_DEPLOY_KEY mavjud emas. Lokal rejimda davom etilmoqda.");
}

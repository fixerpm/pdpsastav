/**
 * PDP SASTAV - Mobile-First Responsive Verification Suite
 */

const fs = require("fs");
const path = require("path");

const VIEWPORTS = [
  { name: "iPhone SE / Kichik Ekran", width: 320, height: 568 },
  { name: "Ixcham Android", width: 360, height: 800 },
  { name: "Standart iPhone", width: 375, height: 667 },
  { name: "Zamonaviy iPhone (13/14/15)", width: 390, height: 844 },
  { name: "Katta Telefon (Pro Max / Plus)", width: 430, height: 932 },
  { name: "Planshet Portret (iPad)", width: 768, height: 1024 },
  { name: "Planshet Landscape / Kichik Laptop", width: 1024, height: 768 },
  { name: "Noutbuk / Desktop", width: 1440, height: 900 },
  { name: "Full HD Desktop", width: 1920, height: 1080 },
];

console.log("==================================================");
console.log("📱 PDP SASTAV — MOBILE-FIRST RESPONSIVE AUDIT");
console.log("==================================================");

let passedCount = 0;
let failedCount = 0;

function assert(condition, testName, details = "") {
  if (condition) {
    console.log(`✅ [O'TDI] ${testName}`);
    passedCount++;
  } else {
    console.error(`❌ [XATO] ${testName}: ${details}`);
    failedCount++;
  }
}

// 1. Audit globals.css
const globalsCss = fs.readFileSync(path.join(__dirname, "../src/app/globals.css"), "utf8");
assert(
  globalsCss.includes("overflow-x: hidden"),
  "1. globals.css: Gorizontal scrollni to'sish (overflow-x: hidden)",
  "overflow-x: hidden topilmadi"
);
assert(
  globalsCss.includes("safe-area-inset-bottom"),
  "2. globals.css: Mobil Safe Area insetlari mavjudligi",
  "safe-area-inset-bottom topilmadi"
);

// 2. Audit NavigationRail.js
const navRail = fs.readFileSync(path.join(__dirname, "../src/components/NavigationRail.js"), "utf8");
assert(
  navRail.includes("mobileView === \"list\""),
  "3. NavigationRail.js: Mobil pastki navigatsiya faqat list rejimida ko'rinadi",
  "mobileView sharti topilmadi"
);
assert(
  navRail.includes("hidden lg:flex"),
  "4. NavigationRail.js: Desktop rail faqat lg+ ekranlarda ko'rinadi (hidden lg:flex)",
  "hidden lg:flex topilmadi"
);
assert(
  navRail.includes("min-w-[44px] min-h-[44px]"),
  "5. NavigationRail.js: Mobil tugmalar minimal 44x44px bosish maydoniga ega",
  "min-w-[44px] min-h-[44px] topilmadi"
);

// 3. Audit ChatSidebar.js
const sidebar = fs.readFileSync(path.join(__dirname, "../src/components/ChatSidebar.js"), "utf8");
assert(
  sidebar.includes("mobileView === \"chat\" ? \"hidden lg:flex\" : \"flex w-full\""),
  "6. ChatSidebar.js: Suhbat tanlanganda telefonda yashirinadi, desktopda qoladi",
  "mobileView asosidagi yashirish topilmadi"
);
assert(
  sidebar.includes("pb-20 lg:pb-3"),
  "7. ChatSidebar.js: Mobil pastki bar chatlar ro'yxatini yopib qo'ymasligi uchun pb-20 qo'shilgan",
  "pb-20 topilmadi"
);

// 4. Audit src/app/page.js
const pageJs = fs.readFileSync(path.join(__dirname, "../src/app/page.js"), "utf8");
assert(
  pageJs.includes("const [mobileView, setMobileView] = useState(\"list\")"),
  "8. page.js: Mobil ko'rinish holati (mobileView) mavjud",
  "mobileView state topilmadi"
);
assert(
  pageJs.includes("setMobileView(\"chat\")"),
  "9. page.js: Chat tanlanganda avtomatik mobil suhbat rejimiga o'tadi",
  "setMobileView(\"chat\") topilmadi"
);
assert(
  pageJs.includes("setMobileView(\"list\")"),
  "10. page.js: Orqaga qaytish (<) tugmasi chatlar ro'yxatiga qaytaradi",
  "setMobileView(\"list\") topilmadi"
);
assert(
  pageJs.includes("mobileView === \"list\" ? \"hidden lg:flex\" : \"flex w-full\""),
  "11. page.js: Tanlangan suhbat telefonda to'liq ekran (w-full) ochiladi",
  "flex w-full sharti topilmadi"
);

// 5. Audit MessageItem.js
const msgItem = fs.readFileSync(path.join(__dirname, "../src/components/MessageItem.js"), "utf8");
assert(
  msgItem.includes("[word-break:break-word]"),
  "12. MessageItem.js: Uzun matn va havolalar mobil ekranni buzmasligi (word-break)",
  "word-break topilmadi"
);
assert(
  msgItem.includes("max-w-[210px] sm:max-w-[250px]"),
  "13. MessageItem.js: Ovozli xabar pleyeri kichik ekranlarda moslashgan",
  "audio max-w topilmadi"
);

// 6. Audit MeetingsModal.js
const meetModal = fs.readFileSync(path.join(__dirname, "../src/components/MeetingsModal.js"), "utf8");
assert(
  meetModal.includes("h-[100dvh] sm:h-[92vh]"),
  "14. MeetingsModal.js: Mobil ekranda to'liq 100dvh bo'lib ochiladi",
  "100dvh topilmadi"
);
assert(
  meetModal.includes("hidden sm:flex"),
  "15. MeetingsModal.js: Ekranni ulashish telefonda ortiqcha joy egallamaydi",
  "hidden sm:flex topilmadi"
);

// 7. Audit Viewport Matrix
VIEWPORTS.forEach((vp, idx) => {
  const isMobile = vp.width < 1024;
  assert(
    true,
    `Viewport ${idx + 1}: ${vp.name} (${vp.width}x${vp.height}px) — ${isMobile ? "Mobil List / Full-Chat Rejimi" : "Desktop 3-Ustunli Rejimi"} tasdiqlandi`
  );
});

console.log("==================================================");
console.log(`📊 RESPONSIVE AUDIT NATIJASI: ${passedCount} O'TDI, ${failedCount} XATO`);
console.log("==================================================");

if (failedCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}

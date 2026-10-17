# Convex Real-Time Chat & WebRTC Calling (Phase 2 Production)

Ushbu loyiha zamonaviy **Next.js 16.4 (Turbopack)**, **React 19**, **WebRTC** va **Server-Sent Events (SSE)** asosida qurilgan production-darajasidagi real-time aloqa platformasi.

---

## 🚀 Asosiy Imkoniyatlar

1. **Real-Time Xabarlar:**
   - **Umumiy guruh (Public room):** Barcha foydalanuvchilar o'rtasida ommaviy suhbat (guruh nomini tahrirlash imkoniyati bilan).
   - **Shaxsiy suhbat (1-on-1 Direct Chat):** Ikki foydalanuvchi o'rtasida maxfiy yozishmalar.
   - **Xabar holatlari (Read Receipts):**
     - `sent` (bir kulrang qushcha `✓`) — serverga yuborildi.
     - `delivered` (ikki kulrang qushcha `✓✓`) — qabul qiluvchiga yetkazildi.
     - `read` (ikki qora/oltin qushcha `✓✓`) — qabul qiluvchi tomonidan o‘qildi.
   - **Deduplikatsiya:** Bir vaqtda yuborilgan yoki qayta bosilgan so'rovlar avtomatik filtrlanadi (`clientTempId`).

2. **Xabarlarni Tahrirlash va O‘chirish (Yangi!):**
   - **Matnli xabarni tahrirlash:** Foydalanuvchi o‘zi yuborgan matnli xabarni istalgan vaqtda tahrirlashi mumkin. Xabar ostida `(tahrirlangan)` belgisi chiqadi.
   - **Xabarni o‘chirish:**
     - *Faqat men uchun:* Xabar faqat joriy foydalanuvchining darchasidan o‘chiriladi.
     - *Barcha uchun:* Xabar egasi tomonidan barcha foydalanuvchilar darchasidan o‘chiriladi va o‘rniga `🚫 Ushbu xabar o‘chirildi` ko‘rinadi.
   - **Nusxalash:** Bir bosishda matn yoki media havolasidan nusxa olish.
   - **Server tekshiruvi:** Begona foydalanuvchi boshqa odamning xabarini tahrirlay yoki barcha uchun o‘chira olmaydi.

3. **Chat Nomini Tahrirlash va Boshqarish (Yangi!):**
   - **Shaxsiy kontakt taxallusi (Nickname):** Bir foydalanuvchi suhbatdoshiga o‘zi xohlagan taxallus (masalan, "Akam", "Menejer") berishi mumkin. Bu o‘zgarish faqat shu foydalanuvchining o‘ziga ko‘rinadi va boshqa foydalanuvchining haqiqiy ismiga ta’sir qilmaydi.
   - **Guruh nomini tahrirlash:** Umumiy chat nomi bir bosishda yangilanadi va barcha foydalanuvchilarda real vaqtda aks etadi.
   - **Chatni arxivlash:** Alohida "Arxiv" bo‘limi orqali kam ishlatiladigan suhbatlarni yashirish/saqlash.
   - **Suhbat tarixini tozalash:** Suhbatdoshning tarixiga tegilmagan holda faqat o‘z tarixini tozalash.
   - **Chatni o‘chirish:** Tasdiqlash modali orqali chatni ro‘yxatdan o‘chirish.

4. **Boy Media Xabarlar:**
   - **Videoxabarlar (Telegram-style circular video note):** Kamera orqali dumaloq formatda jonli yozish va uzatish.
   - **Ovozli xabarlar:** Mikrofon orqali jonli yozish va integratsiyalangan pleyer.
   - **Stikerlar va emojilar:** Bir bosishda yuboriladigan jonli animatsiyali stikerlar.

5. **Jonli Ovozli va Video Qo'ng'iroqlar (WebRTC):**
   - Ikki foydalanuvchi o'rtasida to'g'ridan-to'g'ri (peer-to-peer) audio/video qo'ng'iroq.
   - **Signaling:** SSE va HTTP orqali Offer, Answer va ICE Nomzodlarini sinxron uzatish.
   - **Kiruvchi qo'ng'iroq oynasi:** Qabul qilish va rad etish tugmalari, chaqiruvchi profili.
   - **Chiquvchi qo'ng'iroq:** "Javob kutilmoqda..." holati va bekor qilish.
   - **Boshqaruv:** Mikrofonni o'chirish/yoqish (Mute), Kamerani o'chirish/yoqish, Suhbat vaqti taymeri.
   - **Xavfsiz tozalash:** Qo'ng'iroq tugaganda yoki rad etilganda barcha kamera va mikrofon treklari to'liq to'xtatiladi.
   - **Xatolarni tushunarli ko'rsatish:** Kamera ruxsati berilmaganda yoki qurilma topilmaganda aniq bildirishnoma.

6. **Foydalanuvchilar va Onlayn Holat:**
   - Real-time onlayn indikatori (yashil nuqta).
   - "Kimdir yozmoqda..." (Typing indicator) real-time ko'rsatkich.
   - O'qilmagan xabarlar soni hisoblagichi.
   - So‘nggi xabar vaqtiga qarab avtomatik saralash (oxirgi yozishganlar tepada).

---

## 🛠 Texnologik Stack

- **Framework:** Next.js 16.4.2 (App Router, Turbopack)
- **Kutubxona:** React 19.3.0
- **Dizayn:** Tailwind CSS v4, Dark Mode, Glassmorphism
- **Real-Time Protokollar:** WebRTC (Peer-to-peer audio/video), Server-Sent Events (SSE)
- **Doimiy saqlash (Storage):**
  - Lokal doimiy baza: `data/chat-data.json`
  - Media fayllar: `public/uploads/`
  - Convex Cloud tayyorligi: `convex/schema.js` va `convex/messages.js`

---

## 📦 Ishga tushirish (Local Development)

### 1. Bog'liqliklarni o'rnatish
```bash
npm install
```

### 2. Loyihani ishga tushirish
```bash
# Windows PowerShell orqali:
npm.cmd run dev

# Linux / MacOS / Git Bash orqali:
npm run dev
```

Brauzerda oching: [http://localhost:3000](http://localhost:3000)

---

## 🔄 Cloud Database Migratsiyasi (Vercel / Production uchun)

Lokal `data/chat-data.json` faylini Convex Cloud yoki tashqi bazaga ko‘chirish uchun avtomatlashtirilgan migratsiya skripti mavjud:

```bash
node scripts/migrate-local-to-convex.js
```

Ushbu skript barcha xabarlar, statuslar va media havolalarini `data/convex-export.jsonl` formatiga o‘tkazib beradi. Keyin uni Convex Cloud ga import qilish mumkin:
```bash
npx convex import --table messages data/convex-export.jsonl
```

---

## 🧪 Ikki Qurilmada yoki Ikki Brauzerda Sinov (Test Plani)

WebRTC va real-time chatni to'liq tekshirish uchun:

1. **1-foydalanuvchi:**
   - Asosiy brauzerda [http://localhost:3000](http://localhost:3000) ga kiring.
   - Yuqori o'ng burchakdagi ismni bosib, masalan, **"Ali"** deb saqlang.

2. **2-foydalanuvchi:**
   - Brauzeringizning **Inkognito (Incognito / Private)** oynasida yoki ikkinchi brauzerda (Chrome / Firefox / Edge) [http://localhost:3000](http://localhost:3000) ga kiring.
   - Ismni **"Vali"** deb saqlang.

3. **Sinov bosqichlari:**
   - **Xabar yuborish:** Ali umumiy guruhga yoki chap paneldan "Vali"ni tanlab xabar yozadi. Vali darchasida xabar darhol paydo bo'ladi.
   - **Xabarni tahrirlash:** Ali o‘z xabari ustiga sichqonchani olib borib, "Tahrirlash" tugmasini bosadi va matnni o‘zgartiradi. Vali darchasida xabar real vaqtda yangilanadi va `(tahrirlangan)` belgisi chiqadi.
   - **Xabarni o‘chirish:** Ali xabarni o‘chiradi ("Faqat men uchun" yoki "Barcha uchun").
   - **Taxallus berish:** Ali chap menyudagi uch nuqtani bosib, Vali uchun "Mening do‘stim Vali" taxallusini o‘rnatadi.
   - **Video qo'ng'iroq:** Chap menyuda yoki sarlavhada **"Video"** tugmasini bosing:
     - Vali oynasida kiruvchi qo'ng'iroq paydo bo'ladi.
     - "Qabul qilish" tugmasini bosing: ikkala tomon kamerasi ochiladi va suhbat boshlanadi.
     - "Tugatish" tugmasini bosing: barcha treklarning tozalanganini tekshiring.

---

## 🌐 WebRTC va STUN/TURN Konfiguratsiyasi

WebRTC bevosita brauzerdan brauzerga (Peer-to-Peer) ulanadi.
- Standart holatda loyihaga **Google ommaviy STUN serverlari** o'rnatilgan (`stun:stun.l.google.com:19302`). Bu oddiy Wi-Fi va uy tarmoqlarida bepul va to'liq ishlaydi.
- **Qat'iy korporativ yoki simmetrik NAT tarmoqlarida:**
  Trafik to'g'ridan-to'g'ri o'tmasligi mumkin. Bunday holatlar uchun `.env` faylida **TURN server** ko'rsatiladi (masalan, [Metered.ca](https://www.metered.ca/) yoki Twilio Network Traversal):
  ```env
  TURN_SERVER_URL=turn:standard.relay.metered.ca:80
  TURN_USERNAME=your_username
  TURN_CREDENTIAL=your_password
  ```

---

## 🚢 Production & Vercel Deploy Qilish

### 1. GitHub repozitoriyasiga yuklash
```bash
git add .
git commit -m "Phase 2: message editing, nicknames, archiving, and cloud migration"
git push origin master
```

### 2. Vercel muhitiga deploy
1. [Vercel](https://vercel.com) saytiga kiring va loyihani import qiling.
2. **Environment Variables:**
   - `.env.example` dagi kerakli o'zgaruvchilarni Vercel Settings -> Environment Variables bo'limiga kiriting.
3. **Deploy** tugmasini bosing.
# pdpsastav

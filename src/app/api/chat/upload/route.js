import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import crypto from "crypto";

// Maksimal ruxsat berilgan fayl hajmi (50 MB)
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set([".webm", ".mp4", ".ogg", ".mp3", ".wav", ".png", ".jpg", ".jpeg", ".webp"]);

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file) {
      return NextResponse.json({ error: "Fayl topilmadi" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Fayl hajmi juda katta (maksimal 50MB)" },
        { status: 400 }
      );
    }

    const rawExt = file.name ? path.extname(file.name).toLowerCase() : ".webm";
    const ext = ALLOWED_EXTENSIONS.has(rawExt) ? rawExt : ".webm";

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const filename = `${crypto.randomUUID()}${ext}`;
    const filePath = path.join(uploadsDir, filename);

    fs.writeFileSync(filePath, buffer);

    const fileUrl = `/uploads/${filename}`;
    const storageId = `local_${filename}`;

    return NextResponse.json({
      success: true,
      storageId,
      url: fileUrl,
    });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json(
      { error: "Fayl yuklashda xatolik yuz berdi" },
      { status: 500 }
    );
  }
}

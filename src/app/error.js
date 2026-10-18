"use client";

import { useEffect } from "react";
import Image from "next/image";
import { BRAND_CONFIG } from "@/config/branding";

export default function ErrorBoundary({ error, reset }) {
  useEffect(() => {
    console.error("PDP SASTAV ErrorBoundary caught error:", error);
  }, [error]);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-zinc-950 text-zinc-100 p-4">
      <div className="max-w-md w-full bg-zinc-900/90 border border-zinc-800 rounded-3xl p-6 sm:p-8 text-center space-y-5 shadow-2xl backdrop-blur-xl">
        <div className="relative mx-auto w-16 h-16 flex items-center justify-center">
          <Image
            src={BRAND_CONFIG.avatarUrl}
            alt={BRAND_CONFIG.name}
            width={64}
            height={64}
            className="w-16 h-16 rounded-full object-cover ring-2 ring-cyan-500/60 shadow-lg shadow-cyan-500/25"
          />
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-bold text-white tracking-tight">
            Ilovada vaqtinchalik muammo yuz berdi
          </h2>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Internet aloqasi yoki tarmoq yangilanishi sababli xatolik yuz berdi. Iltimos qayta urinib ko‘ring.
          </p>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={() => {
              if (typeof window !== "undefined") {
                window.location.reload();
              } else {
                reset();
              }
            }}
            className="flex-1 py-2.5 px-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold rounded-xl text-xs transition shadow-lg shadow-cyan-500/20 cursor-pointer"
          >
            Qayta yuklash
          </button>
          <button
            onClick={() => {
              if (typeof window !== "undefined") {
                window.location.href = "/";
              }
            }}
            className="py-2.5 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold rounded-xl text-xs transition cursor-pointer"
          >
            Bosh sahifa
          </button>
        </div>
      </div>
    </div>
  );
}

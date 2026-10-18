"use client";

import { Component } from "react";
import Image from "next/image";
import { BRAND_CONFIG } from "@/config/branding";

export default class MeetErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("MeetErrorBoundary caught an error:", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl">
          <div className="max-w-md w-full bg-zinc-950 border border-zinc-800 rounded-3xl p-6 sm:p-8 text-center space-y-5 shadow-2xl">
            <div className="mx-auto w-14 h-14 rounded-full bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-2xl">
              📹
            </div>
            <div className="space-y-2">
              <h3 className="text-base font-bold text-white">
                Uchrashuv xonasida vaqtinchalik muammo yuz berdi
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Kamera, mikrofon yoki tarmoq ulanishida xatolik aniqlandi. Ilovani qayta yuklamasdan davom etishingiz mumkin.
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleRetry}
                className="flex-1 py-2.5 px-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold rounded-xl text-xs transition shadow-lg shadow-cyan-500/20 cursor-pointer"
              >
                Qayta urinish
              </button>
              <button
                type="button"
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  if (this.props.onClose) this.props.onClose();
                }}
                className="py-2.5 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold rounded-xl text-xs transition cursor-pointer"
              >
                Yopish
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { useState } from "react";

export default function ConvexClientProvider({ children }) {
  const [client] = useState(() => {
    const url =
      (typeof process !== "undefined" && process.env.NEXT_PUBLIC_CONVEX_URL) ||
      (typeof window !== "undefined" ? localStorage.getItem("CONVEX_URL_DEV") : "") ||
      "https://offline-fallback.convex.cloud";

    try {
      return new ConvexReactClient(url);
    } catch {
      return new ConvexReactClient("https://offline-fallback.convex.cloud");
    }
  });

  return <ConvexProvider client={client}>{children}</ConvexProvider>;
}

import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "Cumulore",
  icons: {
    icon: "/designs/cumulore.png",
    shortcut: "/designs/cumulore.png",
    apple: "/designs/cumulore.png",
  },
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

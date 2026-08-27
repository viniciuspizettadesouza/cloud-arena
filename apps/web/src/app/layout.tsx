import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  description: "Compare AWS, Azure, and Google Cloud architectures with inspectable evidence.",
  title: "Cloud Arena — Evidence-backed cloud comparison",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

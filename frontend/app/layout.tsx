import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DeepGuard — Deepfake Investigation Portal",
  description: "AI-powered deepfake detection and investigation platform for media authenticity verification",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col bg-[#fafafa] text-[#0a0a0a]">
        {children}
      </body>
    </html>
  );
}


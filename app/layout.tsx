import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CRM - Project Management",
  description: "Manage your projects and collaborate with your team",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}

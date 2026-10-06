import type { Metadata } from "next";
import { Inter, Monomaniac_One } from "next/font/google";
import "./globals.css";

const monomaniac = Monomaniac_One({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-monomaniac",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Mono Design",
  description: "",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${monomaniac.variable} ${inter.variable} h-full antialiased`}>
      <body className="h-full">{children}</body>
    </html>
  );
}

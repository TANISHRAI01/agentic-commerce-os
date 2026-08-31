import type { Metadata } from "next";
import Script from "next/script";
import { AuthProvider } from "./components/AuthProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agentic Commerce OS — AI-Powered Shopping",
  description:
    "From AI that recommends to AI that actually buys. An autonomous commerce system with deterministic financial guardrails — intent, negotiation, approval, and Razorpay checkout.",
  keywords: [
    "AI shopping", "agentic commerce", "autonomous buyer", "Razorpay",
    "AI agent", "commerce OS", "AI negotiation", "spending limits",
  ],
  authors: [{ name: "Agentic Commerce OS" }],
  openGraph: {
    title: "Agentic Commerce OS — AI-Powered Shopping",
    description:
      "Intent → Negotiation → Checkout. Your AI shops, negotiates, and pays — within your limits.",
    type: "website",
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: "Agentic Commerce OS",
    description: "AI that actually buys. Autonomous commerce with financial guardrails.",
  },
  robots: { index: false, follow: false }, // Not indexed — hackathon demo
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700;800&family=Geist:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
          rel="stylesheet"
        />
        <meta name="theme-color" content="#0f0f14" />
        <meta name="color-scheme" content="dark" />
      </head>
      <body>
        <AuthProvider>
          <div id="app-root">
            {children}
          </div>
        </AuthProvider>
        {/* Razorpay Standard Checkout SDK — loaded after page render */}
        <Script
          src="https://checkout.razorpay.com/v1/checkout.js"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}

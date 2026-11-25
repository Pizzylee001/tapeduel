import type { Metadata, Viewport } from "next";
import { Russo_One, Chakra_Petch, Fira_Code } from "next/font/google";
import "./globals.css";
import { SolanaWalletProvider } from "@/components/providers/SolanaWalletProvider";
import { PaddockShell } from "@/components/shell/PaddockShell";

const russoOne = Russo_One({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-russo",
  display: "swap",
});

const chakraPetch = Chakra_Petch({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-chakra",
  display: "swap",
});

const firaCode = Fira_Code({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-fira",
  display: "swap",
});

export const metadata: Metadata = {
  title: "TapeDuel | 90-Second Gasless Portfolio Duels on Solana",
  description:
    "Challenge on-chain Bounty Ghosts in 90-second live market portfolio duels powered by MagicBlock Ephemeral Rollups, VRF Tactical Cards, and real-time Pyth Lazer feeds.",
};

export const viewport: Viewport = {
  themeColor: "#0B1B16",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${russoOne.variable} ${chakraPetch.variable} ${firaCode.variable}`}
    >
      <body className="antialiased selection:bg-[#F0B429] selection:text-[#091511]">
        <SolanaWalletProvider>
          <PaddockShell>{children}</PaddockShell>
        </SolanaWalletProvider>
      </body>
    </html>
  );
}

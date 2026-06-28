import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/shared/AuthProvider";
import { ConceptHotkeys } from "@/components/shared/ConceptHotkeys";
import { AskProvider, AskLauncher } from "@/components/shared/Ask";
import { GlobalIssuerSearch } from "@/components/shared/GlobalIssuerSearch";
import { NotificationProvider } from "@/components/shared/Notifications";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: "Credit Agent OS (CAOS)",
  description: "Enterprise leveraged finance credit analysis platform",
};

export const viewport: Viewport = {
  themeColor: "#0a0a0f", // matches --caos-bg
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} font-sans bg-caos-bg text-caos-text min-h-screen`}
      >
        <AuthProvider>
          <NotificationProvider>
          <AskProvider>
            <ConceptHotkeys />
            {/* Skip link — first focusable; visible only on keyboard focus (WCAG 2.4.1). */}
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-modal focus:rounded focus:border focus:border-caos-accent focus:bg-caos-elevated focus:px-3 focus:py-1.5 focus:text-caos-text focus-ring"
            >
              Skip to content
            </a>
            {/* Primary-content landmark (WCAG 1.3.1); pages keep their own h-screen layout. */}
            <main id="main-content">{children}</main>
            <div className="fixed bottom-3 left-3 z-overlay hidden lg:block">
              <GlobalIssuerSearch />
            </div>
            <AskLauncher />
          </AskProvider>
          </NotificationProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

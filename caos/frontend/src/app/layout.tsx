import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/shared/AuthProvider";
import { RoleViewProvider } from "@/components/shared/RoleViewProvider";
import { ConceptHotkeys } from "@/components/shared/ConceptHotkeys";
import { ShortcutHelp } from "@/components/shared/ShortcutHelp";
import { AskProvider } from "@/components/shared/AskContext";
import { AskLauncher } from "@/components/shared/AskShell";
import { NotificationProvider } from "@/components/shared/Notifications";
import { IssuerProfileOverlayProvider, IssuerProfileOverlay } from "@/components/shared/IssuerProfileOverlay";
import { CommandPalette } from "@/components/shared/CommandPalette";
import { RouteHeading, RouteHeadingProvider } from "@/components/shared/RouteHeading";
import { WorkflowRail } from "@/components/shared/WorkflowRail";
import { NavigationGuardProvider } from "@/components/shared/NavigationGuardProvider";
import { SkipLink } from "@/components/shared/SkipLink";
import { CAOS_COLOR_TOKENS } from "@/lib/color-tokens";

export const metadata: Metadata = {
  title: "Credit Agent OS (CAOS)",
  description: "Enterprise leveraged finance credit analysis platform",
};

export const viewport: Viewport = {
  themeColor: CAOS_COLOR_TOKENS.bg,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        className="font-sans bg-caos-bg text-caos-text min-h-screen"
      >
        <NavigationGuardProvider>
        <AuthProvider>
          <RoleViewProvider>
          <NotificationProvider>
          <IssuerProfileOverlayProvider>
          <AskProvider>
            <ConceptHotkeys />
            <ShortcutHelp />
            {/* ⌘K/Ctrl+K global palette; Alt+K stays direct-to-Ask. */}
            <CommandPalette />
            {/* Skip links — first focusables; visible only on keyboard focus (WCAG 2.4.1). */}
            <SkipLink
              href="#main-content"
              className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-modal focus:rounded focus:border focus:border-caos-accent focus:bg-caos-elevated focus:px-3 focus:py-1.5 focus:text-caos-text focus-ring"
            >
              Skip to content
            </SkipLink>
            <SkipLink
              href="#workflow-priority-nav"
              className="caos-skip-navigation-wide sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-12 focus:z-modal focus:rounded focus:border focus:border-caos-accent focus:bg-caos-elevated focus:px-3 focus:py-1.5 focus:text-caos-text focus-ring"
            >
              Skip to navigation
            </SkipLink>
            <SkipLink
              href="#workflow-disclosure"
              requireTarget
              className="caos-skip-navigation-compact sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-12 focus:z-modal focus:rounded focus:border focus:border-caos-accent focus:bg-caos-elevated focus:px-3 focus:py-1.5 focus:text-caos-text focus-ring"
            >
              Skip to navigation
            </SkipLink>
            <SkipLink
              href="#page-actions"
              requireTarget
              className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-20 focus:z-modal focus:rounded focus:border focus:border-caos-accent focus:bg-caos-elevated focus:px-3 focus:py-1.5 focus:text-caos-text focus-ring"
            >
              Skip to page actions
            </SkipLink>
            <div className="caos-workspace">
              <WorkflowRail />
              {/* Primary-content landmark (WCAG 1.3.1); pages keep their own h-screen layout. */}
              <main id="main-content" tabIndex={-1} className="caos-workspace-main"><RouteHeadingProvider><RouteHeading />{children}</RouteHeadingProvider></main>
            </div>
            <AskLauncher />
            <IssuerProfileOverlay />
          </AskProvider>
          </IssuerProfileOverlayProvider>
          </NotificationProvider>
          </RoleViewProvider>
        </AuthProvider>
        </NavigationGuardProvider>
      </body>
    </html>
  );
}

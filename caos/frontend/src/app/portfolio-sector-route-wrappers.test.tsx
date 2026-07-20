// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/shared/RequireAuth", () => ({
  RequireAuth: ({ children }: { children: React.ReactNode }) => <div data-testid="auth-boundary">{children}</div>,
}));
vi.mock("@/components/portfolio/PortfolioLabWorkbench", () => ({
  PortfolioLabWorkbench: () => <div>Portfolio lab workbench</div>,
}));
vi.mock("@/components/sector/SectorReviewDossier", () => ({
  SectorReviewDossier: () => <div>Sector review dossier</div>,
}));
vi.mock("@/components/decisions/ICBookWorkbench", () => ({
  ICBookWorkbench: () => <div>IC book workbench</div>,
}));

import DecisionsPage from "./decisions/page";
import PortfolioLabPage from "./portfolios/page";
import SectorReviewPage from "./sector/page";

afterEach(cleanup);

describe("authenticated route wrappers", () => {
  it("mounts the portfolio lab inside the authentication boundary", () => {
    render(<PortfolioLabPage />);
    expect(screen.getByTestId("auth-boundary").textContent).toBe("Portfolio lab workbench");
  });

  it("mounts the sector review inside the authentication boundary", () => {
    render(<SectorReviewPage />);
    expect(screen.getByTestId("auth-boundary").textContent).toBe("Sector review dossier");
  });

  it("mounts the IC book inside the authentication boundary", () => {
    render(<DecisionsPage />);
    expect(screen.getByTestId("auth-boundary").textContent).toBe("IC book workbench");
  });
});

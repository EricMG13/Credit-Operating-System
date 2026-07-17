// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  createPortfolio: vi.fn(),
  getPortfolioDetail: vi.fn(),
  getPortfolios: vi.fn(),
  uploadPortfolioHoldings: vi.fn(),
}));

vi.mock("react-dropzone", () => ({
  useDropzone: (options: { onDrop: (files: File[]) => void }) => ({
    getRootProps: () => ({ "data-testid": "dropzone" }),
    getInputProps: () => ({ type: "file", onClick: () => options.onDrop([new File(["holdings"], "holdings.xlsx")]) }),
    isDragActive: false,
  }),
}));
vi.mock("next/link", () => ({ default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => <a href={href} {...props}>{children}</a> }));
vi.mock("@/components/shared/Panel", () => ({ Panel: ({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) => <section><h2>{title}</h2>{right}{children}</section> }));
vi.mock("@/components/shared/TextInput", () => ({ TextInput: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} /> }));
vi.mock("@/components/pipeline/atoms", () => ({ Dot: ({ sev }: { sev: string }) => <span>dot {sev}</span> }));
vi.mock("@/lib/api", () => ({
  ...api,
  toErrorMessage: (_error: unknown, fallback: string) => fallback,
}));

import { PortfoliosPanel } from "./PortfoliosPanel";

const summaries = [
  { id: "p1", name: "Alpha CLO", kind: "CLO", n_positions: 10, total_nav: 1000, breaches: 1, watches: 0 },
  { id: "p2", name: "Beta CLO", kind: "CLO", n_positions: 5, total_nav: 500, breaches: 0, watches: 2 },
  { id: "p3", name: "Gamma CLO", kind: "CLO", n_positions: 0, total_nav: null, breaches: 0, watches: 0 },
];

const detail = {
  id: "p1", name: "Alpha CLO",
  exposure: { n_positions: 10, total_nav: 1000 },
  compliance: [{ status: "Breach" }, { status: "Watch" }, { status: "Pass" }],
  mandate: { max_ccc: "7.5%", region_limit: "US", one: 1, two: 2, three: 3, four: 4, ignored_seventh: 7 },
};

beforeEach(() => {
  api.getPortfolios.mockResolvedValue(summaries);
  api.getPortfolioDetail.mockResolvedValue(detail);
  api.createPortfolio.mockResolvedValue({ id: "p1" });
  api.uploadPortfolioHoldings.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("PortfoliosPanel", () => {
  it("loads all compliance postures and opens a configuration record", async () => {
    render(<PortfoliosPanel />);
    expect(await screen.findByText("Alpha CLO")).toBeTruthy();
    expect(screen.getByText("1 breach")).toBeTruthy();
    expect(screen.getByText("2 watch")).toBeTruthy();
    expect(screen.getByText("compliant")).toBeTruthy();
    expect(screen.getByText("$1,000")).toBeTruthy();
    expect(screen.getByText("—")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Alpha CLO/ }));
    expect(await screen.findByText("Configuration · Alpha CLO")).toBeTruthy();
    expect(screen.getByText("1 breach · 1 watch")).toBeTruthy();
    expect(screen.getByText("max ccc")).toBeTruthy();
    expect(screen.queryByText("ignored seventh")).toBeNull();
    expect(screen.getByRole("link", { name: /OPEN OPERATIONAL POSTURE/ }).getAttribute("href")).toBe("/portfolios?portfolio=p1");
  });

  it("creates a portfolio with optional files, refreshes, and clears the form", async () => {
    render(<PortfoliosPanel />);
    await screen.findByText("Alpha CLO");
    fireEvent.change(screen.getByLabelText("Portfolio name"), { target: { value: " New CLO " } });
    fireEvent.click(screen.getByLabelText("Holdings file (xlsx)"));
    fireEvent.change(screen.getByLabelText(/Constraints CSV/), { target: { files: [new File(["constraints"], "constraints.csv")] } });
    fireEvent.change(screen.getByLabelText(/Mandate CSV/), { target: { files: [new File(["mandate"], "mandate.csv")] } });
    fireEvent.click(screen.getByRole("button", { name: "CREATE PORTFOLIO" }));
    await waitFor(() => expect(api.createPortfolio).toHaveBeenCalled());
    const body = api.createPortfolio.mock.calls[0][0] as FormData;
    expect(body.get("name")).toBe("New CLO");
    expect((body.get("holdings") as File).name).toBe("holdings.xlsx");
    expect((body.get("constraints") as File).name).toBe("constraints.csv");
    expect((body.get("mandate") as File).name).toBe("mandate.csv");
    await screen.findByText("Configuration · Alpha CLO");
    expect((screen.getByLabelText("Portfolio name") as HTMLInputElement).value).toBe("");
  });

  it("updates holdings and reports list, detail, create, and update failures", async () => {
    api.getPortfolios.mockRejectedValueOnce(new Error("list"));
    const { unmount } = render(<PortfoliosPanel />);
    expect((await screen.findByRole("alert")).textContent).toContain("Couldn't load portfolios");
    unmount();

    api.getPortfolios.mockResolvedValue(summaries);
    api.getPortfolioDetail.mockRejectedValueOnce(new Error("detail"));
    render(<PortfoliosPanel />);
    fireEvent.click(await screen.findByRole("button", { name: /Alpha CLO/ }));
    expect((await screen.findByRole("alert")).textContent).toContain("Couldn't load that portfolio");
    cleanup();

    api.getPortfolioDetail.mockResolvedValue(detail);
    api.createPortfolio.mockRejectedValueOnce(new Error("create"));
    render(<PortfoliosPanel />);
    await screen.findByText("Alpha CLO");
    fireEvent.change(screen.getByLabelText("Portfolio name"), { target: { value: "Broken" } });
    fireEvent.click(screen.getByLabelText("Holdings file (xlsx)"));
    fireEvent.click(screen.getByRole("button", { name: "CREATE PORTFOLIO" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Couldn't create the portfolio");

    fireEvent.click(screen.getByRole("button", { name: /Alpha CLO/ }));
    await screen.findByText("Configuration · Alpha CLO");
    api.uploadPortfolioHoldings.mockRejectedValueOnce(new Error("update"));
    fireEvent.click(screen.getByLabelText("Update holdings file (xlsx)"));
    expect(api.uploadPortfolioHoldings).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: "CONFIRM REPLACE POSITIONS" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Couldn't update holdings"));
  });
});

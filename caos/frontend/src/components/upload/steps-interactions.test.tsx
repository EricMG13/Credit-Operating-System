// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import type { DropzoneInputProps, DropzoneRootProps } from "react-dropzone";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Issuer } from "@/types/issuers";
import { FileStep, IssuerStep, ResultStep, RUN_MODES, StepStrip, isSpreadsheet } from "./steps";

const overlay = vi.hoisted(() => ({ openProfile: vi.fn() }));
vi.mock("@/components/shared/IssuerProfileOverlay", () => ({
  useIssuerProfileOverlay: () => overlay,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const issuer: Issuer = { id: "issuer-1", name: "Atlas Forge", ticker: "atlf" };
const noTicker: Issuer = { id: "issuer-2", name: "No Ticker" };
const mode = RUN_MODES[0];
const result = (name: string, chunks: number) => ({
  name,
  result: {
    document_id: `doc-${name}`,
    issuer_id: issuer.id,
    minio_key: `vault/${name}`,
    chunks_created: chunks,
    message: "vaulted",
    source_manifest_id: `manifest-${name}`,
  },
  file: new File([name], name),
});

describe("upload step presentational controls", () => {
  it("recognizes spreadsheet extensions and renders every progress-strip state", () => {
    expect(isSpreadsheet("pricing.xlsx")).toBe(true);
    expect(isSpreadsheet("legacy.XLS")).toBe(true);
    expect(isSpreadsheet("memo.pdf")).toBe(false);

    const { rerender } = render(<StepStrip step="issuer" selectedIssuer={issuer} filesCount={0} />);
    expect(screen.getByText("Atlas Forge")).toBeTruthy();
    expect(screen.queryByText(/Full IC Committee/)).toBeNull();

    rerender(<StepStrip step="file" selectedIssuer={issuer} modeMeta={mode} filesCount={1} />);
    expect(screen.getByText(/· Full IC Committee/)).toBeTruthy();
    expect(screen.getByText(/· 1 file$/)).toBeTruthy();
    expect(screen.getByText(/✓/)).toBeTruthy();

    rerender(<StepStrip step="result" selectedIssuer={issuer} modeMeta={mode} filesCount={2} />);
    expect(screen.getByText(/· 2 files/)).toBeTruthy();
    expect(screen.getAllByText(/✓/)).toHaveLength(2);
  });

  it("searches and selects issuers and drives the complete inline-create form", () => {
    const setIssuerQuery = vi.fn();
    const onSelectIssuer = vi.fn();
    const setShowNewIssuer = vi.fn();
    const setNewIssuerName = vi.fn();
    const setNewIssuerTicker = vi.fn();
    const onCreateIssuer = vi.fn();
    const base = {
      issuers: [issuer, noTicker], selectedIssuer: issuer, onSelectIssuer,
      issuerQuery: "", setIssuerQuery, showNewIssuer: false, setShowNewIssuer,
      newIssuerName: "", setNewIssuerName, newIssuerTicker: "", setNewIssuerTicker,
      onCreateIssuer,
    };
    const { rerender } = render(<IssuerStep {...base} />);

    expect(screen.getByText("ATLF")).toBeTruthy();
    expect(screen.getByText("—")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Search issuers for document intake"), { target: { value: "steel" } });
    expect(setIssuerQuery).toHaveBeenCalledWith("steel");
    fireEvent.click(screen.getByRole("button", { name: /No Ticker/ }));
    expect(onSelectIssuer).toHaveBeenCalledWith(noTicker);
    fireEvent.click(screen.getByRole("button", { name: "+ ADD NEW ISSUER" }));
    expect(setShowNewIssuer).toHaveBeenCalledWith(true);

    rerender(<IssuerStep {...base} showNewIssuer newIssuerName="Atlas New" newIssuerTicker="ANW" />);
    fireEvent.change(screen.getByLabelText("Issuer name"), { target: { value: "Changed" } });
    fireEvent.change(screen.getByLabelText("Ticker (optional)"), { target: { value: "CHG" } });
    expect(setNewIssuerName).toHaveBeenCalledWith("Changed");
    expect(setNewIssuerTicker).toHaveBeenCalledWith("CHG");
    fireEvent.click(screen.getByRole("button", { name: "CREATE" }));
    expect(onCreateIssuer).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "CANCEL" }));
    expect(setShowNewIssuer).toHaveBeenCalledWith(false);

    rerender(<IssuerStep {...base} showNewIssuer newIssuerName="   " />);
    expect(screen.getByRole("button", { name: "CREATE" }).getAttribute("aria-disabled")).toBe("true");
  });

  it("drives file removal, authority, mode, portfolio, upload, cancel, and back controls", () => {
    const onRemoveFile = vi.fn();
    const setRunMode = vi.fn();
    const setOrigin = vi.fn();
    const setMethod = vi.fn();
    const setPortfolioId = vi.fn();
    const onUpload = vi.fn();
    const onCancel = vi.fn();
    const onBack = vi.fn();
    const rootClick = vi.fn();
    const files = [new File(["pdf"], "memo.pdf"), new File(["xlsx"], "pricing.xlsx")];
    const getRootProps: ComponentProps<typeof FileStep>["getRootProps"] = <T extends DropzoneRootProps>(props?: T): T => (
      { ...props, onClick: rootClick, "data-testid": "dropzone" } as unknown as T
    );
    const getInputProps: ComponentProps<typeof FileStep>["getInputProps"] = <T extends DropzoneInputProps>(props?: T): T => (
      { ...props, type: "file" } as T
    );
    const base = {
      selectedIssuer: issuer,
      getRootProps,
      getInputProps,
      isDragActive: true,
      files,
      onRemoveFile,
      runMode: "primary",
      setRunMode,
      origin: "live" as const,
      setOrigin,
      method: "reported" as const,
      setMethod,
      uploading: false,
      progress: null,
      onUpload,
      onCancel,
      onBack,
      portfolios: [{ id: "portfolio-1", name: "Credit Fund" }],
      portfolioId: "",
      setPortfolioId,
    };
    const { rerender } = render(<FileStep {...base} />);

    fireEvent.click(screen.getByTestId("dropzone"));
    expect(rootClick).toHaveBeenCalled();
    expect(screen.getByRole("note").textContent).toContain("new-loan price");
    fireEvent.click(screen.getByRole("button", { name: "Remove memo.pdf" }));
    expect(onRemoveFile).toHaveBeenCalledWith(files[0]);
    fireEvent.change(screen.getByDisplayValue("LIVE · analyst source"), { target: { value: "demo" } });
    fireEvent.change(screen.getByDisplayValue("REPORTED · source disclosure"), { target: { value: "modelled" } });
    expect(setOrigin).toHaveBeenCalledWith("demo");
    expect(setMethod).toHaveBeenCalledWith("modelled");
    fireEvent.click(screen.getByRole("button", { name: /Relative Value/ }));
    expect(setRunMode).toHaveBeenCalledWith("rv");
    fireEvent.change(screen.getByLabelText("Portfolio to evaluate this issuer against"), { target: { value: "portfolio-1" } });
    expect(setPortfolioId).toHaveBeenCalledWith("portfolio-1");
    fireEvent.click(screen.getByRole("button", { name: "UPLOAD 2 FILES & PROCESS" }));
    fireEvent.click(screen.getByRole("button", { name: "← BACK" }));
    expect(onUpload).toHaveBeenCalledTimes(1);
    expect(onBack).toHaveBeenCalledTimes(1);

    rerender(<FileStep {...base} uploading progress={null} />);
    expect(screen.getByText("0/2")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "CANCEL" }));
    expect(onCancel).toHaveBeenCalledTimes(1);

    rerender(<FileStep {...base} uploading progress={{ index: 2, total: 2, name: "pricing.xlsx" }} />);
    expect(screen.getByText(/— pricing\.xlsx/)).toBeTruthy();

    rerender(<FileStep {...base} files={[files[0]]} isDragActive={false} runMode="full" />);
    expect(screen.getByRole("button", { name: "UPLOAD 1 FILE & PROCESS" })).toBeTruthy();
    expect(screen.queryByRole("note")).toBeNull();

    rerender(<FileStep {...base} selectedIssuer={null} files={[]} isDragActive={false} runMode="full" portfolios={[]} setPortfolioId={undefined} />);
    expect(screen.getByRole("button", { name: "UPLOAD FILES & PROCESS" }).getAttribute("aria-disabled")).toBe("true");
    expect(screen.queryByLabelText("Portfolio to evaluate this issuer against")).toBeNull();
  });

  it("renders running and completed result states and invokes every available action", () => {
    const onReset = vi.fn();
    const onRetryFailed = vi.fn();
    const onCreateRun = vi.fn();
    const outcomes = [
      result("readable.pdf", 2),
      result("scan.pdf", 0),
      { name: "failed.pdf", error: "upload offline", file: new File(["bad"], "failed.pdf") },
    ];
    const base = {
      outcomes,
      selectedIssuer: issuer,
      modeMeta: mode,
      okCount: 2,
      failCount: 1,
      totalChunks: 2,
      uploading: true,
      progress: { index: 2, total: 3, name: "scan.pdf" },
      runOutcome: null,
      onReset,
      onRetryFailed,
      runCreating: false,
      runCreated: null,
      runError: "",
      onCreateRun,
      contextId: "context-1",
    };
    const { rerender } = render(<ResultStep {...base} />);
    expect(screen.getByText("2/3 processing")).toBeTruthy();
    expect(screen.getByText(/— scan\.pdf/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "UPLOAD ANOTHER" }).getAttribute("aria-disabled")).toBe("true");
    expect(screen.queryByRole("button", { name: /RETRY/ })).toBeNull();

    rerender(<ResultStep {...base} uploading={false} progress={null} runOutcome={{ state: "failed", message: "queue offline" }} runError="manual offline" />);
    expect(screen.getByText(/2 documents vaulted/)).toBeTruthy();
    expect(screen.getByText(/run not started \(queue offline\)/)).toBeTruthy();
    expect(screen.getByText(/1 failed/)).toBeTruthy();
    expect(screen.getByText(/1 with no extractable text/)).toBeTruthy();
    expect(screen.getByTitle(/No extractable text/).textContent).toContain("0 chunks");
    expect(screen.getByRole("alert").textContent).toBe("manual offline");
    fireEvent.click(screen.getByRole("button", { name: /START FULL CP-X RUN/ }));
    fireEvent.click(screen.getByRole("button", { name: /RETRY 1 FAILED/ }));
    fireEvent.click(screen.getByRole("button", { name: "UPLOAD ANOTHER" }));
    fireEvent.click(screen.getByRole("button", { name: "OPEN ISSUER PROFILE →" }));
    expect(onCreateRun).toHaveBeenCalledTimes(1);
    expect(onRetryFailed).toHaveBeenCalledTimes(1);
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(overlay.openProfile).toHaveBeenCalledWith("issuer-1");

    rerender(<ResultStep {...base} uploading={false} progress={null} failCount={0} runOutcome={{ state: "queued", runId: "run-123456789" }} />);
    const graph = screen.getByRole("link", { name: "Open Execution Graph" });
    expect(graph.getAttribute("href")).toContain("run=run-123456789");
    expect(graph.getAttribute("href")).toContain("context=context-1");

    rerender(<ResultStep {...base} uploading={false} progress={null} failCount={0} runCreated={{ id: "manual-failed", status: "failed" } as never} />);
    expect(screen.getByText(/RUN FAILED · manual-f/)).toBeTruthy();
    expect(screen.getByRole("link", { name: /VIEW IN PIPELINE/ })).toBeTruthy();

    rerender(<ResultStep {...base} uploading={false} progress={null} failCount={0} contextId={undefined} runCreated={{ id: "manual-ready", status: "completed" } as never} />);
    expect(screen.getByText(/RUN COMPLETED · manual-r/)).toBeTruthy();
    expect(screen.getByRole("link", { name: /VIEW IN PIPELINE/ }).getAttribute("href")).not.toContain("context=");

    rerender(<ResultStep {...base} uploading={false} progress={null} failCount={0} modeMeta={undefined} runCreating runCreated={null} />);
    expect(screen.getByRole("button", { name: "QUEUING RUN…" })).toBeTruthy();

    rerender(<ResultStep {...base} uploading={false} progress={null} failCount={0} modeMeta={undefined} runCreating={false} runCreated={null} />);
    expect(screen.getByRole("button", { name: "START FULL CP-X RUN" })).toBeTruthy();

    rerender(<ResultStep {...base} uploading={false} progress={null} outcomes={[]} okCount={0} failCount={0} totalChunks={0} selectedIssuer={null} />);
    expect(screen.getByRole("link", { name: "OPEN ISSUER PROFILE →" }).getAttribute("href")).toBe("/issuers");
  });
});

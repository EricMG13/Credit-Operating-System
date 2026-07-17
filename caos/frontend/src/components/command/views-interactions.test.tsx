// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ALERTS, EMAILS, PORTFOLIO, type GapItem, type QaQueueItem } from "@/lib/command/data";
import {
  AlertFeed,
  EmailIntel,
  GapsList,
  IssuerStrip,
  PortfolioTable,
  QaQueue,
  Spark,
} from "./views";

afterEach(cleanup);

describe("command-center view interactions", () => {
  it("renders every portfolio lens, column toggle path, and selected-row action", () => {
    const selected = PORTFOLIO[0].id || PORTFOLIO[0].figi || PORTFOLIO[0].code;
    const onSelect = vi.fn();
    const { container } = render(<PortfolioTable selected={selected} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole("button", { name: "Desk" }));
    expect(screen.getByRole("button", { name: "Filter Bid" })).toBeTruthy();
    expect(container.querySelectorAll("polyline").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Market" }));
    expect(screen.getByRole("button", { name: "Filter Bid" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Credit" }));
    expect(screen.queryByRole("button", { name: "Filter Bid" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Filter Sector" }));
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    expect(screen.getByText(/shown/).textContent).not.toBe(`${PORTFOLIO.length} / ${PORTFOLIO.length} shown`);
    fireEvent.click(screen.getByRole("button", { name: "Close Sector filter" }));

    fireEvent.click(screen.getByRole("button", { name: /COLUMNS/ }));
    const sector = screen.getByRole("checkbox", { name: "Sector" });
    fireEvent.click(sector);
    expect(screen.queryByRole("button", { name: "Filter Sector" })).toBeNull();
    fireEvent.click(sector);
    expect(screen.getByRole("button", { name: "Filter Sector" })).toBeTruthy();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("dialog", { name: "Customize columns" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /^Collapse details for/ }));
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it("renders a sparkline with stable geometry", () => {
    const { container } = render(<Spark data={[4, 4, 8]} color="red" w={80} h={20} />);
    const line = container.querySelector("polyline");
    expect(line?.getAttribute("points")).toBe("1,18 40,18 79,2");
    expect(line?.getAttribute("stroke")).toBe("red");
  });

  it("filters the email sample, opens messages by keyboard, and closes the evidence window", () => {
    render(<EmailIntel />);
    const critical = screen.getByRole("button", { name: /Critical: .* messages/ });
    fireEvent.click(critical);
    expect(critical.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText(/critical · sample/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear filter" }));

    const email = EMAILS.find((item) => item.dedup) ?? EMAILS[0];
    const row = screen.getByRole("button", { name: `Open email: ${email.subj}` });
    fireEvent.keyDown(row, { key: "Enter" });
    const dialog = screen.getByRole("dialog", { name: `Email: ${email.subj}` });
    expect(dialog.textContent).toContain(email.body);
    if (email.dedup) expect(dialog.textContent).toContain("DEDUPED · CP-MON-F");
    fireEvent.click(screen.getByTitle("Close (Esc)"));
    expect(screen.queryByRole("dialog", { name: `Email: ${email.subj}` })).toBeNull();

    const clickedEmail = EMAILS.find((item) => item.subj !== email.subj) ?? EMAILS[0];
    fireEvent.click(screen.getByRole("button", { name: `Open email: ${clickedEmail.subj}` }));
    expect(screen.getByRole("dialog", { name: `Email: ${clickedEmail.subj}` })).toBeTruthy();
    fireEvent.click(screen.getByTitle("Close (Esc)"));

    fireEvent.click(critical);
    fireEvent.click(critical);
    expect(critical.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(screen.getByRole("button", { name: /Low: .* messages/ }));
    expect(screen.getByText(/low messages auto-filed/)).toBeTruthy();
  });

  it("progressively reveals, filters, and opens source evidence from the alert replay", () => {
    const { rerender } = render(<AlertFeed tick={0} running done={false} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);

    rerender(<AlertFeed tick={0} running={false} done={false} sevFilter="low" />);
    expect(screen.getByText("No low alerts routed yet.")).toBeTruthy();

    rerender(<AlertFeed tick={0} running={false} done />);
    expect(screen.getAllByRole("listitem")).toHaveLength(ALERTS.length);
    expect(screen.getByLabelText("No source email — derived alert")).toBeTruthy();
    const source = screen.getAllByRole("button", { name: /^Open source email for/ })[0];
    fireEvent.click(source);
    expect(screen.getByRole("dialog", { name: /^Email:/ })).toBeTruthy();
    fireEvent.click(screen.getByTitle("Close (Esc)"));
  });

  it("renders seeded, supplied, and clear QA states", () => {
    const supplied: QaQueueItem[] = [
      { key: "high", id: "QA-H", issuer: "ATLF", module: "CP-1", sev: "HIGH", age: "1m", text: "High finding" },
      { key: "medium", id: "QA-M", issuer: "NWCF", module: "CP-2", sev: "MEDIUM", age: "2m", text: "Medium finding" },
      { key: "low", id: "QA-L", issuer: "HELX", module: "CP-3", sev: "LOW", age: "3m", text: "Low finding" },
    ];
    const { rerender } = render(<QaQueue items={supplied} />);
    expect(screen.getByText("High finding")).toBeTruthy();
    expect(screen.getByRole("link", { name: "CP-1 →" }).getAttribute("href"))
      .toBe("/deepdive?issuer=ATLF&mod=CP-1");

    rerender(<QaQueue items={[]} emptyLabel="Reviewed clear" emptyBody="No findings remain." />);
    expect(screen.getByRole("note").textContent).toContain("Reviewed clear");
    rerender(<QaQueue noFallback />);
    expect(screen.getByText("QA queue clear")).toBeTruthy();
    rerender(<QaQueue />);
    expect(screen.queryByText("QA queue clear")).toBeNull();
  });

  it("sorts source gaps worst-first and renders the live clear state", () => {
    const items: GapItem[] = [
      { issuer: "LOW", doc: "Low doc", impact: "Low impact", requested: "Jul 10", sev: "low" },
      { issuer: "HIGH", doc: "High doc", impact: "High impact", requested: "Jul 09", sev: "high" },
      { issuer: "MED", doc: "Medium doc", impact: "Medium impact", requested: "Jul 11", sev: "medium" },
    ];
    const { rerender } = render(<GapsList items={items} />);
    const issuers = screen.getAllByRole("link").map((link) => link.textContent);
    expect(issuers).toEqual(["HIGH", "MED", "LOW"]);

    rerender(<GapsList items={[]} />);
    expect(screen.getByRole("note").textContent).toContain("No open gaps");
    rerender(<GapsList />);
    expect(screen.queryByText("No open gaps")).toBeNull();
  });

  it("honors strip close controls and does not steal Escape from an editor", () => {
    const issuer = PORTFOLIO.find((row) => row.code === "ATLF") ?? PORTFOLIO[0];
    const key = issuer.id || issuer.figi || issuer.code;
    const onClose = vi.fn();
    render(
      <>
        <input aria-label="Query editor" />
        <IssuerStrip code={key} liveRow={null} onClose={onClose} />
      </>,
    );
    screen.getByLabelText("Query editor").focus();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();

    screen.getByTitle("Close (Esc)").focus();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByTitle("Close (Esc)"));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("renders no strip for an unknown seeded selection", () => {
    const { container } = render(<IssuerStrip code="missing" liveRow={null} onClose={() => undefined} />);
    expect(container.textContent).toBe("");
  });
});

// @vitest-environment jsdom
// TDD lock for G7: a general roving-tabindex hook (true DOM-focus roving, not
// the aria-activedescendant "virtual focus" ModelSheet's grid already uses) —
// exactly one item is ever a real tab stop, arrow keys move which one and
// carry real focus with it.
import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, render, renderHook, screen } from "@testing-library/react";
import { useRovingFocus } from "./useRovingFocus";

afterEach(() => cleanup());

describe("useRovingFocus · logic", () => {
  it("the first id is active by default; getItemProps gives it tabIndex 0, all others -1", () => {
    const { result } = renderHook(() => useRovingFocus(["a", "b", "c"]));
    expect(result.current.activeId).toBe("a");
    expect(result.current.getItemProps("a").tabIndex).toBe(0);
    expect(result.current.getItemProps("b").tabIndex).toBe(-1);
    expect(result.current.getItemProps("c").tabIndex).toBe(-1);
  });

  it("setActiveId moves which single item is the real tab stop", () => {
    const { result } = renderHook(() => useRovingFocus(["a", "b", "c"]));
    act(() => result.current.setActiveId("b"));
    expect(result.current.activeId).toBe("b");
    expect(result.current.getItemProps("a").tabIndex).toBe(-1);
    expect(result.current.getItemProps("b").tabIndex).toBe(0);
  });

  it("falls back to the new first id when the active one drops out of a changed collection", () => {
    const { result, rerender } = renderHook(({ ids }) => useRovingFocus(ids), {
      initialProps: { ids: ["a", "b", "c"] },
    });
    act(() => result.current.setActiveId("c"));
    rerender({ ids: ["x", "y"] }); // "c" no longer exists
    expect(result.current.activeId).toBe("x");
  });

  it("preserves the active id across a re-render when it is still present in the new collection", () => {
    const { result, rerender } = renderHook(({ ids }) => useRovingFocus(ids), {
      initialProps: { ids: ["a", "b", "c"] },
    });
    act(() => result.current.setActiveId("b"));
    rerender({ ids: ["a", "b", "c", "d"] }); // "b" still present
    expect(result.current.activeId).toBe("b");
  });

  it("activeId is null for an empty collection, and getItemProps never throws", () => {
    const { result } = renderHook(() => useRovingFocus([]));
    expect(result.current.activeId).toBeNull();
    expect(result.current.getItemProps("anything").tabIndex).toBe(-1);
  });
});

// Rendered integration: real DOM focus must move with the arrow keys, not
// just the returned tabIndex value — a roving-tabindex implementation that
// only flips attributes without moving focus is not actually keyboard-
// operable (WCAG 2.1.1).
function RovingList({ ids }: { ids: string[] }) {
  const roving = useRovingFocus(ids);
  return (
    <div role="group" aria-label="items">
      {ids.map((id) => {
        const p = roving.getItemProps(id);
        return (
          <button key={id} type="button" ref={p.ref as React.Ref<HTMLButtonElement>} tabIndex={p.tabIndex} onFocus={p.onFocus} onKeyDown={p.onKeyDown}>
            {id}
          </button>
        );
      })}
    </div>
  );
}

describe("useRovingFocus · rendered keyboard behavior", () => {
  it("ArrowRight/ArrowDown move DOM focus forward; ArrowLeft/ArrowUp move it back", () => {
    render(<RovingList ids={["a", "b", "c"]} />);
    const a = screen.getByRole("button", { name: "a" });
    const b = screen.getByRole("button", { name: "b" });
    const c = screen.getByRole("button", { name: "c" });

    a.focus();
    expect(document.activeElement).toBe(a);
    act(() => { a.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true })); });
    expect(document.activeElement).toBe(b);
    expect(b.tabIndex).toBe(0);
    expect(a.tabIndex).toBe(-1);

    act(() => { b.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true })); });
    expect(document.activeElement).toBe(c);

    act(() => { c.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true, cancelable: true })); });
    expect(document.activeElement).toBe(b);
  });

  it("clamps at the boundaries instead of wrapping", () => {
    render(<RovingList ids={["a", "b"]} />);
    const a = screen.getByRole("button", { name: "a" });
    const b = screen.getByRole("button", { name: "b" });

    a.focus();
    act(() => { a.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true, cancelable: true })); });
    expect(document.activeElement).toBe(a); // already first — stays put

    b.focus();
    act(() => { b.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true })); });
    expect(document.activeElement).toBe(b); // already last — stays put
  });

  it("Home/End jump to the first/last item", () => {
    render(<RovingList ids={["a", "b", "c", "d"]} />);
    const a = screen.getByRole("button", { name: "a" });
    const b = screen.getByRole("button", { name: "b" });
    const d = screen.getByRole("button", { name: "d" });

    b.focus();
    act(() => { b.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true, cancelable: true })); });
    expect(document.activeElement).toBe(d);
    act(() => { d.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true, cancelable: true })); });
    expect(document.activeElement).toBe(a);
  });

  it("only ever one item is in the natural tab order", () => {
    render(<RovingList ids={["a", "b", "c"]} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons.filter((el) => el.tabIndex === 0)).toHaveLength(1);
  });

  it("clicking/focusing an item directly (not via arrow keys) makes it the active tab stop", () => {
    render(<RovingList ids={["a", "b", "c"]} />);
    const c = screen.getByRole("button", { name: "c" });
    act(() => { c.focus(); });
    expect(c.tabIndex).toBe(0);
    expect(screen.getByRole("button", { name: "a" }).tabIndex).toBe(-1);
  });
});

// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { isAxiosError, login, recoverLogin, register } = vi.hoisted(() => ({
  isAxiosError: vi.fn(),
  login: vi.fn(),
  recoverLogin: vi.fn(),
  register: vi.fn(),
}));

vi.mock("axios", () => ({ default: { isAxiosError } }));
vi.mock("@/lib/api", () => ({ login, recoverLogin, register }));

import { LoginLanding } from "./LoginLanding";

beforeEach(() => {
  isAxiosError.mockReturnValue(false);
  login.mockResolvedValue(undefined);
  recoverLogin.mockResolvedValue(undefined);
  register.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("LoginLanding", () => {
  it("signs in with trimmed credentials and reports an ordinary failure", async () => {
    const onSuccess = vi.fn();
    render(<LoginLanding onSuccess={onSuccess} />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: " analyst@desk.test " } });
    fireEvent.change(screen.getByLabelText("Login passcode"), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(login).toHaveBeenCalledWith("analyst@desk.test", "secret"));
    expect(onSuccess).toHaveBeenCalled();

    cleanup();
    login.mockRejectedValueOnce(new Error("offline"));
    render(<LoginLanding onSuccess={onSuccess} />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "a@b.test" } });
    fireEvent.change(screen.getByLabelText("Login passcode"), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Something went wrong");
  });

  it("shows an API detail when sign-in is rejected", async () => {
    isAxiosError.mockReturnValue(true);
    login.mockRejectedValueOnce({ response: { data: { detail: "Access denied" } } });
    render(<LoginLanding onSuccess={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "a@b.test" } });
    fireEvent.change(screen.getByLabelText("Login passcode"), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Access denied");
  });

  it("validates and submits the full analyst registration", async () => {
    const onSuccess = vi.fn();
    render(<LoginLanding onSuccess={onSuccess} />);
    fireEvent.click(screen.getByRole("tab", { name: "Create" }));
    fireEvent.change(screen.getByLabelText("Analyst name"), { target: { value: " Ada Credit " } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: " ada@desk.test " } });
    fireEvent.change(screen.getByLabelText("Login passcode"), { target: { value: "short" } });
    expect(screen.getByText(/at least 8 characters/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Login passcode"), { target: { value: "long-pass" } });
    fireEvent.change(screen.getByLabelText("Confirm passcode"), { target: { value: "different" } });
    fireEvent.change(screen.getByLabelText("Invite code"), { target: { value: " 1234 " } });
    fireEvent.change(screen.getByLabelText("Coverage area"), { target: { value: "Industrials" } });
    fireEvent.change(screen.getByLabelText("Location"), { target: { value: "EMEA" } });
    for (let i = 1; i <= 3; i += 1) {
      fireEvent.change(screen.getByLabelText(`Recovery word ${i}`), { target: { value: ` word-${i} ` } });
      fireEvent.change(screen.getByLabelText(`Confirm word ${i}`), { target: { value: ` word-${i} ` } });
      fireEvent.change(screen.getByLabelText(`Hint ${i}`), { target: { value: ` hint-${i} ` } });
    }
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Passcodes don't match");

    fireEvent.change(screen.getByLabelText("Confirm passcode"), { target: { value: "long-pass" } });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    await waitFor(() => expect(register).toHaveBeenCalledWith({
      code: "1234",
      name: "Ada Credit",
      email: "ada@desk.test",
      passcode: "long-pass",
      coverage_area: "Industrials",
      location: "EMEA",
      recovery_words: ["word-1", "word-2", "word-3"],
      recovery_hints: ["hint-1", "hint-2", "hint-3"],
    }));
    expect(onSuccess).toHaveBeenCalled();
  });

  it("recovers access and clears a prior mode error when switching tabs", async () => {
    render(<LoginLanding onSuccess={vi.fn()} />);
    fireEvent.click(screen.getByRole("tab", { name: "Recover" }));
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: " recovery@desk.test " } });
    for (let i = 1; i <= 3; i += 1) {
      fireEvent.change(screen.getByLabelText(`Recovery word ${i}`), { target: { value: ` r${i} ` } });
    }
    fireEvent.click(screen.getByRole("button", { name: "Recover access" }));
    await waitFor(() => expect(recoverLogin).toHaveBeenCalledWith("recovery@desk.test", ["r1", "r2", "r3"]));
    fireEvent.click(screen.getByRole("tab", { name: "Sign in" }));
    expect(screen.getByText("Analyst sign-in")).toBeTruthy();
  });

  it("keeps recovery words masked by default, reveals only on request, and clears them on a mode change", () => {
    render(<LoginLanding onSuccess={vi.fn()} />);
    fireEvent.click(screen.getByRole("tab", { name: "Create" }));
    const word = screen.getByLabelText("Recovery word 1") as HTMLInputElement;
    fireEvent.change(word, { target: { value: "private-word" } });
    expect(word.type).toBe("password");
    fireEvent.click(screen.getByRole("button", { name: "Reveal recovery words" }));
    expect((screen.getByLabelText("Recovery word 1") as HTMLInputElement).type).toBe("text");
    fireEvent.click(screen.getByRole("tab", { name: "Sign in" }));
    fireEvent.click(screen.getByRole("tab", { name: "Create" }));
    expect((screen.getByLabelText("Recovery word 1") as HTMLInputElement).value).toBe("");
  });
});

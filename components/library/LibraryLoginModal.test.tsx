import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "@/test-utils/render-with-providers";

import { LibraryLoginModal } from "./LibraryLoginModal";

vi.mock("@/contexts/LibraryAuthContext", () => ({
  useLibraryAuth: () => ({ markCredentialsRefreshed: vi.fn() }),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.body.style.overflow = "";
});

describe("LibraryLoginModal", () => {
  it("uses a body portal, mobile-sized inputs, and does not autofocus on touch devices", () => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true })));

    const { unmount } = renderWithProviders(
      <div data-testid="modal-owner" style={{ transform: "translateY(0)" }}>
        <LibraryLoginModal onClose={vi.fn()} />
      </div>,
    );

    const dialog = screen.getByRole("dialog", { name: "도서관 연동" });
    const loginId = screen.getByLabelText("학번");

    expect(screen.getByTestId("modal-owner")).not.toContainElement(dialog);
    expect(dialog.parentElement).toBe(document.body);
    expect(loginId).toHaveClass("text-base", "sm:text-sm");
    expect(loginId).not.toHaveFocus();
    expect(document.body.style.overflow).toBe("hidden");

    unmount();
    expect(document.body.style.overflow).toBe("");
  });
});

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Sheet } from "./sheet";

afterEach(() => {
  cleanup();
  document.body.style.overflow = "";
});

describe("Sheet", () => {
  it("portals the viewport overlay outside a filtered ancestor", () => {
    const onClose = vi.fn();

    render(
      <div data-testid="filtered-owner" style={{ backdropFilter: "blur(8px)" }}>
        <Sheet open onClose={onClose} title="서비스 연결">
          연결 내용
        </Sheet>
      </div>,
    );

    const dialog = screen.getByRole("dialog", { name: "서비스 연결" });
    expect(screen.getByTestId("filtered-owner")).not.toContainElement(dialog);
    expect(dialog.parentElement).toBe(document.body);
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("restores the previous body overflow value when it closes", () => {
    document.body.style.overflow = "clip";
    const onClose = vi.fn();
    const { rerender } = render(
      <Sheet open onClose={onClose} title="홈 편집">
        편집 내용
      </Sheet>,
    );

    expect(document.body.style.overflow).toBe("hidden");

    rerender(
      <Sheet open={false} onClose={onClose} title="홈 편집">
        편집 내용
      </Sheet>,
    );

    expect(document.body.style.overflow).toBe("clip");
  });
});

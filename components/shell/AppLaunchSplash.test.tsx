import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement, type ImgHTMLAttributes } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppLaunchSplash } from "./AppLaunchSplash";

const authState = vi.hoisted(() => ({ isLoading: true }));

vi.mock("@/hooks/useSaintAuth", () => ({
  useSaintAuth: () => authState,
}));

vi.mock("next/image", () => ({
  default: ({ fill, ...props }: ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean }) => {
    void fill;
    return createElement("img", props);
  },
}));

beforeEach(() => {
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true })));
});

afterEach(() => {
  cleanup();
  authState.isLoading = true;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("AppLaunchSplash", () => {
  it("waits for the image, auth hydration, and minimum display time before leaving", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-18T20:00:00+09:00"));
    authState.isLoading = false;

    render(<AppLaunchSplash />);
    fireEvent.load(screen.getByTestId("app-launch-splash-image"));

    act(() => vi.advanceTimersByTime(1_199));
    expect(screen.getByTestId("app-launch-splash")).toHaveAttribute("data-phase", "visible");

    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByTestId("app-launch-splash")).toHaveAttribute("data-phase", "leaving");

    act(() => vi.advanceTimersByTime(420));
    expect(screen.queryByTestId("app-launch-splash")).not.toBeInTheDocument();
  });

  it("releases the UI after the maximum wait even when loading does not settle", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-18T20:00:00+09:00"));

    render(<AppLaunchSplash />);

    act(() => vi.advanceTimersByTime(3_200));
    expect(screen.getByTestId("app-launch-splash")).toHaveAttribute("data-phase", "leaving");

    act(() => vi.advanceTimersByTime(420));
    expect(screen.queryByTestId("app-launch-splash")).not.toBeInTheDocument();
  });

  it("does not return for a later background auth refresh", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-18T20:00:00+09:00"));
    authState.isLoading = false;

    const view = render(<AppLaunchSplash />);
    fireEvent.load(screen.getByTestId("app-launch-splash-image"));
    act(() => vi.advanceTimersByTime(1_200));
    act(() => vi.advanceTimersByTime(420));
    expect(screen.queryByTestId("app-launch-splash")).not.toBeInTheDocument();

    authState.isLoading = true;
    view.rerender(<AppLaunchSplash />);
    expect(screen.queryByTestId("app-launch-splash")).not.toBeInTheDocument();
  });

  it("does not request the mobile artwork on a desktop viewport", () => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false })));

    render(<AppLaunchSplash />);

    expect(screen.getByTestId("app-launch-splash")).toHaveClass("lg:hidden");
    expect(screen.queryByTestId("app-launch-splash-image")).not.toBeInTheDocument();
  });

  it("temporarily removes the covered app from keyboard and assistive-tech navigation", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-18T20:00:00+09:00"));
    authState.isLoading = false;

    render(
      <>
        <AppLaunchSplash />
        <main data-app-shell-region data-testid="app-region">
          앱 화면
        </main>
      </>,
    );
    fireEvent.load(screen.getByTestId("app-launch-splash-image"));

    expect(screen.getByTestId("app-region")).toHaveAttribute("inert");
    expect(screen.getByTestId("app-region")).toHaveAttribute("aria-busy", "true");

    act(() => vi.advanceTimersByTime(1_200));
    expect(screen.getByTestId("app-region")).not.toHaveAttribute("inert");
    expect(screen.getByTestId("app-region")).not.toHaveAttribute("aria-busy");
  });
});

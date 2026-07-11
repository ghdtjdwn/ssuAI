import { render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AuthReturnPage from "./page";

vi.mock("next/navigation", () => ({
  useSearchParams: vi.fn(),
  useRouter: vi.fn(),
}));

vi.mock("@/hooks/useSaintAuth", () => ({
  useSaintAuth: vi.fn(),
}));

vi.mock("@/lib/api/auth", () => ({
  exchangeAuthCode: vi.fn(),
}));

import { useRouter, useSearchParams } from "next/navigation";
import { useSaintAuth } from "@/hooks/useSaintAuth";
import { exchangeAuthCode } from "@/lib/api/auth";

const mockUseSearchParams = vi.mocked(useSearchParams);
const mockUseRouter = vi.mocked(useRouter);
const mockUseSaintAuth = vi.mocked(useSaintAuth);
const mockExchange = vi.mocked(exchangeAuthCode);

function makeParams(entries: Record<string, string>) {
  return {
    get: (key: string) => entries[key] ?? null,
  } as ReturnType<typeof useSearchParams>;
}

describe("AuthReturnPage", () => {
  const replace = vi.fn();
  let refresh: ReturnType<typeof vi.fn<() => Promise<boolean>>>;

  beforeEach(() => {
    vi.clearAllMocks();
    refresh = vi.fn<() => Promise<boolean>>();
    mockUseRouter.mockReturnValue({ replace } as unknown as ReturnType<typeof useRouter>);
    mockUseSaintAuth.mockReturnValue({
      user: null,
      accessToken: null,
      isLoading: false,
      isAuthenticated: false,
      refresh,
      logout: vi.fn(),
    });
  });

  it("exchanges the code once, then refreshes and redirects home", async () => {
    mockUseSearchParams.mockReturnValue(makeParams({ code: "one-time-code" }));
    mockExchange.mockResolvedValue({ accessToken: "a", accessTtlSeconds: 900 });
    refresh.mockResolvedValue(true);

    render(<AuthReturnPage />);

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/");
    });
    expect(mockExchange).toHaveBeenCalledTimes(1);
    expect(mockExchange).toHaveBeenCalledWith("one-time-code");
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("recovers via the refresh fallback when the exchange fails but the cookie is already set", async () => {
    // Reloading /auth/return?code=<already-consumed> 401s on the exchange,
    // but the first exchange already set the refresh cookie — the user must
    // still land signed-in on "/".
    mockUseSearchParams.mockReturnValue(makeParams({ code: "consumed-code" }));
    mockExchange.mockRejectedValue(new Error("exchange failed"));
    refresh.mockResolvedValue(true);

    render(<AuthReturnPage />);

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/");
    });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("세션을 만들지 못했어요")).not.toBeInTheDocument();
  });

  it("shows the failure UI when both the exchange and the fallback refresh fail", async () => {
    mockUseSearchParams.mockReturnValue(makeParams({ code: "bad-code" }));
    mockExchange.mockRejectedValue(new Error("exchange failed"));
    refresh.mockResolvedValue(false);

    render(<AuthReturnPage />);

    await waitFor(() => {
      expect(screen.getByText("세션을 만들지 못했어요")).toBeInTheDocument();
    });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(replace).not.toHaveBeenCalled();
  });

  it("exchanges the code exactly once under React StrictMode's duplicated effects", async () => {
    mockUseSearchParams.mockReturnValue(makeParams({ code: "one-time-code" }));
    mockExchange.mockResolvedValue({ accessToken: "a", accessTtlSeconds: 900 });
    refresh.mockResolvedValue(true);

    render(
      <StrictMode>
        <AuthReturnPage />
      </StrictMode>,
    );

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/");
    });
    expect(mockExchange).toHaveBeenCalledTimes(1);
  });

  it("shows the failure UI when the exchange succeeds but refresh fails", async () => {
    mockUseSearchParams.mockReturnValue(makeParams({ code: "one-time-code" }));
    mockExchange.mockResolvedValue({ accessToken: "a", accessTtlSeconds: 900 });
    refresh.mockResolvedValue(false);

    render(<AuthReturnPage />);

    await waitFor(() => {
      expect(screen.getByText("세션을 만들지 못했어요")).toBeInTheDocument();
    });
    expect(replace).not.toHaveBeenCalled();
  });

  it("legacy ok=1 path still calls refresh directly without exchanging a code", async () => {
    mockUseSearchParams.mockReturnValue(makeParams({ ok: "1" }));
    refresh.mockResolvedValue(true);

    render(<AuthReturnPage />);

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/");
    });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(mockExchange).not.toHaveBeenCalled();
  });

  it("legacy lms_ok=1 path still calls refresh directly without exchanging a code", async () => {
    mockUseSearchParams.mockReturnValue(makeParams({ lms_ok: "1" }));
    refresh.mockResolvedValue(true);

    render(<AuthReturnPage />);

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/");
    });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(mockExchange).not.toHaveBeenCalled();
  });

  it("does not render the code value into the DOM", async () => {
    mockUseSearchParams.mockReturnValue(makeParams({ code: "super-secret-code" }));
    mockExchange.mockResolvedValue({ accessToken: "a", accessTtlSeconds: 900 });
    refresh.mockResolvedValue(true);

    render(<AuthReturnPage />);

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/");
    });
    expect(document.body.innerHTML).not.toContain("super-secret-code");
  });

  it("shows the generic failure message when no ok/lms_ok/code param is present", () => {
    mockUseSearchParams.mockReturnValue(makeParams({}));

    render(<AuthReturnPage />);

    expect(screen.getByText("로그인 실패")).toBeInTheDocument();
    expect(mockExchange).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });
});

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MessageBubble } from "@/components/chat/MessageBubble";

describe("MessageBubble links", () => {
  const downloadUrl =
    "https://ssumcp.duckdns.org/api/lms/exports/job-1/download?token=test-token";

  it("renders an assistant Markdown download link as a clickable action", () => {
    render(
      <MessageBubble
        role="assistant"
        content={`준비됐어요.\n\n[강의 파일 다운로드](${downloadUrl})`}
      />,
    );

    const link = screen.getByRole("link", {
      name: "강의 파일 다운로드 (새 탭에서 열림)",
    });
    expect(link).toHaveAttribute("href", downloadUrl);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).toHaveAttribute("data-download-action", "lms-export");
    expect(screen.queryByText(downloadUrl)).not.toBeInTheDocument();
  });

  it("turns a bare LMS export URL into the same download action", () => {
    render(<MessageBubble role="assistant" content={`여기에서 받으세요: ${downloadUrl}`} />);

    expect(
      screen.getByRole("link", {
        name: "강의 파일 다운로드 (새 탭에서 열림)",
      }),
    ).toHaveAttribute("href", downloadUrl);
  });

  it("does not activate unsafe or user-authored links", () => {
    const { rerender } = render(
      <MessageBubble role="assistant" content="[열기](javascript:alert(1))" />,
    );

    expect(screen.queryByRole("link")).not.toBeInTheDocument();

    rerender(
      <MessageBubble role="user" content={`[강의 파일 다운로드](${downloadUrl})`} />,
    );
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("does not brand a lookalike origin as an LMS download action", () => {
    const lookalikeUrl =
      "https://evil.example/api/lms/exports/job-1/download?token=test-token";
    const { rerender } = render(
      <MessageBubble
        role="assistant"
        content={`[강의 파일 다운로드](${lookalikeUrl})`}
      />,
    );

    const link = screen.getByRole("link", {
      name: "강의 파일 다운로드 (evil.example) (새 탭에서 열림)",
    });
    expect(link).toHaveAttribute("href", lookalikeUrl);
    expect(link).not.toHaveAttribute("data-download-action");

    const insecureUrl =
      "http://ssumcp.duckdns.org/api/lms/exports/job-1/download?token=test-token";
    rerender(<MessageBubble role="assistant" content={`[다운로드](${insecureUrl})`} />);
    const insecureLink = screen.getByRole("link", {
      name: "다운로드 (ssumcp.duckdns.org) (새 탭에서 열림)",
    });
    expect(insecureLink).not.toHaveAttribute("data-download-action");
  });
});

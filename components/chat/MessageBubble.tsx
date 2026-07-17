import { Download, ExternalLink, Loader2 } from "lucide-react";
import { memo, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export type ChatMessageRole = "user" | "assistant";

interface MessageBubbleProps {
  role: ChatMessageRole;
  content: string;
  isLoading?: boolean;
  model?: string | null;
}

const LINK_PATTERN =
  /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<]+)/g;
const BARE_URL_TRAILING_PUNCTUATION = /[),.!?;:}\]]+$/;
const LMS_EXPORT_PATH = /^\/api\/lms\/exports\/[^/]+\/download$/;
const DEFAULT_SSUMCP_ORIGIN = "https://ssumcp.duckdns.org";

interface SafeLink {
  href: string;
  hostname: string;
  isLmsExport: boolean;
}

function trustedSsuMcpOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_SSUAI_API_BASE?.trim();
  try {
    return new URL(configured || DEFAULT_SSUMCP_ORIGIN).origin;
  } catch {
    return DEFAULT_SSUMCP_ORIGIN;
  }
}

function safeHttpLink(candidate: string): SafeLink | null {
  try {
    const parsed = new URL(candidate);
    if (
      !["http:", "https:"].includes(parsed.protocol) ||
      parsed.username ||
      parsed.password
    ) {
      return null;
    }
    return {
      href: parsed.toString(),
      hostname: parsed.hostname,
      isLmsExport:
        parsed.origin === trustedSsuMcpOrigin() &&
        LMS_EXPORT_PATH.test(parsed.pathname) &&
        Boolean(parsed.searchParams.get("token")),
    };
  } catch {
    return null;
  }
}

function AssistantLink({ href, isLmsExport, label }: SafeLink & { label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${label} (새 탭에서 열림)`}
      data-download-action={isLmsExport ? "lms-export" : undefined}
      className={cn(
        "mx-1 my-1 inline-flex max-w-full items-center gap-1.5 whitespace-normal rounded-control font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isLmsExport
          ? "bg-primary px-3 py-2 text-[13px] text-primary-foreground shadow-e1 hover:bg-primary-600 dark:hover:bg-primary-300 dark:hover:text-primary-800"
          : "text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary",
      )}
    >
      {isLmsExport ? (
        <Download size={15} className="shrink-0" aria-hidden="true" />
      ) : (
        <ExternalLink size={14} className="shrink-0" aria-hidden="true" />
      )}
      <span>{label}</span>
    </a>
  );
}

function renderAssistantContent(content: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = new RegExp(LINK_PATTERN.source, LINK_PATTERN.flags);
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(content)) !== null) {
    if (match.index > cursor) {
      nodes.push(content.slice(cursor, match.index));
    }

    const markdownLabel = match[1];
    const rawCandidate = match[2] ?? match[3] ?? "";
    let candidate = rawCandidate;
    let trailing = "";
    if (!markdownLabel) {
      const trailingMatch = candidate.match(BARE_URL_TRAILING_PUNCTUATION);
      if (trailingMatch) {
        trailing = trailingMatch[0];
        candidate = candidate.slice(0, -trailing.length);
      }
    }

    const link = safeHttpLink(candidate);
    if (link) {
      let label = markdownLabel;
      if (link.isLmsExport) {
        label ||= "강의 파일 다운로드";
      } else {
        label = label ? `${label} (${link.hostname})` : `${link.hostname} 열기`;
      }
      nodes.push(
        <AssistantLink
          key={`${match.index}-${link.href}`}
          {...link}
          label={label}
        />,
      );
      if (trailing) nodes.push(trailing);
    } else {
      nodes.push(match[0]);
    }
    cursor = pattern.lastIndex;
  }

  if (cursor < content.length) {
    nodes.push(content.slice(cursor));
  }
  return nodes;
}

// Memoized: during streaming the whole thread re-renders on every token, but
// the already-settled bubbles have unchanged (primitive) props, so memo keeps
// them from re-rendering — only the streaming bubble updates.
export const MessageBubble = memo(function MessageBubble({
  role,
  content,
  isLoading = false,
  model,
}: MessageBubbleProps) {
  const isUser = role === "user";

  return (
    <div className={cn("flex w-full animate-fadeIn", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[min(42rem,85%)] break-words px-4 py-3 text-[15px] leading-[1.55]",
          isUser
            ? "rounded-card rounded-tr-[4px] bg-primary text-primary-foreground"
            : "rounded-card rounded-tl-[4px] border border-hairline bg-surface text-foreground shadow-e1",
        )}
      >
        {isLoading ? (
          <span className="flex items-center gap-2 text-muted-foreground">
            <Loader2 size={15} className="shrink-0 animate-spin" aria-hidden="true" />
            답변 준비 중...
          </span>
        ) : (
          <>
            <p className="whitespace-pre-wrap">
              {isUser ? content : renderAssistantContent(content)}
            </p>
            {!isUser && model ? (
              <p className="mt-2 text-right font-mono text-[10px] text-subtle">{model}</p>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
});

import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

export type ChatMessageRole = "user" | "assistant";

interface MessageBubbleProps {
  role: ChatMessageRole;
  content: string;
  isLoading?: boolean;
  model?: string | null;
}

export function MessageBubble({ role, content, isLoading = false, model }: MessageBubbleProps) {
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
            <p className="whitespace-pre-wrap">{content}</p>
            {!isUser && model ? (
              <p className="mt-2 text-right font-mono text-[10px] text-subtle">{model}</p>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

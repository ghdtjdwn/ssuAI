"use client";

import { Bot, CheckCircle2, Loader2, Send, Sparkles } from "lucide-react";
import {
  FormEvent,
  KeyboardEvent,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";

import { HitlCard, HitlDoneCard, formatHitlSummary } from "@/components/chat/HitlCard";
import { MessageBubble, type ChatMessageRole } from "@/components/chat/MessageBubble";
import { Button } from "@/components/ui/button";
import { useSaintAuth } from "@/hooks/useSaintAuth";
import {
  startAgentStream,
  resumeAgentStream,
  createMcpWebSession,
  readAgentStream,
  type InterruptData,
} from "@/lib/api/agent";
import {
  clearAgentThread,
  getOrCreateAgentThreadId,
} from "@/lib/agentThread";
import { cn } from "@/lib/utils";

const MAX_MESSAGE_LENGTH = 1000;

const SAMPLE_PROMPTS = [
  "도서관 5층 빈 자리 있어?",
  "오늘 학식 뭐야?",
  "졸업까지 어떤 조건들이 남았어?",
  "이번 주 마감인 과제 있어?",
];

type MessageRole = ChatMessageRole;

interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  isStatus?: boolean; // handoff / tool events shown as non-bubble lines
  hitl?: "approved"; // approved HITL request kept in the thread as a done card
}

function nextId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function ChatPanel() {
  const { accessToken, isAuthenticated } = useSaintAuth();

  const [threadId, setThreadId] = useState<string>(getOrCreateAgentThreadId);
  const [mcpSessionId, setMcpSessionId] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingContent, setStreamingContent] = useState<string>("");
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [pendingInterrupt, setPendingInterrupt] = useState<InterruptData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isResumingHitl, setIsResumingHitl] = useState(false);

  const streamingContentRef = useRef<string>("");
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const previousIsAuthenticatedRef = useRef(isAuthenticated);

  // Obtain mcp_session_id when JWT is available
  useEffect(() => {
    if (!isAuthenticated || !accessToken || mcpSessionId) return;
    let cancelled = false;
    createMcpWebSession(accessToken)
      .then((res) => {
        if (!cancelled) {
          setMcpSessionId(res.mcpSessionId);
        }
      })
      .catch(() => {
        if (cancelled) return;
        // Not fatal: mcp_session_id remains null; only public tools will work
        if (process.env.NODE_ENV === "development") {
          console.warn("Could not obtain mcp_session_id; public tools only.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, accessToken, mcpSessionId]);

  useEffect(() => {
    const wasAuthenticated = previousIsAuthenticatedRef.current;
    previousIsAuthenticatedRef.current = isAuthenticated;
    if (!wasAuthenticated || isAuthenticated) return;

    setMcpSessionId(null);
    // useSaintAuth.logout() already clears the stored id (it must work even
    // when this panel is unmounted); this keeps the mounted panel's state in
    // sync and covers non-logout auth losses (e.g. refresh expiry).
    clearAgentThread();
    setThreadId(getOrCreateAgentThreadId());
    setMessages([]);
    streamingContentRef.current = "";
    setStreamingContent("");
    setInput("");
    setIsStreaming(false);
    setPendingInterrupt(null);
    setError(null);
    setIsResumingHitl(false);
  }, [isAuthenticated]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, streamingContent, isStreaming, pendingInterrupt, error]);

  function appendStatus(text: string) {
    setMessages((prev) => [
      ...prev,
      { id: nextId(), role: "assistant", content: text, isStatus: true },
    ]);
  }

  function finalizeAssistantMessage() {
    const content = streamingContentRef.current.trim();
    if (content) {
      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: "assistant", content },
      ]);
    }
    streamingContentRef.current = "";
    setStreamingContent("");
  }

  const consumeStream = useCallback(
    async (response: Response) => {
      for await (const event of readAgentStream(response)) {
        if (event.type === "text") {
          streamingContentRef.current += event.content;
          setStreamingContent(streamingContentRef.current);
        } else if (event.type === "handoff") {
          appendStatus(`[${event.agent}] ${event.message}`);
        } else if (event.type === "tool") {
          appendStatus(event.label ?? `도구 실행: ${event.name}`);
        } else if (event.type === "interrupt") {
          finalizeAssistantMessage();
          setPendingInterrupt(event.data);
          setIsStreaming(false);
          return; // stream ends after interrupt
        } else if (event.type === "error") {
          finalizeAssistantMessage();
          setIsStreaming(false);
          setError(event.message);
          return;
        } else if (event.type === "done") {
          finalizeAssistantMessage();
          setIsStreaming(false);
          return;
        }
      }
      // Stream ended without explicit done (e.g. network drop)
      finalizeAssistantMessage();
      setIsStreaming(false);
    },
    [],
  );

  async function sendMessage(messageText: string, appendUserMsg = true) {
    const trimmed = messageText.trim();
    if (!trimmed || isStreaming) return;

    setError(null);
    setPendingInterrupt(null);
    if (appendUserMsg) {
      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: "user", content: trimmed },
      ]);
    }
    setIsStreaming(true);
    streamingContentRef.current = "";
    setStreamingContent("");

    try {
      const response = await startAgentStream(trimmed, threadId, mcpSessionId);
      await consumeStream(response);
    } catch (err) {
      finalizeAssistantMessage();
      setIsStreaming(false);
      setError(err instanceof Error ? err.message : "에이전트 연결에 실패했습니다.");
    }
  }

  async function handleHitlDecision(approved: boolean) {
    if (!pendingInterrupt || isResumingHitl) return;
    if (approved) {
      // Swap the pending card into a persistent "done" card in the thread.
      const summary = formatHitlSummary(pendingInterrupt.details);
      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: "assistant", content: summary, hitl: "approved" },
      ]);
    }
    setIsResumingHitl(true);
    setPendingInterrupt(null);
    setIsStreaming(true);
    streamingContentRef.current = "";
    setStreamingContent("");

    try {
      const response = await resumeAgentStream(
        threadId,
        approved,
        pendingInterrupt.action_id ?? null,
        mcpSessionId,
      );
      await consumeStream(response);
    } catch (err) {
      finalizeAssistantMessage();
      setIsStreaming(false);
      setError(err instanceof Error ? err.message : "에이전트 재개에 실패했습니다.");
    } finally {
      setIsResumingHitl(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = input;
    setInput("");
    void sendMessage(text);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      const text = input;
      setInput("");
      void sendMessage(text);
    }
  }

  const isIdle = !isStreaming && !pendingInterrupt;

  return (
    <section aria-label="ssuAI 챗봇" className="mx-auto flex min-h-0 w-full max-w-[820px] flex-1 flex-col">
      {/* Agent identity strip */}
      <header className="flex shrink-0 items-center justify-between gap-3 pb-1">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-primary shadow-e1">
            <Bot size={20} className="text-white" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-[16px] font-extrabold leading-tight text-foreground">
              ssuAI Agent
            </h2>
            <p className="truncate text-[11.5px] leading-tight text-subtle">
              자연어로 학사·도서관·캠퍼스를 한 번에
            </p>
          </div>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-pill bg-muted px-3 py-1.5 text-[11.5px] font-semibold text-muted-foreground">
          <span
            className={cn("h-[7px] w-[7px] rounded-full", mcpSessionId ? "bg-success" : "bg-mint")}
            aria-hidden="true"
          />
          {mcpSessionId ? "MCP 연결됨" : "공개 도구 모드"}
        </span>
      </header>

      {/* Thread (scrolls; composer stays pinned below) */}
      <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto py-4">
        {messages.length === 0 && !isStreaming ? (
          <div className="flex flex-1 animate-fadeIn flex-col items-center justify-center gap-5 py-8 text-center">
            <div className="flex flex-col items-center gap-2.5">
              <span className="flex h-12 w-12 items-center justify-center rounded-card bg-primary-soft text-primary">
                <Sparkles size={22} aria-hidden="true" />
              </span>
              <div>
                <p className="text-[15px] font-bold text-foreground">무엇이든 물어보세요</p>
                <p className="mt-0.5 text-[12.5px] text-subtle">추천 질문으로 바로 시작할 수 있어요</p>
              </div>
            </div>
            <div className="flex max-w-xl flex-wrap justify-center gap-2">
              {SAMPLE_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => void sendMessage(prompt)}
                  disabled={isStreaming}
                  className="press rounded-pill border border-border bg-surface px-4 py-2 text-[12.5px] font-semibold text-muted-foreground shadow-e1 hover:bg-muted hover:text-foreground"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {messages.map((message, index) => {
          if (message.hitl === "approved") {
            return <HitlDoneCard key={message.id} summary={message.content} />;
          }
          if (message.isStatus) {
            // Spinner only while this is the latest step of an active stream;
            // finished steps settle into a check pill.
            const isRunning =
              isStreaming && !streamingContent && index === messages.length - 1;
            return (
              <div key={message.id} className="flex justify-start" aria-live="polite">
                <span className="inline-flex max-w-[85%] items-center gap-2 rounded-pill bg-muted px-3.5 py-2 text-[12.5px] font-medium text-muted-foreground">
                  {isRunning ? (
                    <Loader2 size={13} className="shrink-0 animate-spin text-primary" aria-hidden="true" />
                  ) : (
                    <CheckCircle2 size={13} className="shrink-0 text-success" aria-hidden="true" />
                  )}
                  <span className="break-words">{message.content}</span>
                </span>
              </div>
            );
          }
          return <MessageBubble key={message.id} role={message.role} content={message.content} />;
        })}

        {/* Streaming assistant message */}
        {(isStreaming || streamingContent) && !pendingInterrupt ? (
          <MessageBubble
            role="assistant"
            content={streamingContent}
            isLoading={isStreaming && !streamingContent}
          />
        ) : null}

        {/* HITL approval card */}
        {pendingInterrupt ? (
          <HitlCard
            interrupt={pendingInterrupt}
            onApprove={() => void handleHitlDecision(true)}
            onReject={() => void handleHitlDecision(false)}
            isProcessing={isResumingHitl}
          />
        ) : null}

        {error ? (
          <div className="flex justify-start">
            <p
              role="alert"
              className="rounded-control border border-danger/30 bg-danger-bg px-3.5 py-2.5 text-[13px] font-medium text-danger"
            >
              {error}
            </p>
          </div>
        ) : null}

        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <form onSubmit={handleSubmit} className="shrink-0 pt-1">
        <div className="flex items-end gap-2 rounded-pill border border-border bg-surface py-1.5 pl-5 pr-1.5 shadow-e1 transition-shadow focus-within:shadow-e2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={MAX_MESSAGE_LENGTH}
            disabled={!isIdle}
            rows={1}
            placeholder={pendingInterrupt ? "위 요청을 승인하거나 취소해주세요" : "메시지를 입력하세요"}
            aria-label="채팅 메시지"
            className={cn(
              // 16px (text-base) on mobile keeps iOS Safari from auto-zooming the input.
              "max-h-32 min-h-10 flex-1 resize-none self-center bg-transparent py-2 text-base leading-6 text-foreground sm:text-[14px]",
              "placeholder:text-subtle focus-visible:outline-none",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
          />
          <Button
            type="submit"
            size="icon"
            className="h-10 w-10 shrink-0 rounded-pill"
            disabled={!input.trim() || !isIdle}
            aria-label="메시지 보내기"
          >
            {isStreaming ? (
              <Loader2 size={18} className="animate-spin" aria-hidden="true" />
            ) : (
              <Send size={18} aria-hidden="true" />
            )}
          </Button>
        </div>
      </form>
    </section>
  );
}

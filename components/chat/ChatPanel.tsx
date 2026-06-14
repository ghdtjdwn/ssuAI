"use client";

import { Send, Sparkles, Loader2 } from "lucide-react";
import {
  FormEvent,
  KeyboardEvent,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";

import { HitlCard } from "@/components/chat/HitlCard";
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
import { cn } from "@/lib/utils";

const MAX_MESSAGE_LENGTH = 1000;
const THREAD_ID_KEY = "ssuagent_thread_id";

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
}

function nextId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getOrCreateThreadId(): string {
  if (typeof window === "undefined") return nextId();
  const stored = sessionStorage.getItem(THREAD_ID_KEY);
  if (stored) return stored;
  const fresh = nextId();
  sessionStorage.setItem(THREAD_ID_KEY, fresh);
  return fresh;
}

export function ChatPanel() {
  const { accessToken, isAuthenticated } = useSaintAuth();

  const [threadId] = useState<string>(getOrCreateThreadId);
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

  // Obtain mcp_session_id when JWT is available
  useEffect(() => {
    if (!isAuthenticated || !accessToken || mcpSessionId) return;
    createMcpWebSession(accessToken)
      .then((res) => setMcpSessionId(res.mcpSessionId))
      .catch(() => {
        // Not fatal: mcp_session_id remains null; only public tools will work
        if (process.env.NODE_ENV === "development") {
          console.warn("Could not obtain mcp_session_id; public tools only.");
        }
      });
  }, [isAuthenticated, accessToken, mcpSessionId]);

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
          appendStatus(`도구 실행: ${event.name}`);
        } else if (event.type === "interrupt") {
          finalizeAssistantMessage();
          setPendingInterrupt(event.data);
          setIsStreaming(false);
          return; // stream ends after interrupt
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
    <section className="flex min-h-[34rem] flex-1 flex-col rounded-md border border-border bg-card">
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <Sparkles className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
          <h2 className="truncate text-base font-semibold text-foreground">ssuAI Agent</h2>
        </div>
        <span className="shrink-0 rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
          {mcpSessionId ? "MCP 연결됨" : "공개 도구 모드"}
        </span>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-5">
        {messages.length === 0 && !isStreaming ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <div className="flex max-w-xl flex-wrap justify-center gap-2">
              {SAMPLE_PROMPTS.map((prompt) => (
                <Button
                  key={prompt}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void sendMessage(prompt)}
                  disabled={isStreaming}
                  className="h-auto min-h-8 whitespace-normal text-left leading-5"
                >
                  {prompt}
                </Button>
              ))}
            </div>
          </div>
        ) : null}

        {messages.map((message) =>
          message.isStatus ? (
            <p
              key={message.id}
              className="text-xs text-muted-foreground"
              aria-live="polite"
            >
              {message.content}
            </p>
          ) : (
            <MessageBubble key={message.id} role={message.role} content={message.content} />
          ),
        )}

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
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} className="border-t border-border p-4">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={MAX_MESSAGE_LENGTH}
            disabled={!isIdle}
            rows={2}
            placeholder={pendingInterrupt ? "위 요청을 승인하거나 취소해주세요" : "메시지를 입력하세요"}
            aria-label="채팅 메시지"
            className={cn(
              "min-h-12 flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-base leading-6 sm:text-sm",
              "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
          />
          <Button
            type="submit"
            size="icon"
            className="h-12 w-12 shrink-0"
            disabled={!input.trim() || !isIdle}
            aria-label="메시지 보내기"
          >
            {isStreaming ? (
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            ) : (
              <Send className="h-5 w-5" aria-hidden="true" />
            )}
          </Button>
        </div>
        <div className="mt-2 text-right text-xs text-muted-foreground">
          {input.length}/{MAX_MESSAGE_LENGTH}
        </div>
      </form>
    </section>
  );
}

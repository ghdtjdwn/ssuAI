"use client";

import { CheckCircle2, Info, AlertCircle } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

export type ToastType = "success" | "error" | "info";

interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  toast: (type: ToastType, message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_TTL_MS = 3200;

const toastStyles: Record<
  ToastType,
  { bar: string; icon: typeof CheckCircle2; iconColor: string }
> = {
  success: { bar: "bg-success", icon: CheckCircle2, iconColor: "text-success" },
  error: { bar: "bg-danger", icon: AlertCircle, iconColor: "text-danger" },
  info: { bar: "bg-primary", icon: Info, iconColor: "text-primary" },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const toast = useCallback((type: ToastType, message: string) => {
    const id = nextId.current++;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, TOAST_TTL_MS);
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 lg:inset-x-auto lg:bottom-6 lg:right-6 lg:items-end"
      >
        {toasts.map((t) => {
          const s = toastStyles[t.type];
          const Icon = s.icon;
          return (
            <div
              key={t.id}
              role="status"
              className="pointer-events-auto flex w-full max-w-sm items-center gap-3 overflow-hidden rounded-control border border-border bg-surface py-3 pl-0 pr-4 shadow-e2 animate-toastIn"
            >
              <span className={`h-10 w-1 shrink-0 rounded-r ${s.bar}`} />
              <Icon size={18} className={`shrink-0 ${s.iconColor}`} aria-hidden />
              <p className="text-[13px] font-medium text-foreground">{t.message}</p>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}

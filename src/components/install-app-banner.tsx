import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "slotly-install-banner-dismissed";

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

export function InstallAppBanner() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!visible || !deferred) return null;

  const install = async () => {
    try {
      await deferred.prompt();
      await deferred.userChoice;
    } finally {
      setVisible(false);
      setDeferred(null);
    }
  };

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  };

  return (
    <div className="fixed inset-x-4 bottom-24 z-50 md:left-auto md:right-6 md:bottom-6 md:w-80 surface-card border border-border/70 shadow-xl p-4 flex items-center gap-3 animate-in slide-in-from-bottom-4">
      <div className="relative size-10 shrink-0 rounded-xl overflow-hidden" style={{ background: "var(--gradient-brand, #0A0A0A)" }}>
        <img src="/icons/icon-192.png" alt="Slotly" className="size-10 object-cover" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">Instalar aplicativo</p>
        <p className="text-xs text-muted-foreground truncate">Acesse o Slotly direto da sua tela inicial.</p>
      </div>
      <button
        onClick={install}
        className="btn-primary h-10 shrink-0 !px-3 text-sm"
        aria-label="Instalar aplicativo"
      >
        <Download className="size-4" />
      </button>
      <button
        onClick={dismiss}
        className="shrink-0 inline-flex items-center justify-center size-8 rounded-full text-muted-foreground hover:bg-accent transition"
        aria-label="Fechar"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

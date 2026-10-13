import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import logo from "@/assets/logo.jpeg.asset.json";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isIos() {
  if (typeof navigator === "undefined") return false;
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // @ts-expect-error iOS Safari proprietary
    window.navigator.standalone === true
  );
}

export function Nav() {
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const showInstall = !isStandalone() && (installEvent !== null || isIos());

  const handleInstall = async () => {
    if (installEvent) {
      await installEvent.prompt();
      const choice = await installEvent.userChoice;
      if (choice.outcome === "accepted") setInstallEvent(null);
    } else if (isIos()) {
      setIosHint((v) => !v);
    }
  };

  const cls = "px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground";
  const active = { className: "px-3 py-1.5 rounded-md text-sm bg-secondary text-primary" };

  return (
    <header className="border-b border-border bg-background/80 backdrop-blur sticky top-0 z-10">
      <div className="mx-auto max-w-6xl flex items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-3 font-mono font-bold text-primary tracking-widest">
          <img src={logo.url} alt="Logomarca" className="h-10 w-auto rounded" />
          <span className="hidden min-[420px]:inline">SKYPILOT</span>
        </Link>
        <div className="flex items-center gap-2">
          <nav className="flex gap-1">
            <Link to="/" className={cls} activeProps={active} activeOptions={{ exact: true }}>Painel</Link>
            <Link to="/documentos" className={cls} activeProps={active}>Documentos</Link>
          </nav>
          {showInstall && (
            <div className="relative">
              <button
                onClick={handleInstall}
                className="px-3 py-1.5 rounded-md text-sm bg-primary text-primary-foreground font-medium hover:opacity-90"
              >
                Instalar app
              </button>
              {iosHint && (
                <div className="absolute right-0 top-full mt-2 w-56 rounded-md border border-border bg-card p-3 text-xs text-muted-foreground shadow-lg z-20">
                  No iPhone: toque no botão <strong className="text-foreground">Compartilhar</strong> e depois em{" "}
                  <strong className="text-foreground">Adicionar à Tela de Início</strong>.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

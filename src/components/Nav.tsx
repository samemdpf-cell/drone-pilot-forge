import { useEffect, useState } from "react";
import { Link, useHydrated } from "@tanstack/react-router";
import logo from "@/assets/logo.jpeg.asset.json";
import { Button } from "@/components/ui/button";

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
  const hydrated = useHydrated();
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

  const showInstall = hydrated && !isStandalone() && (installEvent !== null || isIos());

  const handleInstall = async () => {
    if (installEvent) {
      await installEvent.prompt();
      const choice = await installEvent.userChoice;
      if (choice.outcome === "accepted") setInstallEvent(null);
    } else if (isIos()) {
      setIosHint((v) => !v);
    }
  };

  const cls = "flex min-h-11 items-center justify-center px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground";
  const active = { className: `${cls} bg-secondary text-primary` };

  return (
    <header className="border-b border-border bg-background/80 backdrop-blur sticky top-0 z-10">
      <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-2 sm:flex sm:justify-between sm:py-3">
        <Link to="/" className="flex min-w-0 items-center gap-2 font-mono font-bold text-primary">
          <img src={logo.url} alt="Anselmo Imagens Aéreas" className="h-10 w-auto shrink-0 rounded" />
          <span className="truncate text-sm sm:text-base">CHECKLIST PILOTOS PROFISSIONAL</span>
        </Link>
          <nav aria-label="Navegação principal" className="col-span-2 row-start-2 grid grid-cols-2 gap-1 sm:ml-auto sm:flex">
            <Link to="/" className={cls} activeProps={active} activeOptions={{ exact: true }}>Painel</Link>
            <Link to="/documentos" className={cls} activeProps={active}>Documentos</Link>
          </nav>
          {showInstall && (
            <div className="relative col-start-2 row-start-1 shrink-0">
              <Button
                onClick={handleInstall}
                className="h-11 px-3"
              >
                Instalar app
              </Button>
              {iosHint && (
                <div className="absolute right-0 top-full mt-2 w-56 rounded-md border border-border bg-card p-3 text-xs text-muted-foreground shadow-lg z-20">
                  No iPhone: toque no botão <strong className="text-foreground">Compartilhar</strong> e depois em{" "}
                  <strong className="text-foreground">Adicionar à Tela de Início</strong>.
                </div>
              )}
            </div>
          )}
      </div>
    </header>
  );
}

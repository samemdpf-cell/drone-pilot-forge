import { Link } from "@tanstack/react-router";
import logo from "@/assets/logo.jpeg.asset.json";

export function Nav() {
  const cls = "px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground";
  const active = { className: "px-3 py-1.5 rounded-md text-sm bg-secondary text-primary" };
  return (
    <header className="border-b border-border bg-background/80 backdrop-blur sticky top-0 z-10">
      <div className="mx-auto max-w-6xl flex items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-3 font-mono font-bold text-primary tracking-widest">
          <img src={logo.url} alt="Logomarca" className="h-10 w-auto rounded" />
          SKYPILOT
        </Link>
        <nav className="flex gap-1">
          <Link to="/" className={cls} activeProps={active} activeOptions={{ exact: true }}>Painel</Link>
          <Link to="/documentos" className={cls} activeProps={active}>Documentos</Link>
        </nav>
      </div>
    </header>
  );
}

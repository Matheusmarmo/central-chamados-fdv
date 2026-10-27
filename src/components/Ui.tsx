import { useEffect, useRef, type ReactNode } from "react";
import { Inbox, X } from "lucide-react";

export function Carregando({ texto = "Carregando…" }: { texto?: string }) {
  return (
    <div className="carregando" role="status">
      <span className="spinner" aria-hidden="true" />
      {texto}
    </div>
  );
}

export function Vazio({ titulo, texto, acao }: { titulo: string; texto?: string; acao?: ReactNode }) {
  return (
    <div className="vazio">
      <Inbox size={28} aria-hidden="true" />
      <strong>{titulo}</strong>
      {texto && <p>{texto}</p>}
      {acao}
    </div>
  );
}

export function Modal({
  titulo,
  aberto,
  aoFechar,
  children,
  rodape,
}: {
  titulo: string;
  aberto: boolean;
  aoFechar: () => void;
  children: ReactNode;
  rodape?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aberto) return;
    const anterior = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>("input,select,textarea,button")?.focus();
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && aoFechar();
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("keydown", tecla);
      anterior?.focus();
    };
  }, [aberto, aoFechar]);

  if (!aberto) return null;
  return (
    <div className="fdv-modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && aoFechar()}>
      <div className="fdv-modal" role="dialog" aria-modal="true" aria-labelledby="modal-titulo" ref={ref}>
        <div className="fdv-modal__header modal-header">
          <h2 className="fdv-modal__title" id="modal-titulo">
            {titulo}
          </h2>
          <button className="fdv-icon-btn" onClick={aoFechar} aria-label="Fechar">
            <X />
          </button>
        </div>
        <div className="fdv-modal__body">{children}</div>
        {rodape && <div className="fdv-modal__footer">{rodape}</div>}
      </div>
    </div>
  );
}

export function Avatar({ nome }: { nome: string }) {
  const ini = nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
  return (
    <span className="fdv-avatar" aria-hidden="true">
      {ini || "?"}
    </span>
  );
}

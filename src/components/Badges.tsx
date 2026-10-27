import {
  AppWindow,
  CircleHelp,
  Database,
  KeyRound,
  Monitor,
  Printer,
  Wifi,
  type LucideIcon,
} from "lucide-react";
import { classeStatus, rotuloPrioridade, rotuloStatus } from "../lib/format";
import type { Prioridade, Status } from "../lib/types";

export const ICONES_CATEGORIA: Record<string, LucideIcon> = {
  monitor: Monitor,
  database: Database,
  wifi: Wifi,
  "key-round": KeyRound,
  "app-window": AppWindow,
  printer: Printer,
  "circle-help": CircleHelp,
};

export function PrioridadeBadge({ valor }: { valor: Prioridade }) {
  return <span className={`fdv-badge fdv-badge--${valor}`}>{rotuloPrioridade(valor)}</span>;
}

export function StatusBadge({ valor }: { valor: Status }) {
  return <span className={`fdv-status fdv-status--${classeStatus(valor)}`}>{rotuloStatus(valor)}</span>;
}

/** Ícone da categoria. Hardware e TOTVS recebem cores próprias. */
export function CategoriaIcone({
  slug,
  icone,
  tamanho = "md",
}: {
  slug?: string | null;
  icone?: string | null;
  tamanho?: "sm" | "md";
}) {
  const Icone = ICONES_CATEGORIA[icone ?? ""] ?? CircleHelp;
  const variante = slug === "hardware" || slug === "totvs" ? ` fdv-cat-icon--${slug}` : "";
  return (
    <span className={`fdv-cat-icon${tamanho === "sm" ? " fdv-cat-icon--sm" : ""}${variante}`} aria-hidden="true">
      <Icone />
    </span>
  );
}

export function CategoriaTag({ categoria }: { categoria?: { nome: string; slug: string; icone: string } | null }) {
  if (!categoria) return <span className="fdv-muted">—</span>;
  return (
    <span className="fdv-category">
      <CategoriaIcone slug={categoria.slug} icone={categoria.icone} tamanho="sm" />
      {categoria.nome}
    </span>
  );
}

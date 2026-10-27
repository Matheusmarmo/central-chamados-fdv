import type { Papel, Prioridade, Status } from "./types";

export const PRIORIDADES: { valor: Prioridade; rotulo: string; ajuda: string }[] = [
  { valor: "baixa", rotulo: "Baixa", ajuda: "Pode esperar alguns dias" },
  { valor: "media", rotulo: "Média", ajuda: "Atrapalha, mas há alternativa" },
  { valor: "alta", rotulo: "Alta", ajuda: "Impede o trabalho de uma pessoa" },
  { valor: "critica", rotulo: "Crítica", ajuda: "Para um setor, aula ou sistema" },
];

export const STATUS: { valor: Status; rotulo: string }[] = [
  { valor: "aberto", rotulo: "Aberto" },
  { valor: "em_andamento", rotulo: "Em andamento" },
  { valor: "aguardando", rotulo: "Aguardando" },
  { valor: "resolvido", rotulo: "Resolvido" },
  { valor: "fechado", rotulo: "Fechado" },
];

export const PAPEIS: { valor: Papel; rotulo: string }[] = [
  { valor: "solicitante", rotulo: "Solicitante" },
  { valor: "tecnico", rotulo: "Técnico de TI" },
  { valor: "admin", rotulo: "Administrador" },
];

export const STATUS_ATIVOS: Status[] = ["aberto", "em_andamento", "aguardando"];

export const rotuloPrioridade = (p: string | null | undefined) =>
  PRIORIDADES.find((x) => x.valor === p)?.rotulo ?? p ?? "—";
export const rotuloStatus = (s: string | null | undefined) =>
  STATUS.find((x) => x.valor === s)?.rotulo ?? s ?? "—";
export const rotuloPapel = (p: string | null | undefined) =>
  PAPEIS.find((x) => x.valor === p)?.rotulo ?? p ?? "—";

/** Classe CSS do status (usa os nomes curtos do tema). */
export const classeStatus = (s: Status) => (s === "em_andamento" ? "andamento" : s);

const fmtDataHora = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
});
const fmtCurta = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export const dataHora = (iso: string | null | undefined) => (iso ? fmtDataHora.format(new Date(iso)) : "—");
export const dataCurta = (iso: string | null | undefined) => (iso ? fmtCurta.format(new Date(iso)).replace(",", "") : "—");

export function tempoRelativo(iso: string): string {
  const seg = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (seg < 60) return "agora";
  const min = Math.round(seg / 60);
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  if (d < 30) return d === 1 ? "ontem" : `há ${d} dias`;
  return dataCurta(iso);
}

export const iniciais = (nome: string | null | undefined) =>
  (nome || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");

export function tamanhoArquivo(bytes: number | null | undefined) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

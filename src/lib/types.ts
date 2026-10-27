export type Papel = "solicitante" | "tecnico" | "admin";
export type Prioridade = "baixa" | "media" | "alta" | "critica";
export type Status = "aberto" | "em_andamento" | "aguardando" | "resolvido" | "fechado";

export interface Perfil {
  id: string;
  nome: string;
  email: string;
  setor: string | null;
  ramal: string | null;
  papel: Papel;
  ativo: boolean;
  created_at: string;
}

export interface Categoria {
  id: number;
  slug: string;
  nome: string;
  descricao: string | null;
  icone: string;
  destaque: boolean;
  ativo: boolean;
  ordem: number;
}

export interface PessoaResumo {
  id: string;
  nome: string;
  email?: string;
  setor?: string | null;
  ramal?: string | null;
}

export interface Chamado {
  id: number;
  titulo: string;
  descricao: string;
  categoria_id: number;
  prioridade: Prioridade;
  status: Status;
  local: string | null;
  patrimonio: string | null;
  solicitante_id: string;
  tecnico_id: string | null;
  created_at: string;
  updated_at: string;
  resolvido_em: string | null;
  fechado_em: string | null;
  categoria?: Pick<Categoria, "id" | "nome" | "slug" | "icone"> | null;
  solicitante?: PessoaResumo | null;
  tecnico?: PessoaResumo | null;
}

export interface Comentario {
  id: number;
  chamado_id: number;
  autor_id: string;
  corpo: string;
  interno: boolean;
  created_at: string;
  autor?: PessoaResumo | null;
}

export interface Evento {
  id: number;
  chamado_id: number;
  autor_id: string | null;
  tipo: "criado" | "status" | "prioridade" | "atribuicao" | "categoria" | "comentario" | "anexo";
  de: string | null;
  para: string | null;
  created_at: string;
  autor?: PessoaResumo | null;
}

export interface Notificacao {
  id: number;
  usuario_id: string;
  chamado_id: number | null;
  titulo: string;
  mensagem: string | null;
  lida: boolean;
  created_at: string;
}

export interface Anexo {
  id: number;
  chamado_id: number;
  autor_id: string;
  nome: string;
  caminho: string;
  tamanho: number | null;
  tipo: string | null;
  created_at: string;
}

export interface Indicadores {
  em_aberto: number;
  sem_tecnico: number;
  criticos: number;
  em_andamento: number;
  aguardando: number;
  resolvidos_hoje: number;
  tempo_medio_horas: number | null;
}

/** Seleção padrão de chamado com relações (nomes das FKs da migração). */
export const SELECT_CHAMADO =
  "*, categoria:categorias(id,nome,slug,icone), solicitante:perfis!chamados_solicitante_id_fkey(id,nome,email,setor,ramal), tecnico:perfis!chamados_tecnico_id_fkey(id,nome)";

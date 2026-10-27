import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { PlusCircle, RefreshCw, Search } from "lucide-react";
import ListaChamados from "../components/ListaChamados";
import { Carregando, Vazio } from "../components/Ui";
import { useAuth } from "../context/AuthContext";
import { useCategorias, useEquipe } from "../hooks/useDados";
import { PRIORIDADES, STATUS, STATUS_ATIVOS } from "../lib/format";
import { supabase } from "../lib/supabase";
import { SELECT_CHAMADO, type Chamado, type Indicadores } from "../lib/types";

const PESO: Record<string, number> = { critica: 0, alta: 1, media: 2, baixa: 3 };

export default function PainelTI() {
  const { perfil } = useAuth();
  const { categorias } = useCategorias();
  const equipe = useEquipe();

  const [chamados, setChamados] = useState<Chamado[] | null>(null);
  const [ind, setInd] = useState<Indicadores | null>(null);
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState("");
  const [prioridade, setPrioridade] = useState("");
  const [status, setStatus] = useState("ativos");
  const [tecnico, setTecnico] = useState("");
  const [atualizando, setAtualizando] = useState(false);
  const temporizador = useRef<number | undefined>(undefined);

  const carregar = useCallback(async () => {
    setAtualizando(true);
    let q = supabase.from("chamados").select(SELECT_CHAMADO).order("created_at", { ascending: false }).limit(500);
    if (status === "ativos") q = q.in("status", STATUS_ATIVOS);
    else if (status) q = q.eq("status", status);
    if (categoria) q = q.eq("categoria_id", Number(categoria));
    if (prioridade) q = q.eq("prioridade", prioridade);
    if (tecnico === "sem") q = q.is("tecnico_id", null);
    else if (tecnico) q = q.eq("tecnico_id", tecnico);

    const [lista, indicadores] = await Promise.all([q, supabase.rpc("indicadores_painel")]);
    setChamados((lista.data as Chamado[]) ?? []);
    const linha = (indicadores.data as Indicadores[] | null)?.[0];
    if (linha) setInd(linha);
    setAtualizando(false);
  }, [status, categoria, prioridade, tecnico]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  // Tempo real: qualquer alteração em chamados recarrega a fila (com pequeno atraso para agrupar eventos)
  useEffect(() => {
    const canal = supabase
      .channel("painel-ti")
      .on("postgres_changes", { event: "*", schema: "public", table: "chamados" }, () => {
        window.clearTimeout(temporizador.current);
        temporizador.current = window.setTimeout(() => void carregar(), 400);
      })
      .subscribe();
    return () => {
      window.clearTimeout(temporizador.current);
      void supabase.removeChannel(canal);
    };
  }, [carregar]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase().replace("#", "");
    const lista = (chamados ?? []).filter(
      (c) =>
        !termo ||
        String(c.id).includes(termo) ||
        c.titulo.toLowerCase().includes(termo) ||
        (c.solicitante?.nome ?? "").toLowerCase().includes(termo) ||
        (c.local ?? "").toLowerCase().includes(termo),
    );
    // Fila ativa: prioridade mais alta primeiro, depois os mais antigos
    if (status === "ativos")
      return [...lista].sort((a, b) => PESO[a.prioridade]! - PESO[b.prioridade]! || a.created_at.localeCompare(b.created_at));
    return lista;
  }, [chamados, busca, status]);

  const limparFiltros = () => {
    setBusca("");
    setCategoria("");
    setPrioridade("");
    setStatus("ativos");
    setTecnico("");
  };
  const temFiltro = busca || categoria || prioridade || status !== "ativos" || tecnico;

  return (
    <>
      <div className="fdv-page__header">
        <div>
          <h2 className="fdv-page__title">Visão geral</h2>
          <p className="fdv-page__lead">Fila da equipe de TI, atualizada em tempo real.</p>
        </div>
        <div className="botoes">
          <button className="fdv-btn fdv-btn--secondary" onClick={() => void carregar()} disabled={atualizando}>
            <RefreshCw className={atualizando ? "girando" : ""} /> Atualizar
          </button>
          <Link to="/novo" className="fdv-btn fdv-btn--primary">
            <PlusCircle /> Registrar chamado
          </Link>
        </div>
      </div>

      <div className="fdv-kpi-grid secao">
        <button className="fdv-kpi kpi-btn" onClick={() => { limparFiltros(); }}>
          <div className="fdv-kpi__label">Em aberto</div>
          <div className="fdv-kpi__value">{ind?.em_aberto ?? "–"}</div>
          <div className="fdv-kpi__hint">{ind ? `${ind.sem_tecnico} sem técnico atribuído` : " "}</div>
        </button>
        <button className="fdv-kpi fdv-kpi--critica kpi-btn" onClick={() => { limparFiltros(); setPrioridade("critica"); }}>
          <div className="fdv-kpi__label">Críticos</div>
          <div className="fdv-kpi__value">{ind?.criticos ?? "–"}</div>
          <div className="fdv-kpi__hint">Prioridade crítica em aberto</div>
        </button>
        <button className="fdv-kpi fdv-kpi--alta kpi-btn" onClick={() => { limparFiltros(); setStatus("em_andamento"); }}>
          <div className="fdv-kpi__label">Em andamento</div>
          <div className="fdv-kpi__value">{ind?.em_andamento ?? "–"}</div>
          <div className="fdv-kpi__hint">{ind ? `${ind.aguardando} aguardando retorno` : " "}</div>
        </button>
        <button className="fdv-kpi fdv-kpi--sucesso kpi-btn" onClick={() => { limparFiltros(); setStatus("resolvido"); }}>
          <div className="fdv-kpi__label">Resolvidos hoje</div>
          <div className="fdv-kpi__value">{ind?.resolvidos_hoje ?? "–"}</div>
          <div className="fdv-kpi__hint">
            {ind?.tempo_medio_horas != null ? `Tempo médio: ${String(ind.tempo_medio_horas).replace(".", ",")} h (30 dias)` : "Sem resoluções nos últimos 30 dias"}
          </div>
        </button>
      </div>

      <section className="fdv-card" aria-labelledby="fila">
        <div className="fdv-card__header">
          <h3 className="fdv-card__title" id="fila">Fila de chamados</h3>
          <span className="fdv-help">{chamados ? `${filtrados.length} ${filtrados.length === 1 ? "chamado" : "chamados"}` : ""}</span>
        </div>
        <div className="fdv-filters">
          <label className="busca">
            <Search aria-hidden="true" />
            <input className="fdv-input" placeholder="Nº, assunto, solicitante ou local" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar" />
          </label>
          <select className="fdv-select" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
            <option value="ativos">Em aberto (todos ativos)</option>
            {STATUS.map((s) => (
              <option key={s.valor} value={s.valor}>{s.rotulo}</option>
            ))}
            <option value="">Todos os status</option>
          </select>
          <select className="fdv-select" value={categoria} onChange={(e) => setCategoria(e.target.value)} aria-label="Categoria">
            <option value="">Todas as categorias</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
          <select className="fdv-select" value={prioridade} onChange={(e) => setPrioridade(e.target.value)} aria-label="Prioridade">
            <option value="">Todas as prioridades</option>
            {PRIORIDADES.map((p) => (
              <option key={p.valor} value={p.valor}>{p.rotulo}</option>
            ))}
          </select>
          <select className="fdv-select" value={tecnico} onChange={(e) => setTecnico(e.target.value)} aria-label="Técnico">
            <option value="">Todos os técnicos</option>
            {perfil && <option value={perfil.id}>Atribuídos a mim</option>}
            <option value="sem">Sem técnico</option>
            {equipe
              .filter((t) => t.id !== perfil?.id)
              .map((t) => (
                <option key={t.id} value={t.id}>{t.nome}</option>
              ))}
          </select>
          {temFiltro && (
            <button className="fdv-btn fdv-btn--ghost fdv-btn--sm" onClick={limparFiltros}>Limpar filtros</button>
          )}
        </div>
        {chamados === null ? (
          <Carregando />
        ) : filtrados.length === 0 ? (
          <Vazio titulo="Nenhum chamado encontrado" texto={temFiltro ? "Ajuste os filtros para ver outros chamados." : "A fila está vazia. Bom trabalho!"} />
        ) : (
          <div className="card-lista">
            <ListaChamados chamados={filtrados} mostrarSolicitante />
          </div>
        )}
      </section>
    </>
  );
}

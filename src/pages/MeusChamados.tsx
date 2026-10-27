import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PlusCircle, Search } from "lucide-react";
import ListaChamados from "../components/ListaChamados";
import { Carregando, Vazio } from "../components/Ui";
import { useAuth } from "../context/AuthContext";
import { STATUS_ATIVOS } from "../lib/format";
import { supabase } from "../lib/supabase";
import { SELECT_CHAMADO, type Chamado } from "../lib/types";

type Aba = "ativos" | "resolvidos" | "todos";

export default function MeusChamados() {
  const { perfil } = useAuth();
  const [chamados, setChamados] = useState<Chamado[] | null>(null);
  const [aba, setAba] = useState<Aba>("ativos");
  const [busca, setBusca] = useState("");

  useEffect(() => {
    if (!perfil) return;
    const carregar = () =>
      supabase
        .from("chamados")
        .select(SELECT_CHAMADO)
        .eq("solicitante_id", perfil.id)
        .order("created_at", { ascending: false })
        .then(({ data }) => setChamados((data as Chamado[]) ?? []));
    void carregar();
    const canal = supabase
      .channel(`meus-${perfil.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "chamados", filter: `solicitante_id=eq.${perfil.id}` }, () => void carregar())
      .subscribe();
    return () => void supabase.removeChannel(canal);
  }, [perfil]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return (chamados ?? []).filter((c) => {
      if (aba === "ativos" && !STATUS_ATIVOS.includes(c.status)) return false;
      if (aba === "resolvidos" && STATUS_ATIVOS.includes(c.status)) return false;
      if (!termo) return true;
      return c.titulo.toLowerCase().includes(termo) || String(c.id).includes(termo.replace("#", ""));
    });
  }, [chamados, aba, busca]);

  const contagem = (a: Aba) =>
    (chamados ?? []).filter((c) => (a === "todos" ? true : a === "ativos" ? STATUS_ATIVOS.includes(c.status) : !STATUS_ATIVOS.includes(c.status))).length;

  return (
    <>
      <div className="fdv-page__header">
        <div>
          <h2 className="fdv-page__title">Meus chamados</h2>
          <p className="fdv-page__lead">Acompanhe o andamento e converse com a equipe de TI.</p>
        </div>
        <Link to="/novo" className="fdv-btn fdv-btn--primary">
          <PlusCircle /> Abrir chamado
        </Link>
      </div>

      <section className="fdv-card">
        <div className="fdv-filters filtros-abas">
          <div className="abas" role="tablist" aria-label="Situação">
            {(["ativos", "resolvidos", "todos"] as Aba[]).map((a) => (
              <button key={a} role="tab" aria-selected={aba === a} className={`aba${aba === a ? " ativa" : ""}`} onClick={() => setAba(a)}>
                {a === "ativos" ? "Em andamento" : a === "resolvidos" ? "Concluídos" : "Todos"}
                <span className="aba__count">{contagem(a)}</span>
              </button>
            ))}
          </div>
          <label className="busca">
            <Search aria-hidden="true" />
            <input className="fdv-input" placeholder="Buscar por número ou assunto" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar chamados" />
          </label>
        </div>
        {chamados === null ? (
          <Carregando />
        ) : filtrados.length === 0 ? (
          <Vazio
            titulo={busca ? "Nenhum chamado encontrado" : "Nada por aqui"}
            texto={busca ? "Tente outro termo de busca." : "Você não tem chamados nesta situação."}
          />
        ) : (
          <div className="card-lista">
            <ListaChamados chamados={filtrados} />
          </div>
        )}
      </section>
    </>
  );
}

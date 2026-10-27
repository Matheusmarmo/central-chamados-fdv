import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PlusCircle } from "lucide-react";
import { CategoriaIcone } from "../components/Badges";
import ListaChamados from "../components/ListaChamados";
import { Carregando, Vazio } from "../components/Ui";
import { useAuth } from "../context/AuthContext";
import { useCategorias } from "../hooks/useDados";
import { STATUS_ATIVOS } from "../lib/format";
import { supabase } from "../lib/supabase";
import { SELECT_CHAMADO, type Chamado } from "../lib/types";

export default function Inicio() {
  const { perfil } = useAuth();
  const { categorias } = useCategorias();
  const [chamados, setChamados] = useState<Chamado[] | null>(null);

  useEffect(() => {
    if (!perfil) return;
    supabase
      .from("chamados")
      .select(SELECT_CHAMADO)
      .eq("solicitante_id", perfil.id)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => setChamados((data as Chamado[]) ?? []));
  }, [perfil]);

  const ativos = (chamados ?? []).filter((c) => STATUS_ATIVOS.includes(c.status));
  const aguardandoConfirmacao = (chamados ?? []).filter((c) => c.status === "resolvido");
  const primeiroNome = perfil?.nome?.split(" ")[0] ?? "";

  return (
    <>
      <div className="fdv-page__header">
        <div>
          <h2 className="fdv-page__title">Olá{primeiroNome ? `, ${primeiroNome}` : ""}</h2>
          <p className="fdv-page__lead">Abra um chamado para a equipe de TI ou acompanhe as suas solicitações.</p>
        </div>
        <Link to="/novo" className="fdv-btn fdv-btn--primary">
          <PlusCircle /> Abrir chamado
        </Link>
      </div>

      <section className="secao" aria-labelledby="atalhos">
        <h3 id="atalhos" className="secao__titulo">Do que você precisa?</h3>
        <div className="fdv-category-grid">
          {categorias.map((c) => (
            <Link key={c.id} to={`/novo?categoria=${c.slug}`} className={`fdv-category-option${c.destaque ? " destaque" : ""}`}>
              <CategoriaIcone slug={c.slug} icone={c.icone} />
              <span>
                <span className="fdv-category-option__title">{c.nome}</span>
                <span className="fdv-category-option__desc">{c.descricao}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {aguardandoConfirmacao.length > 0 && (
        <div className="fdv-alert fdv-alert--success secao">
          <span>
            <strong>{aguardandoConfirmacao.length === 1 ? "1 chamado foi resolvido" : `${aguardandoConfirmacao.length} chamados foram resolvidos`}</strong>{" "}
            e aguarda sua confirmação.{" "}
            <Link to={`/chamados/${aguardandoConfirmacao[0]!.id}`}>Ver chamado</Link>
          </span>
        </div>
      )}

      <section className="fdv-card" aria-labelledby="em-andamento">
        <div className="fdv-card__header">
          <h3 className="fdv-card__title" id="em-andamento">Chamados em andamento</h3>
          <Link to="/meus" className="fdv-btn fdv-btn--ghost fdv-btn--sm">Ver todos</Link>
        </div>
        {chamados === null ? (
          <Carregando />
        ) : ativos.length === 0 ? (
          <Vazio titulo="Nenhum chamado em andamento" texto="Quando você abrir um chamado, ele aparece aqui com o status atualizado." />
        ) : (
          <div className="card-lista">
            <ListaChamados chamados={ativos} />
          </div>
        )}
      </section>
    </>
  );
}

import { useNavigate, Link } from "react-router-dom";
import { dataCurta, tempoRelativo } from "../lib/format";
import type { Chamado } from "../lib/types";
import { CategoriaTag, PrioridadeBadge, StatusBadge } from "./Badges";

/**
 * Lista de chamados: tabela no computador e cartões no celular.
 * As linhas são navegáveis por teclado (link no número/assunto).
 */
export default function ListaChamados({
  chamados,
  mostrarSolicitante = false,
  mostrarTecnico = true,
}: {
  chamados: Chamado[];
  mostrarSolicitante?: boolean;
  mostrarTecnico?: boolean;
}) {
  const navegar = useNavigate();

  return (
    <>
      <div className="fdv-table-wrap lista-tabela">
        <table className="fdv-table">
          <thead>
            <tr>
              <th scope="col">Nº</th>
              <th scope="col">Assunto</th>
              <th scope="col">Categoria</th>
              <th scope="col">Prioridade</th>
              <th scope="col">Status</th>
              {mostrarSolicitante && <th scope="col">Solicitante</th>}
              {mostrarTecnico && <th scope="col">Técnico</th>}
              <th scope="col">Abertura</th>
            </tr>
          </thead>
          <tbody>
            {chamados.map((c) => (
              <tr key={c.id} className="linha-clicavel" onClick={() => navegar(`/chamados/${c.id}`)}>
                <td className="fdv-ticket-id">
                  <Link to={`/chamados/${c.id}`} onClick={(e) => e.stopPropagation()}>#{c.id}</Link>
                </td>
                <td className="col-assunto">
                  <span className="assunto">{c.titulo}</span>
                  {c.local && <span className="assunto-sub">{c.local}</span>}
                </td>
                <td><CategoriaTag categoria={c.categoria} /></td>
                <td><PrioridadeBadge valor={c.prioridade} /></td>
                <td><StatusBadge valor={c.status} /></td>
                {mostrarSolicitante && (
                  <td>
                    <span className="assunto">{c.solicitante?.nome ?? "—"}</span>
                    {c.solicitante?.setor && <span className="assunto-sub">{c.solicitante.setor}</span>}
                  </td>
                )}
                {mostrarTecnico && <td>{c.tecnico?.nome ?? <span className="fdv-muted">Não atribuído</span>}</td>}
                <td className="fdv-muted" title={tempoRelativo(c.created_at)}>{dataCurta(c.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="lista-cartoes">
        {chamados.map((c) => (
          <Link key={c.id} to={`/chamados/${c.id}`} className="fdv-ticket-card cartao-link" data-priority={c.prioridade}>
            <div className="fdv-ticket-card__top">
              <span className="ticket-num">#{c.id}</span>
              <StatusBadge valor={c.status} />
            </div>
            <p className="fdv-ticket-card__title">{c.titulo}</p>
            <div className="fdv-ticket-card__meta">
              <PrioridadeBadge valor={c.prioridade} />
              <span>{c.categoria?.nome}</span>
              <span>{dataCurta(c.created_at)}</span>
              {mostrarSolicitante && c.solicitante && <span>{c.solicitante.nome}</span>}
              {mostrarTecnico && <span>{c.tecnico?.nome ?? "Não atribuído"}</span>}
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}

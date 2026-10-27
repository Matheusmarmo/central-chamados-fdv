import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Avatar, Carregando, Vazio } from "../components/Ui";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { dataCurta, PAPEIS } from "../lib/format";
import { mensagemErro, supabase } from "../lib/supabase";
import type { Papel, Perfil } from "../lib/types";

export default function Usuarios() {
  const { perfil: eu } = useAuth();
  const toast = useToast();
  const [usuarios, setUsuarios] = useState<Perfil[] | null>(null);
  const [busca, setBusca] = useState("");
  const [papel, setPapel] = useState("");

  const carregar = () =>
    supabase
      .from("perfis")
      .select("*")
      .order("nome")
      .then(({ data }) => setUsuarios((data as Perfil[]) ?? []));

  useEffect(() => {
    void carregar();
  }, []);

  async function salvar(u: Perfil, campos: Partial<Pick<Perfil, "papel" | "ativo">>) {
    const { error } = await supabase.from("perfis").update(campos).eq("id", u.id);
    if (error) return toast({ tipo: "erro", titulo: "Não foi possível salvar", mensagem: mensagemErro(error) });
    toast({ tipo: "sucesso", titulo: `${u.nome} atualizado` });
    void carregar();
  }

  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return (usuarios ?? []).filter(
      (u) => (!papel || u.papel === papel) && (!t || u.nome.toLowerCase().includes(t) || u.email.toLowerCase().includes(t) || (u.setor ?? "").toLowerCase().includes(t)),
    );
  }, [usuarios, busca, papel]);

  return (
    <>
      <div className="fdv-page__header">
        <div>
          <h2 className="fdv-page__title">Usuários</h2>
          <p className="fdv-page__lead">Defina quem é da equipe de TI e quem administra o sistema. Novos usuários entram como solicitantes.</p>
        </div>
      </div>
      <section className="fdv-card">
        <div className="fdv-filters">
          <label className="busca">
            <Search aria-hidden="true" />
            <input className="fdv-input" placeholder="Nome, e-mail ou setor" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar usuários" />
          </label>
          <select className="fdv-select" value={papel} onChange={(e) => setPapel(e.target.value)} aria-label="Papel">
            <option value="">Todos os papéis</option>
            {PAPEIS.map((p) => (
              <option key={p.valor} value={p.valor}>{p.rotulo}</option>
            ))}
          </select>
        </div>
        {usuarios === null ? (
          <Carregando />
        ) : filtrados.length === 0 ? (
          <Vazio titulo="Nenhum usuário encontrado" />
        ) : (
          <div className="fdv-table-wrap tabela-borda-zero">
            <table className="fdv-table">
              <thead>
                <tr>
                  <th scope="col">Usuário</th>
                  <th scope="col">Setor</th>
                  <th scope="col">Papel</th>
                  <th scope="col">Situação</th>
                  <th scope="col">Desde</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((u) => {
                  const souEu = u.id === eu?.id;
                  return (
                    <tr key={u.id}>
                      <td>
                        <span className="pessoa">
                          <Avatar nome={u.nome} />
                          <span>
                            <span className="assunto">{u.nome}{souEu && " (você)"}</span>
                            <span className="assunto-sub">{u.email}</span>
                          </span>
                        </span>
                      </td>
                      <td>{u.setor || <span className="fdv-muted">—</span>}</td>
                      <td>
                        <select
                          className="fdv-select select-inline"
                          value={u.papel}
                          disabled={souEu}
                          onChange={(e) => void salvar(u, { papel: e.target.value as Papel })}
                          aria-label={`Papel de ${u.nome}`}
                        >
                          {PAPEIS.map((p) => (
                            <option key={p.valor} value={p.valor}>{p.rotulo}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <label className="check">
                          <input type="checkbox" checked={u.ativo} disabled={souEu} onChange={(e) => void salvar(u, { ativo: e.target.checked })} />
                          {u.ativo ? "Ativo" : "Inativo"}
                        </label>
                      </td>
                      <td className="fdv-muted">{dataCurta(u.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

import { useEffect, useState, type FormEvent } from "react";
import { Avatar } from "../components/Ui";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { rotuloPapel } from "../lib/format";
import { mensagemErro, supabase } from "../lib/supabase";

export default function Perfil() {
  const { perfil, recarregarPerfil } = useAuth();
  const toast = useToast();
  const [nome, setNome] = useState("");
  const [setor, setSetor] = useState("");
  const [ramal, setRamal] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    setNome(perfil?.nome ?? "");
    setSetor(perfil?.setor ?? "");
    setRamal(perfil?.ramal ?? "");
  }, [perfil]);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!perfil || nome.trim().length < 2) return;
    setSalvando(true);
    const { error } = await supabase
      .from("perfis")
      .update({ nome: nome.trim(), setor: setor.trim() || null, ramal: ramal.trim() || null })
      .eq("id", perfil.id);
    setSalvando(false);
    if (error) return toast({ tipo: "erro", titulo: "Não foi possível salvar", mensagem: mensagemErro(error) });
    await recarregarPerfil();
    toast({ tipo: "sucesso", titulo: "Perfil atualizado" });
  }

  async function trocarSenha() {
    if (!perfil) return;
    const { error } = await supabase.auth.resetPasswordForEmail(perfil.email, { redirectTo: `${window.location.origin}/redefinir-senha` });
    if (error) return toast({ tipo: "erro", titulo: "Erro", mensagem: mensagemErro(error) });
    toast({ tipo: "sucesso", titulo: "Link enviado", mensagem: `Verifique a caixa de entrada de ${perfil.email}.` });
  }

  if (!perfil) return null;

  return (
    <>
      <div className="fdv-page__header">
        <div className="pessoa pessoa--lg">
          <Avatar nome={perfil.nome} />
          <div>
            <h2 className="fdv-page__title">{perfil.nome}</h2>
            <p className="fdv-page__lead">{perfil.email} · {rotuloPapel(perfil.papel)}</p>
          </div>
        </div>
      </div>

      <form className="fdv-card form-estreito" onSubmit={salvar}>
        <div className="fdv-card__header"><h3 className="fdv-card__title">Dados de contato</h3></div>
        <div className="fdv-card__body fdv-form">
          <div className="fdv-field">
            <label className="fdv-label" htmlFor="p-nome">Nome completo</label>
            <input id="p-nome" className="fdv-input" value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" />
          </div>
          <div className="fdv-form__row">
            <div className="fdv-field">
              <label className="fdv-label" htmlFor="p-setor">Setor</label>
              <input id="p-setor" className="fdv-input" value={setor} onChange={(e) => setSetor(e.target.value)} />
            </div>
            <div className="fdv-field">
              <label className="fdv-label" htmlFor="p-ramal">Ramal</label>
              <input id="p-ramal" className="fdv-input" value={ramal} onChange={(e) => setRamal(e.target.value)} inputMode="tel" />
            </div>
          </div>
          <span className="fdv-help">Setor e ramal ajudam a equipe de TI a encontrar você durante o atendimento.</span>
          <div className="fdv-form__actions">
            <button type="button" className="fdv-btn fdv-btn--secondary" onClick={() => void trocarSenha()}>Alterar senha</button>
            <button className="fdv-btn fdv-btn--primary" disabled={salvando}>{salvando ? "Salvando…" : "Salvar"}</button>
          </div>
        </div>
      </form>
    </>
  );
}

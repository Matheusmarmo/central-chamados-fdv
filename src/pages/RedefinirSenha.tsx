import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "../context/ToastContext";
import { mensagemErro, supabase } from "../lib/supabase";

export default function RedefinirSenha() {
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const navegar = useNavigate();
  const toast = useToast();

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (senha.length < 6) return setErro("A senha precisa ter pelo menos 6 caracteres.");
    if (senha !== confirmacao) return setErro("As senhas não conferem.");
    setEnviando(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setEnviando(false);
    if (error) return setErro(mensagemErro(error));
    toast({ tipo: "sucesso", titulo: "Senha alterada" });
    navegar("/", { replace: true });
  }

  return (
    <div className="auth-page auth-page--single">
      <form className="fdv-card auth-card" onSubmit={salvar}>
        <div className="fdv-card__body fdv-form">
          <h2 className="auth-card__title">Criar nova senha</h2>
          {erro && <div className="fdv-alert fdv-alert--danger" role="alert">{erro}</div>}
          <div className="fdv-field">
            <label className="fdv-label" htmlFor="s1">Nova senha</label>
            <input id="s1" type="password" className="fdv-input" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="new-password" />
          </div>
          <div className="fdv-field">
            <label className="fdv-label" htmlFor="s2">Confirme a nova senha</label>
            <input id="s2" type="password" className="fdv-input" value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} autoComplete="new-password" />
          </div>
          <button className="fdv-btn fdv-btn--primary" disabled={enviando}>{enviando ? "Salvando…" : "Salvar senha"}</button>
        </div>
      </form>
    </div>
  );
}

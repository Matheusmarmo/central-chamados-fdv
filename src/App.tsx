import { useEffect, type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import Layout from "./components/Layout";
import { Carregando } from "./components/Ui";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import { supabase, supabaseConfigurado } from "./lib/supabase";
import Categorias from "./pages/Categorias";
import ChamadoDetalhe from "./pages/ChamadoDetalhe";
import ConfiguracaoPendente from "./pages/ConfiguracaoPendente";
import Inicio from "./pages/Inicio";
import Login from "./pages/Login";
import MeusChamados from "./pages/MeusChamados";
import NovoChamado from "./pages/NovoChamado";
import PainelTI from "./pages/PainelTI";
import Perfil from "./pages/Perfil";
import RedefinirSenha from "./pages/RedefinirSenha";
import Usuarios from "./pages/Usuarios";

function Protegida({ children, papel }: { children: ReactNode; papel?: "equipe" | "admin" }) {
  const { session, perfil, carregando, perfilFalhou, ehEquipe, ehAdmin, sair, recarregarPerfil } = useAuth();
  if (carregando) return <div className="tela-cheia"><Carregando /></div>;
  if (!session) return <Navigate to="/login" replace />;
  if (!perfil && perfilFalhou)
    return (
      <div className="tela-cheia">
        <div className="fdv-alert fdv-alert--danger bloqueio" role="alert">
          <span>
            <strong>Não foi possível carregar seu perfil.</strong> Verifique sua conexão.{" "}
            <button className="link-btn" onClick={() => void recarregarPerfil()}>Tentar novamente</button> ·{" "}
            <button className="link-btn" onClick={() => void sair()}>Sair</button>
          </span>
        </div>
      </div>
    );
  if (!perfil) return <div className="tela-cheia"><Carregando texto="Preparando seu acesso…" /></div>;
  if (!perfil.ativo)
    return (
      <div className="tela-cheia">
        <div className="fdv-alert fdv-alert--warning bloqueio">
          <span>
            <strong>Acesso desativado.</strong> Procure a equipe de TI da FDV.{" "}
            <button className="link-btn" onClick={() => void sair()}>Sair</button>
          </span>
        </div>
      </div>
    );
  if (papel === "equipe" && !ehEquipe) return <Navigate to="/inicio" replace />;
  if (papel === "admin" && !ehAdmin) return <Navigate to="/inicio" replace />;
  return <>{children}</>;
}

function Raiz() {
  const { ehEquipe, carregando } = useAuth();
  if (carregando) return <Carregando />;
  return <Navigate to={ehEquipe ? "/painel" : "/inicio"} replace />;
}

/** Leva o usuário à tela de nova senha quando ele chega pelo link de recuperação. */
function OuvinteRecuperacao() {
  const navegar = useNavigate();
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((evento) => {
      if (evento === "PASSWORD_RECOVERY") navegar("/redefinir-senha");
    });
    return () => data.subscription.unsubscribe();
  }, [navegar]);
  return null;
}

export default function App() {
  if (!supabaseConfigurado) return <ConfiguracaoPendente />;
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <OuvinteRecuperacao />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/redefinir-senha" element={<Protegida><RedefinirSenha /></Protegida>} />
            <Route element={<Protegida><Layout /></Protegida>}>
              <Route index element={<Raiz />} />
              <Route path="inicio" element={<Inicio />} />
              <Route path="novo" element={<NovoChamado />} />
              <Route path="meus" element={<MeusChamados />} />
              <Route path="chamados/:id" element={<ChamadoDetalhe />} />
              <Route path="perfil" element={<Perfil />} />
              <Route path="painel" element={<Protegida papel="equipe"><PainelTI /></Protegida>} />
              <Route path="admin/usuarios" element={<Protegida papel="admin"><Usuarios /></Protegida>} />
              <Route path="admin/categorias" element={<Protegida papel="admin"><Categorias /></Protegida>} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}

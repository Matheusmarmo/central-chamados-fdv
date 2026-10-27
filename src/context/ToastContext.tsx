import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { X } from "lucide-react";

type Tipo = "info" | "sucesso" | "erro";
interface Toast {
  id: number;
  titulo: string;
  mensagem?: string;
  tipo: Tipo;
}

const ToastCtx = createContext<(t: Omit<Toast, "id">) => void>(() => {});

let seq = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remover = useCallback((id: number) => setToasts((l) => l.filter((t) => t.id !== id)), []);

  const mostrar = useCallback(
    (t: Omit<Toast, "id">) => {
      const id = ++seq;
      setToasts((l) => [...l.slice(-3), { ...t, id }]);
      setTimeout(() => remover(id), t.tipo === "erro" ? 7000 : 4500);
    },
    [remover],
  );

  return (
    <ToastCtx.Provider value={mostrar}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`fdv-toast fdv-toast--${t.tipo}`}>
            <div style={{ flex: 1 }}>
              <div className="fdv-toast__title">{t.titulo}</div>
              {t.mensagem && <div>{t.mensagem}</div>}
            </div>
            <button className="toast-close" onClick={() => remover(t.id)} aria-label="Fechar aviso">
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);

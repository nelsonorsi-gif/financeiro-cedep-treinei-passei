import type { CSSProperties } from "react";
import { podeAcessar, type UsuarioSessao } from "./Acesso";

type Props = {
  usuario: UsuarioSessao;
  modulos: string[];
  onAbrir: (modulo: string) => void;
};

const descricoes: Record<string, string> = {
  Cadastros: "Alunos e demais cadastros",
  Professores: "Professores e pagamentos",
  "Matr\u00edculas e Turmas": "Matr\u00edculas, turmas e cursos",
  "Registro de Presen\u00e7a": "Frequ\u00eancia dos alunos",
  "Secretaria e Caixa": "Atendimento e caixa da secretaria",
  Documentos: "Contratos, carn\u00eas e comprovantes",
  "Contas a Receber": "Parcelas e recebimentos",
  "Despesas Pessoais": "Livro-caixa de despesas pessoais",
  "Relat\u00f3rios": "Consultas e relat\u00f3rios autorizados",
};

export default function Inicio({ usuario, modulos, onAbrir }: Props) {
  const atalhos = modulos.filter(
    (modulo) => modulo !== "In\u00edcio" && modulo !== "Dashboard" && podeAcessar(usuario, modulo)
  );

  return (
    <div style={estilos.pagina}>
      <section style={estilos.boasVindas}>
        <div>
          <span style={estilos.rotulo}>P?GINA INICIAL</span>
          <h1 style={estilos.titulo}>Ol?, {usuario.nome}</h1>
          <p style={estilos.texto}>
            Perfil: <strong>{usuario.perfil}</strong>. Escolha uma das ?reas liberadas para o seu acesso.
          </p>
        </div>
        <img src="/logo-cedep.png" alt="CEDEP Cursos" style={estilos.logo} />
      </section>

      <section>
        <h2 style={estilos.subtitulo}>Acessos dispon?veis</h2>
        {atalhos.length === 0 ? (
          <div style={estilos.vazio}>
            Nenhum m?dulo foi liberado para este usu?rio. Solicite a um administrador a revis?o das permiss?es.
          </div>
        ) : (
          <div style={estilos.grade}>
            {atalhos.map((modulo) => (
              <button key={modulo} onClick={() => onAbrir(modulo)} style={estilos.atalho}>
                <strong style={estilos.nomeModulo}>{modulo}</strong>
                <span style={estilos.descricao}>{descricoes[modulo] || "Abrir m?dulo autorizado"}</span>
                <span style={estilos.abrir}>Abrir ?</span>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

const estilos: Record<string, CSSProperties> = {
  pagina: { display: "grid", gap: 28 },
  boasVindas: {
    display: "flex", justifyContent: "space-between", alignItems: "center", gap: 24,
    padding: 28, borderRadius: 18, color: "white",
    background: "linear-gradient(135deg, #15233d 0%, #243b63 100%)",
    boxShadow: "0 12px 30px rgba(16, 26, 45, 0.18)",
  },
  rotulo: { fontSize: 12, fontWeight: 800, letterSpacing: 1.4, color: "#f8c146" },
  titulo: { margin: "8px 0", fontSize: 30 },
  texto: { margin: 0, color: "#dfe8f5", lineHeight: 1.5 },
  logo: { width: 86, height: 86, objectFit: "contain", background: "white", borderRadius: 16, padding: 8 },
  subtitulo: { margin: "0 0 14px", color: "#15233d", fontSize: 21 },
  grade: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 },
  atalho: {
    display: "grid", gap: 8, minHeight: 145, padding: 20, textAlign: "left", cursor: "pointer",
    background: "white", border: "1px solid #dce3ed", borderRadius: 14,
    boxShadow: "0 5px 16px rgba(16, 26, 45, 0.07)", color: "#15233d",
  },
  nomeModulo: { fontSize: 18 },
  descricao: { color: "#64748b", lineHeight: 1.4 },
  abrir: { marginTop: "auto", color: "#d91f2b", fontWeight: 800 },
  vazio: { padding: 22, borderRadius: 12, background: "#fff7e0", color: "#694d00", border: "1px solid #f1d279" },
};


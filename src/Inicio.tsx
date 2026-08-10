import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { podeAcessar, type UsuarioSessao } from "./Acesso";
import {
  EVENTO_NOTIFICACOES,
  atualizarEstadoNotificacao,
  notificacoesComEstado,
  type NotificacaoComEstado,
  type PrioridadeNotificacao,
} from "./servicos/notificacoes";

type Props = {
  usuario: UsuarioSessao;
  modulos: string[];
  onAbrir: (modulo: string) => void;
  onQuantidadeAlterada?: (quantidade: number) => void;
};
type Filtro = "todas" | "nao_lidas" | PrioridadeNotificacao;

const descricoes: Record<string, string> = {
  Cadastros: "Alunos e demais cadastros",
  Professores: "Professores e pagamentos",
  "Matrículas e Turmas": "Matrículas, turmas e cursos",
  "Registro de Presença": "Frequência dos alunos",
  "Secretaria e Caixa": "Atendimento e caixa da secretaria",
  Documentos: "Contratos, carnês e comprovantes",
  "Contas a Receber": "Parcelas e recebimentos",
  "Despesas Pessoais": "Livro-caixa de despesas pessoais",
  Relatórios: "Consultas e relatórios autorizados",
};

const visual: Record<PrioridadeNotificacao, {
  icone: string; nome: string; cor: string; fundo: string; borda: string;
}> = {
  urgente: { icone: "🔴", nome: "Urgente", cor: "#991b1b", fundo: "#fff1f2", borda: "#fecdd3" },
  atencao: { icone: "🟡", nome: "Atenção", cor: "#854d0e", fundo: "#fffbeb", borda: "#fde68a" },
  informativa: { icone: "🔵", nome: "Informativa", cor: "#1e40af", fundo: "#eff6ff", borda: "#bfdbfe" },
  sucesso: { icone: "🟢", nome: "Concluída", cor: "#166534", fundo: "#f0fdf4", borda: "#bbf7d0" },
};

const formatarData = (valor: string) => {
  const data = new Date(valor.length === 10 ? valor + "T12:00:00" : valor);
  return Number.isNaN(data.getTime()) ? "" : data.toLocaleString("pt-BR");
};

export default function Inicio({
  usuario, modulos, onAbrir, onQuantidadeAlterada,
}: Props) {
  const [versao, setVersao] = useState(0);
  const [filtro, setFiltro] = useState<Filtro>("todas");

  useEffect(() => {
    const atualizar = () => setVersao((atual) => atual + 1);
    const intervalo = window.setInterval(atualizar, 60_000);
    window.addEventListener("storage", atualizar);
    window.addEventListener("focus", atualizar);
    window.addEventListener(EVENTO_NOTIFICACOES, atualizar);
    window.addEventListener("financeiro-caixa-atualizado", atualizar);
    return () => {
      window.clearInterval(intervalo);
      window.removeEventListener("storage", atualizar);
      window.removeEventListener("focus", atualizar);
      window.removeEventListener(EVENTO_NOTIFICACOES, atualizar);
      window.removeEventListener("financeiro-caixa-atualizado", atualizar);
    };
  }, []);

  const todas = useMemo(() => notificacoesComEstado(usuario), [usuario, versao]);
  const ativas = useMemo(
    () => todas.filter((item) => !item.dispensada && !item.adiada),
    [todas]
  );
  const naoLidas = ativas.filter((item) => !item.lida).length;

  useEffect(() => {
    onQuantidadeAlterada?.(naoLidas);
  }, [naoLidas, onQuantidadeAlterada]);

  const totais = ativas.reduce<Record<PrioridadeNotificacao, number>>(
    (resultado, item) => {
      resultado[item.prioridade] += 1;
      return resultado;
    },
    { urgente: 0, atencao: 0, informativa: 0, sucesso: 0 }
  );

  const exibidas = ativas.filter((item) => {
    if (filtro === "todas") return true;
    if (filtro === "nao_lidas") return !item.lida;
    return item.prioridade === filtro;
  });

  const atalhos = modulos.filter(
    (modulo) => modulo !== "Início" && modulo !== "Dashboard" && podeAcessar(usuario, modulo)
  );

  const atualizar = (
    notificacao: NotificacaoComEstado,
    acao: "ler" | "nao_ler" | "dispensar" | "lembrar"
  ) => {
    atualizarEstadoNotificacao(usuario.id, notificacao.id, acao);
    setVersao((atual) => atual + 1);
  };

  const abrir = (notificacao: NotificacaoComEstado) => {
    atualizar(notificacao, "ler");
    if (podeAcessar(usuario, notificacao.modulo)) onAbrir(notificacao.modulo);
    else alert("Seu perfil não possui permissão para abrir este módulo.");
  };

  return (
    <div style={estilos.pagina}>
      <section style={estilos.boasVindas}>
        <div>
          <span style={estilos.rotulo}>PÁGINA INICIAL</span>
          <h1 style={estilos.titulo}>Olá, {usuario.nome}</h1>
          <p style={estilos.texto}>
            Perfil: <strong>{usuario.perfil}</strong>. Os avisos e ações respeitam suas permissões.
          </p>
        </div>
        <div style={estilos.sino} aria-label={String(naoLidas) + " notificações não lidas"}>
          <span>🔔</span><strong>{naoLidas}</strong><small>não lidas</small>
        </div>
      </section>

      <section style={estilos.central}>
        <div style={estilos.topo}>
          <div>
            <h2 style={estilos.subtitulo}>Central de Notificações</h2>
            <p style={estilos.legenda}>Os avisos desaparecem automaticamente quando a pendência é resolvida.</p>
          </div>
          <div style={estilos.resumos}>
            <Resumo titulo="Urgentes" valor={totais.urgente} cor="#dc2626" />
            <Resumo titulo="Atenção" valor={totais.atencao} cor="#ca8a04" />
            <Resumo titulo="Concluídas" valor={totais.sucesso} cor="#16a34a" />
          </div>
        </div>

        <div style={estilos.filtros}>
          {([
            ["todas", "Todas (" + ativas.length + ")"],
            ["nao_lidas", "Não lidas (" + naoLidas + ")"],
            ["urgente", "Urgentes (" + totais.urgente + ")"],
            ["atencao", "Atenção (" + totais.atencao + ")"],
            ["sucesso", "Concluídas (" + totais.sucesso + ")"],
          ] as Array<[Filtro, string]>).map(([valor, rotulo]) => (
            <button
              key={valor}
              type="button"
              onClick={() => setFiltro(valor)}
              aria-pressed={filtro === valor}
              style={{ ...estilos.filtro, ...(filtro === valor ? estilos.filtroAtivo : {}) }}
            >
              {rotulo}
            </button>
          ))}
        </div>

        {exibidas.length === 0 ? (
          <div style={estilos.semAvisos}>
            <span style={{ fontSize: 29 }}>✅</span>
            <div><strong>Nenhum aviso neste filtro</strong><p style={estilos.legenda}>Não há pendências para exibir agora.</p></div>
          </div>
        ) : (
          <div style={estilos.lista}>
            {exibidas.map((notificacao) => {
              const aparencia = visual[notificacao.prioridade];
              return (
                <article
                  key={notificacao.id}
                  style={{
                    ...estilos.notificacao,
                    background: aparencia.fundo,
                    borderColor: aparencia.borda,
                    opacity: notificacao.lida ? 0.78 : 1,
                  }}
                >
                  <span style={estilos.icone}>{aparencia.icone}</span>
                  <div style={estilos.corpo}>
                    <div style={estilos.linhaTitulo}>
                      <strong style={{ color: aparencia.cor }}>{notificacao.titulo}</strong>
                      {!notificacao.lida && <span style={estilos.nova}>NOVA</span>}
                    </div>
                    <p style={estilos.descricaoAviso}>{notificacao.descricao}</p>
                    <small style={estilos.data}>{aparencia.nome} • {formatarData(notificacao.dataReferencia)}</small>
                    <div style={estilos.acoes}>
                      <button type="button" onClick={() => abrir(notificacao)} style={estilos.botaoAcao}>
                        {notificacao.acao}
                      </button>
                      <button type="button" onClick={() => atualizar(notificacao, notificacao.lida ? "nao_ler" : "ler")} style={estilos.botaoSecundario}>
                        {notificacao.lida ? "Marcar como não lida" : "Marcar como lida"}
                      </button>
                      <button type="button" onClick={() => atualizar(notificacao, "lembrar")} style={estilos.botaoSecundario}>Lembrar amanhã</button>
                      <button type="button" onClick={() => atualizar(notificacao, "dispensar")} style={estilos.botaoSecundario}>Dispensar</button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 style={estilos.subtitulo}>Acessos disponíveis</h2>
        {atalhos.length === 0 ? (
          <div style={estilos.vazio}>Nenhum módulo foi liberado para este usuário.</div>
        ) : (
          <div style={estilos.grade}>
            {atalhos.map((modulo) => (
              <button key={modulo} onClick={() => onAbrir(modulo)} style={estilos.atalho}>
                <strong style={estilos.nomeModulo}>{modulo}</strong>
                <span style={estilos.descricao}>{descricoes[modulo] || "Abrir módulo autorizado"}</span>
                <span style={estilos.abrir}>Abrir →</span>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Resumo({ titulo, valor, cor }: { titulo: string; valor: number; cor: string }) {
  return <div style={estilos.resumo}><strong style={{ color: cor, fontSize: 22 }}>{valor}</strong><span>{titulo}</span></div>;
}

const estilos: Record<string, CSSProperties> = {
  pagina: { display: "grid", gap: 28 },
  boasVindas: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 24, padding: 28, borderRadius: 18, color: "white", background: "linear-gradient(135deg, #15233d 0%, #243b63 100%)", boxShadow: "0 12px 30px rgba(16,26,45,.18)" },
  rotulo: { fontSize: 12, fontWeight: 800, letterSpacing: 1.4, color: "#f8c146" },
  titulo: { margin: "8px 0", fontSize: 30 },
  texto: { margin: 0, color: "#dfe8f5", lineHeight: 1.5 },
  sino: { minWidth: 105, padding: 13, display: "grid", placeItems: "center", borderRadius: 16, background: "rgba(255,255,255,.12)", fontSize: 20 },
  central: { padding: 22, borderRadius: 16, background: "white", border: "1px solid #dce3ed", boxShadow: "0 8px 24px rgba(16,26,45,.08)" },
  topo: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20, flexWrap: "wrap" },
  subtitulo: { margin: "0 0 7px", color: "#15233d", fontSize: 21 },
  legenda: { margin: 0, color: "#64748b", lineHeight: 1.45 },
  resumos: { display: "flex", gap: 9, flexWrap: "wrap" },
  resumo: { minWidth: 90, display: "grid", gap: 2, padding: "9px 13px", borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" },
  filtros: { display: "flex", gap: 8, flexWrap: "wrap", margin: "20px 0" },
  filtro: { border: "1px solid #cbd5e1", borderRadius: 999, padding: "8px 13px", background: "white", color: "#334155", cursor: "pointer", fontWeight: 700 },
  filtroAtivo: { background: "#15233d", color: "white", borderColor: "#15233d" },
  lista: { display: "grid", gap: 11 },
  notificacao: { display: "flex", gap: 13, padding: 16, border: "1px solid", borderRadius: 12 },
  icone: { fontSize: 18, paddingTop: 1 },
  corpo: { minWidth: 0, flex: 1 },
  linhaTitulo: { display: "flex", gap: 9, alignItems: "center", flexWrap: "wrap" },
  nova: { padding: "2px 6px", borderRadius: 999, fontSize: 10, fontWeight: 900, color: "white", background: "#dc2626" },
  descricaoAviso: { margin: "6px 0", color: "#334155", lineHeight: 1.45 },
  data: { color: "#64748b" },
  acoes: { display: "flex", gap: 7, flexWrap: "wrap", marginTop: 12 },
  botaoAcao: { border: 0, borderRadius: 8, padding: "8px 12px", background: "#15233d", color: "white", cursor: "pointer", fontWeight: 800 },
  botaoSecundario: { border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 10px", background: "white", color: "#334155", cursor: "pointer" },
  semAvisos: { display: "flex", gap: 13, alignItems: "center", padding: 22, borderRadius: 12, background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#166534" },
  grade: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14 },
  atalho: { display: "grid", gap: 8, minHeight: 145, padding: 20, textAlign: "left", cursor: "pointer", background: "white", border: "1px solid #dce3ed", borderRadius: 14, boxShadow: "0 5px 16px rgba(16,26,45,.07)", color: "#15233d" },
  nomeModulo: { fontSize: 18 },
  descricao: { color: "#64748b", lineHeight: 1.4 },
  abrir: { marginTop: "auto", color: "#d91f2b", fontWeight: 800 },
  vazio: { padding: 22, borderRadius: 12, background: "#fff7e0", color: "#694d00", border: "1px solid #f1d279" },
};
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { carregarConfiguracoes } from "./Configuracoes";
import type { UsuarioSessao } from "./Acesso";

export const CHAVE_INVESTIMENTOS = "financeiro-cedep-investimentos";
export const EVENTO_INVESTIMENTOS = "financeiro-investimentos-atualizados";

export type OperacaoInvestimento = "Aporte" | "Resgate" | "Rendimento";

export type Investimento = {
  id: string;
  data: string;
  competencia: string;
  tipo: string;
  banco: string;
  operacao: OperacaoInvestimento;
  descricao: string;
  valor: number;
  usuarioId: string;
  usuarioNome: string;
  criadoEm: string;
  atualizadoEm?: string;
};

const tiposPadrao = [
  "Consórcio",
  "Previdência privada",
  "CDB",
  "Poupança",
  "Outros",
];

const hoje = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

const competenciaDaData = (data: string) => {
  const [ano, mes] = data.split("-");
  return mes && ano ? mes + "/" + ano : "";
};

const moeda = (valor: number) =>
  valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const numero = (valor: string) => {
  const convertido = Number(
    valor.replace("R$", "").replace(/\s/g, "").replace(/\./g, "").replace(",", ".")
  );
  return Number.isFinite(convertido) ? convertido : 0;
};

export const carregarInvestimentos = (): Investimento[] => {
  try {
    const valor = JSON.parse(localStorage.getItem(CHAVE_INVESTIMENTOS) || "[]");
    return Array.isArray(valor) ? valor : [];
  } catch {
    return [];
  }
};

const salvarInvestimentos = (itens: Investimento[]) => {
  localStorage.setItem(CHAVE_INVESTIMENTOS, JSON.stringify(itens));
  window.dispatchEvent(new CustomEvent(EVENTO_INVESTIMENTOS));
};

type Formulario = {
  data: string;
  tipo: string;
  banco: string;
  operacao: OperacaoInvestimento;
  descricao: string;
  valor: string;
};

const formularioVazio = (): Formulario => ({
  data: hoje(),
  tipo: "CDB",
  banco: "",
  operacao: "Aporte",
  descricao: "",
  valor: "",
});

export default function Investimentos({ usuarioAtual }: { usuarioAtual: UsuarioSessao }) {
  const [itens, setItens] = useState<Investimento[]>(carregarInvestimentos);
  const [formulario, setFormulario] = useState<Formulario>(formularioVazio);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [competencia, setCompetencia] = useState("Todas");
  const [tipo, setTipo] = useState("Todos");
  const [banco, setBanco] = useState("Todos");
  const configuracoes = carregarConfiguracoes();

  useEffect(() => {
    const atualizar = () => setItens(carregarInvestimentos());
    window.addEventListener(EVENTO_INVESTIMENTOS, atualizar);
    window.addEventListener("storage", atualizar);
    window.addEventListener("financeiro-sincronizacao-remota", atualizar);
    return () => {
      window.removeEventListener(EVENTO_INVESTIMENTOS, atualizar);
      window.removeEventListener("storage", atualizar);
      window.removeEventListener("financeiro-sincronizacao-remota", atualizar);
    };
  }, []);

  const competencias = useMemo(
    () =>
      Array.from(new Set(itens.map((item) => item.competencia).filter(Boolean))).sort(
        (a, b) => {
          const [mesA, anoA] = a.split("/");
          const [mesB, anoB] = b.split("/");
          return Number(anoB) * 100 + Number(mesB) - (Number(anoA) * 100 + Number(mesA));
        }
      ),
    [itens]
  );

  const bancos = useMemo(
    () =>
      Array.from(
        new Set([
          ...configuracoes.bancos,
          ...itens.map((item) => item.banco),
        ].filter(Boolean))
      ).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [configuracoes.bancos, itens]
  );

  const tipos = useMemo(
    () =>
      Array.from(new Set([...tiposPadrao, ...itens.map((item) => item.tipo)])).sort(
        (a, b) => a.localeCompare(b, "pt-BR")
      ),
    [itens]
  );

  const filtrados = useMemo(
    () =>
      itens
        .filter(
          (item) =>
            (competencia === "Todas" || item.competencia === competencia) &&
            (tipo === "Todos" || item.tipo === tipo) &&
            (banco === "Todos" || item.banco === banco)
        )
        .sort((a, b) => b.data.localeCompare(a.data) || b.criadoEm.localeCompare(a.criadoEm)),
    [itens, competencia, tipo, banco]
  );

  const somar = (lista: Investimento[], operacao: OperacaoInvestimento) =>
    lista
      .filter((item) => item.operacao === operacao)
      .reduce((total, item) => total + item.valor, 0);

  const aportesPeriodo = somar(filtrados, "Aporte");
  const resgatesPeriodo = somar(filtrados, "Resgate");
  const rendimentosPeriodo = somar(filtrados, "Rendimento");
  const totalInvestido = somar(itens, "Aporte") + somar(itens, "Rendimento") - somar(itens, "Resgate");

  const atualizarCampo = <K extends keyof Formulario>(campo: K, valor: Formulario[K]) =>
    setFormulario((atual) => ({ ...atual, [campo]: valor }));

  const salvar = () => {
    const valor = numero(formulario.valor);
    if (!formulario.data || !formulario.tipo || !formulario.banco || valor <= 0) {
      alert("Preencha data, tipo de investimento, banco e um valor válido.");
      return;
    }
    const agora = new Date().toISOString();
    const anterior = itens.find((item) => item.id === editandoId);
    const registro: Investimento = {
      id: editandoId || `investimento-${Date.now()}-${Math.random()}`,
      data: formulario.data,
      competencia: competenciaDaData(formulario.data),
      tipo: formulario.tipo,
      banco: formulario.banco,
      operacao: formulario.operacao,
      descricao: formulario.descricao.trim(),
      valor,
      usuarioId: anterior?.usuarioId || usuarioAtual.id,
      usuarioNome: anterior?.usuarioNome || usuarioAtual.nome,
      criadoEm: anterior?.criadoEm || agora,
      atualizadoEm: editandoId ? agora : undefined,
    };
    const atualizados = editandoId
      ? itens.map((item) => (item.id === editandoId ? registro : item))
      : [...itens, registro];
    salvarInvestimentos(atualizados);
    setItens(atualizados);
    setFormulario(formularioVazio());
    setEditandoId(null);
    alert(editandoId ? "Investimento atualizado." : "Movimentação de investimento salva.");
  };

  const editar = (item: Investimento) => {
    setEditandoId(item.id);
    setFormulario({
      data: item.data,
      tipo: item.tipo,
      banco: item.banco,
      operacao: item.operacao,
      descricao: item.descricao,
      valor: item.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const excluir = (item: Investimento) => {
    if (!window.confirm(`Excluir a movimentação de ${moeda(item.valor)} em ${item.tipo}?`)) return;
    const atualizados = itens.filter((registro) => registro.id !== item.id);
    salvarInvestimentos(atualizados);
    setItens(atualizados);
    if (editandoId === item.id) {
      setEditandoId(null);
      setFormulario(formularioVazio());
    }
  };

  return (
    <div style={estilos.pagina}>
      <section style={estilos.cabecalho}>
        <div>
          <span style={estilos.rotulo}>PATRIMÔNIO FINANCEIRO</span>
          <h1 style={estilos.titulo}>Investimentos</h1>
          <p style={estilos.legenda}>Aportes reduzem o saldo disponível. Resgates retornam ao saldo. Rendimentos aumentam o patrimônio investido.</p>
        </div>
        <div style={estilos.patrimonio}>
          <small>Total investido atual</small>
          <strong>{moeda(totalInvestido)}</strong>
        </div>
      </section>

      <section style={estilos.caixa}>
        <h2>{editandoId ? "Editar movimentação" : "Nova movimentação"}</h2>
        <div style={estilos.formulario}>
          <label style={estilos.campo}><strong>Data</strong><input type="date" value={formulario.data} onChange={(e) => atualizarCampo("data", e.target.value)} style={estilos.input} /></label>
          <label style={estilos.campo}><strong>Operação</strong><select value={formulario.operacao} onChange={(e) => atualizarCampo("operacao", e.target.value as OperacaoInvestimento)} style={estilos.input}><option>Aporte</option><option>Resgate</option><option>Rendimento</option></select></label>
          <label style={estilos.campo}><strong>Tipo</strong><select value={formulario.tipo} onChange={(e) => atualizarCampo("tipo", e.target.value)} style={estilos.input}>{tipos.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label style={estilos.campo}><strong>Banco</strong><select value={formulario.banco} onChange={(e) => atualizarCampo("banco", e.target.value)} style={estilos.input}><option value="">Selecione...</option>{bancos.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label style={estilos.campo}><strong>Valor</strong><input value={formulario.valor} onChange={(e) => atualizarCampo("valor", e.target.value)} placeholder="Ex.: 500,00" style={estilos.input} /></label>
          <label style={{ ...estilos.campo, gridColumn: "span 2" }}><strong>Descrição opcional</strong><input value={formulario.descricao} onChange={(e) => atualizarCampo("descricao", e.target.value)} placeholder="Ex.: aporte mensal ou identificação do plano" style={estilos.input} /></label>
        </div>
        <div style={estilos.acoes}>
          <button type="button" onClick={salvar} style={estilos.botaoPrincipal}>{editandoId ? "Salvar alteração" : "Registrar movimentação"}</button>
          {editandoId && <button type="button" onClick={() => { setEditandoId(null); setFormulario(formularioVazio()); }} style={estilos.botaoSecundario}>Cancelar edição</button>}
        </div>
      </section>

      <section style={estilos.cards}>
        <Card titulo="Aportes no período" valor={aportesPeriodo} cor="#2563eb" />
        <Card titulo="Resgates no período" valor={resgatesPeriodo} cor="#dc2626" />
        <Card titulo="Rendimentos no período" valor={rendimentosPeriodo} cor="#15803d" />
        <Card titulo="Variação investida" valor={aportesPeriodo + rendimentosPeriodo - resgatesPeriodo} cor="#7c3aed" />
      </section>

      <section style={estilos.caixa}>
        <div style={estilos.topoLista}>
          <div><h2 style={{ margin: 0 }}>Movimentações</h2><p style={estilos.legenda}>{filtrados.length} registro(s) encontrado(s).</p></div>
          <div style={estilos.filtros}>
            <select value={competencia} onChange={(e) => setCompetencia(e.target.value)} style={estilos.input}><option>Todas</option>{competencias.map((item) => <option key={item}>{item}</option>)}</select>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} style={estilos.input}><option>Todos</option>{tipos.map((item) => <option key={item}>{item}</option>)}</select>
            <select value={banco} onChange={(e) => setBanco(e.target.value)} style={estilos.input}><option>Todos</option>{bancos.map((item) => <option key={item}>{item}</option>)}</select>
          </div>
        </div>
        {filtrados.length === 0 ? <div style={estilos.vazio}>Nenhuma movimentação de investimento encontrada.</div> : (
          <div style={estilos.tabelaContainer}><table style={estilos.tabela}><thead><tr><th>Data</th><th>Competência</th><th>Operação</th><th>Tipo</th><th>Banco</th><th>Descrição</th><th>Valor</th><th>Ações</th></tr></thead><tbody>
            {filtrados.map((item) => <tr key={item.id}><td>{item.data.split("-").reverse().join("/")}</td><td>{item.competencia}</td><td><span style={{ ...estilos.badge, background: item.operacao === "Aporte" ? "#dbeafe" : item.operacao === "Resgate" ? "#fee2e2" : "#dcfce7", color: item.operacao === "Aporte" ? "#1d4ed8" : item.operacao === "Resgate" ? "#b91c1c" : "#166534" }}>{item.operacao}</span></td><td>{item.tipo}</td><td>{item.banco}</td><td>{item.descricao || "—"}</td><td><strong>{moeda(item.valor)}</strong></td><td><div style={estilos.acoesTabela}><button type="button" onClick={() => editar(item)} style={estilos.botaoEditar}>Editar</button><button type="button" onClick={() => excluir(item)} style={estilos.botaoExcluir}>Excluir</button></div></td></tr>)}
          </tbody></table></div>
        )}
      </section>
    </div>
  );
}

function Card({ titulo, valor, cor }: { titulo: string; valor: number; cor: string }) {
  return <div style={estilos.card}><span>{titulo}</span><strong style={{ color: cor }}>{moeda(valor)}</strong></div>;
}

const estilos: Record<string, CSSProperties> = {
  pagina: { display: "grid", gap: 24 },
  cabecalho: { display: "flex", justifyContent: "space-between", gap: 20, alignItems: "center", flexWrap: "wrap", padding: 25, borderRadius: 17, background: "linear-gradient(135deg,#15233d,#263f69)", color: "white" },
  rotulo: { color: "#f8c146", fontSize: 12, fontWeight: 900, letterSpacing: 1.3 },
  titulo: { margin: "7px 0", fontSize: 30 },
  legenda: { margin: "5px 0 0", color: "#64748b", lineHeight: 1.45 },
  patrimonio: { display: "grid", gap: 5, padding: "13px 17px", borderRadius: 12, background: "rgba(255,255,255,.12)" },
  caixa: { padding: 22, borderRadius: 15, background: "white", border: "1px solid #dce3ed", boxShadow: "0 7px 22px rgba(16,26,45,.07)" },
  formulario: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(185px,1fr))", gap: 14 },
  campo: { display: "grid", gap: 7, color: "#15233d" },
  input: { minHeight: 42, padding: "9px 11px", borderRadius: 8, border: "1px solid #cbd5e1", background: "white", font: "inherit" },
  acoes: { display: "flex", gap: 9, flexWrap: "wrap", marginTop: 17 },
  botaoPrincipal: { border: 0, borderRadius: 9, padding: "11px 15px", background: "#15803d", color: "white", fontWeight: 800, cursor: "pointer" },
  botaoSecundario: { border: "1px solid #cbd5e1", borderRadius: 9, padding: "10px 14px", background: "white", color: "#334155", cursor: "pointer" },
  cards: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 13 },
  card: { display: "grid", gap: 8, padding: 18, borderRadius: 13, background: "white", border: "1px solid #dce3ed" },
  topoLista: { display: "flex", justifyContent: "space-between", gap: 18, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 17 },
  filtros: { display: "flex", gap: 9, flexWrap: "wrap" },
  vazio: { padding: 20, borderRadius: 10, color: "#64748b", background: "#f8fafc" },
  tabelaContainer: { overflowX: "auto" },
  tabela: { width: "100%", borderCollapse: "collapse" },
  badge: { display: "inline-block", padding: "4px 8px", borderRadius: 999, fontSize: 12, fontWeight: 800 },
  acoesTabela: { display: "flex", gap: 6 },
  botaoEditar: { border: 0, borderRadius: 7, padding: "7px 9px", background: "#dbeafe", color: "#1d4ed8", cursor: "pointer", fontWeight: 700 },
  botaoExcluir: { border: 0, borderRadius: 7, padding: "7px 9px", background: "#fee2e2", color: "#b91c1c", cursor: "pointer", fontWeight: 700 },
};

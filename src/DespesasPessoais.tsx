import { useMemo, useState, type CSSProperties } from "react";

export const CHAVE_DESPESAS_PESSOAIS = "financeiro-cedep-despesas-pessoais";
export const CHAVE_CATEGORIAS_PESSOAIS = "financeiro-cedep-categorias-pessoais";
export const CHAVE_PAGAMENTOS_PESSOAIS = "financeiro-cedep-pagamentos-pessoais";

export type DespesaPessoal = {
  id: string;
  competencia: string;
  descricao: string;
  valorPrevisto: number;
  valorPago: number;
  status: "Pendente" | "Pago" | "Parcial" | "Dispensado";
  vencimento: string;
  categoria?: string;
  formaPagamento?: string;
  observacao?: string;
  origem?: "avulsa" | "recorrente";
};

const categoriasPadrao = [
  "Alimentação",
  "Casa",
  "Educação",
  "Lazer",
  "Saúde",
  "Transporte",
  "Vestuário",
  "Outros",
];

const pagamentosPadrao = ["Dinheiro", "Sicoob", "Cartão de crédito", "Cartão de débito"];

const hoje = () => new Date().toISOString().slice(0, 10);
const mesAtual = () => hoje().slice(0, 7);
const competenciaDaData = (data: string) => data.slice(0, 7).split("-").reverse().join("/");

const lerLista = <T,>(chave: string, padrao: T[]): T[] => {
  try {
    const valor = JSON.parse(localStorage.getItem(chave) || "null");
    return Array.isArray(valor) ? valor : padrao;
  } catch {
    return padrao;
  }
};

const lerDespesas = () => lerLista<DespesaPessoal>(CHAVE_DESPESAS_PESSOAIS, []);

const converterValor = (valor: string) => {
  const normalizado = valor.replace("R$", "").replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : 0;
};

const moeda = (valor: number) =>
  valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const formatarData = (data: string) => data.split("-").reverse().join("/");

export default function DespesasPessoais() {
  const [despesas, setDespesas] = useState<DespesaPessoal[]>(lerDespesas);
  const [categorias, setCategorias] = useState<string[]>(() => lerLista(CHAVE_CATEGORIAS_PESSOAIS, categoriasPadrao));
  const [pagamentos, setPagamentos] = useState<string[]>(() => lerLista(CHAVE_PAGAMENTOS_PESSOAIS, pagamentosPadrao).filter((opcao) => !["pix", "transferência", "transferencia"].includes(opcao.trim().toLowerCase())));
  const [mes, setMes] = useState(mesAtual());
  const [busca, setBusca] = useState("");
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [data, setData] = useState(hoje());
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState("");
  const [valor, setValor] = useState("");
  const [formaPagamento, setFormaPagamento] = useState("");
  const [status, setStatus] = useState<"Pago" | "Pendente">("Pago");
  const [observacao, setObservacao] = useState("");

  const persistirDespesas = (proximas: DespesaPessoal[]) => {
    setDespesas(proximas);
    localStorage.setItem(CHAVE_DESPESAS_PESSOAIS, JSON.stringify(proximas));
    window.dispatchEvent(new Event("financeiro-despesas-pessoais-atualizadas"));
  };

  const persistirCatalogo = (chave: string, itens: string[], atualizar: (itens: string[]) => void) => {
    const unicos = Array.from(new Set(itens.map((item) => item.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
    atualizar(unicos);
    localStorage.setItem(chave, JSON.stringify(unicos));
  };

  const limparFormulario = () => {
    setEditandoId(null);
    setData(hoje());
    setDescricao("");
    setCategoria("");
    setValor("");
    setFormaPagamento("");
    setStatus("Pago");
    setObservacao("");
  };

  const salvar = () => {
    const valorNumerico = converterValor(valor);
    if (!data || !descricao.trim() || valorNumerico <= 0 || !categoria.trim() || !formaPagamento.trim()) {
      alert("Informe data, histórico, categoria, valor e forma de pagamento.");
      return;
    }

    const registro: DespesaPessoal = {
      id: editandoId || `pessoal-${Date.now()}`,
      competencia: competenciaDaData(data),
      descricao: descricao.trim(),
      categoria: categoria.trim(),
      valorPrevisto: valorNumerico,
      valorPago: status === "Pago" ? valorNumerico : 0,
      status,
      vencimento: data,
      formaPagamento: formaPagamento.trim(),
      observacao: observacao.trim(),
      origem: "avulsa",
    };

    const proximas = editandoId
      ? despesas.map((item) => (item.id === editandoId ? registro : item))
      : [...despesas, registro];
    persistirDespesas(proximas);
    persistirCatalogo(CHAVE_CATEGORIAS_PESSOAIS, [...categorias, categoria], setCategorias);
    persistirCatalogo(CHAVE_PAGAMENTOS_PESSOAIS, [...pagamentos, formaPagamento], setPagamentos);
    limparFormulario();
  };

  const editar = (item: DespesaPessoal) => {
    if (item.origem === "recorrente") return;
    setEditandoId(item.id);
    setData(item.vencimento);
    setDescricao(item.descricao);
    setCategoria(item.categoria || "");
    setValor(String(item.valorPrevisto).replace(".", ","));
    setFormaPagamento(item.formaPagamento || "");
    setStatus(item.status === "Pago" ? "Pago" : "Pendente");
    setObservacao(item.observacao || "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const excluir = (item: DespesaPessoal) => {
    if (item.origem === "recorrente" || !window.confirm(`Excluir a despesa "${item.descricao}"?`)) return;
    persistirDespesas(despesas.filter((registro) => registro.id !== item.id));
  };

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    return despesas
      .filter((item) => item.vencimento?.slice(0, 7) === mes)
      .filter((item) => !termo || `${item.descricao} ${item.categoria || ""} ${item.formaPagamento || ""}`.toLocaleLowerCase("pt-BR").includes(termo))
      .toSorted((a, b) => a.vencimento.localeCompare(b.vencimento));
  }, [busca, despesas, mes]);

  const total = filtradas.filter((item) => item.status !== "Dispensado").reduce((soma, item) => soma + Number(item.valorPrevisto), 0);
  const pago = filtradas.reduce((soma, item) => soma + Number(item.valorPago), 0);
  const pendente = Math.max(0, total - pago);

  return (
    <div>
      <header style={estilos.cabecalho}>
        <div>
          <h1 style={{ margin: 0 }}>Livro Caixa Pessoal</h1>
          <p style={estilos.textoCinza}>Controle simples das despesas pessoais, separado do caixa da empresa.</p>
        </div>
        <label style={estilos.campo}>
          <strong>Mês</strong>
          <input type="month" value={mes} onChange={(evento) => setMes(evento.target.value)} style={estilos.input} />
        </label>
      </header>

      <section style={estilos.cards}>
        <Card titulo="Total pessoal" valor={moeda(total)} />
        <Card titulo="Pago" valor={moeda(pago)} />
        <Card titulo="Pendente" valor={moeda(pendente)} />
        <Card titulo="Lançamentos" valor={String(filtradas.length)} />
      </section>

      <section style={estilos.caixa}>
        <h2>{editandoId ? "Editar despesa" : "Nova despesa pessoal"}</h2>
        <div style={estilos.formGrid}>
          <Campo label="Data" type="date" value={data} onChange={setData} />
          <Campo label="Histórico" value={descricao} onChange={setDescricao} placeholder="Ex.: Mercado" />
          <CampoComLista label="Categoria" value={categoria} onChange={setCategoria} opcoes={categorias} listaId="categorias-pessoais" placeholder="Digite ou selecione" />
          <Campo label="Valor" value={valor} onChange={setValor} placeholder="Ex.: 150,00" />
          <CampoComLista label="Forma de pagamento" value={formaPagamento} onChange={setFormaPagamento} opcoes={pagamentos} listaId="pagamentos-pessoais" placeholder="Digite ou selecione" />
          <label style={estilos.campo}>
            <strong>Situação</strong>
            <select value={status} onChange={(evento) => setStatus(evento.target.value as "Pago" | "Pendente")} style={estilos.input}>
              <option>Pago</option>
              <option>Pendente</option>
            </select>
          </label>
          <Campo label="Observação" value={observacao} onChange={setObservacao} placeholder="Opcional" />
        </div>
        <div style={estilos.acoes}>
          <button type="button" onClick={salvar} style={estilos.botaoPrincipal}>{editandoId ? "Salvar alteração" : "Adicionar despesa"}</button>
          {editandoId ? <button type="button" onClick={limparFormulario} style={estilos.botaoSecundario}>Cancelar</button> : null}
        </div>
        <p style={estilos.ajuda}>Ao digitar uma categoria ou pagamento novo, ele será cadastrado automaticamente para as próximas seleções.</p>
      </section>

      <section style={{ ...estilos.caixa, marginTop: 24 }}>
        <div style={estilos.topoLista}>
          <div>
            <h2 style={{ margin: 0 }}>Movimentações do mês</h2>
            <span style={estilos.textoCinza}>As despesas recorrentes também aparecem aqui.</span>
          </div>
          <input aria-label="Buscar despesas" value={busca} onChange={(evento) => setBusca(evento.target.value)} placeholder="Buscar histórico, categoria ou pagamento..." style={estilos.input} />
        </div>
        <div style={estilos.tabelaContainer}>
          <table style={estilos.tabela}>
            <thead><tr><th style={estilos.th}>Data</th><th style={estilos.th}>Histórico</th><th style={estilos.th}>Categoria</th><th style={estilos.th}>Valor</th><th style={estilos.th}>Pagamento</th><th style={estilos.th}>Situação</th><th style={estilos.th}>Ações</th></tr></thead>
            <tbody>
              {filtradas.map((item) => (
                <tr key={item.id}>
                  <td style={estilos.td}>{formatarData(item.vencimento)}</td>
                  <td style={estilos.td}><strong>{item.descricao}</strong>{item.origem === "recorrente" ? <div style={estilos.recorrente}>Recorrente</div> : null}</td>
                  <td style={estilos.td}>{item.categoria || "—"}</td>
                  <td style={estilos.td}><strong>{moeda(Number(item.valorPrevisto))}</strong></td>
                  <td style={estilos.td}>{item.formaPagamento || "—"}</td>
                  <td style={estilos.td}><span style={estilos.status}>{item.status}</span></td>
                  <td style={estilos.td}>{item.origem === "recorrente" ? <span style={estilos.textoCinza}>Edite em Compromissos</span> : <div style={estilos.acoesLinha}><button type="button" onClick={() => editar(item)} style={estilos.botaoSecundario}>Editar</button><button type="button" onClick={() => excluir(item)} style={estilos.botaoExcluir}>Excluir</button></div>}</td>
                </tr>
              ))}
              {filtradas.length === 0 ? <tr><td colSpan={7} style={estilos.vazio}>Nenhuma despesa pessoal neste mês.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Campo({ label, value, onChange, type = "text", placeholder = "" }: { label: string; value: string; onChange: (valor: string) => void; type?: string; placeholder?: string }) {
  return <label style={estilos.campo}><strong>{label}</strong><input type={type} value={value} onChange={(evento) => onChange(evento.target.value)} placeholder={placeholder} style={estilos.input} /></label>;
}

function CampoComLista({ label, value, onChange, opcoes, listaId, placeholder }: { label: string; value: string; onChange: (valor: string) => void; opcoes: string[]; listaId: string; placeholder: string }) {
  return <label style={estilos.campo}><strong>{label}</strong><input list={listaId} value={value} onChange={(evento) => onChange(evento.target.value)} placeholder={placeholder} style={estilos.input} /><datalist id={listaId}>{opcoes.map((item) => <option key={item} value={item} />)}</datalist></label>;
}

function Card({ titulo, valor }: { titulo: string; valor: string }) {
  return <div style={estilos.card}><span style={estilos.textoCinza}>{titulo}</span><strong style={{ fontSize: 25 }}>{valor}</strong></div>;
}

const estilos: Record<string, CSSProperties> = {
  cabecalho: { display: "flex", justifyContent: "space-between", alignItems: "end", gap: 20, flexWrap: "wrap", marginBottom: 24 },
  textoCinza: { color: "#526078", lineHeight: 1.55 },
  cards: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 16, marginBottom: 24 },
  card: { background: "white", padding: 22, borderRadius: 15, display: "flex", flexDirection: "column", gap: 10, boxShadow: "0 6px 18px rgba(0,0,0,.06)" },
  caixa: { background: "white", padding: 28, borderRadius: 17, boxShadow: "0 6px 18px rgba(0,0,0,.06)" },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 15 },
  campo: { display: "flex", flexDirection: "column", gap: 7 },
  input: { width: "100%", padding: "12px 13px", border: "1px solid #cbd5e1", borderRadius: 9, boxSizing: "border-box", fontSize: 15 },
  acoes: { display: "flex", gap: 10, flexWrap: "wrap", marginTop: 20 },
  acoesLinha: { display: "flex", gap: 7, flexWrap: "wrap" },
  botaoPrincipal: { background: "#15803d", color: "white", border: 0, borderRadius: 9, padding: "13px 18px", cursor: "pointer", fontWeight: 700 },
  botaoSecundario: { background: "white", color: "#172033", border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 11px", cursor: "pointer" },
  botaoExcluir: { background: "#fff1f2", color: "#be123c", border: "1px solid #fecdd3", borderRadius: 8, padding: "8px 11px", cursor: "pointer" },
  ajuda: { margin: "15px 0 0", color: "#526078", fontSize: 14 },
  topoLista: { display: "grid", gridTemplateColumns: "minmax(240px,1fr) minmax(260px,1fr)", alignItems: "end", gap: 15 },
  tabelaContainer: { overflowX: "auto", marginTop: 18 },
  tabela: { width: "100%", minWidth: 920, borderCollapse: "collapse" },
  th: { background: "#101a2d", color: "white", padding: 12, textAlign: "left" },
  td: { padding: 12, borderBottom: "1px solid #e2e8f0" },
  status: { display: "inline-block", padding: "6px 9px", borderRadius: 20, background: "#eef2ff", fontWeight: 700 },
  recorrente: { color: "#1d4ed8", fontSize: 12, fontWeight: 700, marginTop: 4 },
  vazio: { padding: 28, textAlign: "center", color: "#64748b" },
};

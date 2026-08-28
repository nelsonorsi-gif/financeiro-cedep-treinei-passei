import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import type { UsuarioSessao } from "./Acesso";
import {
  carregarConfiguracoes,
} from "./Configuracoes";
import { supabase } from "./lib/supabase";
import { CHAVE_CADASTROS, type Parceiro } from "./Cadastros";
import { CHAVE_CATEGORIAS_PESSOAIS, CHAVE_PAGAMENTOS_PESSOAIS } from "./DespesasPessoais";

export type PagamentoCompromisso = {
  id: string;
  descricao: string;
  valor: number;
  data: string;
  categoria: string;
  banco: string;
  unidade: string;
};

type Compromisso = {
  id: string;
  descricao: string;
  escopo: "Empresarial" | "Pessoal";
  beneficiario: string;
  categoria: string;
  valor_padrao: number;
  dia_vencimento: number;
  banco: string;
  unidade: string;
  inicio: string;
  fim: string | null;
  ativo: boolean;
};

type Ocorrencia = {
  id: string;
  compromisso_id: string;
  competencia: string;
  descricao: string;
  escopo: "Empresarial" | "Pessoal";
  beneficiario: string;
  categoria: string;
  valor_previsto: number;
  valor_pago: number;
  vencimento: string;
  status: "Pendente" | "Pago" | "Parcial" | "Dispensado";
  data_pagamento: string | null;
  banco: string;
  unidade: string;
  observacao: string;
};

const CHAVE_PESSOAIS = "financeiro-cedep-despesas-pessoais";
const categoriasPessoaisPadrao = ["Alimentação","Casa","Educação","Lazer","Saúde","Transporte","Vestuário","Outros"];
const pagamentosPessoaisPadrao = ["Dinheiro","PIX","Sicoob","Cartão de crédito","Cartão de débito"];
const lerListaLocal = <T,>(chave: string, padrao: T[]): T[] => {
  try { const valor=JSON.parse(localStorage.getItem(chave)||"null"); return Array.isArray(valor)?valor:padrao; } catch { return padrao; }
};
const lerFuncionarios = (): Parceiro[] => {
  try {
    const dados=JSON.parse(localStorage.getItem(CHAVE_CADASTROS)||"null");
    if(!Array.isArray(dados?.parceiros)) return [];
    return (dados.parceiros as Parceiro[]).filter((item) => item.situacao==="Ativo" && item.tipo.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().includes("funcionario"));
  } catch { return []; }
};

const moeda = (valor: number) =>
  valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const competenciaAtual = () => new Date().toISOString().slice(0, 7);

const primeiroDia = (competencia: string) => `${competencia}-01`;

const vencimentoDoMes = (competencia: string, dia: number) => {
  const [ano, mes] = competencia.split("-").map(Number);
  const ultimoDia = new Date(ano, mes, 0).getDate();
  return `${competencia}-${String(Math.min(dia, ultimoDia)).padStart(2, "0")}`;
};

function atualizarEspelhoPessoal(ocorrencias: Ocorrencia[]) {
  let avulsas: unknown[] = [];
  try {
    const existentes = JSON.parse(localStorage.getItem(CHAVE_PESSOAIS) ?? "[]");
    avulsas = Array.isArray(existentes) ? existentes.filter((item) => Boolean(item) && typeof item === "object" && "origem" in item && item.origem === "avulsa") : [];
  } catch { avulsas = []; }
  const recorrentes = ocorrencias.filter((item) => item.escopo === "Pessoal").map((item) => ({
    id: item.id, competencia: item.competencia.slice(0,7).split("-").reverse().join("/"), descricao: item.descricao,
    valorPrevisto: Number(item.valor_previsto), valorPago: Number(item.valor_pago), status: item.status,
    vencimento: item.vencimento, categoria: item.categoria, formaPagamento: item.banco, observacao: item.observacao, origem: "recorrente" as const,
  }));
  localStorage.setItem(CHAVE_PESSOAIS, JSON.stringify([...avulsas, ...recorrentes]));
  window.dispatchEvent(new Event("financeiro-despesas-pessoais-atualizadas"));
}

export default function CompromissosMensais({
  usuarioAtual,
  onRegistrarPagamento,
  onAbrirContasPagar,
}: {
  usuarioAtual: UsuarioSessao;
  onRegistrarPagamento: (pagamento: PagamentoCompromisso) => void;
  onAbrirContasPagar?: () => void;
}) {
  const [compromissos, setCompromissos] = useState<Compromisso[]>([]);
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([]);
  const [competencia, setCompetencia] = useState(competenciaAtual());
  const [descricao, setDescricao] = useState("");
  const [escopo, setEscopo] = useState<"Empresarial" | "Pessoal">("Empresarial");
  const [beneficiario, setBeneficiario] = useState("");
  const [categoria, setCategoria] = useState("");
  const [valor, setValor] = useState("");
  const [dia, setDia] = useState("10");
  const [banco, setBanco] = useState("");
  const [unidade, setUnidade] = useState("CEDEP");
  const [compromissoEditando, setCompromissoEditando] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("Todos");
  const [filtroCategoria, setFiltroCategoria] = useState("Todas");
  const [filtroBeneficiario, setFiltroBeneficiario] = useState("Todos");
  const [funcionarios, setFuncionarios] = useState<Parceiro[]>(lerFuncionarios);
  const [categoriasPessoais, setCategoriasPessoais] = useState<string[]>(() => lerListaLocal(CHAVE_CATEGORIAS_PESSOAIS, categoriasPessoaisPadrao));
  const [pagamentosPessoais, setPagamentosPessoais] = useState<string[]>(() => lerListaLocal(CHAVE_PAGAMENTOS_PESSOAIS, pagamentosPessoaisPadrao));
  const configuracoes =
    useMemo(
      carregarConfiguracoes,
      []
    );

  const carregar = useCallback(async () => {
    if (!supabase) return;
    const inicio = primeiroDia(competencia);
    const [modelos, itens, pessoais] = await Promise.all([
      supabase.from("compromissos_recorrentes").select("*").order("descricao"),
      supabase
        .from("ocorrencias_mensais")
        .select("*")
        .eq("competencia", inicio)
        .order("vencimento"),
      supabase
        .from("ocorrencias_mensais")
        .select("*")
        .eq("escopo", "Pessoal")
        .order("competencia", { ascending: false }),
    ]);
    if (modelos.error) throw modelos.error;
    if (itens.error) throw itens.error;
    if (pessoais.error) throw pessoais.error;
    setCompromissos((modelos.data ?? []) as Compromisso[]);
    const lista = (itens.data ?? []) as Ocorrencia[];
    setOcorrencias(lista);
    atualizarEspelhoPessoal(
      (pessoais.data ?? []) as Ocorrencia[]
    );
  }, [competencia]);

  useEffect(() => {
    void carregar().catch((erro) => console.error("Erro ao carregar compromissos:", erro));
  }, [carregar]);

  useEffect(() => {
    const atualizarListas = () => {
      setFuncionarios(lerFuncionarios());
      setCategoriasPessoais(lerListaLocal(CHAVE_CATEGORIAS_PESSOAIS, categoriasPessoaisPadrao));
      setPagamentosPessoais(lerListaLocal(CHAVE_PAGAMENTOS_PESSOAIS, pagamentosPessoaisPadrao));
    };
    window.addEventListener("storage", atualizarListas);
    window.addEventListener("financeiro-despesas-pessoais-atualizadas", atualizarListas);
    return () => {
      window.removeEventListener("storage", atualizarListas);
      window.removeEventListener("financeiro-despesas-pessoais-atualizadas", atualizarListas);
    };
  }, []);

  const limparFormulario = () => {
    setDescricao("");
    setEscopo("Empresarial");
    setBeneficiario("");
    setCategoria("");
    setValor("");
    setDia("10");
    setBanco("");
    setUnidade(configuracoes.unidades[0] || "CEDEP");
    setCompromissoEditando(null);
  };

  const salvarCompromisso = async () => {
    const valorNumerico = Number(valor.replace(",", "."));
    if (!supabase || !descricao.trim() || valorNumerico <= 0) {
      alert("Informe descri\u00e7\u00e3o e valor v\u00e1lido.");
      return;
    }
    if (escopo === "Pessoal" && (!categoria.trim() || !banco.trim())) {
      alert("Informe categoria e forma de pagamento da despesa pessoal.");
      return;
    }
    const estavaEditando = Boolean(compromissoEditando);
    const dados = {
      descricao: descricao.trim(),
      escopo,
      beneficiario: beneficiario.trim(),
      categoria: categoria.trim(),
      valor_padrao: valorNumerico,
      dia_vencimento: Math.max(1, Math.min(31, Number(dia))),
      banco: banco.trim(),
      unidade: escopo === "Pessoal" ? "" : unidade.trim() || configuracoes.unidades[0] || "CEDEP",
      atualizado_em: new Date().toISOString(),
    };
    const { error } = compromissoEditando
      ? await supabase
          .from("compromissos_recorrentes")
          .update(dados)
          .eq("id", compromissoEditando)
      : await supabase.from("compromissos_recorrentes").insert({
          ...dados,
          inicio: primeiroDia(competencia),
          ativo: true,
          criado_por: usuarioAtual.id,
        });
    if (error) {
      alert(error.message);
      return;
    }
    limparFormulario();
    await carregar();
    alert(
      estavaEditando
        ? "Compromisso recorrente atualizado. A altera\u00e7\u00e3o valer\u00e1 para as pr\u00f3ximas listas geradas."
        : "Compromisso mensal salvo."
    );
  };

  const editarCompromisso = (item: Compromisso) => {
    setCompromissoEditando(item.id);
    setDescricao(item.descricao);
    setEscopo(item.escopo);
    setBeneficiario(item.beneficiario);
    setCategoria(item.categoria);
    setValor(String(item.valor_padrao).replace(".", ","));
    setDia(String(item.dia_vencimento));
    setBanco(item.banco);
    setUnidade(item.unidade || configuracoes.unidades[0] || "CEDEP");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const excluirCompromisso = async (item: Compromisso) => {
    if (!supabase) return;
    if (!window.confirm('Encerrar o compromisso recorrente "' + item.descricao + '"? Ele n\u00e3o gerar\u00e1 novos meses, mas o hist\u00f3rico ser\u00e1 preservado.')) return;
    const { error } = await supabase
      .from("compromissos_recorrentes")
      .update({
        ativo: false,
        fim: primeiroDia(competencia),
        atualizado_em: new Date().toISOString(),
      })
      .eq("id", item.id);
    if (error) {
      alert(error.message);
      return;
    }
    if (compromissoEditando === item.id) limparFormulario();
    await carregar();
    alert("Compromisso recorrente encerrado sem apagar o hist\u00f3rico.");
  };

  const gerarMes = async () => {
    if (!supabase) return;
    const inicio = primeiroDia(competencia);
    const ativos = compromissos.filter(
      (item) =>
        item.ativo &&
        item.inicio <= inicio &&
        (!item.fim || item.fim >= inicio)
    );
    if (!ativos.length) {
      alert("Não há compromissos ativos para este mês.");
      return;
    }
    const registros = ativos.map((item) => ({
      compromisso_id: item.id,
      competencia: inicio,
      descricao: item.descricao,
      escopo: item.escopo,
      beneficiario: item.beneficiario,
      categoria: item.categoria,
      valor_previsto: item.valor_padrao,
      vencimento: vencimentoDoMes(competencia, item.dia_vencimento),
      banco: item.banco,
      unidade: item.unidade,
      criado_por: usuarioAtual.id,
    }));
    const { data, error } = await supabase
      .from("ocorrencias_mensais")
      .upsert(registros, { onConflict: "compromisso_id,competencia", ignoreDuplicates: true })
      .select();
    if (error) {
      alert(error.message);
      return;
    }

    const empresariais = ((data ?? []) as Ocorrencia[]).filter(
      (item) => item.escopo === "Empresarial"
    );
    if (empresariais.length) {
      const { error: erroContas } = await supabase.from("contas_financeiras").upsert(
        empresariais.map((item) => ({
          id: `recorrente-${item.id}`,
          tipo: "pagar",
          descricao: item.descricao,
          valor_original: item.valor_previsto,
          vencimento: item.vencimento,
          categoria: item.categoria || "Compromisso mensal",
          banco: item.banco,
          unidade: item.unidade,
          observacao: `Gerado automaticamente para ${competencia}`,
          status: "Pendente",
          origem: "recorrencia",
          criado_por: usuarioAtual.id,
          atualizado_por: usuarioAtual.id,
        })),
        { onConflict: "id" }
      );
      if (erroContas) {
        alert(`O mês foi criado, mas houve erro ao enviar ao Contas a Pagar: ${erroContas.message}`);
      }
    }
    await carregar();
    alert("Lista mensal gerada sem duplicar contas já existentes.");
  };

  const alternarAtivo = async (item: Compromisso) => {
    if (!supabase) return;
    const { error } = await supabase
      .from("compromissos_recorrentes")
      .update({ ativo: !item.ativo, atualizado_em: new Date().toISOString() })
      .eq("id", item.id);
    if (error) alert(error.message);
    else await carregar();
  };

  const pagar = async (item: Ocorrencia) => {
    if (!supabase || item.status === "Pago") return;
    const informado = window.prompt("Valor pago:", String(item.valor_previsto - item.valor_pago).replace(".", ","));
    if (informado === null) return;
    const pagamento = Number(informado.replace(".", "").replace(",", "."));
    if (!Number.isFinite(pagamento) || pagamento <= 0) {
      alert("Valor inválido.");
      return;
    }
    const totalPago = Math.min(item.valor_previsto, item.valor_pago + pagamento);
    const concluido = totalPago >= item.valor_previsto;
    const dataPagamento = new Date().toISOString().slice(0, 10);
    const { error } = await supabase
      .from("ocorrencias_mensais")
      .update({
        valor_pago: totalPago,
        status: concluido ? "Pago" : "Parcial",
        data_pagamento: dataPagamento,
        atualizado_em: new Date().toISOString(),
      })
      .eq("id", item.id);
    if (error) {
      alert(error.message);
      return;
    }

    if (item.escopo === "Empresarial") {
      await supabase
        .from("contas_financeiras")
        .update({
          valor_pago: totalPago,
          status: concluido ? "Pago" : "Parcial",
          data_baixa: concluido ? dataPagamento : null,
          atualizado_por: usuarioAtual.id,
        })
        .eq("id", `recorrente-${item.id}`);
      onRegistrarPagamento({
        id: `recorrente-pagamento-${item.id}-${Date.now()}`,
        descricao: item.descricao,
        valor: pagamento,
        data: dataPagamento,
        categoria: item.categoria || "Compromisso mensal",
        banco: item.banco,
        unidade: item.unidade,
      });
    }
    await carregar();
  };

  const dispensar = async (item: Ocorrencia) => {
    if (!supabase || !window.confirm(`Dispensar "${item.descricao}" neste mês?`)) return;
    const { error } = await supabase
      .from("ocorrencias_mensais")
      .update({ status: "Dispensado", atualizado_em: new Date().toISOString() })
      .eq("id", item.id);
    if (error) alert(error.message);
    else await carregar();
  };

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return ocorrencias.filter(
      (item) =>
        (filtro === "Todos" || item.escopo === filtro || item.status === filtro) &&
        (filtroCategoria === "Todas" || item.categoria === filtroCategoria) &&
        (filtroBeneficiario === "Todos" ||
          item.beneficiario === filtroBeneficiario) &&
        (!termo || `${item.descricao} ${item.beneficiario}`.toLowerCase().includes(termo))
    );
  }, [busca, filtro, filtroCategoria, filtroBeneficiario, ocorrencias]);

  const categoriasFiltro = useMemo(
    () =>
      Array.from(
        new Set(ocorrencias.map((item) => item.categoria).filter(Boolean))
      ).sort(),
    [ocorrencias]
  );
  const beneficiariosFiltro = useMemo(
    () =>
      Array.from(
        new Set(ocorrencias.map((item) => item.beneficiario).filter(Boolean))
      ).sort(),
    [ocorrencias]
  );

  const empresarialPrevisto = ocorrencias
    .filter((item) => item.escopo === "Empresarial" && item.status !== "Dispensado")
    .reduce((total, item) => total + Number(item.valor_previsto), 0);
  const pessoalPrevisto = ocorrencias
    .filter((item) => item.escopo === "Pessoal" && item.status !== "Dispensado")
    .reduce((total, item) => total + Number(item.valor_previsto), 0);
  const totalPago = ocorrencias.reduce((total, item) => total + Number(item.valor_pago), 0);
  const pendente = ocorrencias
    .filter((item) => item.status !== "Dispensado")
    .reduce((total, item) => total + Math.max(0, Number(item.valor_previsto) - Number(item.valor_pago)), 0);

  return (
    <div>
      <header style={estilos.cabecalho}>
        <div>
          <h1 style={{ margin: 0 }}>Compromissos Mensais</h1>
          <p style={estilos.textoCinza}>
            Gere FGTS, INSS, salários, professores e despesas pessoais automaticamente todos os meses.
          </p>
        </div>
        <label style={estilos.campo}>
          <strong>Mês de controle</strong>
          <input type="month" style={estilos.input} value={competencia} onChange={(e) => setCompetencia(e.target.value)} />
        </label>
      </header>

      <section style={estilos.cards}>
        <Card titulo="Contas empresariais" valor={moeda(empresarialPrevisto)} />
        <Card titulo="Despesas pessoais" valor={moeda(pessoalPrevisto)} />
        <Card titulo="Total pago" valor={moeda(totalPago)} />
        <Card titulo="Ainda pendente" valor={moeda(pendente)} />
      </section>

      <section style={estilos.caixa}>
        <h2>{compromissoEditando ? "Editar compromisso recorrente" : "Novo compromisso recorrente"}</h2>
        <div style={estilos.formGrid}>
          <Campo label="Descrição" value={descricao} onChange={setDescricao} />
          <label style={estilos.campo}>
            <strong>Grupo</strong>
            <select style={estilos.input} value={escopo} onChange={(e) => {
              setEscopo(e.target.value as "Empresarial" | "Pessoal");
              setCategoria("");
              setBanco("");
            }}>
              <option>Empresarial</option>
              {usuarioAtual.perfil !== "Secretaria" && <option>Pessoal</option>}
            </select>
          </label>
          {escopo === "Pessoal" && (
            <div style={estilos.avisoPessoal}>
              Este compromisso ser&aacute; exibido somente em Despesas Pessoais e n&atilde;o ser&aacute; enviado ao Contas a Pagar nem ao caixa da escola.
            </div>
          )}
          <CampoComLista label={escopo === "Pessoal" ? "Favorecido (opcional)" : "Funcionário / favorecido"} value={beneficiario} onChange={setBeneficiario} opcoes={funcionarios.map((item) => item.nome)} listaId="funcionarios-compromissos" placeholder="Digite ou selecione um funcionário" />
          {escopo === "Pessoal" ? (
            <CampoComLista label="Categoria" value={categoria} onChange={setCategoria} opcoes={categoriasPessoais} listaId="categorias-pessoais-compromissos" placeholder="Digite ou selecione" />
          ) : (
            <label style={estilos.campo}>
              <strong>Tipo de saída</strong>
              <select style={estilos.input} value={categoria} onChange={(e) => setCategoria(e.target.value)}>
                <option value="">Selecione...</option>
                {configuracoes.tiposSaida.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
          )}
          <Campo label="Valor padrão" value={valor} onChange={setValor} placeholder="Ex.: 1.500,00" />
          <Campo label="Dia do vencimento" type="number" value={dia} onChange={setDia} />
          {escopo === "Pessoal" ? (
            <CampoComLista label="Forma de pagamento" value={banco} onChange={setBanco} opcoes={pagamentosPessoais} listaId="pagamentos-pessoais-compromissos" placeholder="Digite ou selecione" />
          ) : (
            <>
              <Campo label="Banco / conta" value={banco} onChange={setBanco} />
              <label style={estilos.campo}>
                <strong>Unidade</strong>
                <select style={estilos.input} value={unidade} onChange={(e) => setUnidade(e.target.value)}>
                  {configuracoes.unidades.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
            </>
          )}
        </div>
        <div style={estilos.acoes}>
          <button style={estilos.botaoPrincipal} onClick={salvarCompromisso}>
            {compromissoEditando ? "Salvar altera\u00e7\u00f5es" : "Salvar compromisso"}
          </button>
          {compromissoEditando && (
            <button style={estilos.botaoSecundario} onClick={limparFormulario}>Cancelar edi\u00e7\u00e3o</button>
          )}
          <button style={estilos.botaoGerar} onClick={gerarMes}>Gerar lista de {competencia.split("-").reverse().join("/")}</button>
        </div>
      </section>

      <section style={{ ...estilos.caixa, marginTop: 24 }}>
        <h2>Modelos que se repetem</h2>
        <div style={estilos.modelos}>
          {compromissos.filter((item) => !item.fim).map((item) => (
            <div key={item.id} style={estilos.modelo}>
              <div>
                <strong>{item.descricao}</strong>
                <div style={estilos.textoCinza}>
                  {item.escopo} • dia {item.dia_vencimento} • {moeda(Number(item.valor_padrao))}
                  {item.beneficiario ? ` • ${item.beneficiario}` : ""}
                </div>
              </div>
              <div style={estilos.acoesLinha}>
                <button style={estilos.botaoSecundario} onClick={() => editarCompromisso(item)}>Editar</button>
                <button style={estilos.botaoSecundario} onClick={() => alternarAtivo(item)}>
                  {item.ativo ? "Pausar" : "Reativar"}
                </button>
                <button style={estilos.botaoExcluir} onClick={() => void excluirCompromisso(item)}>Excluir</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ ...estilos.caixa, marginTop: 24 }}>
        <div style={estilos.topoLista}>
          <h2>Checklist do mês</h2>
          <input style={estilos.inputBusca} value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar conta, funcionário ou professor..." />
          <select style={estilos.inputFiltro} value={filtro} onChange={(e) => setFiltro(e.target.value)}>
            <option>Todos</option>
            <option>Empresarial</option>
            <option>Pessoal</option>
            <option>Pendente</option>
            <option>Parcial</option>
            <option>Pago</option>
          </select>
          <select aria-label="Tipo de saída" style={estilos.inputFiltro} value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)}>
            <option>Todas</option>
            {categoriasFiltro.map((item) => <option key={item}>{item}</option>)}
          </select>
          <select style={estilos.inputFiltro} value={filtroBeneficiario} onChange={(e) => setFiltroBeneficiario(e.target.value)}>
            <option>Todos</option>
            {beneficiariosFiltro.map((item) => <option key={item}>{item}</option>)}
          </select>
          {onAbrirContasPagar && (
            <button style={estilos.botaoAbrirContas} onClick={onAbrirContasPagar}>
              Abrir Contas a Pagar
            </button>
          )}
        </div>
        <div style={estilos.tabelaContainer}>
          <table style={estilos.tabela}>
            <thead>
              <tr>
                <th style={estilos.th}>Vencimento</th>
                <th style={estilos.th}>Descrição</th>
                <th style={estilos.th}>Grupo</th>
                <th style={estilos.th}>Previsto</th>
                <th style={estilos.th}>Pago</th>
                <th style={estilos.th}>Status</th>
                <th style={estilos.th}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((item) => (
                <tr key={item.id}>
                  <td style={estilos.td}>{item.vencimento.split("-").reverse().join("/")}</td>
                  <td style={estilos.td}><strong>{item.descricao}</strong><div>{item.beneficiario}</div></td>
                  <td style={estilos.td}>{item.escopo}</td>
                  <td style={estilos.td}>{moeda(Number(item.valor_previsto))}</td>
                  <td style={estilos.td}>{moeda(Number(item.valor_pago))}</td>
                  <td style={estilos.td}><span style={estilos.status}>{item.status}</span></td>
                  <td style={estilos.td}>
                    <div style={estilos.acoesLinha}>
                      {item.status !== "Pago" && item.status !== "Dispensado" && (
                        <button style={estilos.botaoPagar} onClick={() => pagar(item)}>✓ Pagar</button>
                      )}
                      {item.status !== "Pago" && item.status !== "Dispensado" && (
                        <button style={estilos.botaoSecundario} onClick={() => dispensar(item)}>Dispensar</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Campo({ label, value, onChange, type = "text", placeholder = "" }: { label: string; value: string; onChange: (valor: string) => void; type?: string; placeholder?: string }) {
  return <label style={estilos.campo}><strong>{label}</strong><input style={estilos.input} type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} /></label>;
}

function CampoComLista({ label, value, onChange, opcoes, listaId, placeholder }: { label: string; value: string; onChange: (valor: string) => void; opcoes: string[]; listaId: string; placeholder: string }) {
  return <label style={estilos.campo}><strong>{label}</strong><input list={listaId} style={estilos.input} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} /><datalist id={listaId}>{opcoes.map((item) => <option key={item} value={item} />)}</datalist></label>;
}

function Card({ titulo, valor }: { titulo: string; valor: string }) {
  return <div style={estilos.card}><span style={estilos.textoCinza}>{titulo}</span><strong style={{ fontSize: 25 }}>{valor}</strong></div>;
}

const estilos: Record<string, CSSProperties> = {
  cabecalho: { display: "flex", justifyContent: "space-between", alignItems: "end", gap: 20, flexWrap: "wrap", marginBottom: 24 },
  textoCinza: { color: "#526078", lineHeight: 1.55 },
  cards: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 16, marginBottom: 24 },
  card: { background: "white", padding: 22, borderRadius: 15, display: "flex", flexDirection: "column", gap: 10, boxShadow: "0 6px 18px rgba(0,0,0,.06)" },
  caixa: { background: "white", padding: 28, borderRadius: 17, boxShadow: "0 6px 18px rgba(0,0,0,.06)" },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 15 },
  campo: { display: "flex", flexDirection: "column", gap: 7 },
  input: { width: "100%", padding: "12px 13px", border: "1px solid #cbd5e1", borderRadius: 9, boxSizing: "border-box", fontSize: 15 },
  acoes: { display: "flex", gap: 10, flexWrap: "wrap", marginTop: 22 },
  botaoPrincipal: { background: "#15803d", color: "white", border: 0, borderRadius: 9, padding: "13px 18px", cursor: "pointer", fontWeight: 700 },
  botaoGerar: { background: "#1d4ed8", color: "white", border: 0, borderRadius: 9, padding: "13px 18px", cursor: "pointer", fontWeight: 700 },
  botaoSecundario: { background: "white", color: "#172033", border: "1px solid #cbd5e1", borderRadius: 8, padding: "9px 12px", cursor: "pointer" },
  modelos: { display: "grid", gap: 4 },
  modelo: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 15, padding: "14px 0", borderBottom: "1px solid #e2e8f0", flexWrap: "wrap" },
  topoLista: { display: "grid", gridTemplateColumns: "1fr minmax(260px,2fr) minmax(150px,1fr)", gap: 12, alignItems: "center" },
  inputBusca: { padding: "12px 13px", border: "1px solid #cbd5e1", borderRadius: 9 },
  inputFiltro: { padding: "12px 13px", border: "1px solid #cbd5e1", borderRadius: 9 },
  tabelaContainer: { overflowX: "auto", marginTop: 18 },
  tabela: { width: "100%", minWidth: 950, borderCollapse: "collapse" },
  th: { background: "#101a2d", color: "white", padding: 12, textAlign: "left" },
  td: { padding: 12, borderBottom: "1px solid #e2e8f0" },
  status: { display: "inline-block", padding: "6px 9px", borderRadius: 20, background: "#eef2ff", fontWeight: 700 },
  acoesLinha: { display: "flex", gap: 7 },
  botaoPagar: { background: "#15803d", color: "white", border: 0, borderRadius: 7, padding: "8px 10px", cursor: "pointer" },
  botaoAbrirContas: { background: "#17233a", color: "white", border: 0, borderRadius: 9, padding: "12px 14px", cursor: "pointer", fontWeight: 700 },
  botaoExcluir: { background: "#fff", color: "#b91c1c", border: "1px solid #fecaca", borderRadius: 8, padding: "9px 12px", cursor: "pointer" },
  avisoPessoal: { gridColumn: "1 / -1", background: "#eff6ff", color: "#1e40af", border: "1px solid #bfdbfe", borderRadius: 9, padding: "12px 14px", lineHeight: 1.5 },
};

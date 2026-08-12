import type { UsuarioSessao } from "../Acesso";

export const CHAVE_CAIXA = "financeiro-cedep-secretaria";
export const EVENTO_CAIXA_ATUALIZADO = "financeiro-caixa-atualizado";

export type NaturezaMovimentoCaixa =
  | "entrada"
  | "saida"
  | "estorno_entrada"
  | "estorno_saida";

export type MovimentoCaixa = {
  id: string;
  natureza: NaturezaMovimentoCaixa;
  origem: "mensalidade" | "conta_receber" | "conta_pagar" | "receita" | "despesa" | "secretaria" | "taxa_cartao" | "estorno" | "lancamento";
  origemId: string;
  descricao: string;
  valor: number;
  formaPagamento: string;
  dataHora: string;
  usuarioId: string;
  usuarioNome: string;
  alunoId?: string;
  alunoNome?: string;
  estornoDeId?: string;
  motivoEstorno?: string;
  modalidadeCartao?: string;
  parcelasCartao?: number;
  taxaCartao?: number;
  valorLiquido?: number;
  historicoEdicoes?: Array<{
    dataHora: string;
    usuarioId: string;
    usuarioNome: string;
    motivo: string;
    descricaoAnterior: string;
    valorAnterior: number;
    formaPagamentoAnterior: string;
  }>;
};

export type ReaberturaCaixa = {
  dataHora: string;
  usuarioId: string;
  usuarioNome: string;
  motivo: string;
};

export type FechamentoCaixa = {
  dataHora: string;
  valorInformado?: number;
  valorEsperado?: number;
  diferenca?: number;
  observacao?: string;
};

export type SessaoCaixaOperacional = {
  id: string;
  operador: string;
  operadorId?: string;
  unidade: string;
  abertura: string;
  valorInicial: number;
  recebimentos: unknown[];
  movimentos?: MovimentoCaixa[];
  status: "Aberto" | "Fechado";
  fechamento?: string;
  reaberturas?: ReaberturaCaixa[];
  historicoFechamentos?: FechamentoCaixa[];
  alteradoAposReabertura?: boolean;
};

type DadosCaixa = { sessoes: SessaoCaixaOperacional[] };

const carregar = (): DadosCaixa => {
  try {
    const dados = JSON.parse(localStorage.getItem(CHAVE_CAIXA) || "{}");
    return { sessoes: Array.isArray(dados.sessoes) ? dados.sessoes : [] };
  } catch {
    return { sessoes: [] };
  }
};

const salvar = (dados: DadosCaixa) => {
  localStorage.setItem(CHAVE_CAIXA, JSON.stringify(dados));
  window.dispatchEvent(new Event(EVENTO_CAIXA_ATUALIZADO));
};

export const obterCaixaAbertoDoUsuario = (usuario: UsuarioSessao) => {
  if (usuario.perfil === "Administrador") return null;
  return carregar().sessoes.find(
    (sessao) =>
      sessao.status === "Aberto" &&
      (sessao.operadorId === usuario.id ||
        (!sessao.operadorId && sessao.operador === usuario.nome))
  ) ?? null;
};

export const usuarioPodeMovimentar = (usuario: UsuarioSessao) =>
  usuario.perfil === "Administrador" || Boolean(obterCaixaAbertoDoUsuario(usuario));

export const mensagemCaixaFechado =
  "Não há caixa aberto para este usuário. Abra o caixa antes de realizar esta operação.";

export const registrarMovimentoCaixa = (
  usuario: UsuarioSessao,
  movimento: Omit<MovimentoCaixa, "id" | "dataHora" | "usuarioId" | "usuarioNome">
) => {
  if (usuario.perfil === "Administrador") {
    return {
      ...movimento,
      id: `administrativo-${Date.now()}-${Math.random()}`,
      dataHora: new Date().toISOString(),
      usuarioId: usuario.id,
      usuarioNome: usuario.nome,
      administrativoSemCaixa: true,
    };
  }

  const dados = carregar();
  const caixa = obterCaixaAbertoDoUsuario(usuario);
  if (!caixa) throw new Error(mensagemCaixaFechado);

  const registro: MovimentoCaixa = {
    ...movimento,
    id: `movimento-${Date.now()}-${Math.random()}`,
    dataHora: new Date().toISOString(),
    usuarioId: usuario.id,
    usuarioNome: usuario.nome,
  };

  dados.sessoes = dados.sessoes.map((sessao) =>
    sessao.id === caixa.id
      ? { ...sessao, movimentos: [...(sessao.movimentos || []), registro] }
      : sessao
  );
  salvar(dados);
  return { ...registro, caixaId: caixa.id, administrativoSemCaixa: false };
};

export const registrarEstornoCaixa = ({
  usuario,
  original,
  motivo,
}: {
  usuario: UsuarioSessao;
  original: MovimentoCaixa;
  motivo: string;
}) =>
  registrarMovimentoCaixa(usuario, {
    natureza:
      original.natureza === "entrada" || original.natureza === "estorno_saida"
        ? "estorno_entrada"
        : "estorno_saida",
    origem: "estorno",
    origemId: original.origemId,
    descricao: `Estorno: ${original.descricao}`,
    valor: original.valor,
    formaPagamento: original.formaPagamento,
    alunoId: original.alunoId,
    alunoNome: original.alunoNome,
    estornoDeId: original.id,
    motivoEstorno: motivo,
  });

export const totaisDaSessao = (sessao: SessaoCaixaOperacional) => {
  const movimentos = sessao.movimentos || [];
  const somar = (natureza: NaturezaMovimentoCaixa) =>
    movimentos.filter((item) => item.natureza === natureza).reduce((soma, item) => soma + item.valor, 0);
  const entradas = somar("entrada");
  const saidas = somar("saida");
  const estornosEntradas = somar("estorno_entrada");
  const estornosSaidas = somar("estorno_saida");
  return {
    entradas,
    saidas,
    estornosEntradas,
    estornosSaidas,
    saldoEsperado: sessao.valorInicial + entradas - saidas - estornosEntradas + estornosSaidas,
  };
};


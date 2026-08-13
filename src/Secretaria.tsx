import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";

import {
  CHAVE_CADASTROS,
  type Aluno,
} from "./Cadastros";

import {
  carregarConfiguracoes,
  type ConfiguracoesFinanceiras,
} from "./Configuracoes";
import type { UsuarioSessao } from "./Acesso";
import { EVENTO_CAIXA_ATUALIZADO, registrarMovimentoCaixa, totaisDaSessao, type MovimentoCaixa } from "./servicos/caixaOperacional";
import { calcularTaxaCartao } from "./servicos/taxasCartao";

export type RecebimentoCaixa = {
  id: string;
  alunoId: string;
  alunoNome: string;
  descricao: string;
  valor: number;
  formaPagamento: string;
  unidade: string;
  dataHora: string;
  modalidadeCartao?: "debito" | "credito";
  parcelasCartao?: number;
  taxaCartao?: number;
  valorLiquidoCartao?: number;
  caixaId?: string;
  movimentoCaixaId?: string;
};

export type SessaoCaixa = {
  id: string;
  operador: string;
  operadorId?: string;
  unidade: string;
  abertura: string;
  valorInicial: number;
  recebimentos: RecebimentoCaixa[];
  movimentos?: MovimentoCaixa[];
  status: "Aberto" | "Fechado";
  fechamento?: string;
  valorInformado?: number;
  valorEsperado?: number;
  diferenca?: number;
  observacaoFechamento?: string;
  reaberturas?: Array<{
    dataHora: string;
    usuarioId: string;
    usuarioNome: string;
    motivo: string;
  }>;
  historicoFechamentos?: Array<{
    dataHora: string;
    valorInformado?: number;
    valorEsperado?: number;
    diferenca?: number;
    observacao?: string;
  }>;
  alteradoAposReabertura?: boolean;
};

type Props = {
  usuarioAtual: UsuarioSessao;
  onRegistrarReceita: (
    recebimento: RecebimentoCaixa
  ) => void;
};

export const CHAVE_SECRETARIA =
  "financeiro-cedep-secretaria";

const moeda = (valor: number) =>
  valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

const converterNumero = (
  valor: string
) => {
  const texto = valor
    .replace("R$", "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  const numero = Number(texto);
  return Number.isFinite(numero)
    ? numero
    : 0;
};

const ehFormaDinheiro = (formaPagamento: string | undefined) =>
  (formaPagamento ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR") === "dinheiro";

const dinheiroEsperadoDaSessao = (sessao: SessaoCaixa) =>
  (sessao.movimentos ?? []).reduce((saldo, movimento) => {
    if (!ehFormaDinheiro(movimento.formaPagamento)) return saldo;
    const entrada =
      movimento.natureza === "entrada" ||
      movimento.natureza === "estorno_saida";
    return saldo + (entrada ? movimento.valor : -movimento.valor);
  }, sessao.valorInicial);

const normalizarSessao = (sessao: SessaoCaixa): SessaoCaixa => {
  const movimentos = [...(sessao.movimentos ?? [])];
  const idsOrigem = new Set(movimentos.map((item) => item.origemId));

  for (const recebimento of sessao.recebimentos ?? []) {
    if (idsOrigem.has(recebimento.id)) continue;
    movimentos.push({
      id: `movimento-legado-${recebimento.id}`,
      natureza: "entrada",
      origem: "secretaria",
      origemId: recebimento.id,
      descricao: recebimento.descricao,
      valor: recebimento.valor,
      formaPagamento: recebimento.formaPagamento,
      dataHora: recebimento.dataHora,
      usuarioId: sessao.operadorId ?? "legado",
      usuarioNome: sessao.operador,
      alunoId: recebimento.alunoId,
      alunoNome: recebimento.alunoNome,
      modalidadeCartao: recebimento.modalidadeCartao,
      parcelasCartao: recebimento.parcelasCartao,
      taxaCartao: recebimento.taxaCartao,
      valorLiquido: recebimento.valorLiquidoCartao,
    });
  }

  return { ...sessao, movimentos };
};

const normalizarSessoes = (sessoes: SessaoCaixa[]) =>
  sessoes.map(normalizarSessao);

function Secretaria({
  usuarioAtual,
  onRegistrarReceita,
}: Props) {
  const [sessoes, setSessoes] =
    useState<SessaoCaixa[]>([]);
  const [alunos, setAlunos] =
    useState<Aluno[]>([]);
  const [
    configuracoes,
    setConfiguracoes,
  ] =
    useState<ConfiguracoesFinanceiras>(
      carregarConfiguracoes()
    );
  const [carregado, setCarregado] =
    useState(false);

  const [operador, setOperador] =
    useState(usuarioAtual.nome);
  const [unidadeAbertura, setUnidadeAbertura] =
    useState("CEDEP");
  const [valorInicial, setValorInicial] =
    useState("0,00");

  const [alunoId, setAlunoId] =
    useState("");
  const [descricao, setDescricao] =
    useState("Mensalidade");
  const [valor, setValor] =
    useState("");
  const [formaPagamento, setFormaPagamento] =
    useState("");
  const [parcelasCartao, setParcelasCartao] = useState(2);

  const [valorFechamento, setValorFechamento] =
    useState("");
  const [observacaoFechamento, setObservacaoFechamento] =
    useState("");
  const [caixaVisualizadoId, setCaixaVisualizadoId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const secretaria =
        localStorage.getItem(
          CHAVE_SECRETARIA
        );
      const cadastros =
        localStorage.getItem(
          CHAVE_CADASTROS
        );

      if (secretaria) {
        const conteudo =
          JSON.parse(secretaria);
        setSessoes(
          Array.isArray(
            conteudo.sessoes
          )
            ? normalizarSessoes(conteudo.sessoes)
            : []
        );
      }

      if (cadastros) {
        const conteudo =
          JSON.parse(cadastros);
        setAlunos(
          Array.isArray(
            conteudo.alunos
          )
            ? conteudo.alunos
            : []
        );
      }
    } catch (erro) {
      console.error(
        "Erro ao carregar Secretaria:",
        erro
      );
    } finally {
      setCarregado(true);
    }
  }, []);

  useEffect(() => {
    if (!carregado) return;

    localStorage.setItem(
      CHAVE_SECRETARIA,
      JSON.stringify({
        sessoes,
      })
    );
  }, [sessoes, carregado]);

  useEffect(() => {
    const atualizar = () =>
      setConfiguracoes(
        carregarConfiguracoes()
      );

    window.addEventListener(
      "financeiro-config-atualizada",
      atualizar
    );

    return () =>
      window.removeEventListener(
        "financeiro-config-atualizada",
        atualizar
      );
  }, []);


  useEffect(() => {
    const atualizarCaixa = () => {
      try {
        const salvo = localStorage.getItem(CHAVE_SECRETARIA);
        const conteudo = salvo ? JSON.parse(salvo) : null;
        if (Array.isArray(conteudo?.sessoes)) setSessoes(normalizarSessoes(conteudo.sessoes));
      } catch (erro) {
        console.error("Erro ao atualizar caixa:", erro);
      }
    };
    window.addEventListener(EVENTO_CAIXA_ATUALIZADO, atualizarCaixa);
    return () => window.removeEventListener(EVENTO_CAIXA_ATUALIZADO, atualizarCaixa);
  }, []);
  const caixaAberto =
    sessoes.find(
      (item) =>
        item.status === "Aberto" &&
        (item.operadorId === usuarioAtual.id || (!item.operadorId && item.operador === usuarioAtual.nome))
    ) ?? null;

  const caixaVisualizado =
    (caixaVisualizadoId
      ? sessoes.find((item) => item.id === caixaVisualizadoId)
      : null) ?? caixaAberto;

  const movimentosVisualizados = caixaVisualizado?.movimentos ?? [];
  const totaisMovimento = caixaVisualizado
    ? totaisDaSessao(caixaVisualizado)
    : null;
  const valorEsperado = caixaAberto
    ? totaisDaSessao(caixaAberto).saldoEsperado
    : 0;
  const dinheiroEsperado = caixaAberto
    ? dinheiroEsperadoDaSessao(caixaAberto)
    : 0;
  const dinheiroEsperadoVisualizado = caixaVisualizado
    ? dinheiroEsperadoDaSessao(caixaVisualizado)
    : 0;
  const diferencaDinheiroVisualizada =
    caixaVisualizado?.valorInformado !== undefined
      ? caixaVisualizado.valorInformado - dinheiroEsperadoVisualizado
      : undefined;
  const totalRecebido = caixaAberto
    ? (caixaAberto.movimentos ?? [])
        .filter((item) => item.natureza === "entrada")
        .reduce((total, item) => total + item.valor, 0)
    : 0;

  const resumoFormas = movimentosVisualizados.reduce<
    Record<string, { entradas: number; saidas: number }>
  >((totais, movimento) => {
    const forma = movimento.formaPagamento || "Não informado";
    const atual = totais[forma] ?? { entradas: 0, saidas: 0 };
    if (movimento.natureza === "entrada" || movimento.natureza === "estorno_saida") {
      atual.entradas += movimento.valor;
    } else {
      atual.saidas += movimento.valor;
    }
    totais[forma] = atual;
    return totais;
  }, {});
  const alunosAtivos = useMemo(
    () =>
      alunos
        .filter(
          (item) =>
            item.situacao === "Ativo"
        )
        .sort((a, b) =>
          a.nome.localeCompare(b.nome)
        ),
    [alunos]
  );

  const abrirCaixa = () => {
    if (caixaAberto) {
      alert(
        "Já existe um caixa aberto."
      );
      return;
    }

    if (!operador.trim() || !unidadeAbertura) {
      alert(
        "Informe operador e unidade."
      );
      return;
    }

    const inicial =
      converterNumero(valorInicial);

    if (inicial < 0) {
      alert(
        "Informe um valor inicial válido."
      );
      return;
    }

    const sessao: SessaoCaixa = {
      id: `caixa-${Date.now()}`,
      operador: operador.trim(),
      operadorId: usuarioAtual.id,
      unidade: unidadeAbertura,
      abertura:
        new Date().toISOString(),
      valorInicial: inicial,
      recebimentos: [],
      movimentos: [],
      status: "Aberto",
    };

    setSessoes((atuais) => [
      ...atuais,
      sessao,
    ]);
    setCaixaVisualizadoId(null);
    setValorInicial("0,00");
    alert("Caixa aberto.");
  };

  const registrarRecebimento = () => {
    if (!caixaAberto) {
      alert(
        "Abra o caixa antes de registrar recebimentos."
      );
      return;
    }

    const aluno = alunos.find(
      (item) =>
        item.id === alunoId
    );
    const valorNumerico =
      converterNumero(valor);

    if (
      !aluno ||
      !descricao.trim() ||
      valorNumerico <= 0 ||
      !formaPagamento
    ) {
      alert(
        "Preencha aluno, descrição, valor e forma de pagamento."
      );
      return;
    }

    const cartao = calcularTaxaCartao(valorNumerico, formaPagamento, parcelasCartao);

    const recebimento: RecebimentoCaixa = {
      id: `recebimento-${Date.now()}`,
      alunoId: aluno.id,
      alunoNome: aluno.nome,
      descricao:
        descricao.trim(),
      valor: valorNumerico,
      formaPagamento,
      unidade:
        aluno.unidade ||
        caixaAberto.unidade,
      dataHora:
        new Date().toISOString(),
      modalidadeCartao: cartao.modalidade ?? undefined,
      parcelasCartao: cartao.parcelas,
      taxaCartao: cartao.taxa,
      valorLiquidoCartao: cartao.liquido,
    };

    const movimentoRegistrado = registrarMovimentoCaixa(usuarioAtual, {
      natureza: "entrada", origem: "secretaria", origemId: recebimento.id,
      descricao: recebimento.descricao, valor: recebimento.valor,
      formaPagamento: recebimento.formaPagamento, modalidadeCartao: recebimento.modalidadeCartao, parcelasCartao: recebimento.parcelasCartao, taxaCartao: recebimento.taxaCartao, valorLiquido: recebimento.valorLiquidoCartao, alunoId: recebimento.alunoId, alunoNome: recebimento.alunoNome,
    });

    onRegistrarReceita({
      ...recebimento,
      caixaId: "caixaId" in movimentoRegistrado ? movimentoRegistrado.caixaId : undefined,
      movimentoCaixaId: movimentoRegistrado.id,
    });

    setAlunoId("");
    setDescricao("Mensalidade");
    setValor("");
    setParcelasCartao(2);
    alert(
      "Recebimento registrado no caixa e no financeiro."
    );
  };

  const reabrirCaixa = (sessao: SessaoCaixa) => {
    const pertenceAoUsuario =
      sessao.operadorId === usuarioAtual.id ||
      (!sessao.operadorId && sessao.operador === usuarioAtual.nome);

    if (!pertenceAoUsuario) {
      alert("Somente o operador responsável pode reabrir este caixa.");
      return;
    }
    if (caixaAberto) {
      alert("Feche o caixa atualmente aberto antes de reabrir outro.");
      return;
    }

    const motivo = window.prompt(
      "Informe o motivo da reabertura. Esta ação ficará registrada no histórico:"
    )?.trim();
    if (!motivo) return;
    if (!window.confirm("Atenção: este caixa será reaberto para correções e deverá ser fechado novamente. Continuar?")) {
      return;
    }

    const agora = new Date().toISOString();
    setSessoes((atuais) =>
      atuais.map((item) =>
        item.id === sessao.id
          ? {
              ...item,
              status: "Aberto",
              fechamento: undefined,
              valorInformado: undefined,
              valorEsperado: undefined,
              diferenca: undefined,
              observacaoFechamento: undefined,
              alteradoAposReabertura: false,
              reaberturas: [
                ...(item.reaberturas ?? []),
                {
                  dataHora: agora,
                  usuarioId: usuarioAtual.id,
                  usuarioNome: usuarioAtual.nome,
                  motivo,
                },
              ],
            }
          : item
      )
    );
    setCaixaVisualizadoId(null);
    alert("Atenção: caixa reaberto. Todas as alterações serão registradas.");
  };

  const editarMovimento = (movimento: MovimentoCaixa) => {
    if (!caixaAberto) return;
    const motivo = window.prompt("Informe o motivo da edição:")?.trim();
    if (!motivo) return;
    const novaDescricao = window.prompt("Descrição:", movimento.descricao)?.trim();
    if (!novaDescricao) return;
    const novoValorTexto = window.prompt(
      "Valor:",
      movimento.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })
    );
    if (novoValorTexto === null) return;
    const novoValor = converterNumero(novoValorTexto);
    if (novoValor <= 0) {
      alert("Informe um valor válido.");
      return;
    }
    const novaForma = window.prompt(
      "Forma de pagamento:",
      movimento.formaPagamento
    )?.trim();
    if (!novaForma) return;

    setSessoes((atuais) =>
      atuais.map((sessao) =>
        sessao.id === caixaAberto.id
          ? {
              ...sessao,
              alteradoAposReabertura:
                Boolean(sessao.reaberturas?.length) || sessao.alteradoAposReabertura,
              movimentos: (sessao.movimentos ?? []).map((item) =>
                item.id === movimento.id
                  ? {
                      ...item,
                      descricao: novaDescricao,
                      valor: novoValor,
                      formaPagamento: novaForma,
                      historicoEdicoes: [
                        ...(item.historicoEdicoes ?? []),
                        {
                          dataHora: new Date().toISOString(),
                          usuarioId: usuarioAtual.id,
                          usuarioNome: usuarioAtual.nome,
                          motivo,
                          descricaoAnterior: item.descricao,
                          valorAnterior: item.valor,
                          formaPagamentoAnterior: item.formaPagamento,
                        },
                      ],
                    }
                  : item
              ),
            }
          : sessao
      )
    );
    alert("Movimento atualizado e alteração registrada no histórico.");
  };

  const imprimirRelatorioCaixa = () => {
    if (!caixaVisualizado || !totaisMovimento) return;

    const escapar = (valor: unknown) =>
      String(valor ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");

    const linhas = [...movimentosVisualizados]
      .sort((a, b) => a.dataHora.localeCompare(b.dataHora))
      .map((movimento) => {
        const entrada =
          movimento.natureza === "entrada" ||
          movimento.natureza === "estorno_saida";
        const tipo = movimento.natureza.startsWith("estorno")
          ? movimento.natureza === "estorno_entrada"
            ? "Estorno de entrada"
            : "Estorno de saída"
          : movimento.origem.replaceAll("_", " ");
        const detalhes = [
          movimento.alunoNome,
          movimento.motivoEstorno ? "Motivo: " + movimento.motivoEstorno : "",
        ].filter(Boolean).map(escapar).join("<br>");
        return `<tr>
          <td>${escapar(new Date(movimento.dataHora).toLocaleString("pt-BR"))}</td>
          <td><strong>${escapar(movimento.descricao)}</strong>${detalhes ? "<br>" + detalhes : ""}</td>
          <td>${entrada ? escapar(tipo) : ""}</td>
          <td>${entrada ? "" : escapar(tipo)}</td>
          <td>${escapar(movimento.formaPagamento)}</td>
          <td class="entrada">${entrada ? escapar(moeda(movimento.valor)) : ""}</td>
          <td class="saida">${!entrada ? escapar(moeda(movimento.valor)) : ""}</td>
          <td>${escapar(caixaVisualizado.unidade)}</td>
        </tr>`;
      })
      .join("");

    const formas = Object.entries(resumoFormas)
      .map(([forma, totais]) => `<tr>
        <td><strong>${escapar(forma)}</strong></td>
        <td class="entrada">${escapar(moeda(totais.entradas))}</td>
        <td class="saida">${escapar(moeda(totais.saidas))}</td>
        <td>${escapar(moeda(totais.entradas - totais.saidas))}</td>
      </tr>`)
      .join("");

    const janela = window.open("", "_blank", "width=1100,height=760");
    if (!janela) {
      alert("O navegador bloqueou a janela de impressão. Autorize pop-ups para este site.");
      return;
    }

    janela.document.write(`<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Relatório de caixa - ${escapar(caixaVisualizado.operador)}</title>
<style>
  @page { size: A4 landscape; margin: 8mm; }
  * { box-sizing: border-box; }
  body { margin: 0; color: #111827; font-family: Arial, sans-serif; font-size: 8.5pt; }
  h1 { margin: 0 0 3px; font-size: 16pt; }
  h2 { margin: 12px 0 5px; font-size: 11pt; }
  .meta { margin-bottom: 9px; color: #475569; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  thead { display: table-header-group; }
  tr { break-inside: avoid; }
  th { background: #111827; color: white; padding: 5px 4px; text-align: left; font-size: 7.5pt; }
  td { border: 1px solid #cbd5e1; padding: 4px; vertical-align: top; overflow-wrap: anywhere; }
  .movimentos th:nth-child(1), .movimentos td:nth-child(1) { width: 12%; }
  .movimentos th:nth-child(2), .movimentos td:nth-child(2) { width: 24%; }
  .movimentos th:nth-child(3), .movimentos td:nth-child(3),
  .movimentos th:nth-child(4), .movimentos td:nth-child(4) { width: 11%; }
  .movimentos th:nth-child(5), .movimentos td:nth-child(5) { width: 13%; }
  .movimentos th:nth-child(6), .movimentos td:nth-child(6),
  .movimentos th:nth-child(7), .movimentos td:nth-child(7) { width: 10%; white-space: nowrap; }
  .movimentos th:nth-child(8), .movimentos td:nth-child(8) { width: 9%; }
  .entrada { color: #166534; font-weight: 700; }
  .saida { color: #b91c1c; font-weight: 700; }
  .resumos { display: grid; grid-template-columns: 1.25fr 1fr; gap: 8mm; margin-top: 10px; break-inside: avoid; }
  .totais { border: 1px solid #cbd5e1; padding: 7px; }
  .linha { display: flex; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding: 4px 0; }
  .geral { margin-top: 5px; padding: 6px; background: #111827; color: white; font-size: 10pt; }
  .rodape { margin-top: 8px; color: #64748b; font-size: 7.5pt; text-align: right; }
  @media print { .no-print { display: none; } }
</style>
</head>
<body>
  <h1>Relatório de movimentação do caixa</h1>
  <div class="meta">
    Operador: <strong>${escapar(caixaVisualizado.operador)}</strong> |
    Unidade: <strong>${escapar(caixaVisualizado.unidade)}</strong> |
    Abertura: ${escapar(new Date(caixaVisualizado.abertura).toLocaleString("pt-BR"))}
    ${caixaVisualizado.fechamento ? " | Fechamento: " + escapar(new Date(caixaVisualizado.fechamento).toLocaleString("pt-BR")) : ""}
  </div>
  <table class="movimentos">
    <thead><tr><th>Data e hora</th><th>Descrição</th><th>Tipo de entrada</th><th>Tipo de saída</th><th>Forma de pagamento</th><th>Entrada</th><th>Saída</th><th>Unidade</th></tr></thead>
    <tbody>${linhas || '<tr><td colspan="8">Nenhuma movimentação.</td></tr>'}</tbody>
  </table>
  <div class="resumos">
    <div>
      <h2>Resumo por forma de pagamento</h2>
      <table><thead><tr><th>Forma</th><th>Entradas</th><th>Saídas</th><th>Líquido</th></tr></thead><tbody>${formas}</tbody></table>
    </div>
    <div>
      <h2>Resumo final</h2>
      <div class="totais">
        <div class="linha"><span>Saldo inicial</span><strong>${escapar(moeda(caixaVisualizado.valorInicial))}</strong></div>
        <div class="linha"><span>Total de entradas</span><strong class="entrada">${escapar(moeda(totaisMovimento.entradas))}</strong></div>
        <div class="linha"><span>Total de saídas</span><strong class="saida">${escapar(moeda(totaisMovimento.saidas))}</strong></div>
        <div class="linha"><span>Estornos de entradas</span><strong class="saida">${escapar(moeda(totaisMovimento.estornosEntradas))}</strong></div>
        <div class="linha"><span>Estornos de saídas</span><strong class="entrada">${escapar(moeda(totaisMovimento.estornosSaidas))}</strong></div>
        <div class="linha"><span>Total líquido movimentado</span><strong>${escapar(moeda(totaisMovimento.saldoEsperado))}</strong></div>
        <div class="geral linha"><span>Dinheiro esperado na gaveta</span><strong>${escapar(moeda(dinheiroEsperadoVisualizado))}</strong></div>
        ${caixaVisualizado.valorInformado !== undefined ? `<div class="linha"><span>Dinheiro contado</span><strong>${escapar(moeda(caixaVisualizado.valorInformado))}</strong></div><div class="linha"><span>Diferença de dinheiro</span><strong>${escapar(moeda(diferencaDinheiroVisualizada ?? 0))}</strong></div>` : ""}
      </div>
    </div>
  </div>
  <div class="rodape">Gerado em ${escapar(new Date().toLocaleString("pt-BR"))} - ERP CEDEP | Treinei, Passei!</div>
<script>window.onload = () => { window.print(); };</script>
</body>
</html>`);
    janela.document.close();
  };

  const fecharCaixa = () => {
    if (!caixaAberto) return;

    const informado =
      converterNumero(
        valorFechamento
      );

    if (informado < 0) {
      alert(
        "Informe um valor de fechamento válido."
      );
      return;
    }

    const diferenca =
      informado - dinheiroEsperado;

    if (
      !window.confirm(
        `Dinheiro esperado na gaveta: ${moeda(
          dinheiroEsperado
        )}\nValor informado: ${moeda(
          informado
        )}\nDiferença: ${moeda(
          diferenca
        )}\n\nConfirma o fechamento?`
      )
    ) {
      return;
    }

    const fechamentoEm = new Date().toISOString();
    setSessoes((atuais) =>
      atuais.map((item) =>
        item.id === caixaAberto.id
          ? {
              ...item,
              status: "Fechado",
              fechamento: fechamentoEm,
              valorInformado: informado,
              valorEsperado: dinheiroEsperado,
              diferenca,
              observacaoFechamento: observacaoFechamento.trim(),
              historicoFechamentos: [
                ...(item.historicoFechamentos ?? []),
                {
                  dataHora: fechamentoEm,
                  valorInformado: informado,
                  valorEsperado: dinheiroEsperado,
                  diferenca,
                  observacao: observacaoFechamento.trim(),
                },
              ],
            }
          : item
      )
    );
    setValorFechamento("");
    setObservacaoFechamento("");
    alert(
      caixaAberto.reaberturas?.length
        ? "Caixa reaberto, alterado e fechado novamente. O alerta foi registrado no histórico."
        : "Caixa fechado."
    );
  };

  return (
    <div>
      <header
        style={
          estilos.cabecalho
        }
      >
        <h1
          style={{
            margin: 0,
            fontSize: 32,
          }}
        >
          Secretaria e Caixa
        </h1>
        <p
          style={
            estilos.textoCinza
          }
        >
          Abertura, recebimentos e
          fechamento diário.
        </p>
      </header>

      {!caixaAberto ? (
        <section
          style={
            estilos.caixa
          }
        >
          <h2>Abrir caixa</h2>
          <div
            style={
              estilos.formGrid
            }
          >
            <Campo
              label="Operador"
              value={operador}
              onChange={setOperador}
            />
            <CampoSelect
              label="Unidade"
              value={unidadeAbertura}
              opcoes={
                configuracoes.unidades
              }
              onChange={
                setUnidadeAbertura
              }
            />
            <Campo
              label="Valor inicial"
              value={valorInicial}
              onChange={setValorInicial}
            />
          </div>
          <button
            onClick={abrirCaixa}
            style={{
              ...estilos.botaoVerde,
              marginTop: 25,
            }}
          >
            Abrir caixa
          </button>
        </section>
      ) : (
        <>
          <section
            style={
              estilos.cards
            }
          >
            <Card
              titulo="Valor inicial"
              valor={moeda(
                caixaAberto.valorInicial
              )}
            />
            <Card
              titulo="Recebimentos"
              valor={moeda(
                totalRecebido
              )}
            />
            <Card
              titulo="Total líquido movimentado"
              valor={moeda(
                valorEsperado
              )}
            />
            <Card
              titulo="Dinheiro esperado na gaveta"
              valor={moeda(
                dinheiroEsperado
              )}
            />
            <Card
              titulo="Operador"
              valor={
                caixaAberto.operador
              }
            />
          </section>

          <section
            style={
              estilos.grade
            }
          >
            <div
              style={
                estilos.caixa
              }
            >
              <h2>
                Registrar recebimento
              </h2>
              <div
                style={
                  estilos.formGrid
                }
              >
                <CampoSelect
                  label="Aluno"
                  value={alunoId}
                  opcoes={alunosAtivos.map(
                    (item) => ({
                      valor: item.id,
                      rotulo: item.nome,
                    })
                  )}
                  onChange={setAlunoId}
                />
                <Campo
                  label="Descrição"
                  value={descricao}
                  onChange={
                    setDescricao
                  }
                />
                <Campo
                  label="Valor recebido"
                  value={valor}
                  onChange={setValor}
                />
                <CampoSelect
                  label="Forma de pagamento"
                  value={
                    formaPagamento
                  }
                  opcoes={Array.from(new Set(["Dinheiro", "PIX", "Cartão de crédito à vista", "Cartão de débito", "Cartão parcelado", "Transferência", ...configuracoes.bancos]))}
                  onChange={
                    setFormaPagamento
                  }
                />
              </div>
                {formaPagamento === "Cartão parcelado" && (
                  <CampoSelect
                    label="Quantidade de parcelas"
                    value={String(parcelasCartao)}
                    opcoes={Array.from({ length: 11 }, (_, indice) => String(indice + 2))}
                    onChange={(quantidade) => setParcelasCartao(Number(quantidade))}
                  />
                )}
                {(formaPagamento === "Cartão de crédito à vista" || formaPagamento === "Cartão de débito" || formaPagamento === "Cartão parcelado") && (
                  <div style={estilos.textoCinza}>
                    {(() => {
                      const calculo = calcularTaxaCartao(converterNumero(valor), formaPagamento, parcelasCartao);
                      return "Taxa automática: " + moeda(calculo.taxa) + " • Valor líquido: " + moeda(calculo.liquido);
                    })()}
                  </div>
                )}              <button
                onClick={
                  registrarRecebimento
                }
                style={{
                  ...estilos.botaoVerde,
                  marginTop: 25,
                }}
              >
                Confirmar recebimento
              </button>
            </div>

            <div
              style={
                estilos.caixa
              }
            >
              <h2>Fechar caixa</h2>
              <Campo
                label="Dinheiro contado na gaveta"
                value={
                  valorFechamento
                }
                onChange={
                  setValorFechamento
                }
              />
              <Campo
                label="Observação"
                value={
                  observacaoFechamento
                }
                onChange={
                  setObservacaoFechamento
                }
              />
              <button
                onClick={fecharCaixa}
                style={{
                  ...estilos.botaoVermelho,
                  marginTop: 25,
                }}
              >
                Fechar caixa
              </button>
            </div>
          </section>

          </>
      )}

      {caixaVisualizado && (
        <section style={{ ...estilos.caixa, marginTop: 25 }}>
          <div style={estilos.tituloRelatorio}>
            <div>
              <h2 style={{ marginBottom: 6 }}>Movimentação completa do caixa</h2>
              <div style={estilos.textoCinza}>
                {caixaVisualizado.operador} • {caixaVisualizado.unidade} • aberto em{" "}
                {new Date(caixaVisualizado.abertura).toLocaleString("pt-BR")}
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              {caixaVisualizado.reaberturas?.length ? (
                <span style={estilos.alertaReabertura}>
                  Caixa reaberto {caixaVisualizado.alteradoAposReabertura ? "e alterado" : ""}
                </span>
              ) : null}
              <button style={estilos.botaoVerde} onClick={imprimirRelatorioCaixa}>
                Gerar PDF / Imprimir
              </button>
            </div>
          </div>

          {movimentosVisualizados.length === 0 ? (
            <Vazio />
          ) : (
            <div style={estilos.tabelaContainer}>
              <table style={estilos.tabela}>
                <thead>
                  <tr>
                    <th style={estilos.th}>Data e hora</th>
                    <th style={estilos.th}>Descrição</th>
                    <th style={estilos.th}>Tipo de entrada</th>
                    <th style={estilos.th}>Tipo de saída</th>
                    <th style={estilos.th}>Forma de pagamento</th>
                    <th style={estilos.th}>Entrada</th>
                    <th style={estilos.th}>Saída</th>
                    <th style={estilos.th}>Unidade</th>
                    {caixaAberto?.id === caixaVisualizado.id && <th style={estilos.th}>Ações</th>}
                  </tr>
                </thead>
                <tbody>
                  {[...movimentosVisualizados]
                    .sort((a, b) => a.dataHora.localeCompare(b.dataHora))
                    .map((movimento) => {
                      const entrada =
                        movimento.natureza === "entrada" ||
                        movimento.natureza === "estorno_saida";
                      const tipo = movimento.natureza.startsWith("estorno")
                        ? movimento.natureza === "estorno_entrada"
                          ? "Estorno de entrada"
                          : "Estorno de saída"
                        : movimento.origem.replaceAll("_", " ");
                      return (
                        <tr key={movimento.id}>
                          <td style={estilos.td}>{new Date(movimento.dataHora).toLocaleString("pt-BR")}</td>
                          <td style={estilos.td}>
                            <strong>{movimento.descricao}</strong>
                            {movimento.alunoNome && <div style={estilos.textoCinza}>{movimento.alunoNome}</div>}
                            {movimento.motivoEstorno && <div style={estilos.textoEstorno}>Motivo: {movimento.motivoEstorno}</div>}
                            {movimento.historicoEdicoes?.length ? (
                              <div style={estilos.textoAlerta}>Editado com histórico</div>
                            ) : null}
                          </td>
                          <td style={estilos.td}>{entrada ? tipo : ""}</td>
                          <td style={estilos.td}>{entrada ? "" : tipo}</td>
                          <td style={estilos.td}>{movimento.formaPagamento}</td>
                          <td style={{ ...estilos.td, color: "#166534", fontWeight: 700 }}>
                            {entrada ? moeda(movimento.valor) : ""}
                          </td>
                          <td style={{ ...estilos.td, color: "#b91c1c", fontWeight: 700 }}>
                            {!entrada ? moeda(movimento.valor) : ""}
                          </td>
                          <td style={estilos.td}>{caixaVisualizado.unidade}</td>
                          {caixaAberto?.id === caixaVisualizado.id && (
                            <td style={estilos.td}>
                              <button style={estilos.botaoSecundario} onClick={() => editarMovimento(movimento)}>
                                Editar
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}

          <div style={estilos.resumoGrid}>
            <div>
              <h3>Resumo por forma de pagamento</h3>
              <div style={estilos.tabelaContainer}>
                <table style={estilos.tabela}>
                  <thead>
                    <tr>
                      <th style={estilos.th}>Forma</th>
                      <th style={estilos.th}>Entradas</th>
                      <th style={estilos.th}>Saídas</th>
                      <th style={estilos.th}>Líquido</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(resumoFormas).map(([forma, totais]) => (
                      <tr key={forma}>
                        <td style={estilos.td}><strong>{forma}</strong></td>
                        <td style={{ ...estilos.td, color: "#166534" }}>{moeda(totais.entradas)}</td>
                        <td style={{ ...estilos.td, color: "#b91c1c" }}>{moeda(totais.saidas)}</td>
                        <td style={estilos.td}>{moeda(totais.entradas - totais.saidas)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {totaisMovimento && (
              <div style={estilos.resumoFinal}>
                <h3>Resumo final</h3>
                <div style={estilos.registro}><span>Saldo inicial</span><strong>{moeda(caixaVisualizado.valorInicial)}</strong></div>
                <div style={estilos.registro}><span>Total de entradas</span><strong style={{ color: "#166534" }}>{moeda(totaisMovimento.entradas)}</strong></div>
                <div style={estilos.registro}><span>Total de saídas</span><strong style={{ color: "#b91c1c" }}>{moeda(totaisMovimento.saidas)}</strong></div>
                <div style={estilos.registro}><span>Estornos de entradas</span><strong style={{ color: "#b91c1c" }}>{moeda(totaisMovimento.estornosEntradas)}</strong></div>
                <div style={estilos.registro}><span>Estornos de saídas</span><strong style={{ color: "#166534" }}>{moeda(totaisMovimento.estornosSaidas)}</strong></div>
                <div style={estilos.registro}><span>Taxas de cartão</span><strong>{moeda(movimentosVisualizados.reduce((total, item) => total + (item.taxaCartao ?? 0), 0))}</strong></div>
                <div style={estilos.registro}><span>Total líquido movimentado</span><strong>{moeda(totaisMovimento.saldoEsperado)}</strong></div>
                <div style={estilos.totalGeral}><span>Dinheiro esperado na gaveta</span><strong>{moeda(dinheiroEsperadoVisualizado)}</strong></div>
                {caixaVisualizado.valorInformado !== undefined && (
                  <>
                    <div style={estilos.registro}><span>Dinheiro contado</span><strong>{moeda(caixaVisualizado.valorInformado)}</strong></div>
                    <div style={estilos.registro}><span>Diferença de dinheiro</span><strong>{moeda(diferencaDinheiroVisualizada ?? 0)}</strong></div>
                  </>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      <section
        style={{
          ...estilos.caixa,
          marginTop: 25,
        }}
      >
        <h2>
          Histórico de caixas
        </h2>
        {sessoes.length === 0 ? (
          <Vazio />
        ) : (
          [...sessoes]
            .reverse()
            .map((item) => (
              <div
                key={item.id}
                style={
                  estilos.registro
                }
              >
                <div>
                  <strong>
                    {item.operador} •{" "}
                    {item.unidade}
                  </strong>
                  <div
                    style={
                      estilos.textoCinza
                    }
                  >
                    Aberto em{" "}
                    {new Date(
                      item.abertura
                    ).toLocaleString(
                      "pt-BR"
                    )}
                    {item.fechamento
                      ? ` • Fechado em ${new Date(
                          item.fechamento
                        ).toLocaleString(
                          "pt-BR"
                        )}`
                      : ""}
                  </div>
                </div>
                <div>
                  <span
                    style={{
                      ...estilos.status,
                      background:
                        item.status ===
                        "Aberto"
                          ? "#dcfce7"
                          : "#e5e7eb",
                    }}
                  >
                    {item.status}
                  </span>
                  {item.diferenca !==
                    undefined && (
                    <strong
                      style={{
                        marginLeft: 12,
                        color:
                          item.diferenca ===
                          0
                            ? "#166534"
                            : "#b91c1c",
                      }}
                    >
                      Diferença:{" "}
                      {moeda(
                        item.diferenca
                      )}
                    </strong>
                  )}
                  {item.reaberturas?.length ? (
                    <div style={estilos.textoAlerta}>
                      Reaberto {item.reaberturas.length} vez(es)
                      {item.alteradoAposReabertura ? " • alterado após reabertura" : ""}
                    </div>
                  ) : null}
                  <div style={estilos.acoesHistorico}>
                    <button
                      style={estilos.botaoSecundario}
                      onClick={() => setCaixaVisualizadoId(item.id)}
                    >
                      Ver movimentação
                    </button>
                    {item.status === "Fechado" && (
                      <button
                        style={estilos.botaoAlerta}
                        onClick={() => reabrirCaixa(item)}
                      >
                        Reabrir caixa
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
        )}
      </section>
    </div>
  );
}

function Card({
  titulo,
  valor,
}: {
  titulo: string;
  valor: string;
}) {
  return (
    <div
      style={
        estilos.card
      }
    >
      <span
        style={
          estilos.textoCinza
        }
      >
        {titulo}
      </span>
      <strong
        style={{
          fontSize: 24,
        }}
      >
        {valor}
      </strong>
    </div>
  );
}

function Campo({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (
    valor: string
  ) => void;
}) {
  return (
    <label
      style={
        estilos.campoGrupo
      }
    >
      <strong>{label}</strong>
      <input
        value={value}
        onChange={(evento) =>
          onChange(
            evento.target.value
          )
        }
        style={estilos.input}
      />
    </label>
  );
}

type Opcao =
  | string
  | {
      valor: string;
      rotulo: string;
    };

function CampoSelect({
  label,
  value,
  opcoes,
  onChange,
}: {
  label: string;
  value: string;
  opcoes: Opcao[];
  onChange: (
    valor: string
  ) => void;
}) {
  return (
    <label
      style={
        estilos.campoGrupo
      }
    >
      <strong>{label}</strong>
      <select
        value={value}
        onChange={(evento) =>
          onChange(
            evento.target.value
          )
        }
        style={estilos.input}
      >
        <option value="">
          Selecione...
        </option>
        {opcoes.map((opcao) => {
          const valor =
            typeof opcao === "string"
              ? opcao
              : opcao.valor;
          const rotulo =
            typeof opcao === "string"
              ? opcao
              : opcao.rotulo;

          return (
            <option
              key={valor}
              value={valor}
            >
              {rotulo}
            </option>
          );
        })}
      </select>
    </label>
  );
}

function Vazio() {
  return (
    <div
      style={
        estilos.vazio
      }
    >
      Nenhum registro encontrado.
    </div>
  );
}

const estilos: Record<
  string,
  CSSProperties
> = {
  cabecalho: {
    marginBottom: 25,
  },
  textoCinza: {
    color: "#657084",
    lineHeight: 1.6,
  },
  cards: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit,minmax(190px,1fr))",
    gap: 18,
    marginBottom: 25,
  },
  card: {
    background: "white",
    padding: 22,
    borderRadius: 15,
    display: "flex",
    flexDirection: "column",
    gap: 12,
    boxShadow:
      "0 6px 18px rgba(0,0,0,.06)",
  },
  grade: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit,minmax(340px,1fr))",
    gap: 22,
  },
  caixa: {
    background: "white",
    padding: 28,
    borderRadius: 17,
    boxShadow:
      "0 6px 18px rgba(0,0,0,.06)",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit,minmax(210px,1fr))",
    gap: 18,
    marginTop: 20,
  },
  campoGrupo: {
    display: "flex",
    flexDirection: "column",
    gap: 7,
    marginBottom: 15,
  },
  input: {
    width: "100%",
    padding: "13px 14px",
    border:
      "1px solid #ccd3dd",
    borderRadius: 9,
    boxSizing: "border-box",
    fontSize: 15,
  },
  botaoVerde: {
    background: "#15803d",
    color: "white",
    border: "none",
    borderRadius: 9,
    padding: "13px 20px",
    cursor: "pointer",
    fontWeight: "bold",
  },
  botaoVermelho: {
    background: "#b91c1c",
    color: "white",
    border: "none",
    borderRadius: 9,
    padding: "13px 20px",
    cursor: "pointer",
    fontWeight: "bold",
  },
  registro: {
    display: "flex",
    justifyContent:
      "space-between",
    alignItems: "center",
    gap: 15,
    flexWrap: "wrap",
    padding: "16px 0",
    borderBottom:
      "1px solid #e8ebef",
  },
  status: {
    padding: "7px 10px",
    borderRadius: 20,
    color: "#166534",
    fontSize: 13,
    fontWeight: "bold",
  },
  tituloRelatorio: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    flexWrap: "wrap",
    marginBottom: 20,
  },
  alertaReabertura: {
    padding: "9px 12px",
    borderRadius: 9,
    color: "#92400e",
    background: "#fef3c7",
    border: "1px solid #f59e0b",
    fontWeight: 700,
  },
  tabelaContainer: { overflowX: "auto" },
  tabela: { width: "100%", borderCollapse: "collapse", minWidth: 760 },
  th: {
    padding: "12px 10px",
    background: "#111827",
    color: "white",
    textAlign: "left",
    whiteSpace: "nowrap",
    fontSize: 13,
  },
  td: {
    padding: "12px 10px",
    borderBottom: "1px solid #e5e7eb",
    verticalAlign: "top",
    fontSize: 14,
  },
  resumoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))",
    gap: 24,
    marginTop: 28,
    alignItems: "start",
  },
  resumoFinal: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: 18,
  },
  totalGeral: {
    display: "flex",
    justifyContent: "space-between",
    gap: 15,
    padding: "16px 12px",
    marginTop: 8,
    background: "#111827",
    color: "white",
    borderRadius: 8,
    fontSize: 17,
  },
  textoEstorno: { color: "#b91c1c", fontSize: 12, marginTop: 4 },
  textoAlerta: { color: "#92400e", fontSize: 12, marginTop: 4, fontWeight: 700 },
  acoesHistorico: {
    display: "flex",
    gap: 8,
    marginTop: 10,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  botaoSecundario: {
    background: "#e2e8f0",
    color: "#0f172a",
    border: "none",
    borderRadius: 7,
    padding: "8px 11px",
    cursor: "pointer",
    fontWeight: 700,
  },
  botaoAlerta: {
    background: "#f59e0b",
    color: "#422006",
    border: "none",
    borderRadius: 7,
    padding: "8px 11px",
    cursor: "pointer",
    fontWeight: 700,
  },
  vazio: {
    padding: 30,
    textAlign: "center",
    color: "#8c96a8",
  },
};

export default Secretaria;

import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import * as XLSX from "xlsx";
import {
  carregarConfiguracoes,
  type ConfiguracoesFinanceiras,
} from "./Configuracoes";
import type { UsuarioSessao } from "./Acesso";
import {
  carregarContasEstruturadas,
  excluirContaEstruturada,
  registrarBaixaEstruturada,
  salvarContaEstruturada,
} from "./servicos/contasEstruturadas";
import { mensagemCaixaFechado, registrarMovimentoCaixa, usuarioPodeMovimentar } from "./servicos/caixaOperacional";
import { calcularTaxaCartao } from "./servicos/taxasCartao";

export type Conta = {
  id: string;
  descricao: string;
  valor: number;
  vencimento: string;
  categoria: string;
  banco: string;
  unidade: string;
  observacao: string;
  status:
    | "Pendente"
    | "Pago"
    | "Recebido"
    | "Parcial"
    | "Renegociado"
    | "Cancelado";
  tipo: "receber" | "pagar";
  origem?: "manual" | "mensalidade" | "secretaria" | "escola" | "repasse-escola";
  criadoPorId?: string;
  criadoPorNome?: string;
  criadoPorPerfil?: string;
  alunoId?: string;
  alunoNome?: string;
  criadoEm?: string;
  atualizadoEm?: string;
  atualizadoPorId?: string;
  dataBaixa?: string;
  valorPago?: number;
  juros?: number;
  multa?: number;
  desconto?: number;
  formaPagamentoBaixa?: string;
  parcelasCartao?: number;
  taxaCartao?: number;
  valorLiquidoCartao?: number;
};

type Props = {
  tipo: "receber" | "pagar";
  onBaixar: (conta: Conta) => void;
  onEstornar?: (conta: Conta, valor: number, motivo: string) => void;
  usuarioAtual: UsuarioSessao;
  onAbrirCaixa?: () => void;
  contaInicialId?: string | null;
  onConsumirContaInicial?: () => void;
};

type SituacaoFiltro =
  | "Todos"
  | "Pendentes"
  | "Vencidos"
  | "Vencem hoje"
  | "A vencer"
  | "Concluídos";

type Ordenacao =
  | "vencimento-asc"
  | "vencimento-desc"
  | "valor-desc"
  | "valor-asc"
  | "descricao";

export const CHAVE_CONTAS = "financeiro-cedep-contas";
const ITENS_POR_PAGINA = 15;

const moeda = (valor: number) =>
  valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

const normalizar = (valor: string) =>
  valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const converterNumero = (valor: string) => {
  let texto = valor.replace("R$", "").replace(/\s/g, "");
  if (texto.includes(",")) {
    texto = texto.replace(/\./g, "").replace(",", ".");
  }
  const numero = Number(texto);
  return Number.isFinite(numero) ? numero : 0;
};

const hojeISO = () => {
  const agora = new Date();
  const deslocamento = agora.getTimezoneOffset() * 60_000;
  return new Date(agora.getTime() - deslocamento).toISOString().slice(0, 10);
};

const somarDiasISO = (dias: number) => {
  const data = new Date(`${hojeISO()}T12:00:00`);
  data.setDate(data.getDate() + dias);
  return data.toISOString().slice(0, 10);
};

const formatarData = (data: string) => {
  if (!data) return "";
  return new Date(`${data}T00:00:00`).toLocaleDateString("pt-BR");
};

const contaConcluida = (conta: Conta) =>
  conta.status === "Pago" || conta.status === "Recebido";

const contaEmAberto = (conta: Conta) =>
  conta.status === "Pendente" ||
  conta.status === "Parcial";

const totalConta = (conta: Conta) =>
  Math.max(
    0,
    conta.valor +
      (conta.juros ?? 0) +
      (conta.multa ?? 0) -
      (conta.desconto ?? 0)
  );

const saldoConta = (conta: Conta) =>
  Math.max(
    0,
    totalConta(conta) -
      (conta.valorPago ?? 0)
  );

const contaVencida = (conta: Conta) =>
  contaEmAberto(conta) &&
  Boolean(conta.vencimento) &&
  conta.vencimento < hojeISO();

const contaMensalidade = (conta: Conta) =>
  conta.origem === "mensalidade" ||
  normalizar(conta.categoria).includes("mensalidade") ||
  normalizar(conta.observacao).includes("aluno:");

const contaVisivelParaUsuario = (conta: Conta, usuario: UsuarioSessao) => {
  if (usuario.perfil !== "Secretaria") return true;
  if (conta.tipo === "receber" && contaMensalidade(conta)) return true;
  return (
    conta.criadoPorId === usuario.id ||
    (conta.origem === "secretaria" && conta.criadoPorNome === usuario.nome)
  );
};

function Contas({ tipo, onBaixar, onEstornar, usuarioAtual, onAbrirCaixa, contaInicialId, onConsumirContaInicial }: Props) {
  const [contas, setContas] = useState<Conta[]>([]);
  const [carregado, setCarregado] = useState(false);
  const [configuracoes, setConfiguracoes] =
    useState<ConfiguracoesFinanceiras>(carregarConfiguracoes());

  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [vencimento, setVencimento] = useState("");
  const [categoria, setCategoria] = useState("");
  const [banco, setBanco] = useState("");
  const [unidade, setUnidade] = useState("CEDEP");
  const [observacao, setObservacao] = useState("");
  const [formaPagamentoConta, setFormaPagamentoConta] = useState("");
  const [parcelasCartaoConta, setParcelasCartaoConta] = useState(2);
  const [contaEditando, setContaEditando] = useState<string | null>(null);

  const [busca, setBusca] = useState("");
  const [situacao, setSituacao] = useState<SituacaoFiltro>("Todos");
  const [filtroCategoria, setFiltroCategoria] = useState("Todas");
  const [filtroBanco, setFiltroBanco] = useState("Todos");
  const [filtroUnidade, setFiltroUnidade] = useState("Todas");
  const [dataInicial, setDataInicial] = useState("");
  const [dataFinal, setDataFinal] = useState("");
  const [somenteMensalidades, setSomenteMensalidades] = useState(false);
  const [ordenacao, setOrdenacao] = useState<Ordenacao>("vencimento-asc");
  const [pagina, setPagina] = useState(1);
  const [contaBaixa, setContaBaixa] =
    useState<Conta | null>(null);
  const [valorBaixa, setValorBaixa] =
    useState("");
  const [jurosBaixa, setJurosBaixa] =
    useState("0");
  const [multaBaixa, setMultaBaixa] =
    useState("0");
  const [descontoBaixa, setDescontoBaixa] =
    useState("0");
  const [dataPagamento, setDataPagamento] =
    useState(hojeISO());
  const [
    formaPagamento,
    setFormaPagamento,
  ] = useState("Dinheiro");
  const [parcelasCartao, setParcelasCartao] = useState(2);
  const [
    bancoPagamento,
    setBancoPagamento,
  ] = useState("");
  const [
    observacaoBaixa,
    setObservacaoBaixa,
  ] = useState("");
  const [processando, setProcessando] =
    useState(false);

  useEffect(() => {
    const carregar = async () => {
      try {
        const salvas = localStorage.getItem(CHAVE_CONTAS);
        const locais: Conta[] = salvas
          ? JSON.parse(salvas)
          : [];
        setContas(locais);

        const nuvem =
          await carregarContasEstruturadas();
        if (nuvem) {
          setContas(nuvem);
          localStorage.setItem(
            CHAVE_CONTAS,
            JSON.stringify(nuvem)
          );
        }
      } catch (erro) {
        console.error("Erro ao carregar contas:", erro);
      } finally {
        setCarregado(true);
      }
    };
    void carregar();
    const atualizar = () => {
      void carregar();
    };
    window.addEventListener(
      "financeiro-contas-atualizadas",
      atualizar
    );
    return () =>
      window.removeEventListener(
        "financeiro-contas-atualizadas",
        atualizar
      );
  }, []);

  useEffect(() => {
    if (!carregado) return;
    localStorage.setItem(CHAVE_CONTAS, JSON.stringify(contas));
  }, [contas, carregado]);

  useEffect(() => {
    const atualizar = () => setConfiguracoes(carregarConfiguracoes());
    window.addEventListener("financeiro-config-atualizada", atualizar);
    return () =>
      window.removeEventListener("financeiro-config-atualizada", atualizar);
  }, []);

  const limparFormulario = () => {
    setDescricao("");
    setValor("");
    setVencimento("");
    setCategoria("");
    setBanco("");
    setUnidade("CEDEP");
    setObservacao("");
    setFormaPagamentoConta("");
    setParcelasCartaoConta(2);
    setContaEditando(null);
  };

  const salvarConta = async () => {
    const valorNumerico = converterNumero(valor);
    if (!descricao.trim()) return alert("Digite uma descrição.");
    if (valorNumerico <= 0) return alert("Digite um valor válido.");
    if (!vencimento) return alert("Informe a data de vencimento.");
    if (!categoria) {
      return alert(
        tipo === "receber"
          ? "Selecione um tipo de entrada."
          : "Selecione um tipo de saída."
      );
    }
    if (!banco) return alert("Selecione um banco ou conta.");
    if (!unidade) return alert("Selecione uma unidade.");

    const existente = contas.find((item) => item.id === contaEditando);
    const agora = new Date().toISOString();
    const novaConta: Conta = {
      id: contaEditando ?? `conta-${Date.now()}-${Math.random()}`,
      descricao: descricao.trim(),
      valor: valorNumerico,
      vencimento,
      categoria,
      banco,
      unidade,
      observacao: observacao.trim(),
      status: existente?.status ?? "Pendente",
      tipo,
      origem:
        existente?.origem ??
        (usuarioAtual.perfil === "Secretaria" ? "secretaria" : "manual"),
      criadoPorId: existente?.criadoPorId ?? usuarioAtual.id,
      criadoPorNome: existente?.criadoPorNome ?? usuarioAtual.nome,
      criadoPorPerfil: existente?.criadoPorPerfil ?? usuarioAtual.perfil,
      criadoEm: existente?.criadoEm ?? agora,
      atualizadoEm: agora,
      atualizadoPorId:
        usuarioAtual.id,
      dataBaixa: existente?.dataBaixa,
      alunoId: existente?.alunoId,
      alunoNome: existente?.alunoNome,
      valorPago:
        existente?.valorPago ?? 0,
      juros: existente?.juros ?? 0,
      multa: existente?.multa ?? 0,
      desconto:
        existente?.desconto ?? 0,
      formaPagamentoBaixa: formaPagamentoConta,
      parcelasCartao: formaPagamentoConta === "Cartão parcelado" ? parcelasCartaoConta : 1,
    };

    try {
      setProcessando(true);
      await salvarContaEstruturada(
        novaConta,
        usuarioAtual.id
      );
      setContas((atuais) =>
        contaEditando
          ? atuais.map((item) =>
              item.id === contaEditando
                ? novaConta
                : item
            )
          : [...atuais, novaConta]
      );
      limparFormulario();
      alert(
        contaEditando
          ? "Conta atualizada com sucesso."
          : "Conta cadastrada com sucesso."
      );
    } catch (erro) {
      console.error(erro);
      alert(
        "Não foi possível salvar a conta na nuvem."
      );
    } finally {
      setProcessando(false);
    }
  };

  const editarConta = (conta: Conta) => {
    setContaEditando(conta.id);
    setDescricao(conta.descricao);
    setValor(String(conta.valor).replace(".", ","));
    setVencimento(conta.vencimento);
    setCategoria(conta.categoria);
    const formaContaCadastro = conta.formaPagamentoBaixa || conta.banco || "";
    setBanco(formaContaCadastro);
    setUnidade(conta.unidade);
    setObservacao(conta.observacao);
    setFormaPagamentoConta(formaContaCadastro);
    setParcelasCartaoConta(Math.max(2, conta.parcelasCartao ?? 2));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const excluirConta = async (conta: Conta) => {
    if (!window.confirm(`Deseja excluir "${conta.descricao}"?`)) return;
    try {
      await excluirContaEstruturada(
        conta.id
      );
      setContas((atuais) =>
        atuais.filter(
          (item) => item.id !== conta.id
        )
      );
    } catch (erro) {
      console.error(erro);
      alert(
        "Não foi possível excluir esta conta."
      );
    }
  };

  const baixarConta = (conta: Conta) => {
    if (!contaEmAberto(conta)) return;
    setContaBaixa(conta);
    setValorBaixa(
      saldoConta(conta)
        .toFixed(2)
        .replace(".", ",")
    );
    setJurosBaixa(
      String(conta.juros ?? 0).replace(
        ".",
        ","
      )
    );
    setMultaBaixa(
      String(conta.multa ?? 0).replace(
        ".",
        ","
      )
    );
    setDescontoBaixa(
      String(
        conta.desconto ?? 0
      ).replace(".", ",")
    );
    setDataPagamento(hojeISO());
    const formaConta = conta.formaPagamentoBaixa || conta.banco || "Dinheiro";
    setBancoPagamento(formaConta);
    setFormaPagamento(formaConta);
    setParcelasCartao(Math.max(2, conta.parcelasCartao ?? 2));
    setObservacaoBaixa("");
  };

  useEffect(() => {
    if (!carregado || !contaInicialId) return;
    const conta = contas.find((item) => item.id === contaInicialId && item.tipo === tipo);
    if (!conta) return;
    setBusca(conta.descricao);
    setSituacao("Todos");
    setFiltroUnidade("Todas");
    if (contaEmAberto(conta)) baixarConta(conta);
    onConsumirContaInicial?.();
  }, [carregado, contaInicialId, contas, tipo]);

  const confirmarBaixa = async () => {
    if (!contaBaixa) return;
    if (!usuarioPodeMovimentar(usuarioAtual)) {
      if (window.confirm(`${mensagemCaixaFechado}\n\nDeseja abrir o caixa agora?`)) onAbrirCaixa?.();
      return;
    }

    const valorRecebido =
      converterNumero(valorBaixa);
    const juros =
      converterNumero(jurosBaixa);
    const multa =
      converterNumero(multaBaixa);
    const desconto =
      converterNumero(descontoBaixa);
    const totalAtualizado = Math.max(
      0,
      contaBaixa.valor +
        juros +
        multa -
        desconto
    );
    const pagoAntes =
      contaBaixa.valorPago ?? 0;
    const saldoAntes = Math.max(
      0,
      totalAtualizado - pagoAntes
    );

    if (
      valorRecebido <= 0 ||
      valorRecebido >
        saldoAntes + 0.01
    ) {
      alert(
        `Informe um valor entre R$ 0,01 e ${moeda(
          saldoAntes
        )}.`
      );
      return;
    }

    const novoValorPago =
      pagoAntes + valorRecebido;
    const quitada =
      novoValorPago >=
      totalAtualizado - 0.01;
    const cartao = calcularTaxaCartao(valorRecebido, formaPagamento, parcelasCartao);
    const atualizada: Conta = {
      ...contaBaixa,
      formaPagamentoBaixa: formaPagamento,
      parcelasCartao: cartao.parcelas,
      taxaCartao: cartao.taxa,
      valorLiquidoCartao: cartao.liquido,
      valorPago: novoValorPago,
      juros,
      multa,
      desconto,
      status: quitada
        ? tipo === "receber"
          ? "Recebido"
          : "Pago"
        : "Parcial",
      dataBaixa: quitada
        ? dataPagamento
        : undefined,
      atualizadoEm:
        new Date().toISOString(),
      atualizadoPorId:
        usuarioAtual.id,
    };

    try {
      setProcessando(true);
      await registrarBaixaEstruturada({
        conta: atualizada,
        usuarioId:
          usuarioAtual.id,
        valor: valorRecebido,
        dataPagamento,
        bancoPagamento,
        formaPagamento,
        observacao:
          observacaoBaixa,
      });
      registrarMovimentoCaixa(usuarioAtual, {
        natureza: tipo === "receber" ? "entrada" : "saida",
        origem: tipo === "receber" ? "conta_receber" : "conta_pagar",
        origemId: atualizada.id,
        descricao: atualizada.descricao,
        valor: valorRecebido,
        formaPagamento,
        modalidadeCartao: cartao.modalidade ?? undefined,
        parcelasCartao: cartao.parcelas,
        taxaCartao: cartao.taxa,
        valorLiquido: cartao.liquido,
        alunoId: atualizada.alunoId,
        alunoNome: atualizada.alunoNome,
      });
      setContas((atuais) =>
        atuais.map((item) =>
          item.id === atualizada.id
            ? atualizada
            : item
        )
      );
      onBaixar({
        ...atualizada,
        valor: valorRecebido,
      });
      setContaBaixa(null);
      alert(
        quitada
          ? "Baixa integral confirmada."
          : `Baixa parcial registrada. Saldo restante: ${moeda(
              Math.max(
                0,
                totalAtualizado -
                  novoValorPago
              )
            )}.`
      );
    } catch (erro) {
      console.error(erro);
      alert(
        "Não foi possível registrar a baixa."
      );
    } finally {
      setProcessando(false);
    }
  };

  const contasPermitidas = useMemo(
    () =>
      contas.filter(
        (conta) =>
          conta.tipo === tipo && contaVisivelParaUsuario(conta, usuarioAtual)
      ),
    [contas, tipo, usuarioAtual]
  );

  const listas = useMemo(
    () => ({
      categorias: Array.from(
        new Set(contasPermitidas.map((item) => item.categoria).filter(Boolean))
      ).sort(),
      bancos: Array.from(
        new Set(contasPermitidas.map((item) => item.banco).filter(Boolean))
      ).sort(),
      unidades: Array.from(
        new Set([
          ...configuracoes.unidades,
          ...contasPermitidas.map((item) => item.unidade).filter(Boolean),
        ])
      ).sort(),
    }),
    [contasPermitidas, configuracoes.unidades]
  );

  const contasFiltradas = useMemo(() => {
    const termo = normalizar(busca);
    return contasPermitidas
      .filter((conta) => {
        const textoBusca = normalizar(
          `${conta.descricao} ${conta.observacao} ${conta.alunoNome ?? ""}`
        );
        const hoje = hojeISO();
        const correspondeSituacao =
          situacao === "Todos" ||
          (situacao === "Pendentes" &&
            contaEmAberto(conta) &&
            !contaVencida(conta)) ||
          (situacao === "Vencidos" && contaVencida(conta)) ||
          (situacao === "Vencem hoje" &&
            contaEmAberto(conta) &&
            conta.vencimento === hoje) ||
          (situacao === "A vencer" &&
            contaEmAberto(conta) &&
            conta.vencimento > hoje) ||
          (situacao === "Concluídos" && contaConcluida(conta));

        return (
          (!termo || textoBusca.includes(termo)) &&
          correspondeSituacao &&
          (filtroCategoria === "Todas" || conta.categoria === filtroCategoria) &&
          (filtroBanco === "Todos" || conta.banco === filtroBanco) &&
          (filtroUnidade === "Todas" || conta.unidade === filtroUnidade) &&
          (!dataInicial || conta.vencimento >= dataInicial) &&
          (!dataFinal || conta.vencimento <= dataFinal) &&
          (!somenteMensalidades || contaMensalidade(conta))
        );
      })
      .sort((a, b) => {
        if (ordenacao === "vencimento-desc")
          return b.vencimento.localeCompare(a.vencimento);
        if (ordenacao === "valor-desc") return b.valor - a.valor;
        if (ordenacao === "valor-asc") return a.valor - b.valor;
        if (ordenacao === "descricao")
          return a.descricao.localeCompare(b.descricao, "pt-BR");
        if (contaConcluida(a) !== contaConcluida(b))
          return contaConcluida(a) ? 1 : -1;
        return a.vencimento.localeCompare(b.vencimento);
      });
  }, [
    contasPermitidas,
    busca,
    situacao,
    filtroCategoria,
    filtroBanco,
    filtroUnidade,
    dataInicial,
    dataFinal,
    somenteMensalidades,
    ordenacao,
  ]);

  useEffect(() => setPagina(1), [
    busca,
    situacao,
    filtroCategoria,
    filtroBanco,
    filtroUnidade,
    dataInicial,
    dataFinal,
    somenteMensalidades,
    ordenacao,
  ]);

  const totalPaginas = Math.max(1, Math.ceil(contasFiltradas.length / ITENS_POR_PAGINA));
  const paginaSegura = Math.min(pagina, totalPaginas);
  const contasDaPagina = contasFiltradas.slice(
    (paginaSegura - 1) * ITENS_POR_PAGINA,
    paginaSegura * ITENS_POR_PAGINA
  );

  const pendentes =
    contasPermitidas.filter(
      contaEmAberto
    );
  const vencidas = pendentes.filter(contaVencida);
  const proximos30 = pendentes.filter(
    (item) => item.vencimento >= hojeISO() && item.vencimento <= somarDiasISO(30)
  );
  const concluidas = contasPermitidas.filter(contaConcluida);
  const soma = (itens: Conta[]) =>
    itens.reduce((total, item) => total + item.valor, 0);
  const somaSaldos = (
    itens: Conta[]
  ) =>
    itens.reduce(
      (total, item) =>
        total + saldoConta(item),
      0
    );

  const categoriasFormulario =
    tipo === "receber"
      ? configuracoes.tiposEntrada
      : configuracoes.tiposSaida;

  const aplicarAtalho = (dias: number) => {
    setSituacao("A vencer");
    setDataInicial(hojeISO());
    setDataFinal(somarDiasISO(dias));
  };

  const buscarInadimplentes = () => {
    setSituacao("Vencidos");
    setSomenteMensalidades(true);
    setDataInicial("");
    setDataFinal("");
  };

  const limparFiltros = () => {
    setBusca("");
    setSituacao("Todos");
    setFiltroCategoria("Todas");
    setFiltroBanco("Todos");
    setFiltroUnidade("Todas");
    setDataInicial("");
    setDataFinal("");
    setSomenteMensalidades(false);
    setOrdenacao("vencimento-asc");
  };

  const exportarExcel = () => {
    if (!contasFiltradas.length) return alert("Não há contas para exportar.");
    const dados = contasFiltradas.map((conta) => ({
      Vencimento: formatarData(conta.vencimento),
      "Descrição": conta.descricao,
      Aluno: conta.alunoNome ?? "",
      [tipo === "receber" ? "Tipo de entrada" : "Tipo de saída"]:
        conta.categoria,
      Banco: conta.banco,
      Unidade: conta.unidade,
      Valor: conta.valor,
      Status: contaVencida(conta) ? "Vencido" : conta.status,
      "Observação": conta.observacao,
      "Criado por": conta.criadoPorNome ?? "",
    }));
    const planilha = XLSX.utils.json_to_sheet(dados);
    planilha["!cols"] = [
      { wch: 13 },
      { wch: 38 },
      { wch: 28 },
      { wch: 22 },
      { wch: 18 },
      { wch: 16 },
      { wch: 14 },
      { wch: 13 },
      { wch: 45 },
      { wch: 22 },
    ];
    const pasta = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(pasta, planilha, "Contas");
    XLSX.writeFile(
      pasta,
      `${tipo === "receber" ? "contas-a-receber" : "contas-a-pagar"}-${hojeISO()}.xlsx`
    );
  };


  const estornarPagamentos = async (conta: Conta) => {
    const valorEstorno = conta.valorPago ?? 0;
    if (valorEstorno <= 0) return;
    if (!usuarioPodeMovimentar(usuarioAtual)) {
      if (window.confirm(mensagemCaixaFechado + "\n\nDeseja abrir o caixa agora?")) onAbrirCaixa?.();
      return;
    }
    const motivo = window.prompt("Informe o motivo obrigatório do estorno:");
    if (!motivo?.trim()) return;

    const atualizada: Conta = {
      ...conta,
      valorPago: 0,
      dataBaixa: undefined,
      status: "Pendente",
      atualizadoEm: new Date().toISOString(),
      atualizadoPorId: usuarioAtual.id,
    };

    try {
      await salvarContaEstruturada(atualizada, usuarioAtual.id);
      registrarMovimentoCaixa(usuarioAtual, {
        natureza: tipo === "receber" ? "estorno_entrada" : "estorno_saida",
        origem: tipo === "receber" ? "conta_receber" : "conta_pagar",
        origemId: conta.id,
        descricao: "Estorno: " + conta.descricao,
        valor: valorEstorno,
        formaPagamento: conta.formaPagamentoBaixa || conta.banco,
        alunoId: conta.alunoId,
        alunoNome: conta.alunoNome,
        motivoEstorno: motivo.trim(),
      });
      setContas((atuais) => atuais.map((item) => item.id === conta.id ? atualizada : item));
      onEstornar?.(conta, valorEstorno, motivo.trim());
      alert("Estorno registrado. O lançamento original foi preservado no histórico financeiro.");
    } catch (erro) {
      console.error(erro);
      alert("Não foi possível registrar o estorno.");
    }
  };
  const titulo = tipo === "receber" ? "Contas a Receber" : "Contas a Pagar";

  return (
    <div>
      <header style={estilos.cabecalho}>
        <h1 style={estilos.titulo}>{titulo}</h1>
        <p style={estilos.textoCinza}>
          Vencimentos em ordem, busca avançada e baixas financeiras.
        </p>
      </header>

      {usuarioAtual.perfil === "Secretaria" && (
        <div style={estilos.avisoPermissao}>
          <strong>Visão da Secretaria:</strong> você visualiza mensalidades de
          alunos e contas cadastradas pelo seu próprio usuário. As demais contas
          administrativas permanecem restritas.
        </div>
      )}

      <section style={estilos.cardsResumo}>
        <CardResumo titulo={tipo === "receber" ? "A receber" : "A pagar"} valor={moeda(somaSaldos(pendentes))} detalhe={`${pendentes.length} pendente(s)`} />
        <CardResumo titulo="Vencido" valor={moeda(somaSaldos(vencidas))} detalhe={`${vencidas.length} conta(s)`} destaque="vermelho" />
        <CardResumo titulo="Próximos 30 dias" valor={moeda(somaSaldos(proximos30))} detalhe={`${proximos30.length} vencimento(s)`} destaque="amarelo" />
        <CardResumo titulo={tipo === "receber" ? "Recebido" : "Pago"} valor={moeda(soma(concluidas))} detalhe={`${concluidas.length} concluída(s)`} destaque="verde" />
      </section>

      <section style={estilos.caixa}>
        <h2>{contaEditando ? "Editar conta" : `Nova conta a ${tipo}`}</h2>
        <div style={estilos.formGrid}>
          <CampoTexto label="Descrição" value={descricao} onChange={setDescricao} placeholder={tipo === "receber" ? "Ex.: Mensalidade João" : "Ex.: Energia elétrica"} />
          <CampoTexto label="Valor" value={valor} onChange={setValor} placeholder="Ex.: 500,00" />
          <CampoTexto label="Vencimento" value={vencimento} onChange={setVencimento} type="date" />
          <CampoSelect label={tipo === "receber" ? "Tipo de Entrada" : "Tipo de Saída"} value={categoria} opcoes={categoriasFormulario} onChange={setCategoria} />
          <CampoSelect
            label="Forma de pagamento / Conta"
            value={formaPagamentoConta}
            opcoes={Array.from(new Set(["Dinheiro", "Cartão de crédito à vista", "Cartão de débito", "Cartão parcelado", ...configuracoes.bancos]))}
            onChange={(opcao) => {
              setFormaPagamentoConta(opcao);
              setBanco(opcao);
              if (opcao !== "Cartão parcelado") setParcelasCartaoConta(2);
            }}
          />
          {formaPagamentoConta === "Cartão parcelado" && (
            <CampoSelect
              label="Quantidade de parcelas"
              value={String(parcelasCartaoConta)}
              opcoes={Array.from({ length: 11 }, (_, indice) => String(indice + 2))}
              rotulos={Array.from({ length: 11 }, (_, indice) => String(indice + 2) + "x")}
              onChange={(quantidade) => setParcelasCartaoConta(Number(quantidade))}
              semOpcaoVazia
            />
          )}
          <CampoSelect label="Unidade" value={unidade} opcoes={configuracoes.unidades} onChange={setUnidade} />
          <CampoTexto label="Observação" value={observacao} onChange={setObservacao} placeholder="Opcional" />
        </div>
        <div style={estilos.botoes}>
          <button onClick={() => void salvarConta()} disabled={processando} style={estilos.botaoPrincipal}>
            {contaEditando ? "Salvar alterações" : "Salvar conta"}
          </button>
          {contaEditando && (
            <button onClick={limparFormulario} style={estilos.botaoSecundario}>
              Cancelar edição
            </button>
          )}
        </div>
      </section>

      <section style={{ ...estilos.caixa, marginTop: 25 }}>
        <div style={estilos.topoLista}>
          <div>
            <h2 style={{ marginBottom: 5 }}>{titulo}</h2>
            <span style={estilos.textoCinza}>
              {contasFiltradas.length} resultado(s), ordenados por vencimento.
            </span>
          </div>
          <div style={estilos.atalhos}>
            {tipo === "receber" && (
              <button onClick={buscarInadimplentes} style={estilos.botaoAlerta}>
                Alunos inadimplentes
              </button>
            )}
            <button onClick={() => aplicarAtalho(7)} style={estilos.botaoAtalho}>Próximos 7 dias</button>
            <button onClick={() => aplicarAtalho(15)} style={estilos.botaoAtalho}>Próximos 15 dias</button>
            <button onClick={() => aplicarAtalho(30)} style={estilos.botaoAtalho}>Próximos 30 dias</button>
          </div>
        </div>

        <div style={estilos.filtros}>
          <CampoTexto label="Buscar aluno ou descrição" value={busca} onChange={setBusca} placeholder="Nome do aluno, conta ou observação..." />
          <CampoSelect label="Situação" value={situacao} opcoes={["Todos", "Pendentes", "Vencidos", "Vencem hoje", "A vencer", "Concluídos"]} onChange={(valor) => setSituacao(valor as SituacaoFiltro)} semOpcaoVazia />
          <CampoSelect label={tipo === "receber" ? "Tipo de entrada" : "Tipo de saída"} value={filtroCategoria} opcoes={["Todas", ...categoriasFormulario, ...listas.categorias.filter((item) => !categoriasFormulario.includes(item))]} onChange={setFiltroCategoria} semOpcaoVazia />
          <CampoSelect label="Banco / Conta" value={filtroBanco} opcoes={["Todos", ...listas.bancos]} onChange={setFiltroBanco} semOpcaoVazia />
          <CampoSelect label="Unidade" value={filtroUnidade} opcoes={["Todas", ...listas.unidades]} onChange={setFiltroUnidade} semOpcaoVazia />
          <CampoTexto label="Vencimento inicial" value={dataInicial} onChange={setDataInicial} type="date" />
          <CampoTexto label="Vencimento final" value={dataFinal} onChange={setDataFinal} type="date" />
          <CampoSelect label="Ordenar por" value={ordenacao} opcoes={["vencimento-asc", "vencimento-desc", "valor-desc", "valor-asc", "descricao"]} rotulos={["Vencimento mais próximo", "Vencimento mais distante", "Maior valor", "Menor valor", "Descrição A–Z"]} onChange={(valor) => setOrdenacao(valor as Ordenacao)} semOpcaoVazia />
        </div>

        {tipo === "receber" && (
          <label style={estilos.checkbox}>
            <input
              type="checkbox"
              checked={somenteMensalidades}
              onChange={(evento) => setSomenteMensalidades(evento.target.checked)}
            />
            Mostrar somente mensalidades de alunos
          </label>
        )}

        <div style={estilos.botoes}>
          <button onClick={limparFiltros} style={estilos.botaoSecundario}>Limpar filtros</button>
          <button onClick={exportarExcel} style={estilos.botaoExcel}>Exportar resultado para Excel</button>
        </div>

        {!contasDaPagina.length ? (
          <div style={estilos.vazio}>Nenhuma conta encontrada para os filtros selecionados.</div>
        ) : (
          <>
            <div style={estilos.tabelaContainer}>
              <table style={estilos.tabela}>
                <thead>
                  <tr>
                    <th style={estilos.th}>Vencimento</th>
                    <th style={estilos.th}>Descrição / aluno</th>
                    <th style={estilos.th}>{tipo === "receber" ? "Tipo de entrada" : "Tipo de saída"}</th>
                    <th style={estilos.th}>Banco</th>
                    <th style={estilos.th}>Unidade</th>
                    <th style={estilos.th}>Valor</th>
                    <th style={estilos.th}>Status</th>
                    <th style={estilos.th}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {contasDaPagina.map((conta) => {
                    const vencida = contaVencida(conta);
                    const statusTela = vencida ? "Vencido" : conta.status;
                    return (
                      <tr key={conta.id} style={vencida ? estilos.linhaVencida : undefined}>
                        <td style={estilos.td}>
                          <strong>{formatarData(conta.vencimento)}</strong>
                        </td>
                        <td style={estilos.tdDescricao}>
                          <strong>{conta.alunoNome || conta.descricao}</strong>
                          {conta.alunoNome && <small style={estilos.detalhe}>{conta.descricao}</small>}
                          {conta.observacao && <small style={estilos.detalhe}>{conta.observacao}</small>}
                        </td>
                        <td style={estilos.td}>{conta.categoria}</td>
                        <td style={estilos.td}>{conta.banco}</td>
                        <td style={estilos.td}>{conta.unidade}</td>
                        <td style={estilos.td}>
                          <strong>
                            {moeda(
                              saldoConta(conta)
                            )}
                          </strong>
                          {(conta.valorPago ?? 0) >
                            0 && (
                            <small
                              style={
                                estilos.detalhe
                              }
                            >
                              Pago:{" "}
                              {moeda(
                                conta.valorPago ??
                                  0
                              )}
                            </small>
                          )}
                        </td>
                        <td style={estilos.td}>
                          <span style={{
                            ...estilos.status,
                            ...(statusTela === "Vencido"
                              ? estilos.statusVencido
                            : statusTela === "Pendente" ||
                                statusTela === "Parcial"
                                ? estilos.statusPendente
                                : estilos.statusConcluido),
                          }}>
                            {statusTela}
                          </span>
                        </td>
                        <td style={estilos.td}>
                          <div style={estilos.acoesTabela}>
                            {contaEmAberto(conta) && (
                              <button onClick={() => baixarConta(conta)} style={estilos.botaoBaixar}>
                                {conta.status ===
                                "Parcial"
                                  ? "Nova baixa"
                                  : tipo ===
                                      "receber"
                                    ? "Receber"
                                    : "Pagar"}
                              </button>
                            )}
                            {(conta.valorPago ?? 0) > 0 && (
                              <button
                                onClick={() => void estornarPagamentos(conta)}
                                style={estilos.botaoAlerta}
                              >
                                Estornar
                              </button>
                            )}                            <button onClick={() => editarConta(conta)} style={estilos.botaoEditar}>Editar</button>
                            {(conta.valorPago ?? 0) <= 0 && (
                              <button onClick={() => void excluirConta(conta)} style={estilos.botaoExcluir}>Excluir</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={estilos.paginacao}>
              <span>
                Página {paginaSegura} de {totalPaginas}
              </span>
              <div style={estilos.acoesTabela}>
                <button disabled={paginaSegura === 1} onClick={() => setPagina((atual) => Math.max(1, atual - 1))} style={estilos.botaoSecundario}>Anterior</button>
                <button disabled={paginaSegura === totalPaginas} onClick={() => setPagina((atual) => Math.min(totalPaginas, atual + 1))} style={estilos.botaoSecundario}>Próxima</button>
              </div>
            </div>
          </>
        )}
      </section>

      {contaBaixa && (
        <div
          style={estilos.modalFundo}
          role="dialog"
          aria-modal="true"
          aria-label="Registrar baixa financeira"
        >
          <div style={estilos.modal}>
            <h2>
              Registrar{" "}
              {tipo === "receber"
                ? "recebimento"
                : "pagamento"}
            </h2>
            <p style={estilos.textoCinza}>
              {contaBaixa.descricao}
              <br />
              Saldo atual:{" "}
              <strong>
                {moeda(
                  saldoConta(contaBaixa)
                )}
              </strong>
            </p>
            <div style={estilos.formGrid}>
              <CampoTexto
                label="Valor desta baixa"
                value={valorBaixa}
                onChange={setValorBaixa}
                placeholder="0,00"
              />
              <CampoTexto
                label="Data"
                type="date"
                value={dataPagamento}
                onChange={setDataPagamento}
              />
              <CampoTexto
                label="Juros totais"
                value={jurosBaixa}
                onChange={setJurosBaixa}
              />
              <CampoTexto
                label="Multa total"
                value={multaBaixa}
                onChange={setMultaBaixa}
              />
              <CampoTexto
                label="Desconto total"
                value={descontoBaixa}
                onChange={setDescontoBaixa}
              />
              <CampoSelect
                label="Forma de pagamento / Conta"
                value={formaPagamento}
                opcoes={Array.from(new Set([
                  "Dinheiro",
                  "Cartão de crédito à vista",
                  "Cartão de débito",
                  "Cartão parcelado",
                  ...configuracoes.bancos,
                ]))}
                onChange={(opcao) => {
                  setFormaPagamento(opcao);
                  setBancoPagamento(opcao);
                  if (opcao !== "Cartão parcelado") setParcelasCartao(2);
                }}
              />
              {formaPagamento === "Cartão parcelado" && (
                <CampoSelect
                  label="Quantidade de parcelas"
                  value={String(parcelasCartao)}
                  opcoes={Array.from({ length: 11 }, (_, indice) => String(indice + 2))}
                  rotulos={Array.from({ length: 11 }, (_, indice) => String(indice + 2) + "x")}
                  onChange={(valor) => setParcelasCartao(Number(valor))}
                  semOpcaoVazia
                />
              )}
              {(formaPagamento === "Cartão de crédito à vista" ||
                formaPagamento === "Cartão de débito" ||
                formaPagamento === "Cartão parcelado") && (
                <div style={estilos.avisoPermissao}>
                  {(() => {
                    const calculo = calcularTaxaCartao(
                      converterNumero(valorBaixa),
                      formaPagamento,
                      parcelasCartao
                    );
                    return "Taxa: " + moeda(calculo.taxa) + " • Líquido previsto: " + moeda(calculo.liquido);
                  })()}
                </div>
              )}              <CampoTexto
                label="Observação da baixa"
                value={observacaoBaixa}
                onChange={
                  setObservacaoBaixa
                }
                placeholder="Opcional"
              />
            </div>
            <div style={estilos.botoes}>
              <button
                onClick={() =>
                  void confirmarBaixa()
                }
                disabled={processando}
                style={
                  estilos.botaoPrincipal
                }
              >
                {processando
                  ? "Salvando..."
                  : "Confirmar baixa"}
              </button>
              <button
                onClick={() =>
                  setContaBaixa(null)
                }
                disabled={processando}
                style={
                  estilos.botaoSecundario
                }
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type CardResumoProps = {
  titulo: string;
  valor: string;
  detalhe: string;
  destaque?: "vermelho" | "amarelo" | "verde";
};

function CardResumo({ titulo, valor, detalhe, destaque }: CardResumoProps) {
  const borda =
    destaque === "vermelho"
      ? "#dc2626"
      : destaque === "amarelo"
        ? "#d97706"
        : destaque === "verde"
          ? "#15803d"
          : "#2563eb";
  return (
    <div style={{ ...estilos.cardResumo, borderTop: `4px solid ${borda}` }}>
      <span style={estilos.textoCinza}>{titulo}</span>
      <strong style={{ fontSize: 24 }}>{valor}</strong>
      <small style={estilos.detalhe}>{detalhe}</small>
    </div>
  );
}

type CampoTextoProps = {
  label: string;
  value: string;
  onChange: (valor: string) => void;
  placeholder?: string;
  type?: string;
};

function CampoTexto({ label, value, onChange, placeholder = "", type = "text" }: CampoTextoProps) {
  return (
    <label style={estilos.campoGrupo}>
      <strong>{label}</strong>
      <input type={type} value={value} placeholder={placeholder} onChange={(evento) => onChange(evento.target.value)} style={estilos.input} />
    </label>
  );
}

type CampoSelectProps = {
  label: string;
  value: string;
  opcoes: string[];
  onChange: (valor: string) => void;
  semOpcaoVazia?: boolean;
  rotulos?: string[];
};

function CampoSelect({ label, value, opcoes, onChange, semOpcaoVazia = false, rotulos }: CampoSelectProps) {
  const opcoesComValorAtual =
    value && !opcoes.includes(value) ? [value, ...opcoes] : opcoes;
  return (
    <label style={estilos.campoGrupo}>
      <strong>{label}</strong>
      <select value={value} onChange={(evento) => onChange(evento.target.value)} style={estilos.input}>
        {!semOpcaoVazia && <option value="">Selecione...</option>}
        {opcoesComValorAtual.map((opcao, indice) => (
          <option key={opcao} value={opcao}>
            {rotulos?.[indice] ?? opcao}
          </option>
        ))}
      </select>
    </label>
  );
}

const estilos: Record<string, CSSProperties> = {
  cabecalho: { marginBottom: 24 },
  titulo: { margin: 0, fontSize: 32, color: "#0f172a" },
  textoCinza: { color: "#64748b", lineHeight: 1.6 },
  avisoPermissao: {
    background: "#eff6ff",
    border: "1px solid #93c5fd",
    color: "#1e3a8a",
    padding: "14px 18px",
    borderRadius: 12,
    marginBottom: 22,
    lineHeight: 1.5,
  },
  cardsResumo: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))",
    gap: 18,
    marginBottom: 25,
  },
  cardResumo: {
    background: "white",
    padding: 20,
    borderRadius: 15,
    display: "flex",
    flexDirection: "column",
    gap: 9,
    boxShadow: "0 6px 18px rgba(15,23,42,.07)",
  },
  detalhe: { color: "#64748b", display: "block", marginTop: 4, lineHeight: 1.35 },
  caixa: {
    background: "white",
    padding: 26,
    borderRadius: 17,
    boxShadow: "0 6px 18px rgba(15,23,42,.07)",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
    gap: 18,
    marginTop: 20,
  },
  filtros: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))",
    gap: 14,
    marginTop: 22,
  },
  campoGrupo: { display: "flex", flexDirection: "column", gap: 7 },
  input: {
    padding: "13px 14px",
    border: "1px solid #cbd5e1",
    borderRadius: 9,
    fontSize: 15,
    boxSizing: "border-box",
    width: "100%",
    background: "#fff",
    color: "#0f172a",
  },
  botoes: { display: "flex", gap: 10, marginTop: 22, flexWrap: "wrap" },
  topoLista: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 18,
    flexWrap: "wrap",
  },
  atalhos: { display: "flex", gap: 8, flexWrap: "wrap" },
  botaoPrincipal: {
    background: "#15803d",
    color: "white",
    border: "none",
    borderRadius: 9,
    padding: "13px 20px",
    cursor: "pointer",
    fontWeight: 700,
  },
  botaoSecundario: {
    background: "white",
    color: "#1e293b",
    border: "1px solid #cbd5e1",
    borderRadius: 9,
    padding: "11px 16px",
    cursor: "pointer",
    fontWeight: 600,
  },
  botaoAtalho: {
    background: "#e2e8f0",
    color: "#0f172a",
    border: "none",
    borderRadius: 9,
    padding: "10px 13px",
    cursor: "pointer",
    fontWeight: 700,
  },
  botaoAlerta: {
    background: "#fee2e2",
    color: "#991b1b",
    border: "1px solid #fecaca",
    borderRadius: 9,
    padding: "10px 13px",
    cursor: "pointer",
    fontWeight: 700,
  },
  botaoExcel: {
    background: "#166534",
    color: "white",
    border: "none",
    borderRadius: 9,
    padding: "11px 16px",
    cursor: "pointer",
    fontWeight: 700,
  },
  checkbox: {
    display: "flex",
    alignItems: "center",
    gap: 9,
    marginTop: 18,
    color: "#334155",
    fontWeight: 600,
  },
  tabelaContainer: { overflowX: "auto", marginTop: 22 },
  tabela: { width: "100%", minWidth: 1120, borderCollapse: "collapse" },
  th: {
    background: "#101a2d",
    color: "white",
    padding: 12,
    textAlign: "left",
    whiteSpace: "nowrap",
    position: "sticky",
    top: 0,
    zIndex: 1,
  },
  td: {
    padding: 12,
    borderBottom: "1px solid #e2e8f0",
    whiteSpace: "nowrap",
    verticalAlign: "top",
  },
  tdDescricao: {
    padding: 12,
    borderBottom: "1px solid #e2e8f0",
    minWidth: 260,
    maxWidth: 390,
    whiteSpace: "normal",
    verticalAlign: "top",
  },
  linhaVencida: { background: "#fff7f7" },
  status: { padding: "6px 10px", borderRadius: 20, fontSize: 13, fontWeight: 700 },
  statusVencido: { background: "#fee2e2", color: "#991b1b" },
  statusPendente: { background: "#fef3c7", color: "#92400e" },
  statusConcluido: { background: "#dcfce7", color: "#166534" },
  acoesTabela: { display: "flex", gap: 6, flexWrap: "wrap" },
  botaoBaixar: {
    background: "#15803d",
    color: "white",
    border: "none",
    borderRadius: 6,
    padding: "8px 10px",
    cursor: "pointer",
  },
  botaoEditar: {
    background: "#2563eb",
    color: "white",
    border: "none",
    borderRadius: 6,
    padding: "8px 10px",
    cursor: "pointer",
  },
  botaoExcluir: {
    background: "#b91c1c",
    color: "white",
    border: "none",
    borderRadius: 6,
    padding: "8px 10px",
    cursor: "pointer",
  },
  vazio: { textAlign: "center", color: "#64748b", padding: 38 },
  paginacao: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 15,
    marginTop: 20,
    flexWrap: "wrap",
    color: "#475569",
  },
  modalFundo: {
    position: "fixed",
    inset: 0,
    background:
      "rgba(15,23,42,.72)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    zIndex: 9999,
    overflowY: "auto",
  },
  modal: {
    width: "min(900px, 100%)",
    maxHeight: "92vh",
    overflowY: "auto",
    background: "#fff",
    borderRadius: 18,
    padding: 26,
    boxShadow:
      "0 24px 80px rgba(0,0,0,.28)",
  },
};

export default Contas;

import type { Conta } from "../Contas";

export type AnoContratoSalvo = {
  anoLetivo: string;
  cursoId?: string;
  curso: string;
  parcelas: string;
  valorPadrao: string;
  primeiroVencimento: string;
};

export type HistoricoContrato = {
  data: string;
  responsavelId: string;
  responsavelNome: string;
  resumo: string;
  cursosAnteriores: string[];
  cursosNovos: string[];
};

export type RegistroContrato = {
  inicioContrato?: string;
  terminoContrato?: string;
  diaVencimentoContrato?: string;
  enderecoContrato?: string;
  cidadeContrato?: string;
  autorizacaoImagem?: string;
  clausulas?: string;
  duracaoContrato?: string;
  anosContrato?: AnoContratoSalvo[];
  criadoEm?: string;
  atualizadoEm?: string;
  atualizadoPor?: string;
  revisao?: number;
  historico?: HistoricoContrato[];
};

export const resumirAlteracaoContrato = (
  anterior: RegistroContrato | undefined,
  atual: RegistroContrato
) => {
  if (!anterior) return "Contrato criado e parcelas geradas.";

  const alteracoes: string[] = [];
  const cursosAntes = anterior.anosContrato?.map((ano) => ano.curso).join(", ") || "não informado";
  const cursosDepois = atual.anosContrato?.map((ano) => ano.curso).join(", ") || "não informado";
  if (cursosAntes !== cursosDepois) alteracoes.push(`cursos: ${cursosAntes} → ${cursosDepois}`);

  const financeiroAntes = JSON.stringify(anterior.anosContrato?.map(({ parcelas, valorPadrao, primeiroVencimento }) => ({ parcelas, valorPadrao, primeiroVencimento })));
  const financeiroDepois = JSON.stringify(atual.anosContrato?.map(({ parcelas, valorPadrao, primeiroVencimento }) => ({ parcelas, valorPadrao, primeiroVencimento })));
  if (financeiroAntes !== financeiroDepois) alteracoes.push("parcelas, valores ou vencimentos");
  if (anterior.terminoContrato !== atual.terminoContrato) alteracoes.push("período de vigência");
  if (anterior.clausulas !== atual.clausulas) alteracoes.push("condições adicionais");

  return alteracoes.length
    ? `Alteração contratual: ${alteracoes.join("; ")}. Parcelas futuras pendentes recalculadas.`
    : "Contrato revisado sem mudança financeira.";
};

const campoObservacao = (observacao: string | undefined, campo: string) => {
  const trecho = observacao
    ?.split("|")
    .map((item) => item.trim())
    .find((item) => item.toLocaleLowerCase("pt-BR").startsWith(campo.toLocaleLowerCase("pt-BR") + ":"));
  return trecho?.slice(trecho.indexOf(":") + 1).trim().toLocaleLowerCase("pt-BR") ?? "";
};

export const anoLetivoDaParcela = (conta: Conta) =>
  campoObservacao(conta.observacao, "Ano letivo");

const chaveParcelaContrato = (conta: Conta) => [
  conta.alunoId ?? "",
  anoLetivoDaParcela(conta),
  campoObservacao(conta.observacao, "Curso"),
  conta.vencimento,
].join("|");

const preferirParcela = (atual: Conta, candidata: Conta) => {
  const atualPago = (atual.valorPago ?? 0) > 0 || atual.status === "Recebido" || atual.status === "Pago";
  const candidataPaga = (candidata.valorPago ?? 0) > 0 || candidata.status === "Recebido" || candidata.status === "Pago";
  if (candidataPaga && !atualPago) return candidata;
  if (atualPago && !candidataPaga) return atual;
  return String(atual.criadoEm ?? "").localeCompare(String(candidata.criadoEm ?? "")) <= 0
    ? atual
    : candidata;
};

export const recalcularParcelasFuturas = ({
  contas,
  novasParcelas,
  alunoId,
  usuarioId,
  hoje,
  ehAlteracao,
  incluirVencidas = true,
}: {
  contas: Conta[];
  novasParcelas: Conta[];
  alunoId: string;
  usuarioId: string;
  hoje: string;
  ehAlteracao: boolean;
  incluirVencidas?: boolean;
}) => {
  const agora = new Date().toISOString();
  const candidatas = novasParcelas.filter(
    (conta) => incluirVencidas || conta.vencimento >= hoje
  );
  const candidatasUnicas = Array.from(
    new Map(candidatas.map((conta) => [chaveParcelaContrato(conta), conta])).values()
  );
  const existentesDoAluno = contas.filter(
    (conta) =>
      conta.alunoId === alunoId &&
      conta.tipo === "receber" &&
      conta.origem === "mensalidade"
  );
  const existentesPorChave = new Map<string, Conta>();
  existentesDoAluno
    .filter((conta) => conta.status !== "Cancelado")
    .forEach((conta) => {
      const chave = chaveParcelaContrato(conta);
      const atual = existentesPorChave.get(chave);
      existentesPorChave.set(chave, atual ? preferirParcela(atual, conta) : conta);
    });

  const idsMantidos = new Set<string>();
  const parcelasFinais = candidatasUnicas.map((nova) => {
    const existente = existentesPorChave.get(chaveParcelaContrato(nova));
    if (!existente) return nova;
    idsMantidos.add(existente.id);
    const protegida = (existente.valorPago ?? 0) > 0 || existente.status === "Recebido" || existente.status === "Pago";
    if (protegida) return existente;
    return {
      ...nova,
      id: existente.id,
      criadoEm: existente.criadoEm,
      criadoPorId: existente.criadoPorId,
      criadoPorNome: existente.criadoPorNome,
      criadoPorPerfil: existente.criadoPorPerfil,
      atualizadoEm: agora,
      atualizadoPorId: usuarioId,
    };
  });

  const parcelasFinaisPorId = new Map(
    parcelasFinais.map((conta) => [conta.id, conta] as const)
  );
  const substituidas = new Set(
    candidatasUnicas.map((conta) => chaveParcelaContrato(conta))
  );
  const preservadas = contas.map((conta): Conta => {
    const pertence = conta.alunoId === alunoId && conta.tipo === "receber" && conta.origem === "mensalidade";
    if (!pertence) return conta;
    if (idsMantidos.has(conta.id)) return parcelasFinaisPorId.get(conta.id) ?? conta;

    const duplicadaAtiva = substituidas.has(chaveParcelaContrato(conta)) && conta.status !== "Cancelado";
    const deveCancelar =
      conta.status === "Pendente" &&
      (duplicadaAtiva || (ehAlteracao && conta.vencimento >= hoje));
    if (!deveCancelar) return conta;

    return {
      ...conta,
      status: "Cancelado",
      atualizadoEm: agora,
      atualizadoPorId: usuarioId,
      observacao: conta.observacao.includes("Cancelada por alteração contratual")
        ? conta.observacao
        : `${conta.observacao} | Cancelada por alteração contratual`,
    };
  });

  const idsExistentes = new Set(preservadas.map((conta) => conta.id));
  return [
    ...preservadas,
    ...parcelasFinais.filter((conta) => !idsExistentes.has(conta.id)),
  ];
};

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

export const recalcularParcelasFuturas = ({
  contas,
  novasParcelas,
  alunoId,
  usuarioId,
  hoje,
  ehAlteracao,
}: {
  contas: Conta[];
  novasParcelas: Conta[];
  alunoId: string;
  usuarioId: string;
  hoje: string;
  ehAlteracao: boolean;
}) => {
  if (!ehAlteracao) {
    const ids = new Set(novasParcelas.map((conta) => conta.id));
    return [...contas.filter((conta) => !ids.has(conta.id)), ...novasParcelas];
  }

  const agora = new Date().toISOString();
  const preservadas = contas.map((conta): Conta => {
    const pertence = conta.alunoId === alunoId && conta.tipo === "receber" && conta.observacao?.includes(`Contrato: ${alunoId}`);
    const podeSubstituir = pertence && conta.status === "Pendente" && conta.vencimento >= hoje;
    if (!podeSubstituir) return conta;

    return {
      ...conta,
      status: "Cancelado",
      atualizadoEm: agora,
      atualizadoPorId: usuarioId,
      observacao: `${conta.observacao} | Cancelada por alteração contratual`,
    };
  });

  return [
    ...preservadas,
    ...novasParcelas.filter((conta) => conta.vencimento >= hoje),
  ];
};

import {
  supabase,
  supabaseConfigurado,
} from "../lib/supabase";
import type { Perfil } from "../Acesso";
import type { Conta } from "../Contas";
import { normalizarUnidade } from "../utils/unidades";

type ContaBanco = {
  id: string;
  tipo: "receber" | "pagar";
  descricao: string;
  valor_original: number | string;
  valor_pago: number | string;
  juros: number | string;
  multa: number | string;
  desconto: number | string;
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
  origem: Conta["origem"];
  aluno_id: string | null;
  aluno_nome: string | null;
  criado_por: string;
  atualizado_por: string | null;
  data_baixa: string | null;
  criado_em: string;
  atualizado_em: string;
};

const numero = (valor: number | string | null | undefined) => {
  const convertido = Number(valor ?? 0);
  return Number.isFinite(convertido) ? convertido : 0;
};

const paraConta = (registro: ContaBanco): Conta => ({
  id: registro.id,
  tipo: registro.tipo,
  descricao: registro.descricao,
  valor: numero(registro.valor_original),
  valorPago: numero(registro.valor_pago),
  juros: numero(registro.juros),
  multa: numero(registro.multa),
  desconto: numero(registro.desconto),
  vencimento: registro.vencimento,
  categoria: registro.categoria,
  banco: registro.banco,
  unidade: normalizarUnidade(registro.unidade),
  observacao: registro.observacao,
  status: registro.status,
  origem: registro.origem,
  alunoId: registro.aluno_id ?? undefined,
  alunoNome: registro.aluno_nome ?? undefined,
  criadoPorId: registro.criado_por,
  atualizadoPorId: registro.atualizado_por ?? undefined,
  dataBaixa: registro.data_baixa ?? undefined,
  criadoEm: registro.criado_em,
  atualizadoEm: registro.atualizado_em,
});

const paraBanco = (
  conta: Conta,
  usuarioId: string
) => ({
  id: conta.id,
  tipo: conta.tipo,
  descricao: conta.descricao,
  valor_original: conta.valor,
  valor_pago: conta.valorPago ?? 0,
  juros: conta.juros ?? 0,
  multa: conta.multa ?? 0,
  desconto: conta.desconto ?? 0,
  vencimento: conta.vencimento,
  categoria: conta.categoria,
  banco: conta.banco,
  unidade: normalizarUnidade(conta.unidade),
  observacao: conta.observacao,
  status: conta.status,
  origem: conta.origem ?? "manual",
  aluno_id: conta.alunoId ?? null,
  aluno_nome: conta.alunoNome ?? null,
  criado_por: conta.criadoPorId ?? usuarioId,
  atualizado_por: usuarioId,
  data_baixa: conta.dataBaixa ?? null,
  criado_em:
    conta.criadoEm ??
    new Date().toISOString(),
  atualizado_em:
    new Date().toISOString(),
});

const cliente = () => {
  if (
    !supabaseConfigurado ||
    !supabase
  ) {
    return null;
  }
  return supabase;
};

export async function carregarContasEstruturadas() {
  const banco = cliente();
  if (!banco) return null;

  const { data, error } = await banco
    .from("contas_financeiras")
    .select("*")
    .order("vencimento", {
      ascending: true,
    });

  if (error) throw error;
  return (data as ContaBanco[]).map(
    paraConta
  );
}

export async function salvarContaEstruturada(
  conta: Conta,
  usuarioId: string
) {
  const banco = cliente();
  if (!banco) return;
  const { error } = await banco
    .from("contas_financeiras")
    .upsert(
      paraBanco(conta, usuarioId),
      { onConflict: "id" }
    );
  if (error) throw error;
}

export async function excluirContaEstruturada(
  contaId: string
) {
  const banco = cliente();
  if (!banco) return;
  const { error } = await banco
    .from("contas_financeiras")
    .delete()
    .eq("id", contaId);
  if (error) throw error;
}

export async function registrarBaixaEstruturada({
  conta,
  usuarioId,
  valor,
  dataPagamento,
  bancoPagamento,
  formaPagamento,
  observacao,
}: {
  conta: Conta;
  usuarioId: string;
  valor: number;
  dataPagamento: string;
  bancoPagamento: string;
  formaPagamento: string;
  observacao: string;
}) {
  const banco = cliente();
  if (!banco) return;

  const { error: erroBaixa } =
    await banco
      .from("baixas_financeiras")
      .insert({
        conta_id: conta.id,
        valor,
        data_pagamento: dataPagamento,
        banco: bancoPagamento,
        forma_pagamento: formaPagamento,
        observacao,
        recebido_por: usuarioId,
      });
  if (erroBaixa) throw erroBaixa;

  await salvarContaEstruturada(
    conta,
    usuarioId
  );
}

export async function registrarEstornoBaixaEstruturada({
  contaId,
  usuarioId,
  motivo,
}: {
  contaId: string;
  usuarioId: string;
  motivo: string;
}) {
  const banco = cliente();
  if (!banco) return;
  const { data, error: erroConsulta } = await banco
    .from("baixas_financeiras")
    .select("id")
    .eq("conta_id", contaId)
    .is("estornado_em", null)
    .order("criado_em", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (erroConsulta) throw erroConsulta;
  if (!data) return;
  const { error } = await banco
    .from("baixas_financeiras")
    .update({
      estornado_em: new Date().toISOString(),
      estornado_por: usuarioId,
      motivo_estorno: motivo,
    })
    .eq("id", data.id);
  if (error) throw error;
}

export async function sincronizarContasLocais({
  contas,
  usuarioId,
  perfil,
}: {
  contas: Conta[];
  usuarioId: string;
  perfil: Perfil;
}) {
  const banco = cliente();
  if (!banco || !contas.length) {
    return;
  }

  const permitidas =
    perfil === "Secretaria"
      ? contas.filter(
          (conta) =>
            conta.origem ===
              "mensalidade" ||
            conta.criadoPorId ===
              usuarioId
        )
      : contas;

  if (!permitidas.length) return;

  const ids = permitidas.map((conta) => conta.id);
  const { data: existentes, error: erroConsulta } = await banco
    .from("contas_financeiras")
    .select("id")
    .in("id", ids);
  if (erroConsulta) throw erroConsulta;

  const idsExistentes = new Set(
    (existentes ?? []).map((registro) => String(registro.id))
  );
  const novas = permitidas.filter((conta) => !idsExistentes.has(conta.id));
  const atualizacoes = permitidas.filter((conta) => idsExistentes.has(conta.id));

  if (novas.length) {
    const { error } = await banco
      .from("contas_financeiras")
      .insert(novas.map((conta) => paraBanco(conta, usuarioId)));
    if (error) throw error;
  }

  for (const conta of atualizacoes) {
    const { data, error } = await banco
      .from("contas_financeiras")
      .update(paraBanco(conta, usuarioId))
      .eq("id", conta.id)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      throw new Error(`A parcela ${conta.descricao} não pôde ser atualizada.`);
    }
  }
}

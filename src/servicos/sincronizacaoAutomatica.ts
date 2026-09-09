import {
  supabase,
  supabaseConfigurado,
} from "../lib/supabase";
import type { Perfil } from "../Acesso";
import type { Conta } from "../Contas";
import {
  carregarContasEstruturadas,
  sincronizarContasLocais,
} from "./contasEstruturadas";

const CHAVES_COMPARTILHADAS = [
  "financeiro-cedep-lancamentos",
  "financeiro-cedep-importacoes",
  "financeiro-cedep-configuracoes",
  "financeiro-cedep-cadastros",
  "financeiro-cedep-escolas",
  "financeiro-cedep-professores",
  "financeiro-cedep-mensalidades",
  "financeiro-cedep-secretaria",
  "financeiro-cedep-configuracao-pix",
  "financeiro-cedep-configuracoes-contratos",
  "financeiro-cedep-academico",
  "financeiro-cedep-observacoes-alunos",
  "financeiro-cedep-despesas-pessoais",
  "financeiro-cedep-categorias-pessoais",
  "financeiro-cedep-pagamentos-pessoais",
  "financeiro-cedep-taxas-cartao",
] as const;

export const EVENTO_SINCRONIZACAO_REMOTA =
  "financeiro-sincronizacao-remota";

const EVENTOS_POR_CHAVE: Partial<
  Record<(typeof CHAVES_COMPARTILHADAS)[number], string>
> = {
  "financeiro-cedep-configuracoes": "financeiro-config-atualizada",
  "financeiro-cedep-mensalidades": "financeiro-mensalidades-atualizada",
  "financeiro-cedep-secretaria": "financeiro-caixa-atualizado",
  "financeiro-cedep-academico": "financeiro-academico-atualizado",
  "financeiro-cedep-observacoes-alunos":
    "financeiro-observacoes-alunos-atualizadas",
  "financeiro-cedep-despesas-pessoais":
    "financeiro-despesas-pessoais-atualizadas",
  "financeiro-cedep-taxas-cartao":
    "financeiro-taxas-cartao-atualizadas",
};

type RegistroNuvem = {
  chave: string;
  valor: unknown;
  updated_at: string;
};

const lerValorLocal = (
  chave: string
) => {
  const valor =
    localStorage.getItem(chave);

  if (valor === null) {
    return undefined;
  }

  try {
    return JSON.parse(valor);
  } catch {
    return valor;
  }
};

const serializar = (
  valor: unknown
) => JSON.stringify(valor);

type ItemComId = {
  id?: string;
  [campo: string]: unknown;
};

const CAMPOS_MESCLAGEM: Record<string, string[]> = {
  "financeiro-cedep-cadastros": ["alunos", "parceiros"],
  "financeiro-cedep-academico": ["turmas", "matriculas", "presencas"],
  "financeiro-cedep-professores": ["professores", "lancamentos"],
  "financeiro-cedep-secretaria": ["sessoes"],
};

const mesclarListaPendente = (
  baseAnterior: unknown,
  valorLocal: unknown,
  valorRemoto: unknown
) => {
  if (!Array.isArray(baseAnterior) || !Array.isArray(valorLocal) || !Array.isArray(valorRemoto)) {
    return valorRemoto;
  }

  const basePorId = new Map(
    (baseAnterior as ItemComId[]).filter((item) => item.id).map((item) => [item.id as string, item])
  );
  const locais = (valorLocal as ItemComId[]).filter((item) => item.id);
  const idsLocais = new Set(locais.map((item) => item.id as string));
  const resultado = new Map(
    (valorRemoto as ItemComId[]).filter((item) => item.id).map((item) => [item.id as string, item])
  );

  locais.forEach((item) => {
    const anterior = basePorId.get(item.id as string);
    if (!anterior || serializar(anterior) !== serializar(item)) {
      resultado.set(item.id as string, item);
    }
  });
  basePorId.forEach((_item, id) => {
    if (!idsLocais.has(id)) resultado.delete(id);
  });
  return Array.from(resultado.values());
};

const mesclarAlteracoesLocaisPendentes = (
  chave: string,
  baseAnterior: unknown,
  valorLocal: unknown,
  valorRemoto: unknown
) => {
  if (chave === "financeiro-cedep-lancamentos") {
    return mesclarListaPendente(baseAnterior, valorLocal, valorRemoto);
  }
  if (chave === "financeiro-cedep-configuracoes-contratos") {
    if (
      !baseAnterior || typeof baseAnterior !== "object" ||
      !valorLocal || typeof valorLocal !== "object" ||
      !valorRemoto || typeof valorRemoto !== "object"
    ) {
      return valorRemoto;
    }
    const base = baseAnterior as Record<string, unknown>;
    const local = valorLocal as Record<string, unknown>;
    const resultado = { ...(valorRemoto as Record<string, unknown>) };
    Object.entries(local).forEach(([alunoId, contrato]) => {
      if (!(alunoId in base) || serializar(base[alunoId]) !== serializar(contrato)) {
        resultado[alunoId] = contrato;
      }
    });
    Object.keys(base).forEach((alunoId) => {
      if (!(alunoId in local)) delete resultado[alunoId];
    });
    return resultado;
  }
  if (
    !baseAnterior || typeof baseAnterior !== "object" ||
    !valorLocal || typeof valorLocal !== "object" ||
    !valorRemoto || typeof valorRemoto !== "object"
  ) {
    return valorRemoto;
  }
  const resultado = { ...(valorRemoto as Record<string, unknown>) };
  CAMPOS_MESCLAGEM[chave]?.forEach((campo) => {
    resultado[campo] = mesclarListaPendente(
      (baseAnterior as Record<string, unknown>)[campo],
      (valorLocal as Record<string, unknown>)[campo],
      (valorRemoto as Record<string, unknown>)[campo]
    );
  });
  return resultado;
};

const CHAVES_COM_MESCLAGEM = new Set<string>([
  "financeiro-cedep-lancamentos",
  "financeiro-cedep-cadastros",
  "financeiro-cedep-academico",
  "financeiro-cedep-professores",
  "financeiro-cedep-secretaria",
  "financeiro-cedep-configuracoes-contratos",
]);

const calcularRemocoes = (
  chave: string,
  anteriorSerializado: string | undefined,
  valorAtual: unknown
) => {
  if (!anteriorSerializado) return {};
  try {
    const anterior = JSON.parse(anteriorSerializado) as unknown;
    if (chave === "financeiro-cedep-configuracoes-contratos") {
      const antes = anterior && typeof anterior === "object"
        ? anterior as Record<string, unknown>
        : {};
      const depois = valorAtual && typeof valorAtual === "object"
        ? valorAtual as Record<string, unknown>
        : {};
      return { registros: Object.keys(antes).filter((alunoId) => !(alunoId in depois)) };
    }
    const campos = chave === "financeiro-cedep-lancamentos"
      ? ["itens"]
      : CAMPOS_MESCLAGEM[chave] ?? [];
    return Object.fromEntries(campos.map((campo) => {
      const antes = campo === "itens" ? anterior : (anterior as Record<string, unknown>)?.[campo];
      const depois = campo === "itens" ? valorAtual : (valorAtual as Record<string, unknown>)?.[campo];
      const idsDepois = new Set(
        (Array.isArray(depois) ? depois : []).map((item: ItemComId) => item.id).filter(Boolean)
      );
      return [campo, (Array.isArray(antes) ? antes : [])
        .map((item: ItemComId) => item.id)
        .filter((id): id is string => Boolean(id) && !idsDepois.has(id))];
    }));
  } catch {
    return {};
  }
};

const calcularAlteracoesContrato = (
  anteriorSerializado: string | undefined,
  valorAtual: unknown
) => {
  const atual = valorAtual && typeof valorAtual === "object"
    ? valorAtual as Record<string, unknown>
    : {};
  if (!anteriorSerializado) return atual;
  try {
    const anterior = JSON.parse(anteriorSerializado) as Record<string, unknown>;
    return Object.fromEntries(Object.entries(atual).filter(([alunoId, contrato]) =>
      !(alunoId in anterior) || serializar(anterior[alunoId]) !== serializar(contrato)
    ));
  } catch {
    return atual;
  }
};

const salvarValorLocal = (
  chave: string,
  valor: unknown
) => {
  localStorage.setItem(
    chave,
    typeof valor === "string"
      ? valor
      : JSON.stringify(valor)
  );
};

const clienteObrigatorio = () => {
  if (
    !supabaseConfigurado ||
    !supabase
  ) {
    throw new Error(
      "O banco online não está configurado."
    );
  }

  return supabase;
};

export async function salvarChaveCompartilhada<T>(
  chave: string,
  valor: T,
  usuarioId: string,
  remocoes: Record<string, string[]> = {}
): Promise<T> {
  const cliente = clienteObrigatorio();

  if (CHAVES_COM_MESCLAGEM.has(chave)) {
    const { data, error } = await cliente.rpc("mesclar_erp_dados", {
      p_chave: chave,
      p_valor: valor,
      p_updated_by: usuarioId,
      p_remocoes: remocoes,
    });
    if (error) throw error;
    const confirmado = (data ?? valor) as T;
    salvarValorLocal(chave, confirmado);
    return confirmado;
  }

  const { error } = await cliente.from("erp_dados").upsert(
    {
      chave,
      valor,
      updated_by: usuarioId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "chave" }
  );
  if (error) throw error;
  salvarValorLocal(chave, valor);
  return valor;
}

const enviarRegistrosLocais =
  async (
    usuarioId: string
  ) => {
    const cliente =
      clienteObrigatorio();
    const agora =
      new Date().toISOString();
    const registros =
      CHAVES_COMPARTILHADAS.flatMap(
        (chave) => {
          const valor =
            lerValorLocal(chave);

          return valor ===
            undefined
            ? []
            : [
                {
                  chave,
                  valor,
                  updated_by:
                    usuarioId,
                  updated_at:
                    agora,
                },
              ];
        }
      );

    if (registros.length === 0) {
      return;
    }

    const { error } =
      await cliente
        .from("erp_dados")
        .upsert(registros, {
          onConflict: "chave",
        });

    if (error) {
      throw error;
    }
  };

export async function prepararSincronizacaoInicial(
  usuarioId: string,
  podeEditar: boolean,
  perfil: Perfil
) {
  const cliente =
    clienteObrigatorio();
  const contasNuvem =
    await carregarContasEstruturadas();
  if (contasNuvem) {
    salvarValorLocal(
      "financeiro-cedep-contas",
      contasNuvem
    );
  }

  const { data, error } =
    await cliente
      .from("erp_dados")
      .select(
        "chave, valor, updated_at"
      )
      .in(
        "chave",
        [
          ...CHAVES_COMPARTILHADAS,
        ]
      );

  if (error) {
    throw error;
  }

  const registros =
    (data ??
      []) as RegistroNuvem[];

  const chaveTaxasCartao =
    "financeiro-cedep-taxas-cartao";
  const taxasLocais =
    lerValorLocal(chaveTaxasCartao);
  const taxasJaEstaoNaNuvem =
    registros.some(
      (registro) =>
        registro.chave === chaveTaxasCartao
    );

  if (
    perfil === "Administrador" &&
    taxasLocais !== undefined &&
    !taxasJaEstaoNaNuvem
  ) {
    const { error: erroTaxas } =
      await cliente
        .from("erp_dados")
        .upsert(
          {
            chave: chaveTaxasCartao,
            valor: taxasLocais,
            updated_by: usuarioId,
            updated_at:
              new Date().toISOString(),
          },
          { onConflict: "chave" }
        );

    if (erroTaxas) {
      throw erroTaxas;
    }
  }

  if (
    registros.length === 0
  ) {
    if (podeEditar) {
      await enviarRegistrosLocais(
        usuarioId
      );
    }

    return false;
  }

  let alterou = false;

  registros.forEach(
    (registro) => {
      const valorAtual =
        lerValorLocal(
          registro.chave
        );

      if (
        serializar(valorAtual) !==
        serializar(
          registro.valor
        )
      ) {
        salvarValorLocal(
          registro.chave,
          registro.valor
        );
        alterou = true;
      }
    }
  );

  localStorage.setItem(
    "financeiro-cedep-ultima-sincronizacao",
    new Date().toLocaleString(
      "pt-BR"
    )
  );

  return alterou;
}

export function iniciarSincronizacaoAutomatica(
  usuarioId: string,
  podeEditar: boolean,
  perfil: Perfil
) {
  if (
    !supabaseConfigurado ||
    !supabase ||
    !podeEditar
  ) {
    return () => {};
  }

  const cliente = supabase;
  const conhecidos =
    new Map<string, string>();
  let enviando = false;
  let erroNotificado = false;
  let contasConhecidas =
    serializar(
      lerValorLocal(
        "financeiro-cedep-contas"
      )
    );

  CHAVES_COMPARTILHADAS.forEach(
    (chave) => {
      conhecidos.set(
        chave,
        serializar(
          lerValorLocal(chave)
        )
      );
    }
  );

  const sincronizar = async () => {
    if (enviando) return;

    const contasAtuais =
      lerValorLocal(
        "financeiro-cedep-contas"
      ) as Conta[] | undefined;
    const contasSerializadas =
      serializar(contasAtuais);

    if (
      perfil === "Administrador" &&
      contasAtuais &&
      contasSerializadas !==
        contasConhecidas
    ) {
      contasConhecidas =
        contasSerializadas;
      await sincronizarContasLocais({
        contas: contasAtuais,
        usuarioId,
        perfil,
      });
    }

    const alterados =
      CHAVES_COMPARTILHADAS.flatMap(
        (chave) => {
          const valor =
            lerValorLocal(chave);
          const atual =
            serializar(valor);

          if (
            valor === undefined ||
            conhecidos.get(chave) ===
              atual
          ) {
            return [];
          }

          const anterior = conhecidos.get(chave);

          const remocoes = CHAVES_COM_MESCLAGEM.has(chave)
            ? calcularRemocoes(chave, anterior, valor)
            : {};

          return [
            {
              chave,
              valor: chave === "financeiro-cedep-configuracoes-contratos"
                ? calcularAlteracoesContrato(anterior, valor)
                : valor,
              updated_by:
                usuarioId,
              updated_at:
                new Date().toISOString(),
              remocoes,
            },
          ];
        }
      );

    if (alterados.length === 0) {
      return;
    }

    enviando = true;

    const especiais = alterados.filter((item) =>
      CHAVES_COM_MESCLAGEM.has(item.chave)
    );
    const comuns = alterados.filter((item) =>
      !CHAVES_COM_MESCLAGEM.has(item.chave)
    );

    let erro: unknown = null;
    try {
      for (const item of especiais) {
        const confirmado = await salvarChaveCompartilhada(
          item.chave,
          item.valor,
          usuarioId,
          item.remocoes
        );
        conhecidos.set(item.chave, serializar(confirmado));
      }

      if (comuns.length > 0) {
        const resultado = await cliente
          .from("erp_dados")
          .upsert(comuns, { onConflict: "chave" });
        if (resultado.error) throw resultado.error;
        comuns.forEach((item) => {
          conhecidos.set(item.chave, serializar(item.valor));
        });
      }
    } catch (falha) {
      erro = falha;
    }

    enviando = false;

    if (!erro) {
      erroNotificado = false;
      localStorage.setItem(
        "financeiro-cedep-ultima-sincronizacao",
        new Date().toLocaleString(
          "pt-BR"
        )
      );
    } else {
      console.error(
        "Erro na sincronização automática:",
        erro
      );
      if (!erroNotificado) {
        erroNotificado = true;
        window.dispatchEvent(
          new CustomEvent("financeiro-sincronizacao-erro", {
            detail: { erro },
          })
        );
      }
    }
  };

  const intervalo =
    window.setInterval(
      () => {
        void sincronizar();
      },
      2000
    );

  const canal = cliente
    .channel(
      "erp-dados-compartilhados"
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "erp_dados",
      },
      (evento) => {
        const novo =
          evento.new as {
            chave?: string;
            valor?: unknown;
            updated_by?: string;
          };

        if (
          !novo.chave ||
          !CHAVES_COMPARTILHADAS.includes(
            novo.chave as (typeof CHAVES_COMPARTILHADAS)[number]
          )
        ) {
          return;
        }

        const valorLocal = lerValorLocal(novo.chave);
        const baseAnteriorSerializada = conhecidos.get(novo.chave);
        const baseAnterior = baseAnteriorSerializada
          ? JSON.parse(baseAnteriorSerializada)
          : undefined;
        const temAlteracaoLocalPendente =
          serializar(valorLocal) !== baseAnteriorSerializada;
        const valorAplicado =
          CHAVES_COM_MESCLAGEM.has(novo.chave) &&
          temAlteracaoLocalPendente
            ? mesclarAlteracoesLocaisPendentes(novo.chave, baseAnterior, valorLocal, novo.valor)
            : novo.valor;

        salvarValorLocal(
          novo.chave,
          valorAplicado
        );
        conhecidos.set(
          novo.chave,
          serializar(
            novo.valor
          )
        );
        localStorage.setItem(
          "financeiro-cedep-ultima-sincronizacao",
          new Date().toLocaleString(
            "pt-BR"
          )
        );

        window.dispatchEvent(
          new CustomEvent(
            EVENTO_SINCRONIZACAO_REMOTA,
            {
              detail: {
                chave: novo.chave,
                valor: valorAplicado,
              },
            }
          )
        );

        const eventoDoModulo =
          EVENTOS_POR_CHAVE[
            novo.chave as (typeof CHAVES_COMPARTILHADAS)[number]
          ];
        if (eventoDoModulo) {
          window.dispatchEvent(
            new Event(eventoDoModulo)
          );
        }
        window.dispatchEvent(
          new StorageEvent("storage", {
            key: novo.chave,
            newValue: JSON.stringify(
              novo.valor
            ),
          })
        );
      }
    )
    .subscribe();

  return () => {
    window.clearInterval(
      intervalo
    );
    void cliente.removeChannel(
      canal
    );
  };
}

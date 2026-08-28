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

const CHAVES_COM_MESCLAGEM = new Set<string>([
  "financeiro-cedep-cadastros",
  "financeiro-cedep-academico",
]);

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
  const marcador =
    `erp-sync-inicial-${usuarioId}`;

  const contasNuvem =
    await carregarContasEstruturadas();
  if (contasNuvem) {
    salvarValorLocal(
      "financeiro-cedep-contas",
      contasNuvem
    );
  }

  if (
    sessionStorage.getItem(
      marcador
    ) === "ok"
  ) {
    return false;
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

    sessionStorage.setItem(
      marcador,
      "ok"
    );
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

  sessionStorage.setItem(
    marcador,
    "ok"
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

          conhecidos.set(
            chave,
            atual
          );

          return [
            {
              chave,
              valor,
              updated_by:
                usuarioId,
              updated_at:
                new Date().toISOString(),
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
          usuarioId
        );
        conhecidos.set(item.chave, serializar(confirmado));
      }

      if (comuns.length > 0) {
        const resultado = await cliente
          .from("erp_dados")
          .upsert(comuns, { onConflict: "chave" });
        if (resultado.error) throw resultado.error;
      }
    } catch (falha) {
      erro = falha;
    }

    enviando = false;

    if (!erro) {
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
      window.dispatchEvent(
        new CustomEvent("financeiro-sincronizacao-erro", {
          detail: { erro },
        })
      );
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
          novo.updated_by ===
            usuarioId ||
          !CHAVES_COMPARTILHADAS.includes(
            novo.chave as (typeof CHAVES_COMPARTILHADAS)[number]
          )
        ) {
          return;
        }

        salvarValorLocal(
          novo.chave,
          novo.valor
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
                valor: novo.valor,
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

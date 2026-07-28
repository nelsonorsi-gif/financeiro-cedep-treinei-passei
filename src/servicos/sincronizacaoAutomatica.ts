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
] as const;

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

  const contasLocais = (
    lerValorLocal(
      "financeiro-cedep-contas"
    ) ?? []
  ) as Conta[];

  if (
    podeEditar &&
    contasLocais.length > 0
  ) {
    await sincronizarContasLocais({
      contas: contasLocais,
      usuarioId,
      perfil,
    });
  }

  const contasNuvem =
    await carregarContasEstruturadas();
  if (
    contasNuvem &&
    contasNuvem.length > 0
  ) {
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

    const { error } =
      await cliente
        .from("erp_dados")
        .upsert(alterados, {
          onConflict: "chave",
        });

    enviando = false;

    if (!error) {
      localStorage.setItem(
        "financeiro-cedep-ultima-sincronizacao",
        new Date().toLocaleString(
          "pt-BR"
        )
      );
    } else {
      console.error(
        "Erro na sincronização automática:",
        error
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

  let recargaAgendada:
    number | undefined;

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

        if (
          recargaAgendada !==
          undefined
        ) {
          window.clearTimeout(
            recargaAgendada
          );
        }

        recargaAgendada =
          window.setTimeout(
            () =>
              window.location.reload(),
            900
          );
      }
    )
    .subscribe();

  return () => {
    window.clearInterval(
      intervalo
    );
    if (
      recargaAgendada !==
      undefined
    ) {
      window.clearTimeout(
        recargaAgendada
      );
    }
    void cliente.removeChannel(
      canal
    );
  };
}

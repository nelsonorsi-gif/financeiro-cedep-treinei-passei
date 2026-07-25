import {
  supabase,
  supabaseConfigurado,
} from "../lib/supabase";

export const PREFIXO_DADOS_ERP =
  "financeiro-cedep-";

export type PacoteDadosERP = {
  versao: 1;
  criadoEm: string;
  dados: Record<
    string,
    unknown
  >;
};

export function criarPacoteLocal():
  PacoteDadosERP {
  const dados: Record<
    string,
    unknown
  > = {};

  for (
    let indice = 0;
    indice <
    localStorage.length;
    indice += 1
  ) {
    const chave =
      localStorage.key(
        indice
      );

    if (
      !chave ||
      !chave.startsWith(
        PREFIXO_DADOS_ERP
      )
    ) {
      continue;
    }

    const valor =
      localStorage.getItem(
        chave
      );

    if (valor === null) {
      continue;
    }

    try {
      dados[chave] =
        JSON.parse(valor);
    } catch {
      dados[chave] =
        valor;
    }
  }

  return {
    versao: 1,
    criadoEm:
      new Date().toISOString(),
    dados,
  };
}

export function restaurarPacoteLocal(
  pacote: PacoteDadosERP
) {
  Object.entries(
    pacote.dados
  ).forEach(
    ([chave, valor]) => {
      if (
        !chave.startsWith(
          PREFIXO_DADOS_ERP
        )
      ) {
        return;
      }

      localStorage.setItem(
        chave,
        typeof valor ===
          "string"
          ? valor
          : JSON.stringify(
              valor
            )
      );
    }
  );
}

function clienteObrigatorio() {
  if (
    !supabaseConfigurado ||
    !supabase
  ) {
    throw new Error(
      "O banco online ainda não foi configurado."
    );
  }

  return supabase;
}

export async function salvarNaNuvem() {
  const cliente =
    clienteObrigatorio();

  const {
    data: usuario,
  } =
    await cliente.auth.getUser();

  if (!usuario.user) {
    throw new Error(
      "Entre com seu usuário online antes de sincronizar."
    );
  }

  const pacote =
    criarPacoteLocal();

  const { error } =
    await cliente
      .from(
        "erp_snapshots"
      )
      .upsert(
        {
          user_id:
            usuario.user.id,
          payload: pacote,
          updated_at:
            new Date().toISOString(),
        },
        {
          onConflict:
            "user_id",
        }
      );

  if (error) {
    throw error;
  }

  return pacote.criadoEm;
}

export async function carregarDaNuvem() {
  const cliente =
    clienteObrigatorio();

  const {
    data: usuario,
  } =
    await cliente.auth.getUser();

  if (!usuario.user) {
    throw new Error(
      "Entre com seu usuário online antes de sincronizar."
    );
  }

  const {
    data,
    error,
  } = await cliente
    .from("erp_snapshots")
    .select("payload")
    .eq(
      "user_id",
      usuario.user.id
    )
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data?.payload) {
    return null;
  }

  const pacote =
    data.payload as PacoteDadosERP;

  restaurarPacoteLocal(
    pacote
  );

  return pacote;
}

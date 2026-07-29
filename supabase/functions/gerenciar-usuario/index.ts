import {
  createClient,
} from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const responder = (
  corpo: Record<string, unknown>,
  status = 200
) =>
  new Response(
    JSON.stringify(corpo),
    {
      status,
      headers: {
        ...cors,
        "Content-Type":
          "application/json",
      },
    }
  );

Deno.serve(async (requisicao) => {
  if (
    requisicao.method ===
    "OPTIONS"
  ) {
    return new Response("ok", {
      headers: cors,
    });
  }

  try {
    const url =
      Deno.env.get(
        "SUPABASE_URL"
      );
    const chaveServico =
      Deno.env.get(
        "SUPABASE_SERVICE_ROLE_KEY"
      );
    const autorizacao =
      requisicao.headers.get(
        "Authorization"
      );

    if (
      !url ||
      !chaveServico ||
      !autorizacao
    ) {
      return responder(
        {
          erro:
            "Configuração ou autenticação ausente.",
        },
        401
      );
    }

    const admin = createClient(
      url,
      chaveServico,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );
    const token =
      autorizacao.replace(
        /^Bearer\s+/i,
        ""
      );
    const {
      data: autenticacao,
      error: erroAutenticacao,
    } =
      await admin.auth.getUser(
        token
      );

    if (
      erroAutenticacao ||
      !autenticacao.user
    ) {
      return responder(
        {
          erro:
            "Sessão inválida.",
        },
        401
      );
    }

    const {
      data: solicitante,
      error: erroPerfil,
    } = await admin
      .from("profiles")
      .select("perfil, ativo")
      .eq(
        "id",
        autenticacao.user.id
      )
      .single();

    if (
      erroPerfil ||
      solicitante?.perfil !==
        "Administrador" ||
      !solicitante.ativo
    ) {
      return responder(
        {
          erro:
            "Somente o administrador pode gerenciar usuários.",
        },
        403
      );
    }

    const corpo =
      await requisicao.json();

    if (
      corpo.acao ===
      "alterar-status"
    ) {
      if (
        !corpo.id ||
        corpo.id ===
          autenticacao.user.id
      ) {
        return responder(
          {
            erro:
              "Usuário inválido.",
          },
          400
        );
      }

      const { error } =
        await admin
          .from("profiles")
          .update({
            ativo:
              Boolean(
                corpo.ativo
              ),
            updated_at:
              new Date().toISOString(),
          })
          .eq("id", corpo.id);

      if (error) {
        throw error;
      }

      return responder({
        sucesso: true,
      });
    }

    if (
      corpo.acao !==
      "salvar"
    ) {
      return responder(
        {
          erro:
            "Ação inválida.",
        },
        400
      );
    }

    const email = String(
      corpo.email ?? ""
    )
      .trim()
      .toLowerCase();
    const nome = String(
      corpo.nome ?? ""
    ).trim();
    const senha =
      typeof corpo.senha ===
        "string"
        ? corpo.senha
        : "";

    if (
      !email ||
      !nome ||
      (!corpo.id &&
        senha.length < 6)
    ) {
      return responder(
        {
          erro:
            "Nome, e-mail e senha válida são obrigatórios.",
        },
        400
      );
    }

    let id =
      typeof corpo.id ===
      "string"
        ? corpo.id
        : "";

    if (id) {
      const atributos: {
        email: string;
        password?: string;
        user_metadata: {
          nome: string;
        };
      } = {
        email,
        user_metadata: {
          nome,
        },
      };

      if (senha.length >= 6) {
        atributos.password =
          senha;
      }

      const { error } =
        await admin.auth.admin
          .updateUserById(
            id,
            atributos
          );

      if (error) {
        throw error;
      }
    } else {
      const {
        data,
        error,
      } =
        await admin.auth.admin
          .createUser({
            email,
            password: senha,
            email_confirm: true,
            user_metadata: {
              nome,
            },
          });

      if (error || !data.user) {
        throw (
          error ??
          new Error(
            "Usuário não criado."
          )
        );
      }

      id = data.user.id;
    }

    const { error: erroSalvarPerfil } =
      await admin
        .from("profiles")
        .upsert({
          id,
          nome,
          perfil:
            corpo.perfil ??
            "Consulta",
          permissoes:
            Array.isArray(
              corpo.permissoes
            )
              ? corpo.permissoes
              : [],
          ativo:
            corpo.ativo !== false,
          updated_at:
            new Date().toISOString(),
        });

    if (erroSalvarPerfil) {
      throw erroSalvarPerfil;
    }

    return responder({
      sucesso: true,
      id,
    });
  } catch (erro) {
    return responder(
      {
        erro:
          erro instanceof Error
            ? erro.message
            : "Erro inesperado.",
      },
      400
    );
  }
});

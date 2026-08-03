import {
  createClient,
} from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SENHA_MINIMA = 8;

const emailValido = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    email
  );

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
    const chavePublica =
      Deno.env.get(
        "SUPABASE_ANON_KEY"
      );
    const autorizacao =
      requisicao.headers.get(
        "Authorization"
      );

    if (
      !url ||
      !chaveServico ||
      !chavePublica ||
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
    const clienteUsuario =
      createClient(
        url,
        chavePublica,
        {
          global: {
            headers: {
              Authorization:
                autorizacao,
            },
          },
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        }
      );
    const {
      data: autenticacao,
      error: erroAutenticacao,
    } =
      await clienteUsuario.auth.getUser(
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
      console.error(
        "Administrador não reconhecido:",
        JSON.stringify({
          id:
            autenticacao.user.id,
          email:
            autenticacao.user.email,
          perfil:
            solicitante?.perfil,
          ativo:
            solicitante?.ativo,
          erro:
            erroPerfil?.message,
        })
      );

      return responder(
        {
          erro:
            `Somente o administrador pode gerenciar usuários. Perfil online: ${
              solicitante?.perfil ??
              "não encontrado"
            }.`,
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
        senha.length < SENHA_MINIMA)
    ) {
      return responder(
        {
          erro:
            `Nome, e-mail e senha com pelo menos ${SENHA_MINIMA} caracteres são obrigatórios.`,
        },
        400
      );
    }

    if (!emailValido(email)) {
      return responder(
        {
          erro:
            "Informe um e-mail válido.",
        },
        400
      );
    }

    if (
      corpo.id &&
      senha.length > 0 &&
      senha.length < SENHA_MINIMA
    ) {
      return responder(
        {
          erro:
            `A nova senha deve ter pelo menos ${SENHA_MINIMA} caracteres.`,
        },
        400
      );
    }

    let id =
      typeof corpo.id ===
      "string"
        ? corpo.id
        : "";

    if (!id) {
      const {
        data: usuariosExistentes,
        error: erroListagem,
      } =
        await admin.auth.admin
          .listUsers({
            page: 1,
            perPage: 1000,
          });

      if (erroListagem) {
        throw erroListagem;
      }

      const existente =
        usuariosExistentes.users.find(
          (usuario) =>
            usuario.email
              ?.trim()
              .toLowerCase() ===
            email
        );

      if (existente) {
        id = existente.id;
      }
    }

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

      if (
        senha.length >= SENHA_MINIMA
      ) {
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
    const mensagem =
      erro instanceof Error
        ? erro.message
        : typeof erro === "object" &&
            erro !== null &&
            "message" in erro &&
            typeof erro.message ===
              "string"
          ? erro.message
          : typeof erro === "string"
            ? erro
            : "Erro inesperado.";

    console.error(
      "Falha ao gerenciar usuário:",
      mensagem,
      JSON.stringify(erro)
    );

    return responder(
      {
        erro: mensagem,
      },
      400
    );
  }
});

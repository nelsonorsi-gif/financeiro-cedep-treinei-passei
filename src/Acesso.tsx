import {
  useEffect,
  useState,
  type CSSProperties,
} from "react";
import {
  supabase,
  supabaseConfigurado,
} from "./lib/supabase";

export type Perfil =
  | "Administrador"
  | "Financeiro"
  | "Secretaria"
  | "Consulta";

type UsuarioSalvo = {
  id: string;
  nome: string;
  login: string;
  senhaHash: string;
  perfil: Perfil;
  permissoes: string[];
  ativo: boolean;
};

export type UsuarioSessao = Omit<
  UsuarioSalvo,
  "senhaHash"
>;

const CHAVE_USUARIOS =
  "financeiro-cedep-usuarios";
const CHAVE_SESSAO =
  "financeiro-cedep-sessao";

export const MODULOS_ERP = [
  "Dashboard",
  "Cadastros",
  "Professores",
  "Mensalidades",
  "Secretaria e Caixa",
  "Documentos",
  "Receitas",
  "Despesas",
  "Contas a Receber",
  "Contas a Pagar",
  "Bancos",
  "Importar Excel",
  "Relatórios",
  "Configurações",
  "Nuvem e Backup",
  "Usuários",
];

const permissoesPerfil = (
  perfil: Perfil
) => {
  if (perfil === "Administrador") {
    return [...MODULOS_ERP];
  }

  if (perfil === "Financeiro") {
    return [
      "Dashboard",
      "Receitas",
      "Despesas",
      "Contas a Receber",
      "Contas a Pagar",
      "Bancos",
      "Importar Excel",
      "Relatórios",
    ];
  }

  if (perfil === "Secretaria") {
    return [
      "Dashboard",
      "Cadastros",
      "Professores",
      "Mensalidades",
      "Secretaria e Caixa",
      "Documentos",
      "Contas a Receber",
    ];
  }

  return [
    "Dashboard",
    "Relatórios",
  ];
};

const hashSenha = async (
  senha: string
) => {
  const bytes =
    new TextEncoder().encode(
      senha
    );
  const hash =
    await crypto.subtle.digest(
      "SHA-256",
      bytes
    );

  return Array.from(
    new Uint8Array(hash)
  )
    .map((item) =>
      item
        .toString(16)
        .padStart(2, "0")
    )
    .join("");
};

const carregarUsuarios = () => {
  try {
    const salvos =
      localStorage.getItem(
        CHAVE_USUARIOS
      );
    return salvos
      ? (JSON.parse(
          salvos
        ) as UsuarioSalvo[])
      : [];
  } catch {
    return [];
  }
};

const salvarUsuarios = (
  usuarios: UsuarioSalvo[]
) =>
  localStorage.setItem(
    CHAVE_USUARIOS,
    JSON.stringify(usuarios)
  );

export const carregarSessao =
  (): UsuarioSessao | null => {
    try {
      const salva =
        sessionStorage.getItem(
          CHAVE_SESSAO
        );
      return salva
        ? JSON.parse(salva)
        : null;
    } catch {
      return null;
    }
  };

export const encerrarSessao = () =>
  sessionStorage.removeItem(
    CHAVE_SESSAO
  );

export const podeAcessar = (
  usuario: UsuarioSessao,
  modulo: string
) =>
  usuario.perfil ===
    "Administrador" ||
  usuario.permissoes.includes(
    modulo
  );

export async function carregarUsuarioOnline():
  Promise<UsuarioSessao | null> {
  if (
    !supabaseConfigurado ||
    !supabase
  ) {
    return null;
  }

  const {
    data: autenticacao,
  } =
    await supabase.auth.getUser();

  if (!autenticacao.user) {
    return null;
  }

  const {
    data: perfil,
    error,
  } = await supabase
    .from("profiles")
    .select(
      "nome, perfil, ativo"
    )
    .eq(
      "id",
      autenticacao.user.id
    )
    .single();

  if (error || !perfil) {
    throw new Error(
      "Não foi possível carregar o perfil online."
    );
  }

  if (!perfil.ativo) {
    await supabase.auth.signOut();
    throw new Error(
      "Este usuário está inativo."
    );
  }

  const perfilERP =
    perfil.perfil as Perfil;

  return {
    id: autenticacao.user.id,
    nome:
      perfil.nome ||
      autenticacao.user.email ||
      "Usuário",
    login:
      autenticacao.user.email ??
      "",
    perfil: perfilERP,
    permissoes:
      permissoesPerfil(
        perfilERP
      ),
    ativo: true,
  };
}

export async function encerrarSessaoOnline() {
  encerrarSessao();

  if (supabase) {
    await supabase.auth.signOut();
  }
}

export function TelaLoginOnline({
  onEntrar,
}: {
  onEntrar: (
    usuario: UsuarioSessao
  ) => void;
}) {
  const [email, setEmail] =
    useState("");
  const [senha, setSenha] =
    useState("");
  const [mensagem, setMensagem] =
    useState("");
  const [processando, setProcessando] =
    useState(false);

  const entrar = async () => {
    if (
      !supabase ||
      !email.trim() ||
      !senha
    ) {
      setMensagem(
        "Informe seu e-mail e sua senha."
      );
      return;
    }

    setProcessando(true);
    setMensagem("");

    try {
      const { error } =
        await supabase.auth
          .signInWithPassword({
            email:
              email.trim(),
            password: senha,
          });

      if (error) {
        throw error;
      }

      const usuario =
        await carregarUsuarioOnline();

      if (!usuario) {
        throw new Error(
          "Acesso online não encontrado."
        );
      }

      onEntrar(usuario);
    } catch (erro) {
      setMensagem(
        erro instanceof Error
          ? erro.message
          : "Não foi possível entrar."
      );
    } finally {
      setProcessando(false);
    }
  };

  return (
    <div style={estilos.paginaLogin}>
      <div style={estilos.caixaLogin}>
        <img
          src="/logo-cedep.png"
          alt="CEDEP Cursos"
          style={estilos.logo}
        />
        <h1>Entrar no ERP</h1>
        <p style={estilos.textoCinza}>
          Use seu e-mail e sua senha online.
        </p>
        <Campo
          label="E-mail"
          value={email}
          onChange={setEmail}
        />
        <Campo
          label="Senha"
          type="password"
          value={senha}
          onChange={setSenha}
          enter={entrar}
        />
        {mensagem && (
          <div style={estilos.mensagem}>
            {mensagem}
          </div>
        )}
        <button
          onClick={entrar}
          disabled={processando}
          style={estilos.botaoPrincipal}
        >
          {processando
            ? "Entrando..."
            : "Entrar"}
        </button>
      </div>
    </div>
  );
}

export function TelaLogin({
  onEntrar,
}: {
  onEntrar: (
    usuario: UsuarioSessao
  ) => void;
}) {
  const [usuarios, setUsuarios] =
    useState<UsuarioSalvo[]>(
      carregarUsuarios()
    );
  const [nome, setNome] =
    useState("");
  const [login, setLogin] =
    useState("");
  const [senha, setSenha] =
    useState("");
  const [mensagem, setMensagem] =
    useState("");

  const primeiroAcesso =
    usuarios.length === 0;

  const criarAdministrador =
    async () => {
      if (
        !nome.trim() ||
        !login.trim() ||
        senha.length < 6
      ) {
        setMensagem(
          "Preencha os campos e use uma senha com pelo menos 6 caracteres."
        );
        return;
      }

      const usuario: UsuarioSalvo =
        {
          id: `usuario-${Date.now()}`,
          nome: nome.trim(),
          login:
            login
              .trim()
              .toLowerCase(),
          senhaHash:
            await hashSenha(
              senha
            ),
          perfil:
            "Administrador",
          permissoes: [
            ...MODULOS_ERP,
          ],
          ativo: true,
        };

      salvarUsuarios([usuario]);
      setUsuarios([usuario]);
      setSenha("");
      setMensagem(
        "Administrador criado. Faça o login."
      );
    };

  const entrar = async () => {
    const senhaHash =
      await hashSenha(senha);
    const usuario =
      usuarios.find(
        (item) =>
          item.login ===
            login
              .trim()
              .toLowerCase() &&
          item.senhaHash ===
            senhaHash
      );

    if (!usuario) {
      setMensagem(
        "Usuário ou senha inválidos."
      );
      return;
    }

    if (!usuario.ativo) {
      setMensagem(
        "Este usuário está inativo."
      );
      return;
    }

    const {
      senhaHash: _senha,
      ...sessao
    } = usuario;

    sessionStorage.setItem(
      CHAVE_SESSAO,
      JSON.stringify(sessao)
    );
    onEntrar(sessao);
  };

  return (
    <div
      style={
        estilos.paginaLogin
      }
    >
      <div
        style={
          estilos.caixaLogin
        }
      >
        <img
          src="/logo-cedep.png"
          alt="CEDEP Cursos"
          style={
            estilos.logo
          }
        />
        <h1>
          {primeiroAcesso
            ? "Primeiro acesso"
            : "Entrar no ERP"}
        </h1>
        <p
          style={
            estilos.textoCinza
          }
        >
          {primeiroAcesso
            ? "Crie o administrador inicial do sistema."
            : "Use seu usuário e senha."}
        </p>

        {primeiroAcesso && (
          <Campo
            label="Nome"
            value={nome}
            onChange={setNome}
          />
        )}
        <Campo
          label="Usuário"
          value={login}
          onChange={setLogin}
        />
        <Campo
          label="Senha"
          type="password"
          value={senha}
          onChange={setSenha}
          enter={
            primeiroAcesso
              ? criarAdministrador
              : entrar
          }
        />

        {mensagem && (
          <div
            style={
              estilos.mensagem
            }
          >
            {mensagem}
          </div>
        )}

        <button
          onClick={
            primeiroAcesso
              ? criarAdministrador
              : entrar
          }
          style={
            estilos.botaoPrincipal
          }
        >
          {primeiroAcesso
            ? "Criar administrador"
            : "Entrar"}
        </button>
      </div>
    </div>
  );
}

export function Usuarios({
  usuarioAtual,
}: {
  usuarioAtual: UsuarioSessao;
}) {
  const [usuarios, setUsuarios] =
    useState<UsuarioSalvo[]>([]);
  const [nome, setNome] =
    useState("");
  const [login, setLogin] =
    useState("");
  const [senha, setSenha] =
    useState("");
  const [perfil, setPerfil] =
    useState<Perfil>(
      "Secretaria"
    );
  const [permissoes, setPermissoes] =
    useState<string[]>(
      permissoesPerfil(
        "Secretaria"
      )
    );
  const [editando, setEditando] =
    useState<string | null>(null);

  useEffect(() => {
    setUsuarios(
      carregarUsuarios()
    );
  }, []);

  if (
    usuarioAtual.perfil !==
    "Administrador"
  ) {
    return (
      <div>
        Acesso restrito ao
        administrador.
      </div>
    );
  }

  const limpar = () => {
    setNome("");
    setLogin("");
    setSenha("");
    setPerfil("Secretaria");
    setPermissoes(
      permissoesPerfil(
        "Secretaria"
      )
    );
    setEditando(null);
  };

  const mudarPerfil = (
    novoPerfil: Perfil
  ) => {
    setPerfil(novoPerfil);
    setPermissoes(
      permissoesPerfil(
        novoPerfil
      )
    );
  };

  const salvar = async () => {
    if (
      !nome.trim() ||
      !login.trim()
    ) {
      alert(
        "Informe nome e usuário."
      );
      return;
    }

    const existente =
      usuarios.find(
        (item) =>
          item.login ===
            login
              .trim()
              .toLowerCase() &&
          item.id !== editando
      );

    if (existente) {
      alert(
        "Este nome de usuário já existe."
      );
      return;
    }

    if (
      !editando &&
      senha.length < 6
    ) {
      alert(
        "A senha deve ter pelo menos 6 caracteres."
      );
      return;
    }

    const anterior =
      usuarios.find(
        (item) =>
          item.id === editando
      );

    const registro: UsuarioSalvo =
      {
        id:
          editando ??
          `usuario-${Date.now()}`,
        nome: nome.trim(),
        login:
          login
            .trim()
            .toLowerCase(),
        senhaHash:
          senha.length >= 6
            ? await hashSenha(
                senha
              )
            : anterior?.senhaHash ??
              "",
        perfil,
        permissoes:
          perfil ===
          "Administrador"
            ? [...MODULOS_ERP]
            : permissoes,
        ativo:
          anterior?.ativo ??
          true,
      };

    const novos = editando
      ? usuarios.map((item) =>
          item.id === editando
            ? registro
            : item
        )
      : [
          ...usuarios,
          registro,
        ];

    setUsuarios(novos);
    salvarUsuarios(novos);
    limpar();
    alert("Usuário salvo.");
  };

  const editar = (
    usuario: UsuarioSalvo
  ) => {
    setEditando(usuario.id);
    setNome(usuario.nome);
    setLogin(usuario.login);
    setSenha("");
    setPerfil(usuario.perfil);
    setPermissoes([
      ...usuario.permissoes,
    ]);
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const alternar = (
    id: string
  ) => {
    if (
      id === usuarioAtual.id
    ) {
      alert(
        "Você não pode inativar seu próprio usuário."
      );
      return;
    }

    const novos =
      usuarios.map((item) =>
        item.id === id
          ? {
              ...item,
              ativo: !item.ativo,
            }
          : item
      );
    setUsuarios(novos);
    salvarUsuarios(novos);
  };

  const alternarPermissao = (
    modulo: string
  ) =>
    setPermissoes((atuais) =>
      atuais.includes(modulo)
        ? atuais.filter(
            (item) =>
              item !== modulo
          )
        : [...atuais, modulo]
    );

  return (
    <div>
      <header
        style={{
          marginBottom: 25,
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: 32,
          }}
        >
          Usuários e Permissões
        </h1>
        <p
          style={
            estilos.textoCinza
          }
        >
          Controle os acessos de
          cada pessoa ao ERP.
        </p>
      </header>

      <section
        style={
          estilos.caixa
        }
      >
        <h2>
          {editando
            ? "Editar usuário"
            : "Novo usuário"}
        </h2>
        <div
          style={
            estilos.formGrid
          }
        >
          <Campo
            label="Nome"
            value={nome}
            onChange={setNome}
          />
          <Campo
            label="Usuário"
            value={login}
            onChange={setLogin}
          />
          <Campo
            label={
              editando
                ? "Nova senha (opcional)"
                : "Senha"
            }
            type="password"
            value={senha}
            onChange={setSenha}
          />
          <label
            style={
              estilos.campoGrupo
            }
          >
            <strong>Perfil</strong>
            <select
              value={perfil}
              onChange={(evento) =>
                mudarPerfil(
                  evento.target
                    .value as Perfil
                )
              }
              style={
                estilos.input
              }
            >
              <option>
                Administrador
              </option>
              <option>
                Financeiro
              </option>
              <option>
                Secretaria
              </option>
              <option>
                Consulta
              </option>
            </select>
          </label>
        </div>

        <h3>Permissões</h3>
        <div
          style={
            estilos.permissoes
          }
        >
          {MODULOS_ERP.map(
            (modulo) => (
              <label
                key={modulo}
                style={
                  estilos.permissao
                }
              >
                <input
                  type="checkbox"
                  checked={
                    perfil ===
                      "Administrador" ||
                    permissoes.includes(
                      modulo
                    )
                  }
                  disabled={
                    perfil ===
                    "Administrador"
                  }
                  onChange={() =>
                    alternarPermissao(
                      modulo
                    )
                  }
                />
                {modulo}
              </label>
            )
          )}
        </div>

        <div
          style={
            estilos.acoes
          }
        >
          <button
            onClick={salvar}
            style={
              estilos.botaoPrincipal
            }
          >
            Salvar usuário
          </button>
          {editando && (
            <button
              onClick={limpar}
              style={
                estilos.botaoSecundario
              }
            >
              Cancelar edição
            </button>
          )}
        </div>
      </section>

      <section
        style={{
          ...estilos.caixa,
          marginTop: 25,
        }}
      >
        <h2>
          Usuários cadastrados
        </h2>
        {usuarios.map((usuario) => (
          <div
            key={usuario.id}
            style={
              estilos.registro
            }
          >
            <div>
              <strong>
                {usuario.nome}
              </strong>
              <div
                style={
                  estilos.textoCinza
                }
              >
                {usuario.login} •{" "}
                {usuario.perfil}
              </div>
            </div>
            <div
              style={
                estilos.acoes
              }
            >
              <span
                style={{
                  ...estilos.status,
                  background:
                    usuario.ativo
                      ? "#dcfce7"
                      : "#e5e7eb",
                }}
              >
                {usuario.ativo
                  ? "Ativo"
                  : "Inativo"}
              </span>
              <button
                onClick={() =>
                  editar(usuario)
                }
                style={
                  estilos.botaoEditar
                }
              >
                Editar
              </button>
              <button
                onClick={() =>
                  alternar(
                    usuario.id
                  )
                }
                style={
                  estilos.botaoSecundario
                }
              >
                {usuario.ativo
                  ? "Inativar"
                  : "Ativar"}
              </button>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

function Campo({
  label,
  value,
  onChange,
  type = "text",
  enter,
}: {
  label: string;
  value: string;
  onChange: (
    valor: string
  ) => void;
  type?: string;
  enter?: () => void;
}) {
  return (
    <label
      style={
        estilos.campoGrupo
      }
    >
      <strong>{label}</strong>
      <input
        type={type}
        value={value}
        onChange={(evento) =>
          onChange(
            evento.target.value
          )
        }
        onKeyDown={(evento) => {
          if (
            evento.key === "Enter"
          ) {
            enter?.();
          }
        }}
        style={estilos.input}
      />
    </label>
  );
}

const estilos: Record<
  string,
  CSSProperties
> = {
  paginaLogin: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: 24,
    background:
      "linear-gradient(135deg,#101a2d,#263858)",
    fontFamily:
      "Arial, Helvetica, sans-serif",
  },
  caixaLogin: {
    width: "100%",
    maxWidth: 430,
    padding: 34,
    borderRadius: 20,
    background: "white",
    boxShadow:
      "0 20px 60px rgba(0,0,0,.25)",
  },
  logo: {
    display: "block",
    width: 180,
    margin: "0 auto 24px",
  },
  textoCinza: {
    color: "#657084",
    lineHeight: 1.6,
  },
  mensagem: {
    marginTop: 18,
    padding: 12,
    borderRadius: 9,
    background: "#fef3c7",
    color: "#92400e",
  },
  campoGrupo: {
    display: "flex",
    flexDirection: "column",
    gap: 7,
    marginTop: 16,
  },
  input: {
    width: "100%",
    padding: "13px 14px",
    border:
      "1px solid #ccd3dd",
    borderRadius: 9,
    boxSizing: "border-box",
    fontSize: 15,
  },
  botaoPrincipal: {
    marginTop: 22,
    background: "#15803d",
    color: "white",
    border: "none",
    borderRadius: 9,
    padding: "13px 20px",
    cursor: "pointer",
    fontWeight: "bold",
  },
  botaoSecundario: {
    background: "white",
    border:
      "1px solid #ccd3dd",
    borderRadius: 8,
    padding: "9px 12px",
    cursor: "pointer",
  },
  caixa: {
    padding: 28,
    borderRadius: 17,
    background: "white",
    boxShadow:
      "0 6px 18px rgba(0,0,0,.06)",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit,minmax(220px,1fr))",
    gap: 18,
  },
  permissoes: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit,minmax(190px,1fr))",
    gap: 10,
  },
  permissao: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 8,
    background: "#f4f6f8",
  },
  acoes: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    flexWrap: "wrap",
  },
  registro: {
    display: "flex",
    justifyContent:
      "space-between",
    alignItems: "center",
    gap: 15,
    flexWrap: "wrap",
    padding: "16px 0",
    borderBottom:
      "1px solid #e8ebef",
  },
  status: {
    padding: "7px 10px",
    borderRadius: 20,
    color: "#166534",
    fontSize: 13,
    fontWeight: "bold",
  },
  botaoEditar: {
    background: "#2563eb",
    color: "white",
    border: "none",
    borderRadius: 8,
    padding: "9px 12px",
    cursor: "pointer",
  },
};

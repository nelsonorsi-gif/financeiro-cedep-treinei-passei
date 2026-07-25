import {
  useEffect,
  useState,
  type CSSProperties,
} from "react";
import type {
  Session,
} from "@supabase/supabase-js";

import {
  supabase,
  supabaseConfigurado,
} from "./lib/supabase";
import {
  carregarDaNuvem,
  salvarNaNuvem,
} from "./servicos/nuvem";

function mensagemErro(
  erro: unknown
) {
  return erro instanceof Error
    ? erro.message
    : "Não foi possível concluir a operação.";
}

function Nuvem() {
  const [sessao, setSessao] =
    useState<Session | null>(
      null
    );
  const [email, setEmail] =
    useState("");
  const [senha, setSenha] =
    useState("");
  const [nome, setNome] =
    useState("");
  const [mensagem, setMensagem] =
    useState("");
  const [processando, setProcessando] =
    useState(false);
  const [
    ultimaSincronizacao,
    setUltimaSincronizacao,
  ] = useState(
    localStorage.getItem(
      "financeiro-cedep-ultima-sincronizacao"
    ) ?? ""
  );

  useEffect(() => {
    if (!supabase) {
      return;
    }

    void supabase.auth
      .getSession()
      .then(({ data }) =>
        setSessao(
          data.session
        )
      );

    const {
      data: assinatura,
    } =
      supabase.auth.onAuthStateChange(
        (_evento, novaSessao) =>
          setSessao(
            novaSessao
          )
      );

    return () =>
      assinatura.subscription.unsubscribe();
  }, []);

  const criarAcesso = async () => {
    if (
      !supabase ||
      !email.trim() ||
      senha.length < 8 ||
      !nome.trim()
    ) {
      setMensagem(
        "Informe nome, e-mail e uma senha com pelo menos 8 caracteres."
      );
      return;
    }

    setProcessando(true);
    setMensagem("");

    try {
      const { data, error } =
        await supabase.auth.signUp({
          email:
            email.trim(),
          password: senha,
          options: {
            data: {
              nome:
                nome.trim(),
            },
          },
        });

      if (error) {
        throw error;
      }

      setMensagem(
        data.session
          ? "Acesso online criado e conectado."
          : "Acesso criado. Confirme o e-mail recebido antes de entrar."
      );
      setSenha("");
    } catch (erro) {
      setMensagem(
        mensagemErro(erro)
      );
    } finally {
      setProcessando(false);
    }
  };

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

      setMensagem(
        "Acesso online realizado."
      );
      setSenha("");
    } catch (erro) {
      setMensagem(
        mensagemErro(erro)
      );
    } finally {
      setProcessando(false);
    }
  };

  const salvar = async () => {
    setProcessando(true);
    setMensagem(
      "Enviando dados para a nuvem..."
    );

    try {
      const data =
        await salvarNaNuvem();
      const dataTela =
        new Date(
          data
        ).toLocaleString(
          "pt-BR"
        );

      localStorage.setItem(
        "financeiro-cedep-ultima-sincronizacao",
        dataTela
      );
      setUltimaSincronizacao(
        dataTela
      );
      setMensagem(
        "Dados salvos na nuvem com sucesso."
      );
    } catch (erro) {
      setMensagem(
        mensagemErro(erro)
      );
    } finally {
      setProcessando(false);
    }
  };

  const restaurar = async () => {
    const confirmar =
      window.confirm(
        "Restaurar a cópia da nuvem substituirá os dados deste navegador. Deseja continuar?"
      );

    if (!confirmar) {
      return;
    }

    setProcessando(true);
    setMensagem(
      "Restaurando dados..."
    );

    try {
      const pacote =
        await carregarDaNuvem();

      if (!pacote) {
        setMensagem(
          "Ainda não existe uma cópia salva na nuvem."
        );
        return;
      }

      alert(
        "Dados restaurados. O ERP será atualizado agora."
      );
      window.location.reload();
    } catch (erro) {
      setMensagem(
        mensagemErro(erro)
      );
    } finally {
      setProcessando(false);
    }
  };

  const sair = async () => {
    if (!supabase) {
      return;
    }

    await supabase.auth.signOut();
    setMensagem(
      "Acesso online encerrado."
    );
  };

  if (!supabaseConfigurado) {
    return (
      <section style={estilos.caixa}>
        <h1>Nuvem e Backup</h1>
        <p style={estilos.aviso}>
          O banco online ainda não foi configurado neste computador.
        </p>
      </section>
    );
  }

  return (
    <div>
      <header style={estilos.cabecalho}>
        <div>
          <h1 style={{ margin: 0 }}>
            Nuvem e Backup
          </h1>
          <p style={estilos.textoCinza}>
            Os dados operacionais são sincronizados automaticamente entre os usuários autorizados.
          </p>
        </div>
        <span
          style={{
            ...estilos.status,
            background:
              sessao
                ? "#dcfce7"
                : "#fef3c7",
            color:
              sessao
                ? "#166534"
                : "#92400e",
          }}
        >
          {sessao
            ? "Conectado"
            : "Desconectado"}
        </span>
      </header>

      {!sessao ? (
        <section style={estilos.caixa}>
          <h2>Acesso online</h2>
          <p style={estilos.textoCinza}>
            Use um e-mail válido. Este acesso é diferente do login local atual.
          </p>

          <div style={estilos.formGrid}>
            <Campo
              label="Nome"
              value={nome}
              onChange={setNome}
              placeholder="Seu nome completo"
            />
            <Campo
              label="E-mail"
              value={email}
              onChange={setEmail}
              type="email"
              placeholder="nome@exemplo.com"
            />
            <Campo
              label="Senha online"
              value={senha}
              onChange={setSenha}
              type="password"
              placeholder="Mínimo de 8 caracteres"
            />
          </div>

          <div style={estilos.botoes}>
            <button
              onClick={entrar}
              disabled={processando}
              style={estilos.botaoPrincipal}
            >
              Entrar na nuvem
            </button>
            <button
              onClick={criarAcesso}
              disabled={processando}
              style={estilos.botaoSecundario}
            >
              Criar acesso online
            </button>
          </div>
        </section>
      ) : (
        <>
          <section style={estilos.cards}>
            <div style={estilos.card}>
              <span style={estilos.textoCinza}>
                Usuário online
              </span>
              <strong>
                {sessao.user.email}
              </strong>
            </div>
            <div style={estilos.card}>
              <span style={estilos.textoCinza}>
                Última sincronização
              </span>
              <strong>
                {ultimaSincronizacao ||
                  "Ainda não realizada"}
              </strong>
            </div>
          </section>

          <section
            style={{
              ...estilos.caixa,
              marginTop: 22,
            }}
          >
            <h2>
              Sincronização automática ativa
            </h2>
            <p style={estilos.textoCinza}>
              Alterações em alunos, mensalidades, contas, professores, caixa e lançamentos são enviadas automaticamente. Os botões abaixo ficam disponíveis como cópia de segurança adicional.
            </p>

            <div style={estilos.botoes}>
              <button
                onClick={salvar}
                disabled={processando}
                style={estilos.botaoPrincipal}
              >
                Criar cópia de segurança agora
              </button>
              <button
                onClick={restaurar}
                disabled={processando}
                style={estilos.botaoSecundario}
              >
                Restaurar cópia de segurança
              </button>
              <button
                onClick={sair}
                disabled={processando}
                style={estilos.botaoSair}
              >
                Sair da nuvem
              </button>
            </div>
          </section>
        </>
      )}

      {mensagem && (
        <div style={estilos.mensagem}>
          {mensagem}
        </div>
      )}
    </div>
  );
}

function Campo({
  label,
  value,
  onChange,
  type = "text",
  placeholder = "",
}: {
  label: string;
  value: string;
  onChange: (
    valor: string
  ) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label style={estilos.campoGrupo}>
      <strong>{label}</strong>
      <input
        type={type}
        value={value}
        onChange={(evento) =>
          onChange(
            evento.target.value
          )
        }
        placeholder={placeholder}
        style={estilos.input}
      />
    </label>
  );
}

const estilos: Record<
  string,
  CSSProperties
> = {
  cabecalho: {
    display: "flex",
    alignItems: "center",
    justifyContent:
      "space-between",
    gap: 20,
    marginBottom: 25,
  },
  textoCinza: {
    color: "#657084",
    lineHeight: 1.6,
  },
  status: {
    padding: "9px 14px",
    borderRadius: 20,
    fontWeight: "bold",
  },
  caixa: {
    background: "white",
    padding: 28,
    borderRadius: 17,
    boxShadow:
      "0 6px 18px rgba(0,0,0,.06)",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit,minmax(220px,1fr))",
    gap: 18,
    marginTop: 20,
  },
  campoGrupo: {
    display: "flex",
    flexDirection: "column",
    gap: 7,
  },
  input: {
    padding: "13px 14px",
    border:
      "1px solid #ccd3dd",
    borderRadius: 9,
    fontSize: 15,
    boxSizing: "border-box",
    width: "100%",
  },
  botoes: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 24,
  },
  botaoPrincipal: {
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
    color: "#0d1b30",
    border:
      "1px solid #ccd3dd",
    borderRadius: 9,
    padding: "13px 20px",
    cursor: "pointer",
  },
  botaoSair: {
    background: "#b91c1c",
    color: "white",
    border: "none",
    borderRadius: 9,
    padding: "13px 20px",
    cursor: "pointer",
  },
  cards: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit,minmax(240px,1fr))",
    gap: 18,
  },
  card: {
    background: "white",
    padding: 22,
    borderRadius: 15,
    display: "flex",
    flexDirection: "column",
    gap: 12,
    boxShadow:
      "0 6px 18px rgba(0,0,0,.06)",
  },
  mensagem: {
    marginTop: 20,
    padding: 16,
    background: "#eef2f7",
    borderRadius: 10,
    color: "#334155",
  },
  aviso: {
    background: "#fef3c7",
    color: "#92400e",
    padding: 16,
    borderRadius: 10,
  },
};

export default Nuvem;

import {
  useEffect,
  useState,
  type CSSProperties,
} from "react";

export type ConfiguracoesFinanceiras = {
  bancos: string[];
  tiposEntrada: string[];
  tiposSaida: string[];
  unidades: string[];
};

export const CHAVE_CONFIGURACOES =
  "financeiro-cedep-configuracoes";

export const CONFIGURACOES_PADRAO: ConfiguracoesFinanceiras =
  {
    bancos: [
      "SICOOB",
      "INTER",
      "PIX",
      "DINHEIRO",
    ],

    tiposEntrada: [
      "Parcela",
      "Mensalidade",
      "Matrícula",
      "Material",
      "Inscrição",
      "Outros",
    ],

    tiposSaida: [
      "Energia",
      "Internet",
      "Salários",
      "Impostos",
      "Marketing",
      "Material",
      "Aluguel",
      "Combustível",
      "Manutenção",
      "Outros",
    ],

    unidades: [
      "CEDEP",
      "TREINEI, PASSEI!",
      "PARTICULAR",
    ],
  };

export function carregarConfiguracoes(): ConfiguracoesFinanceiras {
  try {
    const salvas =
      localStorage.getItem(
        CHAVE_CONFIGURACOES
      );

    if (salvas) {
      const dados =
        JSON.parse(salvas);

      return {
        bancos:
          Array.isArray(
            dados.bancos
          )
            ? dados.bancos
            : CONFIGURACOES_PADRAO.bancos,

        tiposEntrada:
          Array.isArray(
            dados.tiposEntrada
          )
            ? dados.tiposEntrada
            : CONFIGURACOES_PADRAO.tiposEntrada,

        tiposSaida:
          Array.isArray(
            dados.tiposSaida
          )
            ? dados.tiposSaida
            : CONFIGURACOES_PADRAO.tiposSaida,

        unidades:
          Array.isArray(
            dados.unidades
          )
            ? dados.unidades
            : CONFIGURACOES_PADRAO.unidades,
      };
    }
  } catch (erro) {
    console.error(
      "Erro ao carregar configurações:",
      erro
    );
  }

  return CONFIGURACOES_PADRAO;
}

function Configuracoes() {
  const [
    configuracoes,
    setConfiguracoes,
  ] =
    useState<ConfiguracoesFinanceiras>(
      CONFIGURACOES_PADRAO
    );

  const [
    novoBanco,
    setNovoBanco,
  ] = useState("");

  const [
    novaEntrada,
    setNovaEntrada,
  ] = useState("");

  const [
    novaSaida,
    setNovaSaida,
  ] = useState("");

  const [
    novaUnidade,
    setNovaUnidade,
  ] = useState("");

  useEffect(() => {
    setConfiguracoes(
      carregarConfiguracoes()
    );
  }, []);

  const salvar = (
    novosDados:
      ConfiguracoesFinanceiras
  ) => {
    setConfiguracoes(
      novosDados
    );

    localStorage.setItem(
      CHAVE_CONFIGURACOES,
      JSON.stringify(
        novosDados
      )
    );

    /*
      Avisa outras telas que
      as listas foram atualizadas.
    */
    window.dispatchEvent(
      new Event(
        "financeiro-config-atualizada"
      )
    );
  };

  const adicionar = (
    campo:
      | "bancos"
      | "tiposEntrada"
      | "tiposSaida"
      | "unidades",

    valor: string,

    limpar: () => void
  ) => {
    const texto =
      valor.trim();

    if (!texto) {
      alert(
        "Digite uma opção."
      );

      return;
    }

    const jaExiste =
      configuracoes[campo].some(
        (item) =>
          item.toLowerCase() ===
          texto.toLowerCase()
      );

    if (jaExiste) {
      alert(
        "Esta opção já está cadastrada."
      );

      return;
    }

    salvar({
      ...configuracoes,

      [campo]: [
        ...configuracoes[
          campo
        ],

        texto,
      ],
    });

    limpar();
  };

  const excluir = (
    campo:
      | "bancos"
      | "tiposEntrada"
      | "tiposSaida"
      | "unidades",

    valor: string
  ) => {
    const confirmar =
      window.confirm(
        `Deseja excluir "${valor}" da lista?`
      );

    if (!confirmar) {
      return;
    }

    salvar({
      ...configuracoes,

      [campo]:
        configuracoes[
          campo
        ].filter(
          (item) =>
            item !== valor
        ),
    });
  };

  const restaurarPadrao =
    () => {
      const confirmar =
        window.confirm(
          "Deseja restaurar as listas padrão?"
        );

      if (!confirmar) {
        return;
      }

      salvar(
        CONFIGURACOES_PADRAO
      );

      alert(
        "Listas padrão restauradas."
      );
    };

  const gerarBackup = () => {
    const dados: Record<
      string,
      string
    > = {};

    for (
      let indice = 0;
      indice <
      localStorage.length;
      indice++
    ) {
      const chave =
        localStorage.key(
          indice
        );

      if (
        chave?.startsWith(
          "financeiro-cedep-"
        )
      ) {
        const valor =
          localStorage.getItem(
            chave
          );

        if (valor !== null) {
          dados[chave] =
            valor;
        }
      }
    }

    const backup = {
      aplicacao:
        "financeiro-cedep",
      versao: 1,
      criadoEm:
        new Date().toISOString(),
      dados,
    };

    const arquivo = new Blob(
      [
        JSON.stringify(
          backup,
          null,
          2
        ),
      ],
      {
        type: "application/json",
      }
    );

    const endereco =
      URL.createObjectURL(
        arquivo
      );

    const link =
      document.createElement(
        "a"
      );

    const data =
      new Date()
        .toISOString()
        .slice(0, 10);

    link.href = endereco;
    link.download =
      `backup-financeiro-cedep-${data}.json`;
    link.click();

    URL.revokeObjectURL(
      endereco
    );
  };

  const restaurarBackup = async (
    arquivo: File
  ) => {
    try {
      const conteudo =
        await arquivo.text();

      const backup =
        JSON.parse(conteudo) as {
          aplicacao?: string;
          dados?: Record<
            string,
            unknown
          >;
        };

      if (
        backup.aplicacao !==
          "financeiro-cedep" ||
        !backup.dados ||
        typeof backup.dados !==
          "object"
      ) {
        throw new Error(
          "Arquivo incompatível"
        );
      }

      const entradas =
        Object.entries(
          backup.dados
        );

      const backupValido =
        entradas.every(
          ([chave, valor]) =>
            chave.startsWith(
              "financeiro-cedep-"
            ) &&
            typeof valor ===
              "string"
        );

      if (!backupValido) {
        throw new Error(
          "Conteúdo inválido"
        );
      }

      const confirmar =
        window.confirm(
          "A restauração substituirá os dados financeiros atuais deste navegador. Deseja continuar?"
        );

      if (!confirmar) {
        return;
      }

      const chavesAtuais: string[] =
        [];

      for (
        let indice = 0;
        indice <
        localStorage.length;
        indice++
      ) {
        const chave =
          localStorage.key(
            indice
          );

        if (
          chave?.startsWith(
            "financeiro-cedep-"
          )
        ) {
          chavesAtuais.push(
            chave
          );
        }
      }

      chavesAtuais.forEach(
        (chave) =>
          localStorage.removeItem(
            chave
          )
      );

      entradas.forEach(
        ([chave, valor]) => {
          localStorage.setItem(
            chave,
            valor as string
          );
        }
      );

      alert(
        "Backup restaurado com sucesso. O sistema será recarregado."
      );

      window.location.reload();
    } catch (erro) {
      console.error(
        "Erro ao restaurar backup:",
        erro
      );

      alert(
        "Não foi possível restaurar este arquivo. Selecione um backup gerado pelo próprio sistema."
      );
    }
  };

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
          Configurações
        </h1>

        <p
          style={
            estilos.textoCinza
          }
        >
          Cadastre as opções utilizadas
          no sistema financeiro.
        </p>
      </header>

      <div
        style={
          estilos.grade
        }
      >
        <ListaConfiguracao
          titulo="Bancos / Contas"
          itens={
            configuracoes.bancos
          }
          valorNovo={
            novoBanco
          }
          setValorNovo={
            setNovoBanco
          }
          adicionar={() =>
            adicionar(
              "bancos",
              novoBanco,
              () =>
                setNovoBanco(
                  ""
                )
            )
          }
          excluir={(valor) =>
            excluir(
              "bancos",
              valor
            )
          }
        />

        <ListaConfiguracao
          titulo="Tipos de Entrada"
          itens={
            configuracoes.tiposEntrada
          }
          valorNovo={
            novaEntrada
          }
          setValorNovo={
            setNovaEntrada
          }
          adicionar={() =>
            adicionar(
              "tiposEntrada",
              novaEntrada,
              () =>
                setNovaEntrada(
                  ""
                )
            )
          }
          excluir={(valor) =>
            excluir(
              "tiposEntrada",
              valor
            )
          }
        />

        <ListaConfiguracao
          titulo="Tipos de Saída"
          itens={
            configuracoes.tiposSaida
          }
          valorNovo={
            novaSaida
          }
          setValorNovo={
            setNovaSaida
          }
          adicionar={() =>
            adicionar(
              "tiposSaida",
              novaSaida,
              () =>
                setNovaSaida(
                  ""
                )
            )
          }
          excluir={(valor) =>
            excluir(
              "tiposSaida",
              valor
            )
          }
        />

        <ListaConfiguracao
          titulo="Unidades"
          itens={
            configuracoes.unidades
          }
          valorNovo={
            novaUnidade
          }
          setValorNovo={
            setNovaUnidade
          }
          adicionar={() =>
            adicionar(
              "unidades",
              novaUnidade,
              () =>
                setNovaUnidade(
                  ""
                )
            )
          }
          excluir={(valor) =>
            excluir(
              "unidades",
              valor
            )
          }
        />
      </div>

      <section
        style={{
          ...estilos.caixa,

          marginTop: 25,
        }}
      >
        <h2>
          Backup e restauração
        </h2>

        <p
          style={
            estilos.textoCinza
          }
        >
          Baixe uma cópia completa
          dos lançamentos, contas,
          importações e listas deste
          navegador. Guarde o arquivo
          em um local seguro.
        </p>

        <div
          style={
            estilos.acoesBackup
          }
        >
          <button
            onClick={
              gerarBackup
            }
            style={
              estilos.botaoBackup
            }
          >
            Baixar backup completo
          </button>

          <label
            style={
              estilos.botaoRestaurar
            }
          >
            Restaurar um backup

            <input
              type="file"
              accept=".json,application/json"
              style={{
                display: "none",
              }}
              onChange={(
                evento
              ) => {
                const arquivo =
                  evento.target
                    .files?.[0];

                if (arquivo) {
                  void restaurarBackup(
                    arquivo
                  );
                }

                evento.target.value =
                  "";
              }}
            />
          </label>
        </div>

        <div
          style={
            estilos.avisoBackup
          }
        >
          A restauração substitui os
          dados atuais somente depois
          da sua confirmação.
        </div>
      </section>

      <section
        style={{
          ...estilos.caixa,

          marginTop: 25,
        }}
      >
        <h2>
          Restaurar configurações
        </h2>

        <p
          style={
            estilos.textoCinza
          }
        >
          Este botão restaura apenas
          as listas de opções. Ele não
          apaga lançamentos financeiros.
        </p>

        <button
          onClick={
            restaurarPadrao
          }
          style={
            estilos.botaoSecundario
          }
        >
          Restaurar listas padrão
        </button>
      </section>
    </div>
  );
}

function ListaConfiguracao({
  titulo,
  itens,
  valorNovo,
  setValorNovo,
  adicionar,
  excluir,
}: {
  titulo: string;

  itens: string[];

  valorNovo: string;

  setValorNovo: (
    valor: string
  ) => void;

  adicionar: () => void;

  excluir: (
    valor: string
  ) => void;
}) {
  return (
    <section
      style={estilos.caixa}
    >
      <h2>{titulo}</h2>

      <div
        style={
          estilos.novoItem
        }
      >
        <input
          value={
            valorNovo
          }
          placeholder="Digite uma nova opção"
          onChange={(
            evento
          ) =>
            setValorNovo(
              evento.target.value
            )
          }
          onKeyDown={(
            evento
          ) => {
            if (
              evento.key ===
              "Enter"
            ) {
              adicionar();
            }
          }}
          style={estilos.input}
        />

        <button
          onClick={
            adicionar
          }
          style={
            estilos.botaoAdicionar
          }
        >
          Adicionar
        </button>
      </div>

      <div
        style={{
          marginTop: 20,
        }}
      >
        {itens.length === 0 ? (
          <p
            style={
              estilos.textoCinza
            }
          >
            Nenhuma opção cadastrada.
          </p>
        ) : (
          itens.map(
            (item) => (
              <div
                key={item}
                style={
                  estilos.itemLista
                }
              >
                <span>
                  {item}
                </span>

                <button
                  onClick={() =>
                    excluir(
                      item
                    )
                  }
                  style={
                    estilos.botaoExcluir
                  }
                >
                  Excluir
                </button>
              </div>
            )
          )
        )}
      </div>
    </section>
  );
}

const estilos: Record<
  string,
  CSSProperties
> = {
  textoCinza: {
    color: "#657084",
    lineHeight: 1.6,
  },

  grade: {
    display: "grid",

    gridTemplateColumns:
      "repeat(auto-fit,minmax(350px,1fr))",

    gap: 22,
  },

  caixa: {
    background: "white",

    padding: 25,

    borderRadius: 17,

    boxShadow:
      "0 6px 18px rgba(0,0,0,.06)",
  },

  novoItem: {
    display: "flex",

    gap: 10,

    alignItems: "center",
  },

  input: {
    flex: 1,

    padding: "12px 13px",

    border:
      "1px solid #ccd3dd",

    borderRadius: 9,

    fontSize: 15,

    boxSizing: "border-box",
  },

  botaoAdicionar: {
    background: "#15803d",

    color: "white",

    border: "none",

    borderRadius: 9,

    padding: "12px 16px",

    cursor: "pointer",

    fontWeight: "bold",
  },

  itemLista: {
    display: "flex",

    justifyContent:
      "space-between",

    alignItems: "center",

    gap: 15,

    padding: "12px 0",

    borderBottom:
      "1px solid #e8ebef",
  },

  botaoExcluir: {
    background: "#fee2e2",

    color: "#991b1b",

    border:
      "1px solid #fecaca",

    borderRadius: 7,

    padding: "7px 10px",

    cursor: "pointer",
  },

  acoesBackup: {
    display: "flex",

    gap: 12,

    flexWrap: "wrap",

    marginTop: 20,
  },

  botaoBackup: {
    background: "#15803d",

    color: "white",

    padding: "12px 18px",

    borderRadius: 9,

    border: "none",

    cursor: "pointer",

    fontWeight: "bold",
  },

  botaoRestaurar: {
    display: "inline-block",

    background: "#101a2d",

    color: "white",

    padding: "12px 18px",

    borderRadius: 9,

    cursor: "pointer",

    fontWeight: "bold",
  },

  avisoBackup: {
    marginTop: 18,

    padding: "12px 15px",

    borderRadius: 9,

    background: "#fef3c7",

    color: "#92400e",
  },

  botaoSecundario: {
    background: "white",

    color: "#0d1b30",

    padding: "12px 18px",

    borderRadius: 9,

    border:
      "1px solid #ccd3dd",

    cursor: "pointer",
  },
};

export default Configuracoes;

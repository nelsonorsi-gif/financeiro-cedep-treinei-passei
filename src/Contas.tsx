import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";

import {
  carregarConfiguracoes,
  type ConfiguracoesFinanceiras,
} from "./Configuracoes";

export type Conta = {
  id: string;

  descricao: string;

  valor: number;

  vencimento: string;

  categoria: string;

  banco: string;

  unidade: string;

  observacao: string;

  status:
    | "Pendente"
    | "Pago"
    | "Recebido";

  tipo:
    | "receber"
    | "pagar";
};

type Props = {
  tipo:
    | "receber"
    | "pagar";

  onBaixar: (
    conta: Conta
  ) => void;
};

export const CHAVE_CONTAS =
  "financeiro-cedep-contas";

const moeda = (
  valor: number
) =>
  valor.toLocaleString(
    "pt-BR",
    {
      style: "currency",

      currency: "BRL",
    }
  );

const converterNumero = (
  valor: string
) => {
  let texto = valor
    .replace("R$", "")
    .replace(/\s/g, "");

  if (
    texto.includes(",")
  ) {
    texto = texto
      .replace(/\./g, "")
      .replace(",", ".");
  }

  const numero =
    Number(texto);

  return Number.isFinite(
    numero
  )
    ? numero
    : 0;
};

function Contas({
  tipo,
  onBaixar,
}: Props) {
  const [
    contas,
    setContas,
  ] =
    useState<Conta[]>([]);

  const [
    carregado,
    setCarregado,
  ] = useState(false);

  const [
    configuracoes,
    setConfiguracoes,
  ] =
    useState<ConfiguracoesFinanceiras>(
      carregarConfiguracoes()
    );

  const [
    descricao,
    setDescricao,
  ] = useState("");

  const [
    valor,
    setValor,
  ] = useState("");

  const [
    vencimento,
    setVencimento,
  ] = useState("");

  const [
    categoria,
    setCategoria,
  ] = useState("");

  const [
    banco,
    setBanco,
  ] = useState("");

  const [
    unidade,
    setUnidade,
  ] = useState("CEDEP");

  const [
    observacao,
    setObservacao,
  ] = useState("");

  const [
    contaEditando,
    setContaEditando,
  ] =
    useState<string | null>(
      null
    );

  const [
    filtro,
    setFiltro,
  ] = useState("Todos");

  /* =======================================================
     CARREGAR CONTAS SALVAS
  ======================================================= */

  useEffect(() => {
    try {
      const salvas =
        localStorage.getItem(
          CHAVE_CONTAS
        );

      if (salvas) {
        setContas(
          JSON.parse(
            salvas
          )
        );
      }
    } catch (erro) {
      console.error(
        "Erro ao carregar contas:",
        erro
      );
    } finally {
      setCarregado(true);
    }
  }, []);

  /* =======================================================
     SALVAR AUTOMATICAMENTE
  ======================================================= */

  useEffect(() => {
    if (!carregado) {
      return;
    }

    localStorage.setItem(
      CHAVE_CONTAS,
      JSON.stringify(
        contas
      )
    );
  }, [
    contas,
    carregado,
  ]);

  /* =======================================================
     ATUALIZAR CONFIGURAÇÕES
  ======================================================= */

  useEffect(() => {
    const atualizarConfiguracoes =
      () => {
        setConfiguracoes(
          carregarConfiguracoes()
        );
      };

    window.addEventListener(
      "financeiro-config-atualizada",
      atualizarConfiguracoes
    );

    return () => {
      window.removeEventListener(
        "financeiro-config-atualizada",
        atualizarConfiguracoes
      );
    };
  }, []);

  /* =======================================================
     LIMPAR FORMULÁRIO
  ======================================================= */

  const limparFormulario =
    () => {
      setDescricao("");

      setValor("");

      setVencimento("");

      setCategoria("");

      setBanco("");

      setUnidade(
        "CEDEP"
      );

      setObservacao("");

      setContaEditando(
        null
      );
    };

  /* =======================================================
     SALVAR CONTA
  ======================================================= */

  const salvarConta =
    () => {
      const valorNumerico =
        converterNumero(
          valor
        );

      if (
        !descricao.trim()
      ) {
        alert(
          "Digite uma descrição."
        );

        return;
      }

      if (
        valorNumerico <= 0
      ) {
        alert(
          "Digite um valor válido."
        );

        return;
      }

      if (!vencimento) {
        alert(
          "Informe a data de vencimento."
        );

        return;
      }

      if (!categoria) {
        alert(
          tipo ===
          "receber"
            ? "Selecione um tipo de entrada."
            : "Selecione um tipo de saída."
        );

        return;
      }

      if (!banco) {
        alert(
          "Selecione um banco ou conta."
        );

        return;
      }

      if (!unidade) {
        alert(
          "Selecione uma unidade."
        );

        return;
      }

      const novaConta: Conta =
        {
          id:
            contaEditando ??
            `conta-${Date.now()}-${Math.random()}`,

          descricao:
            descricao.trim(),

          valor:
            valorNumerico,

          vencimento,

          categoria,

          banco,

          unidade,

          observacao:
            observacao.trim(),

          status:
            "Pendente",

          tipo,
        };

      if (
        contaEditando
      ) {
        setContas(
          (atuais) =>
            atuais.map(
              (conta) => {
                if (
                  conta.id !==
                  contaEditando
                ) {
                  return conta;
                }

                /*
                  Mantemos o status anterior.
                */
                return {
                  ...novaConta,

                  status:
                    conta.status,
                };
              }
            )
        );
      } else {
        setContas(
          (atuais) => [
            ...atuais,

            novaConta,
          ]
        );
      }

      const estavaEditando =
        Boolean(
          contaEditando
        );

      limparFormulario();

      alert(
        estavaEditando
          ? "Conta atualizada com sucesso."
          : "Conta cadastrada com sucesso."
      );
    };

  /* =======================================================
     EDITAR CONTA
  ======================================================= */

  const editarConta =
    (
      conta: Conta
    ) => {
      setContaEditando(
        conta.id
      );

      setDescricao(
        conta.descricao
      );

      setValor(
        String(
          conta.valor
        ).replace(
          ".",
          ","
        )
      );

      setVencimento(
        conta.vencimento
      );

      setCategoria(
        conta.categoria
      );

      setBanco(
        conta.banco
      );

      setUnidade(
        conta.unidade
      );

      setObservacao(
        conta.observacao
      );

      window.scrollTo({
        top: 0,

        behavior: "smooth",
      });
    };

  /* =======================================================
     EXCLUIR
  ======================================================= */

  const excluirConta =
    (
      conta: Conta
    ) => {
      const confirmar =
        window.confirm(
          `Deseja excluir "${conta.descricao}"?`
        );

      if (!confirmar) {
        return;
      }

      setContas(
        (atuais) =>
          atuais.filter(
            (item) =>
              item.id !==
              conta.id
          )
      );
    };

  /* =======================================================
     BAIXAR CONTA
  ======================================================= */

  const baixarConta =
    (
      conta: Conta
    ) => {
      if (
        conta.status !==
        "Pendente"
      ) {
        return;
      }

      const palavra =
        tipo ===
        "receber"
          ? "receber"
          : "pagar";

      const confirmar =
        window.confirm(
          `Confirma ${palavra} ${moeda(
            conta.valor
          )} referente a "${conta.descricao}"?`
        );

      if (!confirmar) {
        return;
      }

      const novoStatus:
        | "Recebido"
        | "Pago" =
        tipo ===
        "receber"
          ? "Recebido"
          : "Pago";

      setContas(
        (atuais) =>
          atuais.map(
            (item) =>
              item.id ===
              conta.id
                ? {
                    ...item,

                    status:
                      novoStatus,
                  }
                : item
          )
      );

      /*
        Envia para App.tsx
        para gerar receita ou despesa.
      */
      onBaixar({
        ...conta,

        status:
          novoStatus,
      });

      alert(
        tipo ===
        "receber"
          ? "Recebimento confirmado."
          : "Pagamento confirmado."
      );
    };

  /* =======================================================
     VERIFICAR VENCIMENTO
  ======================================================= */

  const hoje =
    new Date();

  hoje.setHours(
    0,
    0,
    0,
    0
  );

  const verificarVencida =
    (
      conta: Conta
    ) => {
      if (
        conta.status !==
        "Pendente"
      ) {
        return false;
      }

      const data =
        new Date(
          `${conta.vencimento}T00:00:00`
        );

      return data < hoje;
    };

  /* =======================================================
     FILTROS E TOTAIS
  ======================================================= */

  const contasDoTipo =
    contas.filter(
      (conta) =>
        conta.tipo === tipo
    );

  const contasFiltradas =
    useMemo(() => {
      return contasDoTipo.filter(
        (conta) => {
          if (
            filtro ===
            "Todos"
          ) {
            return true;
          }

          if (
            filtro ===
            "Pendentes"
          ) {
            return (
              conta.status ===
                "Pendente" &&
              !verificarVencida(
                conta
              )
            );
          }

          if (
            filtro ===
            "Vencidos"
          ) {
            return verificarVencida(
              conta
            );
          }

          if (
            filtro ===
              "Recebidos" ||
            filtro ===
              "Pagos"
          ) {
            return (
              conta.status ===
                "Recebido" ||
              conta.status ===
                "Pago"
            );
          }

          return true;
        }
      );
    }, [
      contas,
      tipo,
      filtro,
    ]);

  const totalPendente =
    contasDoTipo
      .filter(
        (conta) =>
          conta.status ===
          "Pendente"
      )
      .reduce(
        (
          total,
          conta
        ) =>
          total +
          conta.valor,

        0
      );

  const totalConcluido =
    contasDoTipo
      .filter(
        (conta) =>
          conta.status ===
            "Pago" ||
          conta.status ===
            "Recebido"
      )
      .reduce(
        (
          total,
          conta
        ) =>
          total +
          conta.valor,

        0
      );

  const totalVencido =
    contasDoTipo
      .filter(
        verificarVencida
      )
      .reduce(
        (
          total,
          conta
        ) =>
          total +
          conta.valor,

        0
      );

  const titulo =
    tipo ===
    "receber"
      ? "Contas a Receber"
      : "Contas a Pagar";

  const categorias =
    tipo ===
    "receber"
      ? configuracoes.tiposEntrada
      : configuracoes.tiposSaida;

  /* =======================================================
     INTERFACE
  ======================================================= */

  return (
    <div>
      <header
        style={
          estilos.cabecalho
        }
      >
        <div>
          <h1
            style={{
              margin: 0,

              fontSize: 32,
            }}
          >
            {titulo}
          </h1>

          <p
            style={
              estilos.textoCinza
            }
          >
            Controle de vencimentos
            e baixas financeiras.
          </p>
        </div>
      </header>

      {/* RESUMO */}

      <section
        style={
          estilos.cardsResumo
        }
      >
        <CardResumo
          titulo={
            tipo ===
            "receber"
              ? "A Receber"
              : "A Pagar"
          }

          valor={moeda(
            totalPendente
          )}
        />

        <CardResumo
          titulo="Vencido"

          valor={moeda(
            totalVencido
          )}
        />

        <CardResumo
          titulo={
            tipo ===
            "receber"
              ? "Recebido"
              : "Pago"
          }

          valor={moeda(
            totalConcluido
          )}
        />

        <CardResumo
          titulo="Quantidade"

          valor={String(
            contasDoTipo.length
          )}
        />
      </section>

      {/* FORMULÁRIO */}

      <section
        style={
          estilos.caixa
        }
      >
        <h2>
          {contaEditando
            ? "Editar conta"
            : tipo ===
                "receber"
              ? "Nova conta a receber"
              : "Nova conta a pagar"}
        </h2>

        <div
          style={
            estilos.formGrid
          }
        >
          <CampoTexto
            label="Descrição"

            value={
              descricao
            }

            onChange={
              setDescricao
            }

            placeholder={
              tipo ===
              "receber"
                ? "Ex.: Mensalidade João"
                : "Ex.: Energia elétrica"
            }
          />

          <CampoTexto
            label="Valor"

            value={valor}

            onChange={
              setValor
            }

            placeholder="Ex.: 500,00"
          />

          <CampoTexto
            label="Vencimento"

            value={
              vencimento
            }

            onChange={
              setVencimento
            }

            type="date"
          />

          <CampoSelect
            label={
              tipo ===
              "receber"
                ? "Tipo de Entrada"
                : "Tipo de Saída"
            }

            value={
              categoria
            }

            opcoes={
              categorias
            }

            onChange={
              setCategoria
            }
          />

          <CampoSelect
            label="Banco / Conta"

            value={banco}

            opcoes={
              configuracoes.bancos
            }

            onChange={
              setBanco
            }
          />

          <CampoSelect
            label="Unidade"

            value={
              unidade
            }

            opcoes={
              configuracoes.unidades
            }

            onChange={
              setUnidade
            }
          />

          <CampoTexto
            label="Observação"

            value={
              observacao
            }

            onChange={
              setObservacao
            }

            placeholder="Opcional"
          />
        </div>

        <div
          style={
            estilos.botoes
          }
        >
          <button
            onClick={
              salvarConta
            }

            style={
              estilos.botaoPrincipal
            }
          >
            {contaEditando
              ? "Salvar alterações"
              : "Salvar conta"}
          </button>

          {contaEditando && (
            <button
              onClick={
                limparFormulario
              }

              style={
                estilos.botaoSecundario
              }
            >
              Cancelar edição
            </button>
          )}
        </div>
      </section>

      {/* LISTAGEM */}

      <section
        style={{
          ...estilos.caixa,

          marginTop: 25,
        }}
      >
        <div
          style={
            estilos.topoLista
          }
        >
          <h2>
            {titulo}
          </h2>

          <select
            value={
              filtro
            }

            onChange={(
              evento
            ) =>
              setFiltro(
                evento.target.value
              )
            }

            style={
              estilos.input
            }
          >
            <option>
              Todos
            </option>

            <option>
              Pendentes
            </option>

            <option>
              Vencidos
            </option>

            <option>
              {tipo ===
              "receber"
                ? "Recebidos"
                : "Pagos"}
            </option>
          </select>
        </div>

        {contasFiltradas.length ===
        0 ? (
          <div
            style={
              estilos.vazio
            }
          >
            Nenhuma conta encontrada.
          </div>
        ) : (
          <div
            style={
              estilos.tabelaContainer
            }
          >
            <table
              style={
                estilos.tabela
              }
            >
              <thead>
                <tr>
                  <th
                    style={
                      estilos.th
                    }
                  >
                    Descrição
                  </th>

                  <th
                    style={
                      estilos.th
                    }
                  >
                    Vencimento
                  </th>

                  <th
                    style={
                      estilos.th
                    }
                  >
                    Categoria
                  </th>

                  <th
                    style={
                      estilos.th
                    }
                  >
                    Banco
                  </th>

                  <th
                    style={
                      estilos.th
                    }
                  >
                    Unidade
                  </th>

                  <th
                    style={
                      estilos.th
                    }
                  >
                    Valor
                  </th>

                  <th
                    style={
                      estilos.th
                    }
                  >
                    Status
                  </th>

                  <th
                    style={
                      estilos.th
                    }
                  >
                    Ações
                  </th>
                </tr>
              </thead>

              <tbody>
                {contasFiltradas.map(
                  (conta) => {
                    const vencida =
                      verificarVencida(
                        conta
                      );

                    const statusTela =
                      vencida
                        ? "Vencido"
                        : conta.status;

                    return (
                      <tr
                        key={
                          conta.id
                        }
                      >
                        <td
                          style={
                            estilos.td
                          }
                        >
                          {
                            conta.descricao
                          }
                        </td>

                        <td
                          style={
                            estilos.td
                          }
                        >
                          {new Date(
                            `${conta.vencimento}T00:00:00`
                          ).toLocaleDateString(
                            "pt-BR"
                          )}
                        </td>

                        <td
                          style={
                            estilos.td
                          }
                        >
                          {
                            conta.categoria
                          }
                        </td>

                        <td
                          style={
                            estilos.td
                          }
                        >
                          {
                            conta.banco
                          }
                        </td>

                        <td
                          style={
                            estilos.td
                          }
                        >
                          {
                            conta.unidade
                          }
                        </td>

                        <td
                          style={
                            estilos.td
                          }
                        >
                          {moeda(
                            conta.valor
                          )}
                        </td>

                        <td
                          style={
                            estilos.td
                          }
                        >
                          <span
                            style={{
                              ...estilos.status,

                              background:
                                statusTela ===
                                "Vencido"
                                  ? "#fee2e2"
                                  : statusTela ===
                                        "Pendente"
                                    ? "#fef3c7"
                                    : "#dcfce7",

                              color:
                                statusTela ===
                                "Vencido"
                                  ? "#991b1b"
                                  : statusTela ===
                                        "Pendente"
                                    ? "#92400e"
                                    : "#166534",
                            }}
                          >
                            {
                              statusTela
                            }
                          </span>
                        </td>

                        <td
                          style={
                            estilos.td
                          }
                        >
                          <div
                            style={{
                              display:
                                "flex",

                              gap: 6,

                              flexWrap:
                                "wrap",
                            }}
                          >
                            {conta.status ===
                              "Pendente" && (
                              <button
                                onClick={() =>
                                  baixarConta(
                                    conta
                                  )
                                }

                                style={
                                  estilos.botaoBaixar
                                }
                              >
                                {tipo ===
                                "receber"
                                  ? "Receber"
                                  : "Pagar"}
                              </button>
                            )}

                            <button
                              onClick={() =>
                                editarConta(
                                  conta
                                )
                              }

                              style={
                                estilos.botaoEditar
                              }
                            >
                              Editar
                            </button>

                            <button
                              onClick={() =>
                                excluirConta(
                                  conta
                                )
                              }

                              style={
                                estilos.botaoExcluir
                              }
                            >
                              Excluir
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

/* =========================================================
   COMPONENTES
========================================================= */

function CardResumo({
  titulo,

  valor,
}: {
  titulo: string;

  valor: string;
}) {
  return (
    <div
      style={
        estilos.cardResumo
      }
    >
      <span
        style={
          estilos.textoCinza
        }
      >
        {titulo}
      </span>

      <strong
        style={{
          fontSize: 25,
        }}
      >
        {valor}
      </strong>
    </div>
  );
}

function CampoTexto({
  label,

  value,

  onChange,

  placeholder = "",

  type = "text",
}: {
  label: string;

  value: string;

  onChange: (
    valor: string
  ) => void;

  placeholder?: string;

  type?: string;
}) {
  return (
    <label
      style={
        estilos.campoGrupo
      }
    >
      <strong>
        {label}
      </strong>

      <input
        type={type}

        value={value}

        placeholder={
          placeholder
        }

        onChange={(
          evento
        ) =>
          onChange(
            evento.target.value
          )
        }

        style={
          estilos.input
        }
      />
    </label>
  );
}

function CampoSelect({
  label,

  value,

  opcoes,

  onChange,
}: {
  label: string;

  value: string;

  opcoes: string[];

  onChange: (
    valor: string
  ) => void;
}) {
  /*
    Preserva valores antigos
    que ainda não estejam
    cadastrados nas novas listas.
  */
  const opcoesComValorAtual =
    value &&
    !opcoes.includes(value)
      ? [
          value,

          ...opcoes,
        ]
      : opcoes;

  return (
    <label
      style={
        estilos.campoGrupo
      }
    >
      <strong>
        {label}
      </strong>

      <select
        value={value}

        onChange={(
          evento
        ) =>
          onChange(
            evento.target.value
          )
        }

        style={
          estilos.input
        }
      >
        <option value="">
          Selecione...
        </option>

        {opcoesComValorAtual.map(
          (opcao) => (
            <option
              key={opcao}

              value={opcao}
            >
              {opcao}
            </option>
          )
        )}
      </select>
    </label>
  );
}

/* =========================================================
   ESTILOS
========================================================= */

const estilos: Record<
  string,
  CSSProperties
> = {
  cabecalho: {
    marginBottom: 25,
  },

  textoCinza: {
    color: "#657084",

    lineHeight: 1.6,
  },

  cardsResumo: {
    display: "grid",

    gridTemplateColumns:
      "repeat(auto-fit,minmax(190px,1fr))",

    gap: 18,

    marginBottom: 25,
  },

  cardResumo: {
    background: "white",

    padding: 22,

    borderRadius: 15,

    display: "flex",

    flexDirection: "column",

    gap: 12,

    boxShadow:
      "0 6px 18px rgba(0,0,0,.06)",
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

    gap: 10,

    marginTop: 25,

    flexWrap: "wrap",
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

    border:
      "1px solid #ccd3dd",

    borderRadius: 9,

    padding: "13px 20px",

    cursor: "pointer",
  },

  topoLista: {
    display: "flex",

    justifyContent:
      "space-between",

    alignItems: "center",

    gap: 15,

    flexWrap: "wrap",
  },

  tabelaContainer: {
    overflowX: "auto",

    marginTop: 20,
  },

  tabela: {
    width: "100%",

    minWidth: 1100,

    borderCollapse:
      "collapse",
  },

  th: {
    background: "#101a2d",

    color: "white",

    padding: 12,

    textAlign: "left",

    whiteSpace: "nowrap",
  },

  td: {
    padding: 12,

    borderBottom:
      "1px solid #e8ebef",

    whiteSpace: "nowrap",
  },

  status: {
    padding: "6px 10px",

    borderRadius: 20,

    fontSize: 13,

    fontWeight: "bold",
  },

  botaoBaixar: {
    background: "#15803d",

    color: "white",

    border: "none",

    borderRadius: 6,

    padding: "8px 10px",

    cursor: "pointer",
  },

  botaoEditar: {
    background: "#2563eb",

    color: "white",

    border: "none",

    borderRadius: 6,

    padding: "8px 10px",

    cursor: "pointer",
  },

  botaoExcluir: {
    background: "#b91c1c",

    color: "white",

    border: "none",

    borderRadius: 6,

    padding: "8px 10px",

    cursor: "pointer",
  },

  vazio: {
    textAlign: "center",

    color: "#8c96a8",

    padding: 35,
  },
};

export default Contas;

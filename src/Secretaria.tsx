import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";

import {
  CHAVE_CADASTROS,
  type Aluno,
} from "./Cadastros";

import {
  carregarConfiguracoes,
  type ConfiguracoesFinanceiras,
} from "./Configuracoes";

export type RecebimentoCaixa = {
  id: string;
  alunoId: string;
  alunoNome: string;
  descricao: string;
  valor: number;
  formaPagamento: string;
  unidade: string;
  dataHora: string;
};

export type SessaoCaixa = {
  id: string;
  operador: string;
  unidade: string;
  abertura: string;
  valorInicial: number;
  recebimentos: RecebimentoCaixa[];
  status: "Aberto" | "Fechado";
  fechamento?: string;
  valorInformado?: number;
  valorEsperado?: number;
  diferenca?: number;
  observacaoFechamento?: string;
};

type Props = {
  onRegistrarReceita: (
    recebimento: RecebimentoCaixa
  ) => void;
};

export const CHAVE_SECRETARIA =
  "financeiro-cedep-secretaria";

const moeda = (valor: number) =>
  valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

const converterNumero = (
  valor: string
) => {
  const texto = valor
    .replace("R$", "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  const numero = Number(texto);
  return Number.isFinite(numero)
    ? numero
    : 0;
};

function Secretaria({
  onRegistrarReceita,
}: Props) {
  const [sessoes, setSessoes] =
    useState<SessaoCaixa[]>([]);
  const [alunos, setAlunos] =
    useState<Aluno[]>([]);
  const [
    configuracoes,
    setConfiguracoes,
  ] =
    useState<ConfiguracoesFinanceiras>(
      carregarConfiguracoes()
    );
  const [carregado, setCarregado] =
    useState(false);

  const [operador, setOperador] =
    useState("Secretaria");
  const [unidadeAbertura, setUnidadeAbertura] =
    useState("CEDEP");
  const [valorInicial, setValorInicial] =
    useState("0,00");

  const [alunoId, setAlunoId] =
    useState("");
  const [descricao, setDescricao] =
    useState("Mensalidade");
  const [valor, setValor] =
    useState("");
  const [formaPagamento, setFormaPagamento] =
    useState("");

  const [valorFechamento, setValorFechamento] =
    useState("");
  const [observacaoFechamento, setObservacaoFechamento] =
    useState("");

  useEffect(() => {
    try {
      const secretaria =
        localStorage.getItem(
          CHAVE_SECRETARIA
        );
      const cadastros =
        localStorage.getItem(
          CHAVE_CADASTROS
        );

      if (secretaria) {
        const conteudo =
          JSON.parse(secretaria);
        setSessoes(
          Array.isArray(
            conteudo.sessoes
          )
            ? conteudo.sessoes
            : []
        );
      }

      if (cadastros) {
        const conteudo =
          JSON.parse(cadastros);
        setAlunos(
          Array.isArray(
            conteudo.alunos
          )
            ? conteudo.alunos
            : []
        );
      }
    } catch (erro) {
      console.error(
        "Erro ao carregar Secretaria:",
        erro
      );
    } finally {
      setCarregado(true);
    }
  }, []);

  useEffect(() => {
    if (!carregado) return;

    localStorage.setItem(
      CHAVE_SECRETARIA,
      JSON.stringify({
        sessoes,
      })
    );
  }, [sessoes, carregado]);

  useEffect(() => {
    const atualizar = () =>
      setConfiguracoes(
        carregarConfiguracoes()
      );

    window.addEventListener(
      "financeiro-config-atualizada",
      atualizar
    );

    return () =>
      window.removeEventListener(
        "financeiro-config-atualizada",
        atualizar
      );
  }, []);

  const caixaAberto =
    sessoes.find(
      (item) =>
        item.status === "Aberto"
    ) ?? null;

  const totalRecebido =
    caixaAberto?.recebimentos.reduce(
      (total, item) =>
        total + item.valor,
      0
    ) ?? 0;

  const valorEsperado =
    (caixaAberto?.valorInicial ?? 0) +
    totalRecebido;

  const alunosAtivos = useMemo(
    () =>
      alunos
        .filter(
          (item) =>
            item.situacao === "Ativo"
        )
        .sort((a, b) =>
          a.nome.localeCompare(b.nome)
        ),
    [alunos]
  );

  const abrirCaixa = () => {
    if (caixaAberto) {
      alert(
        "Já existe um caixa aberto."
      );
      return;
    }

    if (!operador.trim() || !unidadeAbertura) {
      alert(
        "Informe operador e unidade."
      );
      return;
    }

    const inicial =
      converterNumero(valorInicial);

    if (inicial < 0) {
      alert(
        "Informe um valor inicial válido."
      );
      return;
    }

    const sessao: SessaoCaixa = {
      id: `caixa-${Date.now()}`,
      operador: operador.trim(),
      unidade: unidadeAbertura,
      abertura:
        new Date().toISOString(),
      valorInicial: inicial,
      recebimentos: [],
      status: "Aberto",
    };

    setSessoes((atuais) => [
      ...atuais,
      sessao,
    ]);
    setValorInicial("0,00");
    alert("Caixa aberto.");
  };

  const registrarRecebimento = () => {
    if (!caixaAberto) {
      alert(
        "Abra o caixa antes de registrar recebimentos."
      );
      return;
    }

    const aluno = alunos.find(
      (item) =>
        item.id === alunoId
    );
    const valorNumerico =
      converterNumero(valor);

    if (
      !aluno ||
      !descricao.trim() ||
      valorNumerico <= 0 ||
      !formaPagamento
    ) {
      alert(
        "Preencha aluno, descrição, valor e forma de pagamento."
      );
      return;
    }

    const recebimento: RecebimentoCaixa = {
      id: `recebimento-${Date.now()}`,
      alunoId: aluno.id,
      alunoNome: aluno.nome,
      descricao:
        descricao.trim(),
      valor: valorNumerico,
      formaPagamento,
      unidade:
        aluno.unidade ||
        caixaAberto.unidade,
      dataHora:
        new Date().toISOString(),
    };

    setSessoes((atuais) =>
      atuais.map((item) =>
        item.id === caixaAberto.id
          ? {
              ...item,
              recebimentos: [
                ...item.recebimentos,
                recebimento,
              ],
            }
          : item
      )
    );

    onRegistrarReceita(
      recebimento
    );

    setAlunoId("");
    setDescricao("Mensalidade");
    setValor("");
    alert(
      "Recebimento registrado no caixa e no financeiro."
    );
  };

  const fecharCaixa = () => {
    if (!caixaAberto) return;

    const informado =
      converterNumero(
        valorFechamento
      );

    if (informado < 0) {
      alert(
        "Informe um valor de fechamento válido."
      );
      return;
    }

    const diferenca =
      informado - valorEsperado;

    if (
      !window.confirm(
        `Valor esperado: ${moeda(
          valorEsperado
        )}\nValor informado: ${moeda(
          informado
        )}\nDiferença: ${moeda(
          diferenca
        )}\n\nConfirma o fechamento?`
      )
    ) {
      return;
    }

    setSessoes((atuais) =>
      atuais.map((item) =>
        item.id === caixaAberto.id
          ? {
              ...item,
              status: "Fechado",
              fechamento:
                new Date().toISOString(),
              valorInformado:
                informado,
              valorEsperado,
              diferenca,
              observacaoFechamento:
                observacaoFechamento.trim(),
            }
          : item
      )
    );

    setValorFechamento("");
    setObservacaoFechamento("");
    alert("Caixa fechado.");
  };

  return (
    <div>
      <header
        style={
          estilos.cabecalho
        }
      >
        <h1
          style={{
            margin: 0,
            fontSize: 32,
          }}
        >
          Secretaria e Caixa
        </h1>
        <p
          style={
            estilos.textoCinza
          }
        >
          Abertura, recebimentos e
          fechamento diário.
        </p>
      </header>

      {!caixaAberto ? (
        <section
          style={
            estilos.caixa
          }
        >
          <h2>Abrir caixa</h2>
          <div
            style={
              estilos.formGrid
            }
          >
            <Campo
              label="Operador"
              value={operador}
              onChange={setOperador}
            />
            <CampoSelect
              label="Unidade"
              value={unidadeAbertura}
              opcoes={
                configuracoes.unidades
              }
              onChange={
                setUnidadeAbertura
              }
            />
            <Campo
              label="Valor inicial"
              value={valorInicial}
              onChange={setValorInicial}
            />
          </div>
          <button
            onClick={abrirCaixa}
            style={{
              ...estilos.botaoVerde,
              marginTop: 25,
            }}
          >
            Abrir caixa
          </button>
        </section>
      ) : (
        <>
          <section
            style={
              estilos.cards
            }
          >
            <Card
              titulo="Valor inicial"
              valor={moeda(
                caixaAberto.valorInicial
              )}
            />
            <Card
              titulo="Recebimentos"
              valor={moeda(
                totalRecebido
              )}
            />
            <Card
              titulo="Valor esperado"
              valor={moeda(
                valorEsperado
              )}
            />
            <Card
              titulo="Operador"
              valor={
                caixaAberto.operador
              }
            />
          </section>

          <section
            style={
              estilos.grade
            }
          >
            <div
              style={
                estilos.caixa
              }
            >
              <h2>
                Registrar recebimento
              </h2>
              <div
                style={
                  estilos.formGrid
                }
              >
                <CampoSelect
                  label="Aluno"
                  value={alunoId}
                  opcoes={alunosAtivos.map(
                    (item) => ({
                      valor: item.id,
                      rotulo: item.nome,
                    })
                  )}
                  onChange={setAlunoId}
                />
                <Campo
                  label="Descrição"
                  value={descricao}
                  onChange={
                    setDescricao
                  }
                />
                <Campo
                  label="Valor recebido"
                  value={valor}
                  onChange={setValor}
                />
                <CampoSelect
                  label="Forma de pagamento"
                  value={
                    formaPagamento
                  }
                  opcoes={
                    configuracoes.bancos
                  }
                  onChange={
                    setFormaPagamento
                  }
                />
              </div>
              <button
                onClick={
                  registrarRecebimento
                }
                style={{
                  ...estilos.botaoVerde,
                  marginTop: 25,
                }}
              >
                Confirmar recebimento
              </button>
            </div>

            <div
              style={
                estilos.caixa
              }
            >
              <h2>Fechar caixa</h2>
              <Campo
                label="Valor contado/informado"
                value={
                  valorFechamento
                }
                onChange={
                  setValorFechamento
                }
              />
              <Campo
                label="Observação"
                value={
                  observacaoFechamento
                }
                onChange={
                  setObservacaoFechamento
                }
              />
              <button
                onClick={fecharCaixa}
                style={{
                  ...estilos.botaoVermelho,
                  marginTop: 25,
                }}
              >
                Fechar caixa
              </button>
            </div>
          </section>

          <section
            style={{
              ...estilos.caixa,
              marginTop: 25,
            }}
          >
            <h2>
              Recebimentos do caixa
            </h2>
            {caixaAberto.recebimentos
              .length === 0 ? (
              <Vazio />
            ) : (
              caixaAberto.recebimentos.map(
                (item) => (
                  <div
                    key={item.id}
                    style={
                      estilos.registro
                    }
                  >
                    <div>
                      <strong>
                        {
                          item.alunoNome
                        }
                      </strong>
                      <div
                        style={
                          estilos.textoCinza
                        }
                      >
                        {
                          item.descricao
                        }{" "}
                        •{" "}
                        {
                          item.formaPagamento
                        }
                      </div>
                    </div>
                    <strong>
                      {moeda(
                        item.valor
                      )}
                    </strong>
                  </div>
                )
              )
            )}
          </section>
        </>
      )}

      <section
        style={{
          ...estilos.caixa,
          marginTop: 25,
        }}
      >
        <h2>
          Histórico de caixas
        </h2>
        {sessoes.length === 0 ? (
          <Vazio />
        ) : (
          [...sessoes]
            .reverse()
            .map((item) => (
              <div
                key={item.id}
                style={
                  estilos.registro
                }
              >
                <div>
                  <strong>
                    {item.operador} •{" "}
                    {item.unidade}
                  </strong>
                  <div
                    style={
                      estilos.textoCinza
                    }
                  >
                    Aberto em{" "}
                    {new Date(
                      item.abertura
                    ).toLocaleString(
                      "pt-BR"
                    )}
                    {item.fechamento
                      ? ` • Fechado em ${new Date(
                          item.fechamento
                        ).toLocaleString(
                          "pt-BR"
                        )}`
                      : ""}
                  </div>
                </div>
                <div>
                  <span
                    style={{
                      ...estilos.status,
                      background:
                        item.status ===
                        "Aberto"
                          ? "#dcfce7"
                          : "#e5e7eb",
                    }}
                  >
                    {item.status}
                  </span>
                  {item.diferenca !==
                    undefined && (
                    <strong
                      style={{
                        marginLeft: 12,
                        color:
                          item.diferenca ===
                          0
                            ? "#166534"
                            : "#b91c1c",
                      }}
                    >
                      Diferença:{" "}
                      {moeda(
                        item.diferenca
                      )}
                    </strong>
                  )}
                </div>
              </div>
            ))
        )}
      </section>
    </div>
  );
}

function Card({
  titulo,
  valor,
}: {
  titulo: string;
  valor: string;
}) {
  return (
    <div
      style={
        estilos.card
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
          fontSize: 24,
        }}
      >
        {valor}
      </strong>
    </div>
  );
}

function Campo({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (
    valor: string
  ) => void;
}) {
  return (
    <label
      style={
        estilos.campoGrupo
      }
    >
      <strong>{label}</strong>
      <input
        value={value}
        onChange={(evento) =>
          onChange(
            evento.target.value
          )
        }
        style={estilos.input}
      />
    </label>
  );
}

type Opcao =
  | string
  | {
      valor: string;
      rotulo: string;
    };

function CampoSelect({
  label,
  value,
  opcoes,
  onChange,
}: {
  label: string;
  value: string;
  opcoes: Opcao[];
  onChange: (
    valor: string
  ) => void;
}) {
  return (
    <label
      style={
        estilos.campoGrupo
      }
    >
      <strong>{label}</strong>
      <select
        value={value}
        onChange={(evento) =>
          onChange(
            evento.target.value
          )
        }
        style={estilos.input}
      >
        <option value="">
          Selecione...
        </option>
        {opcoes.map((opcao) => {
          const valor =
            typeof opcao === "string"
              ? opcao
              : opcao.valor;
          const rotulo =
            typeof opcao === "string"
              ? opcao
              : opcao.rotulo;

          return (
            <option
              key={valor}
              value={valor}
            >
              {rotulo}
            </option>
          );
        })}
      </select>
    </label>
  );
}

function Vazio() {
  return (
    <div
      style={
        estilos.vazio
      }
    >
      Nenhum registro encontrado.
    </div>
  );
}

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
  cards: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit,minmax(190px,1fr))",
    gap: 18,
    marginBottom: 25,
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
  grade: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit,minmax(340px,1fr))",
    gap: 22,
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
      "repeat(auto-fit,minmax(210px,1fr))",
    gap: 18,
    marginTop: 20,
  },
  campoGrupo: {
    display: "flex",
    flexDirection: "column",
    gap: 7,
    marginBottom: 15,
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
  botaoVerde: {
    background: "#15803d",
    color: "white",
    border: "none",
    borderRadius: 9,
    padding: "13px 20px",
    cursor: "pointer",
    fontWeight: "bold",
  },
  botaoVermelho: {
    background: "#b91c1c",
    color: "white",
    border: "none",
    borderRadius: 9,
    padding: "13px 20px",
    cursor: "pointer",
    fontWeight: "bold",
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
  vazio: {
    padding: 30,
    textAlign: "center",
    color: "#8c96a8",
  },
};

export default Secretaria;

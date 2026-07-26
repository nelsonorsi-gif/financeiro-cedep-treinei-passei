import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";

import {
  CHAVE_CONTAS,
  type Conta,
} from "./Contas";
import {
  carregarConfiguracoes,
} from "./Configuracoes";
import type {
  Parceiro,
} from "./Cadastros";

export const CHAVE_ESCOLAS =
  "financeiro-cedep-escolas";

type TipoRepasse =
  | "Fixo"
  | "Por aluno"
  | "Percentual";

type Escola = {
  id: string;
  nome: string;
  numeroAlunos: number;
  valorPorAluno: number;
  valorMinimo: number;
  quantidadeMinimaAlunos: number;
  parceiroId: string;
  tipoRepasse: TipoRepasse;
  valorRepasse: number;
  diaVencimento: number;
  bancoCobranca: string;
  bancoRepasse: string;
  unidade: string;
  observacao: string;
  situacao: "Ativa" | "Inativa";
};

type LancamentoEscola = {
  id: string;
  escolaId: string;
  escolaNome: string;
  competencia: string;
  numeroAlunos: number;
  valorPorAluno: number;
  valorCobranca: number;
  parceiroNome: string;
  valorRepasse: number;
  criadoEm: string;
};

type DadosEscolas = {
  escolas: Escola[];
  lancamentos: LancamentoEscola[];
};

type Props = {
  parceiros: Parceiro[];
};

const escolaVazia = (): Omit<
  Escola,
  "id"
> => ({
  nome: "",
  numeroAlunos: 0,
  valorPorAluno: 0,
  valorMinimo: 0,
  quantidadeMinimaAlunos: 0,
  parceiroId: "",
  tipoRepasse: "Fixo",
  valorRepasse: 0,
  diaVencimento: 10,
  bancoCobranca: "",
  bancoRepasse: "",
  unidade: "CEDEP",
  observacao: "",
  situacao: "Ativa",
});

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

const competenciaAtual = () =>
  new Date().toISOString().slice(
    0,
    7
  );

const calcularCobranca = (
  escola: Pick<
    Escola,
    | "numeroAlunos"
    | "valorPorAluno"
    | "valorMinimo"
    | "quantidadeMinimaAlunos"
  >,
  quantidade = escola.numeroAlunos
) => {
  const alunosCobrados = Math.max(
    quantidade,
    escola.quantidadeMinimaAlunos
  );

  return Math.max(
    quantidade *
      escola.valorPorAluno,
    alunosCobrados *
      escola.valorPorAluno,
    escola.valorMinimo
  );
};

const calcularRepasse = (
  escola: Escola,
  quantidade: number,
  valorCobranca: number
) => {
  if (!escola.parceiroId) {
    return 0;
  }

  if (
    escola.tipoRepasse ===
    "Por aluno"
  ) {
    return (
      quantidade *
      escola.valorRepasse
    );
  }

  if (
    escola.tipoRepasse ===
    "Percentual"
  ) {
    return (
      valorCobranca *
      (escola.valorRepasse /
        100)
    );
  }

  return escola.valorRepasse;
};

const dataVencimento = (
  competencia: string,
  dia: number
) => {
  const [ano, mes] =
    competencia
      .split("-")
      .map(Number);
  const ultimoDia =
    new Date(
      ano,
      mes,
      0
    ).getDate();

  return `${competencia}-${String(
    Math.min(
      Math.max(dia, 1),
      ultimoDia
    )
  ).padStart(2, "0")}`;
};

const lerContas = (): Conta[] => {
  try {
    const salvas =
      localStorage.getItem(
        CHAVE_CONTAS
      );
    return salvas
      ? JSON.parse(salvas)
      : [];
  } catch {
    return [];
  }
};

function Escolas({
  parceiros,
}: Props) {
  const [
    dados,
    setDados,
  ] = useState<DadosEscolas>({
    escolas: [],
    lancamentos: [],
  });
  const [
    carregado,
    setCarregado,
  ] = useState(false);
  const [
    formulario,
    setFormulario,
  ] = useState(escolaVazia());
  const [
    editando,
    setEditando,
  ] =
    useState<string | null>(
      null
    );
  const [
    escolaSelecionada,
    setEscolaSelecionada,
  ] = useState("");
  const [
    competencia,
    setCompetencia,
  ] = useState(
    competenciaAtual()
  );
  const [
    alunosDoMes,
    setAlunosDoMes,
  ] = useState(0);
  const [
    busca,
    setBusca,
  ] = useState("");

  const configuracoes =
    carregarConfiguracoes();

  useEffect(() => {
    try {
      const salvos =
        localStorage.getItem(
          CHAVE_ESCOLAS
        );

      if (salvos) {
        const conteudo =
          JSON.parse(salvos);
        setDados({
          escolas:
            Array.isArray(
              conteudo.escolas
            )
              ? conteudo.escolas
              : [],
          lancamentos:
            Array.isArray(
              conteudo.lancamentos
            )
              ? conteudo.lancamentos
              : [],
        });
      }
    } catch (erro) {
      console.error(
        "Erro ao carregar escolas:",
        erro
      );
    } finally {
      setCarregado(true);
    }
  }, []);

  useEffect(() => {
    if (!carregado) {
      return;
    }

    localStorage.setItem(
      CHAVE_ESCOLAS,
      JSON.stringify(dados)
    );
  }, [dados, carregado]);

  const escolaAtual =
    dados.escolas.find(
      (item) =>
        item.id ===
        escolaSelecionada
    );

  const ultimoLancamentoEscola =
    useMemo(
      () =>
        dados.lancamentos
          .filter(
            (item) =>
              item.escolaId ===
              escolaSelecionada
          )
          .sort((a, b) =>
            b.competencia.localeCompare(
              a.competencia
            )
          )[0],
      [
        dados.lancamentos,
        escolaSelecionada,
      ]
    );

  useEffect(() => {
    if (escolaAtual) {
      setAlunosDoMes(
        ultimoLancamentoEscola
          ?.numeroAlunos ??
          escolaAtual.numeroAlunos
      );
    }
  }, [
    escolaAtual,
    ultimoLancamentoEscola,
  ]);

  const valorPrevisto =
    escolaAtual
      ? calcularCobranca(
          escolaAtual,
          alunosDoMes
        )
      : 0;

  const valorRepassePrevisto =
    escolaAtual
      ? calcularRepasse(
          escolaAtual,
          alunosDoMes,
          valorPrevisto
        )
      : 0;

  const escolasFiltradas =
    useMemo(
      () =>
        dados.escolas.filter(
          (item) =>
            `${item.nome} ${
              parceiros.find(
                (parceiro) =>
                  parceiro.id ===
                  item.parceiroId
              )?.nome ?? ""
            }`
              .toLowerCase()
              .includes(
                busca.toLowerCase()
              )
        ),
      [
        dados.escolas,
        parceiros,
        busca,
      ]
    );

  const limparFormulario =
    () => {
      setFormulario(
        escolaVazia()
      );
      setEditando(null);
    };

  const salvarEscola =
    () => {
      if (
        !formulario.nome.trim()
      ) {
        alert(
          "Informe o nome da escola."
        );
        return;
      }

      if (
        formulario.valorPorAluno <=
        0
      ) {
        alert(
          "Informe o valor por aluno."
        );
        return;
      }

      const registro: Escola = {
        ...formulario,
        id:
          editando ??
          `escola-${Date.now()}`,
        nome:
          formulario.nome.trim(),
      };

      setDados((atual) => ({
        ...atual,
        escolas: editando
          ? atual.escolas.map(
              (item) =>
                item.id ===
                editando
                  ? registro
                  : item
            )
          : [
              ...atual.escolas,
              registro,
            ],
      }));

      limparFormulario();
      alert(
        editando
          ? "Escola atualizada."
          : "Escola cadastrada."
      );
    };

  const editarEscola = (
    escola: Escola
  ) => {
    const {
      id,
      ...campos
    } = escola;
    setFormulario(campos);
    setEditando(id);
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const alternarEscola = (
    id: string
  ) => {
    setDados((atual) => ({
      ...atual,
      escolas:
        atual.escolas.map(
          (item) =>
            item.id === id
              ? {
                  ...item,
                  situacao:
                    item.situacao ===
                    "Ativa"
                      ? "Inativa"
                      : "Ativa",
                }
              : item
        ),
    }));
  };

  const gerarCobranca =
    () => {
      if (
        !escolaAtual ||
        !competencia
      ) {
        alert(
          "Selecione a escola e a competência."
        );
        return;
      }

      if (
        escolaAtual.situacao ===
        "Inativa"
      ) {
        alert(
          "Esta escola está inativa."
        );
        return;
      }

      const idCobranca =
        `escola-cobranca-${escolaAtual.id}-${competencia}`;
      const idRepasse =
        `escola-repasse-${escolaAtual.id}-${competencia}`;
      const contas = lerContas();

      if (
        contas.some(
          (item) =>
            item.id ===
            idCobranca
        )
      ) {
        alert(
          "A cobrança desta escola já foi gerada para essa competência."
        );
        return;
      }

      const parceiro =
        parceiros.find(
          (item) =>
            item.id ===
            escolaAtual.parceiroId
        );
      const descricaoDetalhada =
        `${alunosDoMes} aluno(s) × ${moeda(
          escolaAtual.valorPorAluno
        )}. Valor mínimo: ${moeda(
          escolaAtual.valorMinimo
        )}. Quantidade mínima: ${
          escolaAtual.quantidadeMinimaAlunos
        } aluno(s).`;

      const novasContas: Conta[] = [
        ...contas,
        {
          id: idCobranca,
          descricao:
            `Plataforma Treinei, Passei! - ${escolaAtual.nome} - ${competencia}`,
          valor: valorPrevisto,
          vencimento:
            dataVencimento(
              competencia,
              escolaAtual.diaVencimento
            ),
          categoria:
            "Plataforma Treinei, Passei!",
          banco:
            escolaAtual.bancoCobranca,
          unidade:
            escolaAtual.unidade,
          observacao:
            descricaoDetalhada,
          status: "Pendente",
          tipo: "receber",
          origem: "escola",
          criadoEm:
            new Date().toISOString(),
        },
      ];

      if (
        parceiro &&
        valorRepassePrevisto > 0 &&
        !contas.some(
          (item) =>
            item.id ===
            idRepasse
        )
      ) {
        novasContas.push({
          id: idRepasse,
          descricao:
            `Repasse parceiro ${parceiro.nome} - ${escolaAtual.nome} - ${competencia}`,
          valor:
            valorRepassePrevisto,
          vencimento:
            dataVencimento(
              competencia,
              escolaAtual.diaVencimento
            ),
          categoria:
            "Repasse de Parceiro",
          banco:
            escolaAtual.bancoRepasse ||
            escolaAtual.bancoCobranca,
          unidade:
            escolaAtual.unidade,
          observacao:
            `Repasse ${escolaAtual.tipoRepasse.toLowerCase()} referente à cobrança da plataforma. ${descricaoDetalhada}`,
          status: "Pendente",
          tipo: "pagar",
          origem: "repasse-escola",
          criadoEm:
            new Date().toISOString(),
        });
      }

      localStorage.setItem(
        CHAVE_CONTAS,
        JSON.stringify(
          novasContas
        )
      );

      const lancamento: LancamentoEscola =
        {
          id:
            `lancamento-${escolaAtual.id}-${competencia}`,
          escolaId:
            escolaAtual.id,
          escolaNome:
            escolaAtual.nome,
          competencia,
          numeroAlunos:
            alunosDoMes,
          valorPorAluno:
            escolaAtual.valorPorAluno,
          valorCobranca:
            valorPrevisto,
          parceiroNome:
            parceiro?.nome ?? "",
          valorRepasse:
            valorRepassePrevisto,
          criadoEm:
            new Date().toISOString(),
        };

      setDados((atual) => ({
        ...atual,
        escolas:
          atual.escolas.map(
            (item) =>
              item.id ===
              escolaAtual.id
                ? {
                    ...item,
                    numeroAlunos:
                      alunosDoMes,
                  }
                : item
          ),
        lancamentos: [
          lancamento,
          ...atual.lancamentos.filter(
            (item) =>
              item.id !==
              lancamento.id
          ),
        ],
      }));

      window.dispatchEvent(
        new Event(
          "financeiro-contas-atualizadas"
        )
      );

      alert(
        valorRepassePrevisto > 0
          ? "Cobrança e repasse gerados com sucesso."
          : "Cobrança gerada com sucesso."
      );
    };

  return (
    <div>
      <section
        style={estilos.caixa}
      >
        <h2>
          {editando
            ? "Editar escola"
            : "Nova escola"}
        </h2>

        <p
          style={
            estilos.textoCinza
          }
        >
          Cadastre as escolas que
          utilizam a plataforma
          Treinei, Passei! e defina
          as regras de cobrança e
          repasse.
        </p>

        <div
          style={
            estilos.formGrid
          }
        >
          <Campo
            label="Nome da escola"
            value={formulario.nome}
            onChange={(valor) =>
              setFormulario(
                (atual) => ({
                  ...atual,
                  nome: valor,
                })
              )
            }
          />

          <CampoNumero
            label="Número de alunos"
            value={
              formulario.numeroAlunos
            }
            onChange={(valor) =>
              setFormulario(
                (atual) => ({
                  ...atual,
                  numeroAlunos:
                    valor,
                })
              )
            }
          />

          <CampoNumero
            label="Valor por aluno"
            value={
              formulario.valorPorAluno
            }
            decimal
            onChange={(valor) =>
              setFormulario(
                (atual) => ({
                  ...atual,
                  valorPorAluno:
                    valor,
                })
              )
            }
          />

          <CampoNumero
            label="Valor mínimo mensal"
            value={
              formulario.valorMinimo
            }
            decimal
            onChange={(valor) =>
              setFormulario(
                (atual) => ({
                  ...atual,
                  valorMinimo:
                    valor,
                })
              )
            }
          />

          <CampoNumero
            label="Quantidade mínima de alunos"
            value={
              formulario.quantidadeMinimaAlunos
            }
            onChange={(valor) =>
              setFormulario(
                (atual) => ({
                  ...atual,
                  quantidadeMinimaAlunos:
                    valor,
                })
              )
            }
          />

          <CampoSelect
            label="Parceiro vendedor"
            value={
              formulario.parceiroId
            }
            opcoes={parceiros
              .filter(
                (item) =>
                  item.situacao ===
                  "Ativo"
              )
              .map((item) => ({
                valor: item.id,
                texto: item.nome,
              }))}
            onChange={(valor) =>
              setFormulario(
                (atual) => ({
                  ...atual,
                  parceiroId:
                    valor,
                })
              )
            }
          />

          <CampoSelect
            label="Forma de repasse"
            value={
              formulario.tipoRepasse
            }
            opcoes={[
              {
                valor: "Fixo",
                texto: "Valor fixo",
              },
              {
                valor:
                  "Por aluno",
                texto:
                  "Valor por aluno",
              },
              {
                valor:
                  "Percentual",
                texto:
                  "Percentual da cobrança",
              },
            ]}
            onChange={(valor) =>
              setFormulario(
                (atual) => ({
                  ...atual,
                  tipoRepasse:
                    valor as TipoRepasse,
                })
              )
            }
          />

          <CampoNumero
            label={
              formulario.tipoRepasse ===
              "Percentual"
                ? "Percentual do repasse"
                : "Valor do repasse"
            }
            value={
              formulario.valorRepasse
            }
            decimal
            onChange={(valor) =>
              setFormulario(
                (atual) => ({
                  ...atual,
                  valorRepasse:
                    valor,
                })
              )
            }
          />

          <CampoNumero
            label="Dia do vencimento"
            value={
              formulario.diaVencimento
            }
            onChange={(valor) =>
              setFormulario(
                (atual) => ({
                  ...atual,
                  diaVencimento:
                    Math.min(
                      Math.max(
                        valor,
                        1
                      ),
                      31
                    ),
                })
              )
            }
          />

          <CampoSelect
            label="Banco da cobrança"
            value={
              formulario.bancoCobranca
            }
            opcoes={
              configuracoes.bancos.map(
                (item) => ({
                  valor: item,
                  texto: item,
                })
              )
            }
            onChange={(valor) =>
              setFormulario(
                (atual) => ({
                  ...atual,
                  bancoCobranca:
                    valor,
                })
              )
            }
          />

          <CampoSelect
            label="Banco do repasse"
            value={
              formulario.bancoRepasse
            }
            opcoes={
              configuracoes.bancos.map(
                (item) => ({
                  valor: item,
                  texto: item,
                })
              )
            }
            onChange={(valor) =>
              setFormulario(
                (atual) => ({
                  ...atual,
                  bancoRepasse:
                    valor,
                })
              )
            }
          />

          <CampoSelect
            label="Unidade"
            value={
              formulario.unidade
            }
            opcoes={
              configuracoes.unidades.map(
                (item) => ({
                  valor: item,
                  texto: item,
                })
              )
            }
            onChange={(valor) =>
              setFormulario(
                (atual) => ({
                  ...atual,
                  unidade: valor,
                })
              )
            }
          />

          <Campo
            label="Observações"
            value={
              formulario.observacao
            }
            onChange={(valor) =>
              setFormulario(
                (atual) => ({
                  ...atual,
                  observacao:
                    valor,
                })
              )
            }
          />
        </div>

        <div
          style={estilos.previa}
        >
          <strong>
            Cobrança prevista:
          </strong>{" "}
          {moeda(
            calcularCobranca(
              formulario as Escola
            )
          )}
        </div>

        <div
          style={estilos.botoes}
        >
          <button
            type="button"
            onClick={salvarEscola}
            style={
              estilos.botaoPrincipal
            }
          >
            {editando
              ? "Salvar alterações"
              : "Cadastrar escola"}
          </button>

          {editando && (
            <button
              type="button"
              onClick={
                limparFormulario
              }
              style={
                estilos.botaoSecundario
              }
            >
              Cancelar
            </button>
          )}
        </div>
      </section>

      <section
        style={{
          ...estilos.caixa,
          marginTop: 24,
        }}
      >
        <h2>
          Lançamento mensal
        </h2>

        <p
          style={
            estilos.textoCinza
          }
        >
          Gere a cobrança da escola
          em Contas a Receber e,
          quando configurado, o
          repasse do vendedor em
          Contas a Pagar. A
          quantidade do último mês
          aparece preenchida
          automaticamente; altere
          apenas quando o número de
          alunos mudar.
        </p>

        <div
          style={
            estilos.formGrid
          }
        >
          <CampoSelect
            label="Escola"
            value={
              escolaSelecionada
            }
            opcoes={dados.escolas
              .filter(
                (item) =>
                  item.situacao ===
                  "Ativa"
              )
              .map((item) => ({
                valor: item.id,
                texto: item.nome,
              }))}
            onChange={
              setEscolaSelecionada
            }
          />

          <label
            style={
              estilos.campoGrupo
            }
          >
            <strong>
              Competência
            </strong>
            <input
              type="month"
              value={competencia}
              onChange={(evento) =>
                setCompetencia(
                  evento.target.value
                )
              }
              style={estilos.input}
            />
          </label>

          <CampoNumero
            label="Alunos no mês"
            value={alunosDoMes}
            onChange={
              setAlunosDoMes
            }
          />
        </div>

        {escolaAtual && (
          <>
            <div
              style={
                estilos.avisoRepeticao
              }
            >
              {ultimoLancamentoEscola
                ? `Último lançamento: ${ultimoLancamentoEscola.competencia}, com ${ultimoLancamentoEscola.numeroAlunos} aluno(s).`
                : `Primeiro lançamento desta escola. A quantidade cadastrada é ${escolaAtual.numeroAlunos} aluno(s).`}
            </div>

            <div
              style={
                estilos.resumo
              }
            >
              <Resumo
                titulo="Cobrança"
                valor={moeda(
                  valorPrevisto
                )}
              />
              <Resumo
                titulo="Repasse"
                valor={moeda(
                  valorRepassePrevisto
                )}
              />
              <Resumo
                titulo="Líquido"
                valor={moeda(
                  valorPrevisto -
                    valorRepassePrevisto
                )}
              />
            </div>
          </>
        )}

        <button
          type="button"
          onClick={gerarCobranca}
          style={{
            ...estilos.botaoPrincipal,
            marginTop: 22,
          }}
        >
          Gerar cobrança mensal
        </button>
      </section>

      <section
        style={{
          ...estilos.caixa,
          marginTop: 24,
        }}
      >
        <div
          style={
            estilos.topoLista
          }
        >
          <h2>
            Escolas cadastradas
          </h2>
          <input
            value={busca}
            placeholder="Buscar escola..."
            onChange={(evento) =>
              setBusca(
                evento.target.value
              )
            }
            style={estilos.input}
          />
        </div>

        {escolasFiltradas.length ===
        0 ? (
          <p
            style={
              estilos.textoCinza
            }
          >
            Nenhuma escola
            cadastrada.
          </p>
        ) : (
          escolasFiltradas.map(
            (escola) => {
              const parceiro =
                parceiros.find(
                  (item) =>
                    item.id ===
                    escola.parceiroId
                );

              return (
                <div
                  key={escola.id}
                  style={
                    estilos.registro
                  }
                >
                  <div>
                    <strong>
                      {escola.nome}
                    </strong>
                    <p
                      style={
                        estilos.textoCinza
                      }
                    >
                      {
                        escola.numeroAlunos
                      }{" "}
                      aluno(s) •{" "}
                      {moeda(
                        escola.valorPorAluno
                      )}{" "}
                      por aluno • Mínimo:{" "}
                      {moeda(
                        escola.valorMinimo
                      )}
                      {parceiro
                        ? ` • Parceiro: ${parceiro.nome}`
                        : ""}
                    </p>
                  </div>

                  <div
                    style={
                      estilos.botoes
                    }
                  >
                    <span
                      style={{
                        ...estilos.situacao,
                        background:
                          escola.situacao ===
                          "Ativa"
                            ? "#dcfce7"
                            : "#fee2e2",
                        color:
                          escola.situacao ===
                          "Ativa"
                            ? "#166534"
                            : "#991b1b",
                      }}
                    >
                      {
                        escola.situacao
                      }
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        editarEscola(
                          escola
                        )
                      }
                      style={
                        estilos.botaoEditar
                      }
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        alternarEscola(
                          escola.id
                        )
                      }
                      style={
                        estilos.botaoSecundario
                      }
                    >
                      {escola.situacao ===
                      "Ativa"
                        ? "Inativar"
                        : "Ativar"}
                    </button>
                  </div>
                </div>
              );
            }
          )
        )}
      </section>

      {dados.lancamentos.length >
        0 && (
        <section
          style={{
            ...estilos.caixa,
            marginTop: 24,
          }}
        >
          <h2>
            Histórico de cobranças
          </h2>
          {dados.lancamentos.map(
            (item) => (
              <div
                key={item.id}
                style={
                  estilos.registro
                }
              >
                <div>
                  <strong>
                    {item.escolaNome} •{" "}
                    {item.competencia}
                  </strong>
                  <p
                    style={
                      estilos.textoCinza
                    }
                  >
                    {
                      item.numeroAlunos
                    }{" "}
                    alunos • Cobrança:{" "}
                    {moeda(
                      item.valorCobranca
                    )}{" "}
                    • Repasse:{" "}
                    {moeda(
                      item.valorRepasse
                    )}
                  </p>
                </div>
              </div>
            )
          )}
        </section>
      )}
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
      style={estilos.campoGrupo}
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

function CampoNumero({
  label,
  value,
  onChange,
  decimal = false,
}: {
  label: string;
  value: number;
  onChange: (
    valor: number
  ) => void;
  decimal?: boolean;
}) {
  return (
    <label
      style={estilos.campoGrupo}
    >
      <strong>{label}</strong>
      <input
        type="number"
        min="0"
        step={
          decimal ? "0.01" : "1"
        }
        value={value || ""}
        onChange={(evento) =>
          onChange(
            Number(
              evento.target.value
            ) || 0
          )
        }
        style={estilos.input}
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
  opcoes: Array<{
    valor: string;
    texto: string;
  }>;
  onChange: (
    valor: string
  ) => void;
}) {
  return (
    <label
      style={estilos.campoGrupo}
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
        {opcoes.map((opcao) => (
          <option
            key={opcao.valor}
            value={opcao.valor}
          >
            {opcao.texto}
          </option>
        ))}
      </select>
    </label>
  );
}

function Resumo({
  titulo,
  valor,
}: {
  titulo: string;
  valor: string;
}) {
  return (
    <div
      style={estilos.cardResumo}
    >
      <span>{titulo}</span>
      <strong>{valor}</strong>
    </div>
  );
}

const estilos: Record<
  string,
  CSSProperties
> = {
  caixa: {
    background: "white",
    padding: 28,
    borderRadius: 17,
    boxShadow:
      "0 6px 18px rgba(0,0,0,.06)",
  },
  textoCinza: {
    color: "#52627a",
    lineHeight: 1.55,
    marginBottom: 0,
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
    width: "100%",
    minHeight: 46,
    padding: "12px 14px",
    border:
      "1px solid #cbd5e1",
    borderRadius: 9,
    background: "white",
    color: "#0f172a",
  },
  previa: {
    display: "inline-block",
    marginTop: 20,
    padding: "12px 15px",
    borderRadius: 9,
    background: "#eef2f7",
  },
  botoes: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "center",
    marginTop: 20,
  },
  botaoPrincipal: {
    minHeight: 44,
    padding: "12px 18px",
    border: "none",
    borderRadius: 9,
    background: "#15803d",
    color: "white",
    fontWeight: 700,
    cursor: "pointer",
  },
  botaoSecundario: {
    minHeight: 40,
    padding: "10px 15px",
    border:
      "1px solid #cbd5e1",
    borderRadius: 9,
    background: "white",
    color: "#0f172a",
    cursor: "pointer",
  },
  botaoEditar: {
    minHeight: 40,
    padding: "10px 15px",
    border: "none",
    borderRadius: 9,
    background: "#2563eb",
    color: "white",
    cursor: "pointer",
  },
  resumo: {
    display: "grid",
    gridTemplateColumns:
      "repeat(3,minmax(0,1fr))",
    gap: 14,
    marginTop: 22,
  },
  avisoRepeticao: {
    marginTop: 20,
    padding: "13px 15px",
    border:
      "1px solid #bfdbfe",
    borderRadius: 10,
    background: "#eff6ff",
    color: "#1e3a8a",
    fontWeight: 600,
  },
  cardResumo: {
    display: "flex",
    flexDirection: "column",
    gap: 7,
    padding: 18,
    border:
      "1px solid #e2e8f0",
    borderRadius: 12,
  },
  topoLista: {
    display: "flex",
    justifyContent:
      "space-between",
    alignItems: "center",
    gap: 15,
    flexWrap: "wrap",
  },
  registro: {
    display: "flex",
    justifyContent:
      "space-between",
    alignItems: "center",
    gap: 18,
    padding: "18px 0",
    borderBottom:
      "1px solid #e2e8f0",
    flexWrap: "wrap",
  },
  situacao: {
    padding: "7px 11px",
    borderRadius: 999,
    fontWeight: 700,
  },
};

export default Escolas;

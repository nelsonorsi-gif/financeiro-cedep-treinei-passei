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
  CHAVE_CONTAS,
  type Conta,
} from "./Contas";

import {
  carregarConfiguracoes,
  type ConfiguracoesFinanceiras,
} from "./Configuracoes";
import {
  CHAVE_MENSALIDADES,
  carregarCatalogoCursos,
  type Curso,
  type Plano,
} from "./CatalogoCursos";

export {
  CHAVE_MENSALIDADES,
} from "./CatalogoCursos";
export type {
  Plano,
} from "./CatalogoCursos";

export type Geracao = {
  id: string;
  alunoId: string;
  alunoNome: string;
  planoId: string;
  planoNome: string;
  curso?: string;
  valorParcela?: number;
  parcelas: number;
  valorTotal: number;
  primeiraParcela: string;
  criadoEm: string;
};

type DadosMensalidades = {
  cursos: Curso[];
  planos: Plano[];
  geracoes: Geracao[];
};

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

const adicionarMeses = (
  dataISO: string,
  quantidade: number
) => {
  const [ano, mes, dia] =
    dataISO.split("-").map(Number);

  const data = new Date(
    ano,
    mes - 1 + quantidade,
    1
  );

  const ultimoDia = new Date(
    data.getFullYear(),
    data.getMonth() + 1,
    0
  ).getDate();

  data.setDate(
    Math.min(dia, ultimoDia)
  );

  return [
    data.getFullYear(),
    String(
      data.getMonth() + 1
    ).padStart(2, "0"),
    String(
      data.getDate()
    ).padStart(2, "0"),
  ].join("-");
};

function Mensalidades() {
  const [dados, setDados] =
    useState<DadosMensalidades>({
      cursos: [],
      planos: [],
      geracoes: [],
    });

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

  const [nome, setNome] =
    useState("");
  const [cursoId, setCursoId] =
    useState("");
  const [valor, setValor] =
    useState("");
  const [parcelas, setParcelas] =
    useState("1");
  const [unidade, setUnidade] =
    useState("CEDEP");
  const [planoEditando, setPlanoEditando] =
    useState<string | null>(null);

  const [
    cursoNome,
    setCursoNome,
  ] = useState("");
  const [
    cursoDescricao,
    setCursoDescricao,
  ] = useState("");
  const [
    cursoEditando,
    setCursoEditando,
  ] =
    useState<string | null>(null);

  const [alunoId, setAlunoId] =
    useState("");
  const [planoId, setPlanoId] =
    useState("");
  const [
    primeiroVencimento,
    setPrimeiroVencimento,
  ] = useState("");

  useEffect(() => {
    try {
      const mensalidades =
        localStorage.getItem(
          CHAVE_MENSALIDADES
        );
      const cadastros =
        localStorage.getItem(
          CHAVE_CADASTROS
        );

      if (mensalidades) {
        const conteudo =
          JSON.parse(mensalidades);
        const catalogo =
          carregarCatalogoCursos();
        setDados({
          cursos:
            catalogo.cursos,
          planos:
            catalogo.planos,
          geracoes: Array.isArray(
            conteudo.geracoes
          )
            ? conteudo.geracoes
            : [],
        });
      }

      if (cadastros) {
        const conteudo =
          JSON.parse(cadastros);
        setAlunos(
          Array.isArray(
            conteudo.alunos
          )
            ? conteudo.alunos.map(
                (item: Aluno) => ({
                  ...item,
                  curso:
                    item.curso ?? "",
                  valorTabela:
                    item.valorTabela ?? 0,
                  desconto:
                    item.desconto ?? 0,
                  valorMensalidade:
                    item.valorMensalidade ??
                    0,
                  cursoId:
                    item.cursoId ?? "",
                  planoId:
                    item.planoId ?? "",
                  planoNome:
                    item.planoNome ?? "",
                  parcelas:
                    item.parcelas ?? 1,
                  bancoMensalidade:
                    item.bancoMensalidade ??
                    "",
                })
              )
            : []
        );
      }
    } catch (erro) {
      console.error(
        "Erro ao carregar mensalidades:",
        erro
      );
    } finally {
      setCarregado(true);
    }
  }, []);

  useEffect(() => {
    if (!carregado) return;

    localStorage.setItem(
      CHAVE_MENSALIDADES,
      JSON.stringify(dados)
    );
    window.dispatchEvent(
      new Event(
        "financeiro-mensalidades-atualizada"
      )
    );
  }, [dados, carregado]);

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

  const planosAtivos = dados.planos.filter(
    (item) =>
      item.situacao === "Ativo"
  );

  const cursosAtivos =
    dados.cursos.filter(
      (item) =>
        item.situacao === "Ativo"
    );

  const alunoSelecionado =
    alunos.find(
      (item) =>
        item.id === alunoId
    );

  const planoSelecionado =
    dados.planos.find(
      (item) =>
        item.id === planoId
    );

  const valorIndividual =
    alunoSelecionado
      ?.valorMensalidade ?? 0;

  const valorParcelaSelecionada =
    valorIndividual > 0
      ? valorIndividual
      : planoSelecionado?.valor ??
        0;

  const selecionarAluno = (
    id: string
  ) => {
    setAlunoId(id);

    const selecionado =
      alunos.find(
        (item) =>
          item.id === id
      );

    if (selecionado) {
      const planoDoCurso =
        planosAtivos.find(
          (item) =>
            item.id ===
              selecionado.planoId ||
            item.cursoId ===
              selecionado.cursoId ||
            item.curso
              .trim()
              .toLocaleLowerCase(
                "pt-BR"
              ) ===
              selecionado.curso
                .trim()
                .toLocaleLowerCase(
                  "pt-BR"
                )
        );

      if (planoDoCurso) {
        setPlanoId(
          planoDoCurso.id
        );
      }
    }
  };

  const limparPlano = () => {
    setNome("");
    setCursoId("");
    setValor("");
    setParcelas("1");
    setUnidade("CEDEP");
    setPlanoEditando(null);
  };

  const limparCurso = () => {
    setCursoNome("");
    setCursoDescricao("");
    setCursoEditando(null);
  };

  const salvarCurso = () => {
    if (!cursoNome.trim()) {
      alert(
        "Informe o nome do curso."
      );
      return;
    }

    const duplicado =
      dados.cursos.some(
        (item) =>
          item.id !==
            cursoEditando &&
          item.nome
            .trim()
            .toLocaleLowerCase(
              "pt-BR"
            ) ===
            cursoNome
              .trim()
              .toLocaleLowerCase(
                "pt-BR"
              )
      );

    if (duplicado) {
      alert(
        "Este curso já está cadastrado."
      );
      return;
    }

    const registro: Curso = {
      id:
        cursoEditando ??
        `curso-${Date.now()}`,
      nome: cursoNome.trim(),
      descricao:
        cursoDescricao.trim(),
      situacao: "Ativo",
    };

    setDados((atual) => ({
      ...atual,
      cursos: cursoEditando
        ? atual.cursos.map(
            (item) =>
              item.id ===
              cursoEditando
                ? {
                    ...registro,
                    situacao:
                      item.situacao,
                  }
                : item
          )
        : [
            ...atual.cursos,
            registro,
          ],
      planos: cursoEditando
        ? atual.planos.map(
            (item) =>
              item.cursoId ===
              cursoEditando
                ? {
                    ...item,
                    curso:
                      registro.nome,
                  }
                : item
          )
        : atual.planos,
    }));

    limparCurso();
    alert("Curso salvo.");
  };

  const editarCurso = (
    curso: Curso
  ) => {
    setCursoEditando(curso.id);
    setCursoNome(curso.nome);
    setCursoDescricao(
      curso.descricao
    );
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const alternarCurso = (
    id: string
  ) => {
    setDados((atual) => ({
      ...atual,
      cursos: atual.cursos.map(
        (item) =>
          item.id === id
            ? {
                ...item,
                situacao:
                  item.situacao ===
                  "Ativo"
                    ? "Inativo"
                    : "Ativo",
              }
            : item
      ),
    }));
  };

  const salvarPlano = () => {
    const valorNumerico =
      converterNumero(valor);
    const quantidade =
      Number(parcelas);

    if (!nome.trim()) {
      alert(
        "Informe o nome do plano."
      );
      return;
    }

    const cursoSelecionado =
      dados.cursos.find(
        (item) =>
          item.id === cursoId
      );

    if (!cursoSelecionado) {
      alert(
        "Selecione o curso do plano."
      );
      return;
    }

    if (
      valorNumerico <= 0 ||
      !Number.isInteger(quantidade) ||
      quantidade <= 0
    ) {
      alert(
        "Informe valor e quantidade de parcelas válidos."
      );
      return;
    }

    if (!unidade) {
      alert(
        "Selecione a unidade."
      );
      return;
    }

    const registro: Plano = {
      id:
        planoEditando ??
        `plano-${Date.now()}`,
      nome: nome.trim(),
      cursoId:
        cursoSelecionado.id,
      curso:
        cursoSelecionado.nome,
      valor: valorNumerico,
      parcelas: quantidade,
      banco: "",
      unidade,
      situacao: "Ativo",
    };

    setDados((atual) => ({
      ...atual,
      planos: planoEditando
        ? atual.planos.map(
            (item) =>
              item.id === planoEditando
                ? {
                    ...registro,
                    situacao:
                      item.situacao,
                  }
                : item
          )
        : [
            ...atual.planos,
            registro,
          ],
    }));

    limparPlano();
    alert("Plano salvo.");
  };

  const editarPlano = (
    plano: Plano
  ) => {
    setPlanoEditando(plano.id);
    setNome(plano.nome);
    setCursoId(
      plano.cursoId ||
        dados.cursos.find(
          (item) =>
            item.nome ===
            plano.curso
        )?.id ||
        ""
    );
    setValor(
      String(plano.valor).replace(
        ".",
        ","
      )
    );
    setParcelas(
      String(plano.parcelas)
    );
    setUnidade(plano.unidade);
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const alternarPlano = (
    id: string
  ) => {
    setDados((atual) => ({
      ...atual,
      planos: atual.planos.map(
        (item) =>
          item.id === id
            ? {
                ...item,
                situacao:
                  item.situacao ===
                  "Ativo"
                    ? "Inativo"
                    : "Ativo",
              }
            : item
      ),
    }));
  };

  const gerarMensalidades = () => {
    const aluno = alunos.find(
      (item) =>
        item.id === alunoId
    );
    const plano = dados.planos.find(
      (item) =>
        item.id === planoId
    );

    if (
      !aluno ||
      !plano ||
      !primeiroVencimento
    ) {
      alert(
        "Selecione aluno, plano e primeiro vencimento."
      );
      return;
    }

    const valorParcela =
      aluno.valorMensalidade >
      0
        ? aluno.valorMensalidade
        : plano.valor;
    const quantidadeParcelas =
      aluno.parcelas > 0
        ? aluno.parcelas
        : plano.parcelas;

    const duplicada =
      dados.geracoes.some(
        (item) =>
          item.alunoId ===
            aluno.id &&
          item.planoId ===
            plano.id
      );

    if (
      duplicada &&
      !window.confirm(
        "Já existe uma geração deste plano para o aluno. Deseja gerar novamente?"
      )
    ) {
      return;
    }

    const geracaoId =
      `geracao-${Date.now()}`;

    let contas: Conta[] = [];

    try {
      const salvas =
        localStorage.getItem(
          CHAVE_CONTAS
        );
      contas = salvas
        ? JSON.parse(salvas)
        : [];
    } catch {
      contas = [];
    }

    const novasContas: Conta[] =
      Array.from(
        {
          length:
            quantidadeParcelas,
        },
        (_, indice) => ({
          id: `${geracaoId}-${indice + 1}`,
          descricao:
            `${aluno.curso || plano.curso || plano.nome} - ${aluno.nome} - ${indice + 1}/${quantidadeParcelas}`,
          valor: valorParcela,
          vencimento:
            adicionarMeses(
              primeiroVencimento,
              indice
            ),
          categoria:
            "Mensalidade",
          banco: "",
          unidade:
            aluno.unidade ||
            plano.unidade,
          observacao:
            `Aluno: ${aluno.nome} | Curso: ${aluno.curso || plano.curso || plano.nome} | Valor contratado: ${moeda(valorParcela)} | Geração: ${geracaoId}`,
          status: "Pendente",
          tipo: "receber",
          origem: "mensalidade",
          alunoId: aluno.id,
          alunoNome: aluno.nome,
          criadoEm: new Date().toISOString(),
        })
      );

    localStorage.setItem(
      CHAVE_CONTAS,
      JSON.stringify([
        ...contas,
        ...novasContas,
      ])
    );

    const geracao: Geracao = {
      id: geracaoId,
      alunoId: aluno.id,
      alunoNome: aluno.nome,
      planoId: plano.id,
      planoNome: plano.nome,
      curso:
        aluno.curso ||
        plano.curso,
      valorParcela,
      parcelas:
        quantidadeParcelas,
      valorTotal:
        valorParcela *
        quantidadeParcelas,
      primeiraParcela:
        primeiroVencimento,
      criadoEm:
        new Date().toLocaleString(
          "pt-BR"
        ),
    };

    setDados((atual) => ({
      ...atual,
      geracoes: [
        ...atual.geracoes,
        geracao,
      ],
    }));

    setAlunoId("");
    setPlanoId("");
    setPrimeiroVencimento("");

    alert(
      `${quantidadeParcelas} mensalidades geradas em Contas a Receber.`
    );
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
          Cursos e Mensalidades
        </h1>
        <p
          style={
            estilos.textoCinza
          }
        >
          Planos financeiros e
          geração de parcelas para
          alunos.
        </p>
      </header>

      <section
        style={
          estilos.caixa
        }
      >
        <h2>
          {cursoEditando
            ? "Editar curso"
            : "Novo curso"}
        </h2>
        <p
          style={
            estilos.textoCinza
          }
        >
          Cadastre aqui os cursos que
          poderão ser escolhidos nos
          planos e no cadastro do aluno.
        </p>
        <div
          style={
            estilos.formGrid
          }
        >
          <Campo
            label="Nome do curso"
            value={cursoNome}
            placeholder="Ex.: Pré-vestibular"
            onChange={setCursoNome}
          />
          <Campo
            label="Descrição"
            value={
              cursoDescricao
            }
            placeholder="Ex.: Turma extensiva"
            onChange={
              setCursoDescricao
            }
          />
        </div>
        <div
          style={{
            ...estilos.acoes,
            marginTop: 20,
          }}
        >
          <button
            onClick={salvarCurso}
            style={
              estilos.botaoSalvar
            }
          >
            Salvar curso
          </button>
          {cursoEditando && (
            <button
              onClick={limparCurso}
              style={
                estilos.botaoSecundario
              }
            >
              Cancelar edição
            </button>
          )}
        </div>

        <div
          style={{
            marginTop: 24,
          }}
        >
          {dados.cursos.length ===
          0 ? (
            <Vazio />
          ) : (
            dados.cursos.map(
              (item) => (
                <div
                  key={item.id}
                  style={
                    estilos.registro
                  }
                >
                  <div>
                    <strong>
                      {item.nome}
                    </strong>
                    <div
                      style={
                        estilos.textoCinza
                      }
                    >
                      {item.descricao ||
                        "Sem descrição"}
                    </div>
                  </div>
                  <div
                    style={
                      estilos.acoes
                    }
                  >
                    <span
                      style={
                        estilos.status
                      }
                    >
                      {item.situacao}
                    </span>
                    <button
                      onClick={() =>
                        editarCurso(
                          item
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
                        alternarCurso(
                          item.id
                        )
                      }
                      style={
                        estilos.botaoSecundario
                      }
                    >
                      {item.situacao ===
                      "Ativo"
                        ? "Inativar"
                        : "Ativar"}
                    </button>
                  </div>
                </div>
              )
            )
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
          {planoEditando
            ? "Editar plano"
            : "Novo plano"}
        </h2>

        <div
          style={
            estilos.formGrid
          }
        >
          <Campo
            label="Nome do plano"
            value={nome}
            placeholder="Ex.: Pré-vestibular 2026"
            onChange={setNome}
          />
          <CampoSelect
            label="Curso"
            value={cursoId}
            opcoes={cursosAtivos.map(
              (item) => ({
                valor: item.id,
                rotulo: item.nome,
              })
            )}
            onChange={setCursoId}
          />
          <Campo
            label="Valor de cada parcela"
            value={valor}
            placeholder="Ex.: 650,00"
            onChange={setValor}
          />
          <Campo
            label="Quantidade de parcelas"
            type="number"
            value={parcelas}
            onChange={setParcelas}
          />
          <CampoSelect
            label="Unidade"
            value={unidade}
            opcoes={
              configuracoes.unidades
            }
            onChange={setUnidade}
          />
        </div>

        <div
          style={
            estilos.acoes
          }
        >
          <button
            onClick={salvarPlano}
            style={
              estilos.botaoSalvar
            }
          >
            Salvar plano
          </button>
          {planoEditando && (
            <button
              onClick={limparPlano}
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
          Gerar mensalidades
        </h2>

        {alunosAtivos.length ===
        0 ? (
          <div
            style={
              estilos.aviso
            }
          >
            Cadastre ao menos um
            aluno ativo antes de gerar
            mensalidades.
          </div>
        ) : (
          <>
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
                onChange={selecionarAluno}
              />
              <CampoSelect
                label="Plano"
                value={planoId}
                opcoes={planosAtivos.map(
                  (item) => ({
                    valor: item.id,
                    rotulo:
                      `${item.nome} — ${item.parcelas}x ${moeda(item.valor)}`,
                  })
                )}
                onChange={setPlanoId}
              />
              <Campo
                label="Primeiro vencimento"
                type="date"
                value={
                  primeiroVencimento
                }
                onChange={
                  setPrimeiroVencimento
                }
              />
            </div>

            {alunoSelecionado && (
              <div
                style={
                  estilos.resumoContrato
                }
              >
                <div>
                  <strong>
                    Curso contratado
                  </strong>
                  <span>
                    {alunoSelecionado.curso ||
                      planoSelecionado?.curso ||
                      "Não informado"}
                  </span>
                </div>
                <div>
                  <strong>
                    Valor padrão
                  </strong>
                  <span>
                    {moeda(
                      alunoSelecionado.valorTabela ||
                        planoSelecionado?.valor ||
                        0
                    )}
                  </span>
                </div>
                <div>
                  <strong>
                    Desconto mensal
                  </strong>
                  <span>
                    {moeda(
                      alunoSelecionado.desconto ||
                        0
                    )}
                  </span>
                </div>
                <div>
                  <strong>
                    Valor real por parcela
                  </strong>
                  <span>
                    {moeda(
                      valorParcelaSelecionada
                    )}
                  </span>
                </div>
              </div>
            )}

            <button
              onClick={
                gerarMensalidades
              }
              style={{
                ...estilos.botaoSalvar,
                marginTop: 25,
              }}
            >
              Gerar mensalidades
            </button>
          </>
        )}
      </section>

      <section
        style={
          estilos.gradeListas
        }
      >
        <div
          style={
            estilos.caixa
          }
        >
          <h2>
            Planos cadastrados
          </h2>
          {dados.planos.length ===
          0 ? (
            <Vazio />
          ) : (
            dados.planos.map(
              (item) => (
                <div
                  key={item.id}
                  style={
                    estilos.registro
                  }
                >
                  <div>
                    <strong>
                      {item.nome}
                    </strong>
                    <div
                      style={
                        estilos.textoCinza
                      }
                    >
                      {item.parcelas}x{" "}
                      {moeda(
                        item.valor
                      )}
                      {item.curso
                        ? ` • ${item.curso}`
                        : ""}
                    </div>
                  </div>
                  <div
                    style={
                      estilos.acoes
                    }
                  >
                    <span
                      style={
                        estilos.status
                      }
                    >
                      {
                        item.situacao
                      }
                    </span>
                    <button
                      onClick={() =>
                        editarPlano(
                          item
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
                        alternarPlano(
                          item.id
                        )
                      }
                      style={
                        estilos.botaoSecundario
                      }
                    >
                      {item.situacao ===
                      "Ativo"
                        ? "Inativar"
                        : "Ativar"}
                    </button>
                  </div>
                </div>
              )
            )
          )}
        </div>

        <div
          style={
            estilos.caixa
          }
        >
          <h2>
            Gerações realizadas
          </h2>
          {dados.geracoes.length ===
          0 ? (
            <Vazio />
          ) : (
            [
              ...dados.geracoes,
            ]
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
                      {
                        item.alunoNome
                      }
                    </strong>
                    <div
                      style={
                        estilos.textoCinza
                      }
                    >
                      {item.planoNome} •{" "}
                      {item.parcelas} parcelas
                      •{" "}
                      {moeda(
                        item.valorTotal
                      )}
                      {item.valorParcela
                        ? ` • ${moeda(
                            item.valorParcela
                          )} por parcela`
                        : ""}
                    </div>
                    <small
                      style={
                        estilos.textoCinza
                      }
                    >
                      {item.criadoEm}
                    </small>
                  </div>
                </div>
              ))
          )}
        </div>
      </section>
    </div>
  );
}

function Campo({
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
      <strong>{label}</strong>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
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
    width: "100%",
    padding: "13px 14px",
    border:
      "1px solid #ccd3dd",
    borderRadius: 9,
    boxSizing: "border-box",
    fontSize: 15,
  },
  acoes: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  botaoSalvar: {
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
  botaoEditar: {
    background: "#2563eb",
    color: "white",
    border: "none",
    borderRadius: 8,
    padding: "9px 12px",
    cursor: "pointer",
  },
  aviso: {
    padding: 18,
    borderRadius: 10,
    background: "#fef3c7",
    color: "#92400e",
  },
  resumoContrato: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit,minmax(180px,1fr))",
    gap: 14,
    marginTop: 20,
    padding: 18,
    borderRadius: 12,
    background: "#eef6ff",
    border: "1px solid #bfdbfe",
  },
  gradeListas: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit,minmax(360px,1fr))",
    gap: 22,
    marginTop: 25,
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
    background: "#dcfce7",
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

export default Mensalidades;

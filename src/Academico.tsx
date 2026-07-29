import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import type {
  UsuarioSessao,
} from "./Acesso";
import {
  carregarCatalogoCursos,
} from "./CatalogoCursos";

export type Turma = {
  id: string;
  nome: string;
  curso: string;
  cursoId?: string;
  unidade: string;
  turno: string;
  ano: number;
  capacidade: number;
  ativo: boolean;
};

export type Matricula = {
  id: string;
  aluno_id: string;
  aluno_nome: string;
  turma_id: string;
  status: string;
  data_matricula: string;
  observacao: string;
};

type Aluno = {
  id: string;
  nome: string;
};

type DadosAcademicos = {
  turmas: Turma[];
  matriculas: Matricula[];
  presencas?: unknown[];
};

export const CHAVE_ACADEMICO =
  "financeiro-cedep-academico";
const CHAVE_CADASTROS =
  "financeiro-cedep-cadastros";

const lerAlunos = (): Aluno[] => {
  try {
    const bruto = JSON.parse(
      localStorage.getItem(
        CHAVE_CADASTROS
      ) ?? "{}"
    );
    const lista = Array.isArray(bruto)
      ? bruto
      : bruto.alunos ?? [];
    return lista
      .map(
        (
          item: Record<
            string,
            unknown
          >
        ) => ({
          id: String(
            item.id ?? ""
          ),
          nome: String(
            item.nome ??
              item.nomeCompleto ??
              ""
          ),
        })
      )
      .filter(
        (item: Aluno) =>
          item.id && item.nome
      );
  } catch {
    return [];
  }
};

const lerAcademico =
  (): DadosAcademicos => {
    try {
      const salvo =
        localStorage.getItem(
          CHAVE_ACADEMICO
        );
      if (!salvo) {
        return {
          turmas: [],
          matriculas: [],
          presencas: [],
        };
      }
      const dados =
        JSON.parse(salvo);
      return {
        turmas: Array.isArray(
          dados.turmas
        )
          ? dados.turmas
          : [],
        matriculas: Array.isArray(
          dados.matriculas
        )
          ? dados.matriculas
          : [],
        presencas: Array.isArray(
          dados.presencas
        )
          ? dados.presencas
          : [],
      };
    } catch {
      return {
        turmas: [],
        matriculas: [],
        presencas: [],
      };
    }
  };

export default function Academico({
  usuarioAtual,
}: {
  usuarioAtual: UsuarioSessao;
}) {
  const inicial =
    useMemo(lerAcademico, []);
  const [turmas, setTurmas] =
    useState<Turma[]>(
      inicial.turmas
    );
  const [
    matriculas,
    setMatriculas,
  ] = useState<Matricula[]>(
    inicial.matriculas
  );
  const [alunos] =
    useState<Aluno[]>(
      lerAlunos
    );
  const catalogo =
    useMemo(
      carregarCatalogoCursos,
      []
    );
  const [nome, setNome] =
    useState("");
  const [cursoId, setCursoId] =
    useState("");
  const [unidade, setUnidade] =
    useState("CEDEP");
  const [turno, setTurno] =
    useState("Noturno");
  const [ano, setAno] =
    useState(
      new Date().getFullYear()
    );
  const [
    capacidade,
    setCapacidade,
  ] = useState(40);
  const [alunoId, setAlunoId] =
    useState("");
  const [turmaId, setTurmaId] =
    useState("");
  const [
    observacao,
    setObservacao,
  ] = useState("");
  const [busca, setBusca] =
    useState("");

  useEffect(() => {
    const anterior =
      lerAcademico();
    localStorage.setItem(
      CHAVE_ACADEMICO,
      JSON.stringify({
        turmas,
        matriculas,
        presencas:
          anterior.presencas ?? [],
      })
    );
  }, [turmas, matriculas]);

  const salvarTurma = () => {
    const curso =
      catalogo.cursos.find(
        (item) =>
          item.id === cursoId
      );
    if (
      !nome.trim() ||
      !curso ||
      !Number.isInteger(ano) ||
      ano < 2000 ||
      ano > 2100
    ) {
      alert(
        "Informe nome, curso e um ano válido para a turma."
      );
      return;
    }

    setTurmas((atuais) => [
      ...atuais,
      {
        id: `turma-${Date.now()}`,
        nome: nome.trim(),
        curso: curso.nome,
        cursoId: curso.id,
        unidade,
        turno,
        ano,
        capacidade:
          Math.max(
            1,
            capacidade
          ),
        ativo: true,
      },
    ]);
    setNome("");
    setCursoId("");
    alert("Turma cadastrada.");
  };

  const matricular = () => {
    if (!alunoId || !turmaId) {
      alert(
        "Selecione o aluno e a turma."
      );
      return;
    }
    const duplicada =
      matriculas.some(
        (item) =>
          item.aluno_id ===
            alunoId &&
          item.turma_id ===
            turmaId &&
          item.status === "Ativa"
      );
    if (duplicada) {
      alert(
        "Este aluno já possui matrícula ativa nessa turma."
      );
      return;
    }
    const aluno = alunos.find(
      (item) =>
        item.id === alunoId
    );
    setMatriculas(
      (atuais) => [
        ...atuais,
        {
          id: `matricula-${Date.now()}`,
          aluno_id: alunoId,
          aluno_nome:
            aluno?.nome ??
            "Aluno",
          turma_id: turmaId,
          status: "Ativa",
          data_matricula:
            new Date()
              .toISOString()
              .slice(0, 10),
          observacao:
            observacao.trim(),
          criado_por:
            usuarioAtual.id,
        } as Matricula & {
          criado_por: string;
        },
      ]
    );
    setAlunoId("");
    setTurmaId("");
    setObservacao("");
    alert("Matrícula realizada.");
  };

  const alterarStatus = (
    matricula: Matricula
  ) => {
    setMatriculas((atuais) =>
      atuais.map((item) =>
        item.id === matricula.id
          ? {
              ...item,
              status:
                item.status ===
                "Ativa"
                  ? "Cancelada"
                  : "Ativa",
            }
          : item
      )
    );
  };

  const matriculasFiltradas =
    useMemo(() => {
      const termo = busca
        .trim()
        .toLowerCase();
      return matriculas.filter(
        (item) => {
          const turma =
            turmas.find(
              (registro) =>
                registro.id ===
                item.turma_id
            );
          return (
            !termo ||
            `${item.aluno_nome} ${
              turma?.nome ?? ""
            }`
              .toLowerCase()
              .includes(termo)
          );
        }
      );
    }, [
      busca,
      matriculas,
      turmas,
    ]);

  return (
    <div>
      <header
        style={
          estilos.cabecalho
        }
      >
        <h1 style={{ margin: 0 }}>
          Matrículas e Turmas
        </h1>
        <p
          style={
            estilos.textoCinza
          }
        >
          Organize alunos por turma.
          O curso é escolhido na
          própria turma.
        </p>
      </header>

      <div style={estilos.grade}>
        <section
          style={estilos.caixa}
        >
          <h2>Nova turma</h2>
          <div
            style={
              estilos.formGrid
            }
          >
            <Campo
              label="Nome da turma"
              value={nome}
              onChange={setNome}
            />
            <CampoSelect
              label="Curso"
              value={cursoId}
              onChange={
                setCursoId
              }
              opcoes={catalogo.cursos
                .filter(
                  (item) =>
                    item.situacao ===
                    "Ativo"
                )
                .map((item) => ({
                  valor: item.id,
                  rotulo:
                    item.nome,
                }))}
            />
            <Campo
              label="Unidade"
              value={unidade}
              onChange={setUnidade}
            />
            <Campo
              label="Turno"
              value={turno}
              onChange={setTurno}
            />
            <Campo
              label="Ano"
              type="number"
              value={String(ano)}
              onChange={(valor) =>
                setAno(
                  Number(valor)
                )
              }
            />
            <Campo
              label="Capacidade"
              type="number"
              value={String(
                capacidade
              )}
              onChange={(valor) =>
                setCapacidade(
                  Number(valor)
                )
              }
            />
          </div>
          <button
            style={estilos.botao}
            onClick={salvarTurma}
          >
            Salvar turma
          </button>
        </section>

        <section
          style={estilos.caixa}
        >
          <h2>Matricular aluno</h2>
          <CampoSelect
            label="Aluno"
            value={alunoId}
            onChange={setAlunoId}
            opcoes={alunos.map(
              (item) => ({
                valor: item.id,
                rotulo: item.nome,
              })
            )}
          />
          <CampoSelect
            label="Turma"
            value={turmaId}
            onChange={setTurmaId}
            opcoes={turmas
              .filter(
                (item) =>
                  item.ativo
              )
              .map((item) => ({
                valor: item.id,
                rotulo: `${item.nome} - ${item.curso} (${item.ano})`,
              }))}
          />
          <Campo
            label="Observação"
            value={observacao}
            onChange={
              setObservacao
            }
          />
          <button
            style={estilos.botao}
            onClick={matricular}
          >
            Confirmar matrícula
          </button>
        </section>
      </div>

      <section
        style={{
          ...estilos.caixa,
          marginTop: 24,
        }}
      >
        <h2>Turmas cadastradas</h2>
        {!turmas.length ? (
          <p
            style={
              estilos.textoCinza
            }
          >
            Nenhuma turma cadastrada.
          </p>
        ) : (
          <div
            style={estilos.cards}
          >
            {turmas.map(
              (turma) => {
                const ocupadas =
                  matriculas.filter(
                    (item) =>
                      item.turma_id ===
                        turma.id &&
                      item.status ===
                        "Ativa"
                  ).length;
                return (
                  <div
                    style={
                      estilos.card
                    }
                    key={turma.id}
                  >
                    <strong>
                      {turma.nome}
                    </strong>
                    <span>
                      {turma.curso} -{" "}
                      {turma.turno} -{" "}
                      {turma.ano}
                    </span>
                    <span>
                      {turma.unidade} -{" "}
                      {ocupadas}/
                      {
                        turma.capacidade
                      }{" "}
                      vagas
                    </span>
                  </div>
                );
              }
            )}
          </div>
        )}
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
          <h2>Matrículas</h2>
          <input
            style={
              estilos.inputBusca
            }
            value={busca}
            onChange={(evento) =>
              setBusca(
                evento.target.value
              )
            }
            placeholder="Buscar aluno ou turma..."
          />
        </div>
        {matriculasFiltradas.map(
          (matricula) => {
            const turma =
              turmas.find(
                (item) =>
                  item.id ===
                  matricula.turma_id
              );
            return (
              <div
                style={
                  estilos.registro
                }
                key={matricula.id}
              >
                <div>
                  <strong>
                    {
                      matricula.aluno_nome
                    }
                  </strong>
                  <div
                    style={
                      estilos.textoCinza
                    }
                  >
                    {turma?.nome ??
                      "Turma"}{" "}
                    -{" "}
                    {turma?.curso ??
                      ""}
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
                        matricula.status ===
                        "Ativa"
                          ? "#dcfce7"
                          : "#fee2e2",
                    }}
                  >
                    {
                      matricula.status
                    }
                  </span>
                  <button
                    style={
                      estilos.secundario
                    }
                    onClick={() =>
                      alterarStatus(
                        matricula
                      )
                    }
                  >
                    {matricula.status ===
                    "Ativa"
                      ? "Cancelar"
                      : "Reativar"}
                  </button>
                </div>
              </div>
            );
          }
        )}
      </section>
    </div>
  );
}

function Campo({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (
    valor: string
  ) => void;
  type?: string;
}) {
  return (
    <label style={estilos.campo}>
      <strong>{label}</strong>
      <input
        style={estilos.input}
        type={type}
        value={value}
        onChange={(evento) =>
          onChange(
            evento.target.value
          )
        }
      />
    </label>
  );
}

function CampoSelect({
  label,
  value,
  onChange,
  opcoes,
}: {
  label: string;
  value: string;
  onChange: (
    valor: string
  ) => void;
  opcoes: Array<{
    valor: string;
    rotulo: string;
  }>;
}) {
  return (
    <label style={estilos.campo}>
      <strong>{label}</strong>
      <select
        style={estilos.input}
        value={value}
        onChange={(evento) =>
          onChange(
            evento.target.value
          )
        }
      >
        <option value="">
          Selecione...
        </option>
        {opcoes.map((item) => (
          <option
            key={item.valor}
            value={item.valor}
          >
            {item.rotulo}
          </option>
        ))}
      </select>
    </label>
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
    color: "#526078",
    lineHeight: 1.6,
  },
  grade: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit,minmax(320px,1fr))",
    gap: 24,
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
      "repeat(auto-fit,minmax(180px,1fr))",
    gap: 15,
  },
  campo: {
    display: "flex",
    flexDirection: "column",
    gap: 7,
    marginTop: 12,
  },
  input: {
    width: "100%",
    padding: "12px 13px",
    border:
      "1px solid #cbd5e1",
    borderRadius: 9,
    boxSizing: "border-box",
    fontSize: 15,
  },
  botao: {
    marginTop: 20,
    background: "#15803d",
    color: "white",
    border: 0,
    borderRadius: 9,
    padding: "13px 20px",
    fontWeight: 700,
    cursor: "pointer",
  },
  cards: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit,minmax(240px,1fr))",
    gap: 14,
  },
  card: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
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
  inputBusca: {
    minWidth: 280,
    padding: "12px 13px",
    border:
      "1px solid #cbd5e1",
    borderRadius: 9,
  },
  registro: {
    display: "flex",
    justifyContent:
      "space-between",
    gap: 15,
    alignItems: "center",
    padding: "16px 0",
    borderBottom:
      "1px solid #e2e8f0",
    flexWrap: "wrap",
  },
  acoes: {
    display: "flex",
    gap: 8,
    alignItems: "center",
  },
  status: {
    padding: "7px 10px",
    borderRadius: 20,
    fontWeight: 700,
  },
  secundario: {
    background: "white",
    border:
      "1px solid #cbd5e1",
    borderRadius: 8,
    padding: "9px 12px",
    cursor: "pointer",
  },
};

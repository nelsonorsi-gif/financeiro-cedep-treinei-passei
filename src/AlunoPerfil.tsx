import {
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import type { UsuarioSessao } from "./Acesso";
import type { Aluno } from "./Cadastros";
import {
  CHAVE_CONTAS,
  type Conta,
} from "./Contas";
import {
  CHAVE_ACADEMICO,
  type Matricula,
  type Turma,
} from "./Academico";

type Presenca = {
  id: string;
  turmaId: string;
  data: string;
  faltas: string[];
};

type ObservacaoAluno = {
  id: string;
  alunoId: string;
  texto: string;
  autorId: string;
  autorNome: string;
  criadoEm: string;
};

const CHAVE_OBSERVACOES =
  "financeiro-cedep-observacoes-alunos";
const CHAVE_CONTRATOS =
  "financeiro-cedep-configuracoes-contratos";

const lerJson = <T,>(
  chave: string,
  padrao: T
): T => {
  try {
    return JSON.parse(
      localStorage.getItem(chave) ??
        JSON.stringify(padrao)
    ) as T;
  } catch {
    return padrao;
  }
};

const moeda = (valor: number) =>
  valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

export default function AlunoPerfil({
  aluno,
  usuarioAtual,
  fechar,
}: {
  aluno: Aluno;
  usuarioAtual: UsuarioSessao;
  fechar: () => void;
}) {
  const contas = lerJson<Conta[]>(
    CHAVE_CONTAS,
    []
  ).filter(
    (conta) =>
      conta.alunoId === aluno.id ||
      conta.alunoNome === aluno.nome
  );
  const academico = lerJson<{
    turmas: Turma[];
    matriculas: Matricula[];
    presencas: Presenca[];
  }>(CHAVE_ACADEMICO, {
    turmas: [],
    matriculas: [],
    presencas: [],
  });
  const contratos = lerJson<
    Record<string, {
      planoContrato?: string;
      anosContrato?: Array<{
        anoLetivo: string;
        curso: string;
        parcelas: string;
        valorPadrao: string;
        primeiroVencimento: string;
      }>;
    }>
  >(CHAVE_CONTRATOS, {});
  const [observacoes, setObservacoes] =
    useState<ObservacaoAluno[]>(() =>
      lerJson<ObservacaoAluno[]>(
        CHAVE_OBSERVACOES,
        []
      )
    );
  const [novaObservacao, setNovaObservacao] =
    useState("");

  const matriculas = academico.matriculas.filter(
    (item) => item.aluno_id === aluno.id
  );
  const turmasIds = new Set(
    matriculas.map((item) => item.turma_id)
  );
  const registros = academico.presencas.filter(
    (item) => turmasIds.has(item.turmaId)
  );
  const faltas = registros.filter((item) =>
    item.faltas.includes(aluno.id)
  ).length;
  const presencas = Math.max(
    0,
    registros.length - faltas
  );
  const percentual =
    registros.length > 0
      ? (presencas / registros.length) * 100
      : 0;
  const contrato = contratos[aluno.id];
  const observacoesAluno = useMemo(
    () =>
      observacoes
        .filter((item) => item.alunoId === aluno.id)
        .sort((a, b) =>
          b.criadoEm.localeCompare(a.criadoEm)
        ),
    [aluno.id, observacoes]
  );

  const salvarObservacao = () => {
    if (!novaObservacao.trim()) {
      alert("Digite a observação.");
      return;
    }
    const atualizadas = [
      ...observacoes,
      {
        id: `observacao-${Date.now()}`,
        alunoId: aluno.id,
        texto: novaObservacao.trim(),
        autorId: usuarioAtual.id,
        autorNome: usuarioAtual.nome,
        criadoEm: new Date().toISOString(),
      },
    ];
    localStorage.setItem(
      CHAVE_OBSERVACOES,
      JSON.stringify(atualizadas)
    );
    setObservacoes(atualizadas);
    setNovaObservacao("");
    window.dispatchEvent(
      new CustomEvent(
        "financeiro-observacoes-alunos-atualizadas"
      )
    );
  };

  return (
    <section style={estilos.caixa}>
      <div style={estilos.topo}>
        <div>
          <h2 style={{ margin: 0 }}>
            Perfil de {aluno.nome}
          </h2>
          <p style={estilos.cinza}>
            {aluno.cpf || "CPF não informado"} •{" "}
            {aluno.telefone ||
              "Telefone não informado"}
          </p>
        </div>
        <button onClick={fechar} style={estilos.fechar}>
          Fechar perfil
        </button>
      </div>

      <div style={estilos.cards}>
        <Card
          titulo="Parcelas"
          valor={String(contas.length)}
        />
        <Card
          titulo="Pendentes"
          valor={moeda(
            contas
              .filter(
                (item) =>
                  item.status === "Pendente"
              )
              .reduce(
                (total, item) =>
                  total + item.valor,
                0
              )
          )}
        />
        <Card
          titulo="Presenças"
          valor={String(presencas)}
        />
        <Card
          titulo="Frequência"
          valor={
            registros.length
              ? `${percentual.toFixed(1)}%`
              : "Sem registros"
          }
        />
      </div>

      <div style={estilos.grade}>
        <div>
          <h3>Parcelas e recebimentos</h3>
          {!contas.length ? (
            <p style={estilos.cinza}>
              Nenhuma parcela gerada.
            </p>
          ) : (
            contas
              .sort((a, b) =>
                a.vencimento.localeCompare(
                  b.vencimento
                )
              )
              .map((conta) => (
                <div
                  key={conta.id}
                  style={estilos.linha}
                >
                  <span>
                    <strong>
                      {conta.descricao}
                    </strong>
                    <br />
                    {conta.vencimento
                      .split("-")
                      .reverse()
                      .join("/")}
                  </span>
                  <span>
                    {moeda(conta.valor)} •{" "}
                    {conta.status}
                  </span>
                </div>
              ))
          )}
        </div>

        <div>
          <h3>Turmas e frequência</h3>
          {matriculas.map((matricula) => {
            const turma =
              academico.turmas.find(
                (item) =>
                  item.id ===
                  matricula.turma_id
              );
            return (
              <div
                key={matricula.id}
                style={estilos.linha}
              >
                <span>
                  <strong>
                    {turma?.nome ?? "Turma"}
                  </strong>
                  <br />
                  {turma?.curso}
                </span>
                <span>{matricula.status}</span>
              </div>
            );
          })}
          {!matriculas.length && (
            <p style={estilos.cinza}>
              Nenhuma matrícula encontrada.
            </p>
          )}
          <p style={estilos.cinza}>
            {registros.length} dia(s) registrado(s):{" "}
            {presencas} presença(s) e {faltas} falta(s).
          </p>
        </div>
      </div>

      <div style={estilos.contrato}>
        <h3>Contrato</h3>
        {!contrato?.anosContrato?.length ? (
          <p style={estilos.cinza}>
            Nenhuma configuração de contrato
            salva para este aluno.
          </p>
        ) : (
          <>
            <p>
              <strong>Plano:</strong>{" "}
              {contrato.planoContrato ||
                "Personalizado"}
            </p>
            {contrato.anosContrato.map(
              (ano, indice) => (
                <div
                  key={`${ano.anoLetivo}-${indice}`}
                  style={estilos.linha}
                >
                  <span>
                    <strong>
                      {ano.anoLetivo} — {ano.curso}
                    </strong>
                    <br />
                    Primeiro vencimento:{" "}
                    {ano.primeiroVencimento
                      ?.split("-")
                      .reverse()
                      .join("/") || "—"}
                  </span>
                  <span>
                    {ano.parcelas}x{" "}
                    {ano.valorPadrao}
                  </span>
                </div>
              )
            )}
          </>
        )}
      </div>

      <div style={estilos.observacoes}>
        <h3>Observações do aluno</h3>
        <textarea
          value={novaObservacao}
          onChange={(evento) =>
            setNovaObservacao(
              evento.target.value
            )
          }
          placeholder="Registrar atendimento, ocorrência ou informação importante..."
          style={estilos.textarea}
        />
        <button
          onClick={salvarObservacao}
          style={estilos.salvar}
        >
          Salvar observação
        </button>
        {observacoesAluno.map((item) => (
          <div key={item.id} style={estilos.nota}>
            <strong>{item.autorNome}</strong> •{" "}
            {new Date(
              item.criadoEm
            ).toLocaleString("pt-BR")}
            <p>{item.texto}</p>
          </div>
        ))}
      </div>
    </section>
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
    <div style={estilos.card}>
      <span style={estilos.cinza}>{titulo}</span>
      <strong style={{ fontSize: 23 }}>
        {valor}
      </strong>
    </div>
  );
}

const estilos: Record<string, CSSProperties> = {
  caixa: {
    background: "white",
    borderRadius: 17,
    padding: 26,
    marginBottom: 24,
    boxShadow: "0 6px 18px rgba(0,0,0,.07)",
  },
  topo: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "start",
    flexWrap: "wrap",
  },
  fechar: {
    border: "1px solid #cbd5e1",
    background: "white",
    borderRadius: 8,
    padding: "10px 14px",
    cursor: "pointer",
  },
  cinza: { color: "#52627a", lineHeight: 1.45 },
  cards: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit,minmax(170px,1fr))",
    gap: 12,
    margin: "20px 0",
  },
  card: {
    background: "#f3f6fa",
    borderRadius: 12,
    padding: 17,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  grade: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit,minmax(320px,1fr))",
    gap: 24,
  },
  linha: {
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    padding: "11px 0",
    borderBottom: "1px solid #e2e8f0",
  },
  contrato: {
    marginTop: 22,
    paddingTop: 5,
  },
  observacoes: {
    marginTop: 24,
    borderTop: "1px solid #dbe3ee",
    paddingTop: 18,
  },
  textarea: {
    width: "100%",
    minHeight: 90,
    padding: 12,
    border: "1px solid #cbd5e1",
    borderRadius: 9,
    boxSizing: "border-box",
    font: "inherit",
  },
  salvar: {
    marginTop: 9,
    background: "#15803d",
    color: "white",
    border: 0,
    borderRadius: 8,
    padding: "11px 16px",
    cursor: "pointer",
    fontWeight: 700,
  },
  nota: {
    marginTop: 12,
    background: "#f8fafc",
    borderLeft: "4px solid #2563eb",
    borderRadius: 8,
    padding: 13,
  },
};

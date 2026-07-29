import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import type { UsuarioSessao } from "./Acesso";
import {
  CHAVE_ACADEMICO,
  type Matricula,
  type Turma,
} from "./Academico";

type RegistroPresenca = {
  id: string;
  turmaId: string;
  data: string;
  faltas: string[];
  registradoPorId: string;
  registradoEm: string;
};

type DadosAcademicos = {
  turmas: Turma[];
  matriculas: Matricula[];
  presencas?: RegistroPresenca[];
};

const hoje = () =>
  new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Sao_Paulo",
  });

const carregarDados = (): DadosAcademicos => {
  try {
    const salvo = localStorage.getItem(CHAVE_ACADEMICO);
    if (salvo) {
      const dados = JSON.parse(salvo) as DadosAcademicos;
      return {
        turmas: Array.isArray(dados.turmas) ? dados.turmas : [],
        matriculas: Array.isArray(dados.matriculas)
          ? dados.matriculas
          : [],
        presencas: Array.isArray(dados.presencas)
          ? dados.presencas
          : [],
      };
    }
  } catch (erro) {
    console.error("Erro ao carregar presenças:", erro);
  }
  return { turmas: [], matriculas: [], presencas: [] };
};

const escaparHtml = (valor: string) =>
  valor
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

export default function Presenca({
  usuarioAtual,
}: {
  usuarioAtual: UsuarioSessao;
}) {
  const [dados, setDados] = useState<DadosAcademicos>(carregarDados);
  const [turmaId, setTurmaId] = useState("");
  const [data, setData] = useState(hoje);
  const [faltas, setFaltas] = useState<string[]>([]);

  useEffect(() => {
    const atualizar = () => setDados(carregarDados());
    window.addEventListener("financeiro-academico-atualizado", atualizar);
    window.addEventListener("storage", atualizar);
    return () => {
      window.removeEventListener(
        "financeiro-academico-atualizado",
        atualizar
      );
      window.removeEventListener("storage", atualizar);
    };
  }, []);

  const turmasAtivas = useMemo(
    () =>
      dados.turmas
        .filter((turma) => turma.ativo)
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    [dados.turmas]
  );

  const turma = dados.turmas.find((item) => item.id === turmaId);
  const alunos = useMemo(
    () =>
      dados.matriculas
        .filter(
          (matricula) =>
            matricula.turma_id === turmaId &&
            matricula.status !== "Cancelada"
        )
        .sort((a, b) =>
          a.aluno_nome.localeCompare(b.aluno_nome, "pt-BR")
        ),
    [dados.matriculas, turmaId]
  );

  useEffect(() => {
    const registro = dados.presencas?.find(
      (item) => item.turmaId === turmaId && item.data === data
    );
    setFaltas(registro?.faltas ?? []);
  }, [dados.presencas, turmaId, data]);

  const alternarFalta = (alunoId: string) => {
    setFaltas((atuais) =>
      atuais.includes(alunoId)
        ? atuais.filter((id) => id !== alunoId)
        : [...atuais, alunoId]
    );
  };

  const salvar = () => {
    if (!turmaId || !data) {
      alert("Selecione a turma e a data.");
      return;
    }
    const registro: RegistroPresenca = {
      id: `presenca-${turmaId}-${data}`,
      turmaId,
      data,
      faltas,
      registradoPorId: usuarioAtual.id,
      registradoEm: new Date().toISOString(),
    };
    const presencas = [
      ...(dados.presencas ?? []).filter(
        (item) => item.id !== registro.id
      ),
      registro,
    ];
    const atualizados = { ...dados, presencas };
    localStorage.setItem(CHAVE_ACADEMICO, JSON.stringify(atualizados));
    setDados(atualizados);
    window.dispatchEvent(
      new CustomEvent("financeiro-academico-atualizado")
    );
    alert(
      `Presença salva: ${alunos.length - faltas.length} presentes e ${faltas.length} faltas.`
    );
  };

  const imprimirLista = () => {
    if (!turma || !data || alunos.length === 0) {
      alert("Selecione uma turma que possua alunos matriculados.");
      return;
    }
    const linhas = alunos
      .map(
        (aluno, indice) => `
          <tr>
            <td>${indice + 1}</td>
            <td>${escaparHtml(aluno.aluno_nome)}</td>
            <td></td>
          </tr>`
      )
      .join("");
    const janela = window.open("", "_blank", "width=1000,height=800");
    if (!janela) {
      alert("O navegador bloqueou a janela de impressão.");
      return;
    }
    janela.document.write(`<!doctype html>
      <html lang="pt-BR"><head><meta charset="utf-8">
      <title>Lista de presença - ${escaparHtml(turma.nome)}</title>
      <style>
        @page { size: A4 portrait; margin: 10mm; }
        * { box-sizing: border-box; }
        body { font-family: Arial, sans-serif; color: #111827; margin: 0; }
        header { display:flex; align-items:center; gap:18px; border-bottom:2px solid #17233a; padding-bottom:10px; }
        img { width:110px; max-height:60px; object-fit:contain; }
        h1 { font-size:20px; margin:0 0 5px; }
        p { margin:3px 0; font-size:12px; }
        table { width:100%; border-collapse:collapse; margin-top:12px; font-size:11px; }
        th, td { border:1px solid #475569; padding:6px; height:29px; }
        th { background:#e8edf4; text-align:left; }
        th:first-child, td:first-child { width:35px; text-align:center; }
        th:last-child, td:last-child { width:43%; }
        footer { margin-top:12px; font-size:10px; color:#475569; }
        @media print { .acoes { display:none; } }
      </style></head><body>
      <div class="acoes"><button onclick="window.print()">Imprimir / Salvar PDF</button></div>
      <header>
        <img src="/logo-cedep.png" alt="CEDEP">
        <div>
          <h1>Lista de presença</h1>
          <p><strong>Turma:</strong> ${escaparHtml(turma.nome)}</p>
          <p><strong>Curso:</strong> ${escaparHtml(turma.curso)} &nbsp; | &nbsp;
          <strong>Data:</strong> ${data.split("-").reverse().join("/")}</p>
        </div>
      </header>
      <table><thead><tr><th>Nº</th><th>Aluno(a)</th><th>Assinatura</th></tr></thead>
      <tbody>${linhas}</tbody></table>
      <footer>CEDEP Cursos — registro diário de presença</footer>
      <script>window.onload=()=>setTimeout(()=>window.print(),300)</script>
      </body></html>`);
    janela.document.close();
  };

  const historico = (dados.presencas ?? [])
    .filter((item) => !turmaId || item.turmaId === turmaId)
    .sort((a, b) => b.data.localeCompare(a.data))
    .slice(0, 12);

  return (
    <div>
      <header style={estilos.cabecalho}>
        <div>
          <h1 style={{ margin: 0 }}>Registro de Presença</h1>
          <p style={estilos.textoCinza}>
            Marque somente quem faltou. Os demais ficam presentes
            automaticamente.
          </p>
        </div>
      </header>

      <section style={estilos.caixa}>
        <div style={estilos.filtros}>
          <label style={estilos.campo}>
            <strong>Turma</strong>
            <select
              value={turmaId}
              onChange={(evento) => setTurmaId(evento.target.value)}
              style={estilos.input}
            >
              <option value="">Selecione...</option>
              {turmasAtivas.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nome} — {item.curso}
                </option>
              ))}
            </select>
          </label>
          <label style={estilos.campo}>
            <strong>Data</strong>
            <input
              type="date"
              value={data}
              onChange={(evento) => setData(evento.target.value)}
              style={estilos.input}
            />
          </label>
        </div>

        <div style={estilos.resumo}>
          <span><strong>{alunos.length}</strong> alunos</span>
          <span style={{ color: "#166534" }}>
            <strong>{alunos.length - faltas.length}</strong> presentes
          </span>
          <span style={{ color: "#b91c1c" }}>
            <strong>{faltas.length}</strong> faltas
          </span>
        </div>

        {alunos.length === 0 ? (
          <div style={estilos.vazio}>
            Selecione uma turma com alunos matriculados.
          </div>
        ) : (
          <div style={estilos.lista}>
            {alunos.map((aluno) => {
              const faltou = faltas.includes(aluno.aluno_id);
              return (
                <label
                  key={aluno.id}
                  style={{
                    ...estilos.aluno,
                    background: faltou ? "#fff1f2" : "#f0fdf4",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={faltou}
                    onChange={() => alternarFalta(aluno.aluno_id)}
                  />
                  <span style={{ flex: 1 }}>{aluno.aluno_nome}</span>
                  <strong style={{ color: faltou ? "#b91c1c" : "#166534" }}>
                    {faltou ? "Falta" : "Presente"}
                  </strong>
                </label>
              );
            })}
          </div>
        )}

        <div style={estilos.botoes}>
          <button onClick={salvar} style={estilos.botaoPrincipal}>
            Salvar presença do dia
          </button>
          <button onClick={imprimirLista} style={estilos.botaoSecundario}>
            Gerar lista para assinatura / PDF
          </button>
        </div>
      </section>

      <section style={{ ...estilos.caixa, marginTop: 22 }}>
        <h2>Últimos registros</h2>
        {historico.length === 0 ? (
          <p style={estilos.textoCinza}>Nenhuma presença registrada.</p>
        ) : (
          historico.map((registro) => {
            const turmaHistorico = dados.turmas.find(
              (item) => item.id === registro.turmaId
            );
            return (
              <div key={registro.id} style={estilos.historico}>
                <span>
                  <strong>{turmaHistorico?.nome ?? "Turma"}</strong>
                  <br />
                  {registro.data.split("-").reverse().join("/")}
                </span>
                <span>{registro.faltas.length} falta(s)</span>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}

const estilos: Record<string, CSSProperties> = {
  cabecalho: { marginBottom: 24 },
  textoCinza: { color: "#52627a", lineHeight: 1.5 },
  caixa: {
    background: "white",
    padding: 26,
    borderRadius: 17,
    boxShadow: "0 6px 18px rgba(0,0,0,.06)",
  },
  filtros: {
    display: "grid",
    gridTemplateColumns: "minmax(240px, 2fr) minmax(180px, 1fr)",
    gap: 16,
  },
  campo: { display: "flex", flexDirection: "column", gap: 7 },
  input: {
    width: "100%",
    padding: "12px 13px",
    border: "1px solid #cbd5e1",
    borderRadius: 9,
    fontSize: 15,
    boxSizing: "border-box",
  },
  resumo: {
    display: "flex",
    gap: 22,
    flexWrap: "wrap",
    padding: "16px 0",
    marginTop: 8,
  },
  lista: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))",
    gap: 9,
  },
  aluno: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    border: "1px solid #dbe3ee",
    borderRadius: 10,
    padding: "12px 14px",
    cursor: "pointer",
  },
  botoes: { display: "flex", gap: 10, flexWrap: "wrap", marginTop: 20 },
  botaoPrincipal: {
    background: "#15803d",
    color: "white",
    border: "none",
    borderRadius: 9,
    padding: "13px 18px",
    cursor: "pointer",
    fontWeight: 700,
  },
  botaoSecundario: {
    background: "#17233a",
    color: "white",
    border: "none",
    borderRadius: 9,
    padding: "13px 18px",
    cursor: "pointer",
    fontWeight: 700,
  },
  vazio: { padding: 28, textAlign: "center", color: "#64748b" },
  historico: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    padding: "12px 0",
    borderBottom: "1px solid #e2e8f0",
  },
};

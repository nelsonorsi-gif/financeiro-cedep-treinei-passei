import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { UsuarioSessao } from "./Acesso";
import { supabase } from "./lib/supabase";

type Turma = {
  id: string;
  nome: string;
  curso: string;
  unidade: string;
  turno: string;
  ano: number;
  capacidade: number;
  ativo: boolean;
};

type Matricula = {
  id: string;
  aluno_id: string;
  aluno_nome: string;
  turma_id: string;
  status: string;
  data_matricula: string;
  observacao: string;
};

type Aluno = { id: string; nome: string };

const CHAVE_CADASTROS = "financeiro-cedep-cadastros";

function lerAlunos(): Aluno[] {
  try {
    const bruto = JSON.parse(localStorage.getItem(CHAVE_CADASTROS) ?? "{}");
    const lista = Array.isArray(bruto) ? bruto : bruto.alunos ?? [];
    return lista
      .map((item: Record<string, unknown>) => ({
        id: String(item.id ?? ""),
        nome: String(item.nome ?? item.nomeCompleto ?? ""),
      }))
      .filter((item: Aluno) => item.id && item.nome);
  } catch {
    return [];
  }
}

export default function Academico({ usuarioAtual }: { usuarioAtual: UsuarioSessao }) {
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [matriculas, setMatriculas] = useState<Matricula[]>([]);
  const [alunos] = useState<Aluno[]>(lerAlunos);
  const [nome, setNome] = useState("");
  const [curso, setCurso] = useState("");
  const [unidade, setUnidade] = useState("CEDEP");
  const [turno, setTurno] = useState("Noturno");
  const [ano, setAno] = useState(new Date().getFullYear());
  const [capacidade, setCapacidade] = useState(40);
  const [alunoId, setAlunoId] = useState("");
  const [turmaId, setTurmaId] = useState("");
  const [observacao, setObservacao] = useState("");
  const [busca, setBusca] = useState("");

  const carregar = async () => {
    if (!supabase) return;
    const [resultadoTurmas, resultadoMatriculas] = await Promise.all([
      supabase.from("turmas").select("*").order("ano", { ascending: false }).order("nome"),
      supabase.from("matriculas").select("*").order("data_matricula", { ascending: false }),
    ]);
    if (resultadoTurmas.error) throw resultadoTurmas.error;
    if (resultadoMatriculas.error) throw resultadoMatriculas.error;
    setTurmas((resultadoTurmas.data ?? []) as Turma[]);
    setMatriculas((resultadoMatriculas.data ?? []) as Matricula[]);
  };

  useEffect(() => {
    void carregar().catch((erro) => console.error("Erro ao carregar acadêmico:", erro));
  }, []);

  const salvarTurma = async () => {
    if (!supabase || !nome.trim() || !curso.trim()) {
      alert("Informe o nome e o curso da turma.");
      return;
    }
    const { error } = await supabase.from("turmas").insert({
      nome: nome.trim(),
      curso: curso.trim(),
      unidade,
      turno,
      ano,
      capacidade,
      ativo: true,
      criado_por: usuarioAtual.id,
    });
    if (error) {
      alert(error.message);
      return;
    }
    setNome("");
    setCurso("");
    await carregar();
    alert("Turma cadastrada.");
  };

  const matricular = async () => {
    if (!supabase || !alunoId || !turmaId) {
      alert("Selecione o aluno e a turma.");
      return;
    }
    const aluno = alunos.find((item) => item.id === alunoId);
    const { error } = await supabase.from("matriculas").insert({
      aluno_id: alunoId,
      aluno_nome: aluno?.nome ?? "Aluno",
      turma_id: turmaId,
      status: "Ativa",
      data_matricula: new Date().toISOString().slice(0, 10),
      observacao: observacao.trim(),
      criado_por: usuarioAtual.id,
    });
    if (error) {
      alert(error.message);
      return;
    }
    setAlunoId("");
    setTurmaId("");
    setObservacao("");
    await carregar();
    alert("Matrícula realizada.");
  };

  const alterarStatus = async (matricula: Matricula) => {
    if (!supabase) return;
    const novoStatus = matricula.status === "Ativa" ? "Cancelada" : "Ativa";
    const { error } = await supabase
      .from("matriculas")
      .update({ status: novoStatus })
      .eq("id", matricula.id);
    if (error) {
      alert(error.message);
      return;
    }
    await carregar();
  };

  const matriculasFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return matriculas.filter((item) => {
      const turma = turmas.find((registro) => registro.id === item.turma_id);
      return !termo || `${item.aluno_nome} ${turma?.nome ?? ""}`.toLowerCase().includes(termo);
    });
  }, [busca, matriculas, turmas]);

  return (
    <div>
      <header style={estilos.cabecalho}>
        <h1 style={{ margin: 0 }}>Matrículas e Turmas</h1>
        <p style={estilos.textoCinza}>Organize alunos, cursos, turmas, vagas e situação das matrículas.</p>
      </header>

      <div style={estilos.grade}>
        <section style={estilos.caixa}>
          <h2>Nova turma</h2>
          <div style={estilos.formGrid}>
            <Campo label="Nome da turma" value={nome} onChange={setNome} />
            <Campo label="Curso" value={curso} onChange={setCurso} />
            <Campo label="Unidade" value={unidade} onChange={setUnidade} />
            <Campo label="Turno" value={turno} onChange={setTurno} />
            <Campo label="Ano" type="number" value={String(ano)} onChange={(v) => setAno(Number(v))} />
            <Campo label="Capacidade" type="number" value={String(capacidade)} onChange={(v) => setCapacidade(Number(v))} />
          </div>
          <button style={estilos.botao} onClick={salvarTurma}>Salvar turma</button>
        </section>

        <section style={estilos.caixa}>
          <h2>Matricular aluno</h2>
          <label style={estilos.campo}>
            <strong>Aluno</strong>
            <select style={estilos.input} value={alunoId} onChange={(e) => setAlunoId(e.target.value)}>
              <option value="">Selecione...</option>
              {alunos.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
            </select>
          </label>
          <label style={estilos.campo}>
            <strong>Turma</strong>
            <select style={estilos.input} value={turmaId} onChange={(e) => setTurmaId(e.target.value)}>
              <option value="">Selecione...</option>
              {turmas.filter((item) => item.ativo).map((item) => (
                <option key={item.id} value={item.id}>{item.nome} — {item.curso} ({item.ano})</option>
              ))}
            </select>
          </label>
          <Campo label="Observação" value={observacao} onChange={setObservacao} />
          <button style={estilos.botao} onClick={matricular}>Confirmar matrícula</button>
        </section>
      </div>

      <section style={{ ...estilos.caixa, marginTop: 24 }}>
        <h2>Turmas cadastradas</h2>
        <div style={estilos.cards}>
          {turmas.map((turma) => {
            const ocupadas = matriculas.filter((m) => m.turma_id === turma.id && m.status === "Ativa").length;
            return (
              <div style={estilos.card} key={turma.id}>
                <strong>{turma.nome}</strong>
                <span>{turma.curso} • {turma.turno} • {turma.ano}</span>
                <span>{turma.unidade} • {ocupadas}/{turma.capacidade} vagas ocupadas</span>
              </div>
            );
          })}
        </div>
      </section>

      <section style={{ ...estilos.caixa, marginTop: 24 }}>
        <div style={estilos.topoLista}>
          <h2>Matrículas</h2>
          <input style={estilos.inputBusca} value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar aluno ou turma..." />
        </div>
        {matriculasFiltradas.map((matricula) => {
          const turma = turmas.find((item) => item.id === matricula.turma_id);
          return (
            <div style={estilos.registro} key={matricula.id}>
              <div>
                <strong>{matricula.aluno_nome}</strong>
                <div style={estilos.textoCinza}>{turma?.nome ?? "Turma"} • {turma?.curso ?? ""}</div>
              </div>
              <div style={estilos.acoes}>
                <span style={{ ...estilos.status, background: matricula.status === "Ativa" ? "#dcfce7" : "#fee2e2" }}>{matricula.status}</span>
                <button style={estilos.secundario} onClick={() => alterarStatus(matricula)}>
                  {matricula.status === "Ativa" ? "Cancelar" : "Reativar"}
                </button>
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}

function Campo({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (valor: string) => void; type?: string }) {
  return (
    <label style={estilos.campo}>
      <strong>{label}</strong>
      <input style={estilos.input} type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

const estilos: Record<string, CSSProperties> = {
  cabecalho: { marginBottom: 25 },
  textoCinza: { color: "#526078", lineHeight: 1.6 },
  grade: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 24 },
  caixa: { background: "white", padding: 28, borderRadius: 17, boxShadow: "0 6px 18px rgba(0,0,0,.06)" },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 15 },
  campo: { display: "flex", flexDirection: "column", gap: 7, marginTop: 12 },
  input: { width: "100%", padding: "12px 13px", border: "1px solid #cbd5e1", borderRadius: 9, boxSizing: "border-box", fontSize: 15 },
  botao: { marginTop: 20, background: "#15803d", color: "white", border: 0, borderRadius: 9, padding: "13px 20px", fontWeight: 700, cursor: "pointer" },
  cards: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 14 },
  card: { display: "flex", flexDirection: "column", gap: 8, padding: 18, border: "1px solid #e2e8f0", borderRadius: 12 },
  topoLista: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 15, flexWrap: "wrap" },
  inputBusca: { minWidth: 280, padding: "12px 13px", border: "1px solid #cbd5e1", borderRadius: 9 },
  registro: { display: "flex", justifyContent: "space-between", gap: 15, alignItems: "center", padding: "16px 0", borderBottom: "1px solid #e2e8f0", flexWrap: "wrap" },
  acoes: { display: "flex", gap: 8, alignItems: "center" },
  status: { padding: "7px 10px", borderRadius: 20, fontWeight: 700 },
  secundario: { background: "white", border: "1px solid #cbd5e1", borderRadius: 8, padding: "9px 12px", cursor: "pointer" },
};

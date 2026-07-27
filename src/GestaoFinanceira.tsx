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
  supabase,
  supabaseConfigurado,
} from "./lib/supabase";

type Fechamento = {
  id: number;
  data_inicial: string;
  data_final: string;
  unidade: string;
  banco: string;
  saldo_inicial: number;
  entradas: number;
  saidas: number;
  saldo_calculado: number;
  saldo_informado: number | null;
  diferenca: number;
  status:
    | "Aberto"
    | "Fechado"
    | "Reaberto";
  observacao: string;
  criado_em: string;
};

type Auditoria = {
  id: number;
  tabela: string;
  registro_id: string;
  operacao:
    | "INSERT"
    | "UPDATE"
    | "DELETE";
  usuario_id: string | null;
  criado_em: string;
};

type LancamentoLocal = {
  data: string;
  entrada: number;
  saida: number;
  unidade: string;
  formaPagamento: string;
};

const moeda = (valor: number) =>
  Number(valor || 0).toLocaleString(
    "pt-BR",
    {
      style: "currency",
      currency: "BRL",
    }
  );

const hojeISO = () =>
  new Date()
    .toISOString()
    .slice(0, 10);

const primeiroDiaMes = () => {
  const data = new Date();
  return `${data.getFullYear()}-${String(
    data.getMonth() + 1
  ).padStart(2, "0")}-01`;
};

const numero = (valor: string) => {
  const convertido = Number(
    valor
      .replace(/\./g, "")
      .replace(",", ".")
  );
  return Number.isFinite(convertido)
    ? convertido
    : 0;
};

const lerLancamentos = () => {
  try {
    const valor = localStorage.getItem(
      "financeiro-cedep-lancamentos"
    );
    return valor
      ? (JSON.parse(
          valor
        ) as LancamentoLocal[])
      : [];
  } catch {
    return [];
  }
};

export default function GestaoFinanceira({
  usuarioAtual,
}: {
  usuarioAtual: UsuarioSessao;
}) {
  const [dataInicial, setDataInicial] =
    useState(primeiroDiaMes());
  const [dataFinal, setDataFinal] =
    useState(hojeISO());
  const [unidade, setUnidade] =
    useState("");
  const [banco, setBanco] =
    useState("");
  const [
    saldoInicial,
    setSaldoInicial,
  ] = useState("0");
  const [
    saldoInformado,
    setSaldoInformado,
  ] = useState("");
  const [
    observacao,
    setObservacao,
  ] = useState("");
  const [
    fechamentos,
    setFechamentos,
  ] = useState<Fechamento[]>([]);
  const [auditoria, setAuditoria] =
    useState<Auditoria[]>([]);
  const [mensagem, setMensagem] =
    useState("");
  const [processando, setProcessando] =
    useState(false);

  const lancamentos =
    useMemo(
      lerLancamentos,
      [
        dataInicial,
        dataFinal,
        unidade,
        banco,
      ]
    );

  const lancamentosPeriodo =
    useMemo(
      () =>
        lancamentos.filter(
          (item) =>
            (!dataInicial ||
              item.data >=
                dataInicial) &&
            (!dataFinal ||
              item.data <=
                dataFinal) &&
            (!unidade ||
              item.unidade ===
                unidade) &&
            (!banco ||
              item.formaPagamento ===
                banco)
        ),
      [
        lancamentos,
        dataInicial,
        dataFinal,
        unidade,
        banco,
      ]
    );

  const entradas =
    lancamentosPeriodo.reduce(
      (total, item) =>
        total +
        Number(item.entrada || 0),
      0
    );
  const saidas =
    lancamentosPeriodo.reduce(
      (total, item) =>
        total +
        Number(item.saida || 0),
      0
    );
  const saldoCalculado =
    numero(saldoInicial) +
    entradas -
    saidas;
  const diferenca =
    saldoInformado === ""
      ? 0
      : numero(saldoInformado) -
        saldoCalculado;

  const unidades = Array.from(
    new Set(
      lancamentos
        .map((item) => item.unidade)
        .filter(Boolean)
    )
  ).sort();
  const bancos = Array.from(
    new Set(
      lancamentos
        .map(
          (item) =>
            item.formaPagamento
        )
        .filter(Boolean)
    )
  ).sort();

  const carregar = async () => {
    if (
      !supabaseConfigurado ||
      !supabase
    ) {
      return;
    }
    const [
      resultadoFechamentos,
      resultadoAuditoria,
    ] = await Promise.all([
      supabase
        .from(
          "fechamentos_financeiros"
        )
        .select("*")
        .order("criado_em", {
          ascending: false,
        })
        .limit(30),
      supabase
        .from("auditoria_erp")
        .select(
          "id,tabela,registro_id,operacao,usuario_id,criado_em"
        )
        .order("criado_em", {
          ascending: false,
        })
        .limit(50),
    ]);

    if (!resultadoFechamentos.error) {
      setFechamentos(
        (resultadoFechamentos.data ??
          []) as Fechamento[]
      );
    }
    if (!resultadoAuditoria.error) {
      setAuditoria(
        (resultadoAuditoria.data ??
          []) as Auditoria[]
      );
    }
  };

  useEffect(() => {
    void carregar();
  }, []);

  const salvarFechamento =
    async () => {
      if (
        !supabase ||
        !dataInicial ||
        !dataFinal
      ) {
        return;
      }
      if (dataFinal < dataInicial) {
        alert(
          "A data final não pode ser anterior à inicial."
        );
        return;
      }
      try {
        setProcessando(true);
        setMensagem("");
        const { error } =
          await supabase
            .from(
              "fechamentos_financeiros"
            )
            .insert({
              data_inicial:
                dataInicial,
              data_final: dataFinal,
              unidade,
              banco,
              saldo_inicial:
                numero(saldoInicial),
              entradas,
              saidas,
              saldo_calculado:
                saldoCalculado,
              saldo_informado:
                saldoInformado === ""
                  ? null
                  : numero(
                      saldoInformado
                    ),
              status: "Fechado",
              observacao,
              criado_por:
                usuarioAtual.id,
              fechado_por:
                usuarioAtual.id,
              fechado_em:
                new Date().toISOString(),
            });
        if (error) throw error;
        setMensagem(
          "Fechamento registrado com sucesso."
        );
        setObservacao("");
        await carregar();
      } catch (erro) {
        console.error(erro);
        setMensagem(
          "Não foi possível salvar o fechamento."
        );
      } finally {
        setProcessando(false);
      }
    };

  const criarBackup = async () => {
    if (!supabase) return;
    const dados: Record<
      string,
      unknown
    > = {};
    for (
      let indice = 0;
      indice < localStorage.length;
      indice += 1
    ) {
      const chave =
        localStorage.key(indice);
      if (
        !chave ||
        !chave.startsWith(
          "financeiro-cedep-"
        )
      ) {
        continue;
      }
      const valor =
        localStorage.getItem(chave);
      try {
        dados[chave] =
          valor === null
            ? null
            : JSON.parse(valor);
      } catch {
        dados[chave] = valor;
      }
    }

    const texto =
      JSON.stringify(dados);
    try {
      setProcessando(true);
      const { error } =
        await supabase
          .from("backups_erp")
          .insert({
            usuario_id:
              usuarioAtual.id,
            tipo: "manual",
            payload: dados,
            tamanho_bytes:
              new Blob([texto]).size,
          });
      if (error) throw error;
      setMensagem(
        "Backup seguro criado na nuvem."
      );
    } catch (erro) {
      console.error(erro);
      setMensagem(
        "Não foi possível criar o backup na nuvem."
      );
    } finally {
      setProcessando(false);
    }
  };

  return (
    <div>
      <header style={estilos.cabecalho}>
        <h1 style={estilos.titulo}>
          Gestão e Fechamento
        </h1>
        <p style={estilos.textoCinza}>
          Conciliação, fechamento por
          período, auditoria e backup
          seguro.
        </p>
      </header>

      <section style={estilos.cards}>
        <Card
          titulo="Entradas realizadas"
          valor={moeda(entradas)}
        />
        <Card
          titulo="Saídas realizadas"
          valor={moeda(saidas)}
        />
        <Card
          titulo="Saldo calculado"
          valor={moeda(
            saldoCalculado
          )}
        />
        <Card
          titulo="Diferença"
          valor={moeda(diferenca)}
          alerta={
            Math.abs(diferenca) > 0.01
          }
        />
      </section>

      <section style={estilos.caixa}>
        <h2>
          Novo fechamento financeiro
        </h2>
        <div style={estilos.formGrid}>
          <Campo
            label="Data inicial"
            type="date"
            value={dataInicial}
            onChange={setDataInicial}
          />
          <Campo
            label="Data final"
            type="date"
            value={dataFinal}
            onChange={setDataFinal}
          />
          <Selecao
            label="Unidade"
            value={unidade}
            onChange={setUnidade}
            opcoes={unidades}
            todos="Todas"
          />
          <Selecao
            label="Banco / Conta"
            value={banco}
            onChange={setBanco}
            opcoes={bancos}
            todos="Todos"
          />
          <Campo
            label="Saldo inicial"
            value={saldoInicial}
            onChange={setSaldoInicial}
          />
          <Campo
            label="Saldo contado/informado"
            value={saldoInformado}
            onChange={setSaldoInformado}
            placeholder="Opcional"
          />
          <Campo
            label="Observação"
            value={observacao}
            onChange={setObservacao}
            placeholder="Ocorrências do fechamento"
          />
        </div>
        <div style={estilos.acoes}>
          <button
            onClick={() =>
              void salvarFechamento()
            }
            disabled={processando}
            style={estilos.botaoPrincipal}
          >
            Salvar fechamento
          </button>
          <button
            onClick={() =>
              void criarBackup()
            }
            disabled={processando}
            style={estilos.botaoBackup}
          >
            Criar backup na nuvem
          </button>
        </div>
        {mensagem && (
          <p style={estilos.mensagem}>
            {mensagem}
          </p>
        )}
      </section>

      <section
        style={{
          ...estilos.caixa,
          marginTop: 24,
        }}
      >
        <h2>
          Histórico de fechamentos
        </h2>
        {!fechamentos.length ? (
          <p style={estilos.textoCinza}>
            Nenhum fechamento
            registrado.
          </p>
        ) : (
          <div
            style={
              estilos.tabelaContainer
            }
          >
            <table style={estilos.tabela}>
              <thead>
                <tr>
                  <th style={estilos.th}>
                    Período
                  </th>
                  <th style={estilos.th}>
                    Unidade
                  </th>
                  <th style={estilos.th}>
                    Banco
                  </th>
                  <th style={estilos.th}>
                    Entradas
                  </th>
                  <th style={estilos.th}>
                    Saídas
                  </th>
                  <th style={estilos.th}>
                    Saldo
                  </th>
                  <th style={estilos.th}>
                    Diferença
                  </th>
                </tr>
              </thead>
              <tbody>
                {fechamentos.map(
                  (item) => (
                    <tr key={item.id}>
                      <td
                        style={estilos.td}
                      >
                        {item.data_inicial} a{" "}
                        {item.data_final}
                      </td>
                      <td
                        style={estilos.td}
                      >
                        {item.unidade ||
                          "Todas"}
                      </td>
                      <td
                        style={estilos.td}
                      >
                        {item.banco ||
                          "Todos"}
                      </td>
                      <td
                        style={estilos.td}
                      >
                        {moeda(
                          item.entradas
                        )}
                      </td>
                      <td
                        style={estilos.td}
                      >
                        {moeda(
                          item.saidas
                        )}
                      </td>
                      <td
                        style={estilos.td}
                      >
                        {moeda(
                          item.saldo_calculado
                        )}
                      </td>
                      <td
                        style={estilos.td}
                      >
                        {moeda(
                          item.diferenca
                        )}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {usuarioAtual.perfil !==
        "Secretaria" && (
        <section
          style={{
            ...estilos.caixa,
            marginTop: 24,
          }}
        >
          <h2>
            Atividades recentes
          </h2>
          {!auditoria.length ? (
            <p
              style={
                estilos.textoCinza
              }
            >
              Nenhuma atividade
              registrada.
            </p>
          ) : (
            <div
              style={
                estilos.listaAuditoria
              }
            >
              {auditoria.map(
                (item) => (
                  <div
                    key={item.id}
                    style={
                      estilos.itemAuditoria
                    }
                  >
                    <strong>
                      {item.operacao}
                    </strong>
                    <span>
                      {item.tabela} •{" "}
                      {item.registro_id}
                    </span>
                    <small>
                      {new Date(
                        item.criado_em
                      ).toLocaleString(
                        "pt-BR"
                      )}
                    </small>
                  </div>
                )
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function Card({
  titulo,
  valor,
  alerta = false,
}: {
  titulo: string;
  valor: string;
  alerta?: boolean;
}) {
  return (
    <div
      style={{
        ...estilos.card,
        borderTop: `4px solid ${
          alerta ? "#dc2626" : "#15803d"
        }`,
      }}
    >
      <span style={estilos.textoCinza}>
        {titulo}
      </span>
      <strong style={{ fontSize: 24 }}>
        {valor}
      </strong>
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
  onChange: (valor: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label style={estilos.campo}>
      <strong>{label}</strong>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(evento) =>
          onChange(evento.target.value)
        }
        style={estilos.input}
      />
    </label>
  );
}

function Selecao({
  label,
  value,
  onChange,
  opcoes,
  todos,
}: {
  label: string;
  value: string;
  onChange: (valor: string) => void;
  opcoes: string[];
  todos: string;
}) {
  return (
    <label style={estilos.campo}>
      <strong>{label}</strong>
      <select
        value={value}
        onChange={(evento) =>
          onChange(evento.target.value)
        }
        style={estilos.input}
      >
        <option value="">{todos}</option>
        {opcoes.map((opcao) => (
          <option
            key={opcao}
            value={opcao}
          >
            {opcao}
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
  cabecalho: { marginBottom: 24 },
  titulo: {
    margin: 0,
    fontSize: 32,
    color: "#0f172a",
  },
  textoCinza: {
    color: "#64748b",
    lineHeight: 1.6,
  },
  cards: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit,minmax(190px,1fr))",
    gap: 18,
    marginBottom: 24,
  },
  card: {
    background: "#fff",
    borderRadius: 15,
    padding: 20,
    display: "flex",
    flexDirection: "column",
    gap: 10,
    boxShadow:
      "0 6px 18px rgba(15,23,42,.07)",
  },
  caixa: {
    background: "#fff",
    borderRadius: 17,
    padding: 26,
    boxShadow:
      "0 6px 18px rgba(15,23,42,.07)",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit,minmax(220px,1fr))",
    gap: 16,
  },
  campo: {
    display: "flex",
    flexDirection: "column",
    gap: 7,
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #cbd5e1",
    borderRadius: 9,
    padding: "12px 13px",
    background: "#fff",
    color: "#0f172a",
    fontSize: 15,
  },
  acoes: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 20,
  },
  botaoPrincipal: {
    border: 0,
    borderRadius: 9,
    padding: "12px 18px",
    background: "#15803d",
    color: "#fff",
    fontWeight: 700,
    cursor: "pointer",
  },
  botaoBackup: {
    border: 0,
    borderRadius: 9,
    padding: "12px 18px",
    background: "#1d4ed8",
    color: "#fff",
    fontWeight: 700,
    cursor: "pointer",
  },
  mensagem: {
    marginTop: 18,
    background: "#eff6ff",
    color: "#1e3a8a",
    padding: 12,
    borderRadius: 9,
  },
  tabelaContainer: {
    overflowX: "auto",
  },
  tabela: {
    width: "100%",
    minWidth: 920,
    borderCollapse: "collapse",
  },
  th: {
    background: "#101a2d",
    color: "#fff",
    textAlign: "left",
    padding: 12,
  },
  td: {
    padding: 12,
    borderBottom: "1px solid #e2e8f0",
    whiteSpace: "nowrap",
  },
  listaAuditoria: {
    display: "grid",
    gap: 9,
  },
  itemAuditoria: {
    display: "grid",
    gridTemplateColumns:
      "100px minmax(220px,1fr) auto",
    gap: 12,
    padding: 12,
    background: "#f8fafc",
    borderRadius: 9,
    color: "#334155",
  },
};

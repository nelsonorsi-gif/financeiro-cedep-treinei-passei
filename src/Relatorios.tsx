import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";

import * as XLSX from "xlsx";

export type LancamentoRelatorio = {
  id: string;

  dia: string;

  data?: string;

  competencia?: string;

  descricao: string;

  tipoEntrada: string;

  tipoSaida: string;

  formaPagamento: string;

  entrada: number;

  saida: number;

  unidade: string;

  origem?: "manual" | "excel";
};

type Props = {
  lancamentos:
    LancamentoRelatorio[];
};

function Relatorios({
  lancamentos,
}: Props) {
  const [
    tipo,
    setTipo,
  ] = useState("Todos");

  const [
    bancosSelecionados,
    setBancosSelecionados,
  ] = useState<string[]>([]);

  const [
    unidade,
    setUnidade,
  ] = useState("Todas");

  const [
    competenciasSelecionadas,
    setCompetenciasSelecionadas,
  ] = useState<string[]>([]);

  const [
    dataInicial,
    setDataInicial,
  ] = useState("");

  const [
    dataFinal,
    setDataFinal,
  ] = useState("");

  const [
    busca,
    setBusca,
  ] = useState("");

  const [
    paginaResultado,
    setPaginaResultado,
  ] = useState(1);

  const porPagina = 15;

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

  /* =======================================================
     LISTAS AUTOMÁTICAS
  ======================================================= */

  const bancos =
    useMemo(() => {
      return Array.from(
        new Set(
          lancamentos
            .map(
              (item) =>
                item.formaPagamento.trim()
            )
            .filter(Boolean)
        )
      ).sort();
    }, [lancamentos]);

  const unidades =
    useMemo(() => {
      return Array.from(
        new Set(
          lancamentos
            .map(
              (item) =>
                item.unidade.trim()
            )
            .filter(Boolean)
        )
      ).sort();
    }, [lancamentos]);

  const competencias =
    useMemo(() => {
      const lista =
        Array.from(
          new Set(
            lancamentos
              .map(
                (item) =>
                  item.competencia?.trim()
              )
              .filter(
                (
                  valor
                ): valor is string =>
                  Boolean(valor)
              )
          )
        );

      /*
        Ordena MM/AAAA cronologicamente.
      */
      return lista.sort(
        (a, b) => {
          const [
            mesA,
            anoA,
          ] = a.split("/");

          const [
            mesB,
            anoB,
          ] = b.split("/");

          const dataA =
            Number(anoA) *
              100 +
            Number(mesA);

          const dataB =
            Number(anoB) *
              100 +
            Number(mesB);

          return dataA - dataB;
        }
      );
    }, [lancamentos]);

  /* =======================================================
     FILTROS
  ======================================================= */

  const filtrados =
    useMemo(() => {
      return lancamentos.filter(
        (item) => {
          const correspondeTipo =
            tipo ===
              "Todos" ||
            (tipo ===
              "Entradas" &&
              item.entrada >
                0) ||
            (tipo ===
              "Saídas" &&
              item.saida > 0);

          const correspondeBanco =
            bancosSelecionados.length === 0 ||
            bancosSelecionados.includes(
              item.formaPagamento.trim()
            );

          const correspondeUnidade =
            unidade ===
              "Todas" ||
            item.unidade.trim() ===
              unidade;

          const correspondeCompetencia =
            competenciasSelecionadas.length === 0 ||
            competenciasSelecionadas.includes(
              item.competencia || ""
            );

          const correspondeBusca =
            item.descricao
              .toLowerCase()
              .includes(
                busca.toLowerCase()
              );

          /*
            Filtro de datas completas.
            Só aplica se o lançamento tiver data.
          */
          let correspondePeriodo =
            true;

          if (
            dataInicial &&
            item.data
          ) {
            correspondePeriodo =
              correspondePeriodo &&
              item.data >=
                dataInicial;
          }

          if (
            dataFinal &&
            item.data
          ) {
            correspondePeriodo =
              correspondePeriodo &&
              item.data <=
                dataFinal;
          }

          return (
            correspondeTipo &&
            correspondeBanco &&
            correspondeUnidade &&
            correspondeCompetencia &&
            correspondeBusca &&
            correspondePeriodo
          );
        }
      );
    }, [
      lancamentos,
      tipo,
      bancosSelecionados,
      unidade,
      competenciasSelecionadas,
      dataInicial,
      dataFinal,
      busca,
    ]);

  /* =======================================================
     TOTAIS
  ======================================================= */

  const totalEntradas =
    filtrados.reduce(
      (total, item) =>
        total +
        item.entrada,
      0
    );

  const totalSaidas =
    filtrados.reduce(
      (total, item) =>
        total +
        item.saida,
      0
    );

  const saldo =
    totalEntradas -
    totalSaidas;

  const totalPaginas =
    Math.max(
      1,
      Math.ceil(
        filtrados.length /
          porPagina
      )
    );

  const paginaValida =
    Math.min(
      paginaResultado,
      totalPaginas
    );

  const resultadosPagina =
    filtrados.slice(
      (paginaValida - 1) *
        porPagina,
      paginaValida *
        porPagina
    );

  useEffect(() => {
    setPaginaResultado(1);
  }, [
    tipo,
    bancosSelecionados,
    unidade,
    competenciasSelecionadas,
    dataInicial,
    dataFinal,
    busca,
  ]);

  /* =======================================================
     EXPORTAR EXCEL
  ======================================================= */

  const exportarExcel =
    () => {
      if (
        filtrados.length ===
        0
      ) {
        alert(
          "Não há dados para exportar."
        );

        return;
      }

      const formatarData =
        (
          data?: string
        ) => {
          if (!data) {
            return "";
          }

          const [
            ano,
            mes,
            dia,
          ] =
            data.split("-");

          if (
            !ano ||
            !mes ||
            !dia
          ) {
            return data;
          }

          return `${dia}/${mes}/${ano}`;
        };

      const dados =
        filtrados.map(
          (item) => ({
            Data:
              formatarData(
                item.data
              ),

            Competência:
              item.competencia ||
              "",

            Descrição:
              item.descricao,

            "Tipo de Entrada":
              item.tipoEntrada,

            "Tipo de Saída":
              item.tipoSaida,

            "Banco / Conta":
              item.formaPagamento,

            Entrada:
              item.entrada,

            Saída:
              item.saida,

            Unidade:
              item.unidade,
          })
        );

      dados.push({
        Data: "",

        Competência: "",

        Descrição:
          "TOTAL",

        "Tipo de Entrada":
          "",

        "Tipo de Saída":
          "",

        "Banco / Conta":
          "",

        Entrada:
          totalEntradas,

        Saída:
          totalSaidas,

        Unidade: "",
      });

      const planilha =
        XLSX.utils.json_to_sheet(
          dados
        );

      /*
        Larguras aproximadas
        para melhorar o Excel.
      */
      planilha["!cols"] = [
        { wch: 13 },

        { wch: 13 },

        { wch: 35 },

        { wch: 22 },

        { wch: 22 },

        { wch: 20 },

        { wch: 15 },

        { wch: 15 },

        { wch: 18 },
      ];

      const pasta =
        XLSX.utils.book_new();

      XLSX.utils.book_append_sheet(
        pasta,
        planilha,
        "Relatório"
      );

      let nomeArquivo =
        "relatorio-financeiro";

      if (competenciasSelecionadas.length === 1) {
        nomeArquivo += `-${competenciasSelecionadas[0].replace("/", "-")}`;
      } else if (competenciasSelecionadas.length > 1) {
        nomeArquivo += `-${competenciasSelecionadas.length}-competencias`;
      }

      XLSX.writeFile(
        pasta,
        `${nomeArquivo}.xlsx`
      );
    };

  const exportarPdf = () => {
    if (filtrados.length === 0) {
      alert("Não há dados para gerar o PDF.");
      return;
    }

    const escapar = (valor: string) =>
      valor
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
    const paginas: LancamentoRelatorio[][] = [];
    for (let indice = 0; indice < filtrados.length; indice += 32) {
      paginas.push(filtrados.slice(indice, indice + 32));
    }
    const resumoFiltros = [
      competenciasSelecionadas.length
        ? `Competências: ${competenciasSelecionadas.join(", ")}`
        : "",
      dataInicial ? `De: ${formatarDataTela(dataInicial)}` : "",
      dataFinal ? `Até: ${formatarDataTela(dataFinal)}` : "",
      tipo !== "Todos" ? `Tipo: ${tipo}` : "",
      bancosSelecionados.length
        ? `Bancos: ${bancosSelecionados.join(", ")}`
        : "",
      unidade !== "Todas" ? `Unidade: ${unidade}` : "",
    ]
      .filter(Boolean)
      .join(" • ");
    const conteudo = paginas
      .map(
        (pagina, numero) => `
        <section class="pagina">
          <header>
            <img src="/logo-cedep.png" alt="CEDEP">
            <div><h1>Relatório financeiro</h1>
            <p>${escapar(resumoFiltros || "Todos os períodos e movimentações")}</p></div>
            <span>Página ${numero + 1}/${paginas.length}</span>
          </header>
          ${
            numero === 0
              ? `<div class="totais">
                  <b>Entradas: ${moeda(totalEntradas)}</b>
                  <b>Saídas: ${moeda(totalSaidas)}</b>
                  <b>Saldo: ${moeda(saldo)}</b>
                  <b>${filtrados.length} lançamento(s)</b>
                </div>`
              : ""
          }
          <table><thead><tr>
            <th>Data</th><th>Descrição</th><th>Tipo</th><th>Banco</th>
            <th>Entrada</th><th>Saída</th><th>Unidade</th>
          </tr></thead><tbody>
          ${pagina
            .map(
              (item) => `<tr>
                <td>${escapar(item.data ? formatarDataTela(item.data) : item.dia)}</td>
                <td>${escapar(item.descricao)}</td>
                <td>${escapar(item.tipoEntrada || item.tipoSaida)}</td>
                <td>${escapar(item.formaPagamento)}</td>
                <td>${item.entrada > 0 ? moeda(item.entrada) : ""}</td>
                <td>${item.saida > 0 ? moeda(item.saida) : ""}</td>
                <td>${escapar(item.unidade)}</td>
              </tr>`
            )
            .join("")}
          </tbody></table>
        </section>`
      )
      .join("");
    const janela = window.open("", "_blank", "width=1100,height=800");
    if (!janela) {
      alert("O navegador bloqueou a janela do relatório.");
      return;
    }
    janela.document.write(`<!doctype html><html lang="pt-BR"><head>
      <meta charset="utf-8"><title>Relatório financeiro CEDEP</title>
      <style>
        @page { size:A4 landscape; margin:8mm; }
        * { box-sizing:border-box; }
        body { margin:0; font-family:Arial,sans-serif; color:#111827; }
        .pagina { break-after:page; min-height:185mm; }
        .pagina:last-child { break-after:auto; }
        header { display:flex; align-items:center; gap:14px; border-bottom:2px solid #17233a; padding-bottom:7px; }
        header img { width:90px; max-height:46px; object-fit:contain; }
        header div { flex:1; } h1 { margin:0; font-size:17px; } p { margin:3px 0 0; font-size:8pt; }
        header span { font-size:8pt; }
        .totais { display:flex; gap:24px; margin:7px 0; padding:7px; background:#eef2f7; font-size:8.5pt; }
        table { width:100%; border-collapse:collapse; margin-top:7px; font-size:7.5pt; }
        th { background:#17233a; color:white; padding:4px; text-align:left; }
        td { border-bottom:1px solid #d9e0e9; padding:3.5px 4px; }
        td:nth-child(5),td:nth-child(6) { text-align:right; white-space:nowrap; }
        .acoes { margin-bottom:8px; }
        @media print { .acoes { display:none; } }
      </style></head><body>
      <div class="acoes"><button onclick="window.print()">Imprimir / Salvar PDF</button></div>
      ${conteudo}<script>window.onload=()=>setTimeout(()=>window.print(),350)</script>
      </body></html>`);
    janela.document.close();
  };

  /* =======================================================
     LIMPAR FILTROS
  ======================================================= */

  const limparFiltros =
    () => {
      setTipo("Todos");

      setBancosSelecionados([]);

      setUnidade("Todas");

      setCompetenciasSelecionadas([]);

      setDataInicial("");

      setDataFinal("");

      setBusca("");
    };

  /* =======================================================
     INTERFACE
  ======================================================= */

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
          Relatórios
        </h1>

        <p
          style={
            estilos.textoCinza
          }
        >
          Consulte movimentações por
          competência, período, banco,
          unidade e tipo.
        </p>
      </header>

      {/* CARDS */}

      <section
        style={
          estilos.cards
        }
      >
        <Card
          titulo="Entradas"

          valor={moeda(
            totalEntradas
          )}
        />

        <Card
          titulo="Saídas"

          valor={moeda(
            totalSaidas
          )}
        />

        <Card
          titulo="Saldo"

          valor={moeda(
            saldo
          )}
        />

        <Card
          titulo="Lançamentos"

          valor={String(
            filtrados.length
          )}
        />
      </section>

      {/* FILTROS */}

      <section
        style={
          estilos.caixa
        }
      >
        <h2>
          Filtros
        </h2>

        <div
          style={
            estilos.filtros
          }
        >
          <CampoMultiSelect
            label="Competências"
            valores={competenciasSelecionadas}
            onChange={setCompetenciasSelecionadas}
            opcoes={competencias}
            textoTodas="Todas as competências"
          />

          <CampoSelect
            label="Tipo"

            value={tipo}

            onChange={
              setTipo
            }

            opcoes={[
              "Todos",

              "Entradas",

              "Saídas",
            ]}
          />

          <CampoMultiSelect
            label="Bancos / Contas"
            valores={bancosSelecionados}
            onChange={setBancosSelecionados}
            opcoes={bancos}
            textoTodas="Todos os bancos"
          />

          <CampoSelect
            label="Unidade"

            value={
              unidade
            }

            onChange={
              setUnidade
            }

            opcoes={[
              "Todas",

              ...unidades,
            ]}
          />

          <CampoData
            label="Data inicial"

            value={
              dataInicial
            }

            onChange={
              setDataInicial
            }
          />

          <CampoData
            label="Data final"

            value={
              dataFinal
            }

            onChange={
              setDataFinal
            }
          />

          <label
            style={
              estilos.campoGrupo
            }
          >
            <strong>
              Buscar descrição
            </strong>

            <input
              value={
                busca
              }

              onChange={(
                evento
              ) =>
                setBusca(
                  evento.target.value
                )
              }

              placeholder="Ex.: Mensalidade"

              style={
                estilos.input
              }
            />
          </label>
        </div>

        <div
          style={
            estilos.botoes
          }
        >
          <button
            onClick={
              exportarExcel
            }

            style={
              estilos.botaoExcel
            }
          >
            Exportar Excel
          </button>

          <button
            onClick={exportarPdf}
            style={estilos.botaoPdf}
          >
            Exportar PDF / Imprimir
          </button>

          <button
            onClick={
              limparFiltros
            }

            style={
              estilos.botaoSecundario
            }
          >
            Limpar filtros
          </button>
        </div>
      </section>

      {/* INDICAÇÃO DO FILTRO */}

      <section
        style={
          estilos.resumoFiltro
        }
      >
        <strong>
          Período selecionado:
        </strong>{" "}

        {competenciasSelecionadas.length
          ? competenciasSelecionadas.join(", ")
          : "Todos os períodos"}

        {dataInicial && (
          <>
            {" | "}

            A partir de{" "}

            {formatarDataTela(
              dataInicial
            )}
          </>
        )}

        {dataFinal && (
          <>
            {" | "}

            Até{" "}

            {formatarDataTela(
              dataFinal
            )}
          </>
        )}
      </section>

      {/* RESULTADO */}

      <section
        style={{
          ...estilos.caixa,

          marginTop: 25,
        }}
      >
        <h2>
          Resultado
        </h2>

        {filtrados.length ===
        0 ? (
          <div
            style={
              estilos.vazio
            }
          >
            Nenhum lançamento encontrado
            para os filtros selecionados.
          </div>
        ) : (
          <>
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
                    Data
                  </th>

                  <th
                    style={
                      estilos.th
                    }
                  >
                    Competência
                  </th>

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
                    Tipo Entrada
                  </th>

                  <th
                    style={
                      estilos.th
                    }
                  >
                    Tipo Saída
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
                    Entrada
                  </th>

                  <th
                    style={
                      estilos.th
                    }
                  >
                    Saída
                  </th>

                  <th
                    style={
                      estilos.th
                    }
                  >
                    Unidade
                  </th>
                </tr>
              </thead>

              <tbody>
                {resultadosPagina.map(
                  (item) => (
                    <tr
                      key={
                        item.id
                      }
                    >
                      <td
                        style={
                          estilos.td
                        }
                      >
                        {item.data
                          ? formatarDataTela(
                              item.data
                            )
                          : item.dia}
                      </td>

                      <td
                        style={
                          estilos.td
                        }
                      >
                        {
                          item.competencia
                        }
                      </td>

                      <td
                        style={
                          estilos.td
                        }
                      >
                        {
                          item.descricao
                        }
                      </td>

                      <td
                        style={
                          estilos.td
                        }
                      >
                        {
                          item.tipoEntrada
                        }
                      </td>

                      <td
                        style={
                          estilos.td
                        }
                      >
                        {
                          item.tipoSaida
                        }
                      </td>

                      <td
                        style={
                          estilos.td
                        }
                      >
                        {
                          item.formaPagamento
                        }
                      </td>

                      <td
                        style={
                          estilos.td
                        }
                      >
                        {item.entrada >
                        0
                          ? moeda(
                              item.entrada
                            )
                          : ""}
                      </td>

                      <td
                        style={
                          estilos.td
                        }
                      >
                        {item.saida > 0
                          ? moeda(
                              item.saida
                            )
                          : ""}
                      </td>

                      <td
                        style={
                          estilos.td
                        }
                      >
                        {
                          item.unidade
                        }
                      </td>
                    </tr>
                  )
                )}
              </tbody>
              </table>
            </div>

            {totalPaginas > 1 && (
              <div
                style={
                  estilos.paginacao
                }
              >
                <button
                  style={
                    estilos.botaoSecundario
                  }
                  disabled={
                    paginaValida === 1
                  }
                  onClick={() =>
                    setPaginaResultado(
                      (atual) =>
                        Math.max(
                          1,
                          atual - 1
                        )
                    )
                  }
                >
                  Anterior
                </button>

                <strong>
                  Página {paginaValida} de{" "}
                  {totalPaginas}
                </strong>

                <button
                  style={
                    estilos.botaoSecundario
                  }
                  disabled={
                    paginaValida ===
                    totalPaginas
                  }
                  onClick={() =>
                    setPaginaResultado(
                      (atual) =>
                        Math.min(
                          totalPaginas,
                          atual + 1
                        )
                    )
                  }
                >
                  Próxima
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

/* =========================================================
   FUNÇÃO DE DATA
========================================================= */

function formatarDataTela(
  data: string
) {
  if (!data) {
    return "";
  }

  const [
    ano,
    mes,
    dia,
  ] = data.split("-");

  if (
    !ano ||
    !mes ||
    !dia
  ) {
    return data;
  }

  return `${dia}/${mes}/${ano}`;
}

/* =========================================================
   COMPONENTES
========================================================= */

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
          fontSize: 25,
        }}
      >
        {valor}
      </strong>
    </div>
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

  opcoes: string[];
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
        {opcoes.map(
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

function CampoMultiSelect({
  label,
  valores,
  onChange,
  opcoes,
  textoTodas,
}: {
  label: string;
  valores: string[];
  onChange: (valores: string[]) => void;
  opcoes: string[];
  textoTodas: string;
}) {
  const resumo =
    valores.length === 0
      ? textoTodas
      : valores.length === 1
        ? valores[0]
        : `${valores.length} itens selecionados`;

  const alternar = (opcao: string) => {
    onChange(
      valores.includes(opcao)
        ? valores.filter((item) => item !== opcao)
        : [...valores, opcao]
    );
  };

  return (
    <div style={estilos.campoGrupo}>
      <strong>{label}</strong>
      <details style={estilos.multiSelect}>
        <summary style={estilos.multiResumo}>{resumo}</summary>
        <div style={estilos.multiMenu}>
          <button
            type="button"
            onClick={() => onChange([])}
            style={estilos.multiTodos}
          >
            Exibir todos
          </button>
          {opcoes.map((opcao) => (
            <label key={opcao} style={estilos.multiOpcao}>
              <input
                type="checkbox"
                checked={valores.includes(opcao)}
                onChange={() => alternar(opcao)}
              />
              <span>{opcao}</span>
            </label>
          ))}
        </div>
      </details>
    </div>
  );
}

function CampoData({
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
      <strong>
        {label}
      </strong>

      <input
        type="date"

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
      />
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

  caixa: {
    background: "white",

    padding: 28,

    borderRadius: 17,

    boxShadow:
      "0 6px 18px rgba(0,0,0,.06)",
  },

  filtros: {
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
  },

  multiSelect: {
    position: "relative",
  },
  multiResumo: {
    padding: "13px 14px",
    border: "1px solid #ccd3dd",
    borderRadius: 9,
    fontSize: 15,
    background: "white",
    cursor: "pointer",
    listStyle: "none",
  },
  multiMenu: {
    position: "absolute",
    zIndex: 20,
    width: "100%",
    maxHeight: 280,
    overflowY: "auto",
    marginTop: 5,
    padding: 10,
    background: "white",
    border: "1px solid #ccd3dd",
    borderRadius: 9,
    boxShadow: "0 10px 28px rgba(15,23,42,.16)",
  },
  multiOpcao: {
    display: "flex",
    alignItems: "center",
    gap: 9,
    padding: "8px 6px",
    cursor: "pointer",
  },
  multiTodos: {
    width: "100%",
    padding: "8px 10px",
    marginBottom: 6,
    border: "1px solid #cbd5e1",
    borderRadius: 7,
    background: "#f8fafc",
    cursor: "pointer",
    fontWeight: 700,
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

  botaoExcel: {
    background: "#15803d",

    color: "white",

    border: "none",

    borderRadius: 9,

    padding: "13px 20px",

    cursor: "pointer",

    fontWeight: "bold",
  },

  botaoPdf: {
    background: "#17233a",
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

  paginacao: {
    display: "flex",

    justifyContent: "center",

    alignItems: "center",

    gap: 14,

    flexWrap: "wrap",

    marginTop: 22,
  },

  resumoFiltro: {
    background: "#eef2f7",

    borderRadius: 12,

    padding: "15px 18px",

    marginTop: 20,

    color: "#334155",
  },

  tabelaContainer: {
    overflowX: "auto",

    marginTop: 20,
  },

  tabela: {
    width: "100%",

    minWidth: 1200,

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

  vazio: {
    textAlign: "center",

    color: "#8c96a8",

    padding: 35,
  },
};

export default Relatorios;

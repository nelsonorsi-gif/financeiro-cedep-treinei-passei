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
import type {
  Perfil,
} from "./Acesso";

type Situacao =
  | "Ativo"
  | "Inativo";

export type Professor = {
  id: string;
  nome: string;
  disciplinas: string[];
  valorHoraAula: number;
  aulasSemanais: number;
  valorCombustivel: number;
  situacao: Situacao;
};

type LancamentoProfessor = {
  id: string;
  professorId: string;
  competencia: string;
  data: string;
  tipoAtividade: string;
  quantidade: number;
  valorUnitario: number;
  pagarCombustivel: boolean;
  valorCombustivel: number;
  pagarPedagio: boolean;
  valorPedagio: number;
  observacao: string;
  pago: boolean;
  dataPagamento: string;
};

type DadosProfessores = {
  professores: Professor[];
  lancamentos: LancamentoProfessor[];
};

export type PagamentoProfessorFinanceiro = {
  id: string;
  professorNome: string;
  competencia: string;
  valor: number;
  data: string;
  banco: string;
  unidade: string;
};

type Props = {
  perfil: Perfil;
  onRegistrarPagamento: (
    pagamento: PagamentoProfessorFinanceiro
  ) => void;
};

export const CHAVE_PROFESSORES =
  "financeiro-cedep-professores";

const hojeISO = () =>
  new Date()
    .toISOString()
    .slice(0, 10);

const competenciaAtual = () =>
  hojeISO().slice(0, 7);

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

  if (texto.includes(",")) {
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

const totalLancamento = (
  item: LancamentoProfessor
) =>
  item.quantidade *
    item.valorUnitario +
  (item.pagarCombustivel
    ? item.valorCombustivel
    : 0) +
  (item.pagarPedagio
    ? item.valorPedagio
    : 0);

const descricaoLancamento = (
  item: LancamentoProfessor
) => {
  const partes = [
    `${item.quantidade} ${item.tipoAtividade}`,
  ];

  if (item.pagarCombustivel) {
    partes.push(
      `combustível ${moeda(
        item.valorCombustivel
      )}`
    );
  }

  if (item.pagarPedagio) {
    partes.push(
      `pedágio ${moeda(
        item.valorPedagio
      )}`
    );
  }

  if (item.observacao) {
    partes.push(
      item.observacao
    );
  }

  return partes.join(" • ");
};

const escaparHtml = (
  valor: unknown
) =>
  String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const dataTela = (
  data: string
) =>
  data
    ? new Date(
        `${data}T00:00:00`
      ).toLocaleDateString(
        "pt-BR"
      )
    : "";

const abrirRelatorioPdf = (
  titulo: string,
  conteudo: string
) => {
  const janela = window.open(
    "",
    "_blank",
    "width=1000,height=760"
  );

  if (!janela) {
    alert(
      "O navegador bloqueou a janela. Permita pop-ups para gerar o PDF."
    );
    return;
  }

  janela.document.write(`
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>${escaparHtml(
          titulo
        )}</title>
        <style>
          @page { size: A4; margin: 14mm; }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            color: #172033;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 10.5pt;
            line-height: 1.4;
          }
          header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 24px;
            padding-bottom: 14px;
            margin-bottom: 18px;
            border-bottom: 2px solid #ed232b;
          }
          header img { width: 145px; height: auto; }
          h1 { margin: 0; color: #101a2d; font-size: 20pt; }
          h2 { color: #101a2d; font-size: 14pt; margin: 24px 0 8px; }
          .muted { color: #657084; }
          .periodo {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 10px;
            padding: 12px;
            border: 1px solid #d9dfe8;
            border-radius: 8px;
            background: #f7f8fa;
          }
          .resumo {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 8px;
            margin: 12px 0;
          }
          .card {
            padding: 10px;
            border: 1px solid #d9dfe8;
            border-radius: 7px;
          }
          .card strong { display: block; margin-top: 4px; font-size: 12pt; }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
            page-break-inside: auto;
          }
          tr { page-break-inside: avoid; }
          th, td {
            padding: 7px;
            text-align: left;
            vertical-align: top;
            border: 1px solid #cfd6df;
          }
          th { color: white; background: #101a2d; }
          td.valor { text-align: right; white-space: nowrap; }
          .total {
            margin-top: 12px;
            text-align: right;
            font-size: 14pt;
            font-weight: bold;
          }
          .professor {
            page-break-inside: avoid;
            margin-bottom: 22px;
          }
          .assinaturas {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 55px;
            margin-top: 58px;
          }
          .assinatura {
            padding-top: 7px;
            text-align: center;
            border-top: 1px solid #172033;
          }
          footer {
            margin-top: 28px;
            color: #657084;
            font-size: 9pt;
            text-align: center;
          }
          .no-print {
            margin-bottom: 16px;
            padding: 11px 16px;
            color: white;
            background: #15803d;
            border: none;
            border-radius: 7px;
            cursor: pointer;
            font-weight: bold;
          }
          @media print {
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <button class="no-print" onclick="window.print()">
          Imprimir / Salvar em PDF
        </button>
        <header>
          <img src="${window.location.origin}/logo-cedep.png" alt="CEDEP Cursos" />
          <div>
            <h1>${escaparHtml(
              titulo
            )}</h1>
            <div class="muted">CEDEP Cursos - Sistema Financeiro e Administrativo</div>
          </div>
        </header>
        ${conteudo}
        <footer>
          Relatório gerado em ${new Date().toLocaleString(
            "pt-BR"
          )}
        </footer>
      </body>
    </html>
  `);
  janela.document.close();
};

function Professores({
  perfil,
  onRegistrarPagamento,
}: Props) {
  const administrador =
    perfil ===
    "Administrador";
  const [aba, setAba] =
    useState<
      "Cadastro" | "Controle mensal"
    >("Cadastro");
  const [dados, setDados] =
    useState<DadosProfessores>({
      professores: [],
      lancamentos: [],
    });
  const [carregado, setCarregado] =
    useState(false);
  const [
    configuracoes,
    setConfiguracoes,
  ] =
    useState<ConfiguracoesFinanceiras>(
      carregarConfiguracoes()
    );

  const [editando, setEditando] =
    useState<string | null>(
      null
    );
  const [nome, setNome] =
    useState("");
  const [
    disciplinas,
    setDisciplinas,
  ] = useState("");
  const [
    valorHoraAula,
    setValorHoraAula,
  ] = useState("");
  const [
    aulasSemanais,
    setAulasSemanais,
  ] = useState("");
  const [
    valorCombustivel,
    setValorCombustivel,
  ] = useState("");

  const [
    professorSelecionado,
    setProfessorSelecionado,
  ] = useState("");
  const [
    competencia,
    setCompetencia,
  ] = useState(
    competenciaAtual()
  );
  const [data, setData] =
    useState(hojeISO());
  const [
    tipoAtividade,
    setTipoAtividade,
  ] = useState("Aula");
  const [
    quantidade,
    setQuantidade,
  ] = useState("");
  const [
    valorUnitario,
    setValorUnitario,
  ] = useState("");
  const [
    pagarCombustivel,
    setPagarCombustivel,
  ] = useState(false);
  const [
    combustivelLancamento,
    setCombustivelLancamento,
  ] = useState("");
  const [
    pagarPedagio,
    setPagarPedagio,
  ] = useState(false);
  const [
    valorPedagio,
    setValorPedagio,
  ] = useState("");
  const [
    observacao,
    setObservacao,
  ] = useState("");
  const [
    bancoPagamento,
    setBancoPagamento,
  ] = useState("");
  const [
    unidadePagamento,
    setUnidadePagamento,
  ] = useState("CEDEP");
  const [
    professorRelatorio,
    setProfessorRelatorio,
  ] = useState("Todos");
  const [
    dataInicialRelatorio,
    setDataInicialRelatorio,
  ] = useState(
    `${competenciaAtual()}-01`
  );
  const [
    dataFinalRelatorio,
    setDataFinalRelatorio,
  ] = useState(() => {
    const [ano, mes] =
      competenciaAtual()
        .split("-")
        .map(Number);
    return new Date(
      ano,
      mes,
      0
    )
      .toISOString()
      .slice(0, 10);
  });

  useEffect(() => {
    try {
      const salvos =
        localStorage.getItem(
          CHAVE_PROFESSORES
        );

      if (salvos) {
        const conteudo =
          JSON.parse(salvos);
        setDados({
          professores:
            Array.isArray(
              conteudo.professores
            )
              ? conteudo.professores
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
        "Erro ao carregar professores:",
        erro
      );
    } finally {
      setCarregado(true);
    }
  }, []);

  useEffect(() => {
    if (!administrador) {
      setAba(
        "Controle mensal"
      );
    }
  }, [administrador]);

  useEffect(() => {
    if (!carregado) {
      return;
    }

    localStorage.setItem(
      CHAVE_PROFESSORES,
      JSON.stringify(dados)
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

  const professorAtual =
    dados.professores.find(
      (item) =>
        item.id ===
        professorSelecionado
    );

  const lancamentosFiltrados =
    useMemo(
      () =>
        dados.lancamentos
          .filter(
            (item) =>
              item.professorId ===
                professorSelecionado &&
              item.competencia ===
                competencia
          )
          .sort((a, b) =>
            a.data.localeCompare(
              b.data
            )
          ),
      [
        dados.lancamentos,
        professorSelecionado,
        competencia,
      ]
    );

  const pendentes =
    lancamentosFiltrados.filter(
      (item) => !item.pago
    );
  const totalAulas =
    lancamentosFiltrados.reduce(
      (total, item) =>
        total +
        item.quantidade,
      0
    );
  const totalHoras =
    lancamentosFiltrados.reduce(
      (total, item) =>
        total +
        item.quantidade *
          item.valorUnitario,
      0
    );
  const totalCombustivel =
    lancamentosFiltrados.reduce(
      (total, item) =>
        total +
        (item.pagarCombustivel
          ? item.valorCombustivel
          : 0),
      0
    );
  const totalPedagio =
    lancamentosFiltrados.reduce(
      (total, item) =>
        total +
        (item.pagarPedagio
          ? item.valorPedagio
          : 0),
      0
    );
  const totalMes =
    lancamentosFiltrados.reduce(
      (total, item) =>
        total +
        totalLancamento(
          item
        ),
      0
    );
  const totalPendente =
    pendentes.reduce(
      (total, item) =>
        total +
        totalLancamento(
          item
        ),
      0
    );

  const lancamentosRelatorio =
    useMemo(
      () =>
        dados.lancamentos
          .filter(
            (item) =>
              (professorRelatorio ===
                "Todos" ||
                item.professorId ===
                  professorRelatorio) &&
              (!dataInicialRelatorio ||
                item.data >=
                  dataInicialRelatorio) &&
              (!dataFinalRelatorio ||
                item.data <=
                  dataFinalRelatorio)
          )
          .sort((a, b) =>
            a.data.localeCompare(
              b.data
            )
          ),
      [
        dados.lancamentos,
        professorRelatorio,
        dataInicialRelatorio,
        dataFinalRelatorio,
      ]
    );

  const resumoRelatorio =
    useMemo(() => {
      const mapa = new Map<
        string,
        {
          professor: Professor;
          aulas: number;
          aulasValor: number;
          combustivel: number;
          pedagio: number;
          total: number;
          descricoes: string[];
        }
      >();

      lancamentosRelatorio.forEach(
        (item) => {
          const professor =
            dados.professores.find(
              (registro) =>
                registro.id ===
                item.professorId
            );

          if (!professor) {
            return;
          }

          const atual =
            mapa.get(
              professor.id
            ) ?? {
              professor,
              aulas: 0,
              aulasValor: 0,
              combustivel: 0,
              pedagio: 0,
              total: 0,
              descricoes: [],
            };

          atual.aulas +=
            item.quantidade;
          atual.aulasValor +=
            item.quantidade *
            item.valorUnitario;
          atual.combustivel +=
            item.pagarCombustivel
              ? item.valorCombustivel
              : 0;
          atual.pedagio +=
            item.pagarPedagio
              ? item.valorPedagio
              : 0;
          atual.total +=
            totalLancamento(
              item
            );
          atual.descricoes.push(
            `${new Date(
              `${item.data}T00:00:00`
            ).toLocaleDateString(
              "pt-BR"
            )}: ${descricaoLancamento(
              item
            )}`
          );
          mapa.set(
            professor.id,
            atual
          );
        }
      );

      return Array.from(
        mapa.values()
      );
    }, [
      lancamentosRelatorio,
      dados.professores,
    ]);

  const totalRelatorio =
    resumoRelatorio.reduce(
      (total, item) =>
        total + item.total,
      0
    );

  const periodoRelatorioHtml =
    () => `
      <div class="periodo">
        <div><strong>Data inicial</strong><br />${escaparHtml(
          dataTela(
            dataInicialRelatorio
          )
        )}</div>
        <div><strong>Data final</strong><br />${escaparHtml(
          dataTela(
            dataFinalRelatorio
          )
        )}</div>
        <div><strong>Unidade</strong><br />CEDEP</div>
      </div>
    `;

  const tabelaDetalhesHtml = (
    professor: Professor,
    registros: LancamentoProfessor[]
  ) => {
    const aulas =
      registros.reduce(
        (total, item) =>
          total +
          item.quantidade,
        0
      );
    const aulasValor =
      registros.reduce(
        (total, item) =>
          total +
          item.quantidade *
            item.valorUnitario,
        0
      );
    const combustivel =
      registros.reduce(
        (total, item) =>
          total +
          (item.pagarCombustivel
            ? item.valorCombustivel
            : 0),
        0
      );
    const pedagio =
      registros.reduce(
        (total, item) =>
          total +
          (item.pagarPedagio
            ? item.valorPedagio
            : 0),
        0
      );
    const total =
      registros.reduce(
        (soma, item) =>
          soma +
          totalLancamento(
            item
          ),
        0
      );

    return `
      <section class="professor">
        <h2>${escaparHtml(
          professor.nome
        )}</h2>
        <div class="muted">Disciplina(s): ${escaparHtml(
          professor.disciplinas.join(
            ", "
          ) || "Não informada"
        )}</div>
        <div class="resumo">
          <div class="card">Quantidade<strong>${escaparHtml(
            aulas
          )}</strong></div>
          <div class="card">Aulas/atividades<strong>${escaparHtml(
            moeda(aulasValor)
          )}</strong></div>
          <div class="card">Combustível<strong>${escaparHtml(
            moeda(combustivel)
          )}</strong></div>
          <div class="card">Pedágio<strong>${escaparHtml(
            moeda(pedagio)
          )}</strong></div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Descrição do pagamento</th>
              <th>Quantidade</th>
              <th>Valor unitário</th>
              <th>Total</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${registros
              .map(
                (item) => `
                  <tr>
                    <td>${escaparHtml(
                      dataTela(
                        item.data
                      )
                    )}</td>
                    <td>${escaparHtml(
                      descricaoLancamento(
                        item
                      )
                    )}</td>
                    <td>${escaparHtml(
                      item.quantidade
                    )}</td>
                    <td class="valor">${escaparHtml(
                      moeda(
                        item.valorUnitario
                      )
                    )}</td>
                    <td class="valor">${escaparHtml(
                      moeda(
                        totalLancamento(
                          item
                        )
                      )
                    )}</td>
                    <td>${item.pago
                      ? "Pago"
                      : "Pendente"}</td>
                  </tr>
                `
              )
              .join("")}
          </tbody>
        </table>
        <div class="total">Total do professor: ${escaparHtml(
          moeda(total)
        )}</div>
      </section>
    `;
  };

  const gerarPdfProfessor =
    () => {
      if (
        professorRelatorio ===
        "Todos"
      ) {
        alert(
          "Selecione um professor no filtro do relatório."
        );
        return;
      }

      const professor =
        dados.professores.find(
          (item) =>
            item.id ===
            professorRelatorio
        );
      const registros =
        lancamentosRelatorio.filter(
          (item) =>
            item.professorId ===
            professorRelatorio
        );

      if (
        !professor ||
        registros.length === 0
      ) {
        alert(
          "Não existem lançamentos para este professor no período."
        );
        return;
      }

      abrirRelatorioPdf(
        `Relatório de Pagamento - ${professor.nome}`,
        `
          ${periodoRelatorioHtml()}
          ${tabelaDetalhesHtml(
            professor,
            registros
          )}
          <div class="assinaturas">
            <div class="assinatura">Responsável CEDEP</div>
            <div class="assinatura">${escaparHtml(
              professor.nome
            )}</div>
          </div>
        `
      );
    };

  const gerarPdfGeral =
    () => {
      if (
        lancamentosRelatorio.length ===
        0
      ) {
        alert(
          "Não existem lançamentos no período selecionado."
        );
        return;
      }

      const blocos =
        resumoRelatorio
          .map((resumo) =>
            tabelaDetalhesHtml(
              resumo.professor,
              lancamentosRelatorio.filter(
                (item) =>
                  item.professorId ===
                  resumo.professor.id
              )
            )
          )
          .join("");

      abrirRelatorioPdf(
        "Relatório Geral de Pagamento dos Professores",
        `
          ${periodoRelatorioHtml()}
          ${blocos}
          <div class="total">Total geral: ${escaparHtml(
            moeda(totalRelatorio)
          )}</div>
          <div class="assinaturas">
            <div class="assinatura">Responsável Financeiro</div>
            <div class="assinatura">Administrador CEDEP</div>
          </div>
        `
      );
    };

  const limparProfessor =
    () => {
      setEditando(null);
      setNome("");
      setDisciplinas("");
      setValorHoraAula("");
      setAulasSemanais("");
      setValorCombustivel("");
    };

  const salvarProfessor =
    () => {
      const hora =
        converterNumero(
          valorHoraAula
        );
      const semanais =
        converterNumero(
          aulasSemanais
        );

      if (!nome.trim()) {
        alert(
          "Informe o nome do professor."
        );
        return;
      }

      if (hora <= 0) {
        alert(
          "Informe o valor da hora/aula."
        );
        return;
      }

      const registro: Professor =
        {
          id:
            editando ??
            `professor-${Date.now()}`,
          nome: nome.trim(),
          disciplinas:
            disciplinas
              .split(",")
              .map((item) =>
                item.trim()
              )
              .filter(Boolean),
          valorHoraAula: hora,
          aulasSemanais:
            semanais,
          valorCombustivel:
            converterNumero(
              valorCombustivel
            ),
          situacao:
            dados.professores.find(
              (item) =>
                item.id ===
                editando
            )?.situacao ??
            "Ativo",
        };

      setDados((atual) => ({
        ...atual,
        professores: editando
          ? atual.professores.map(
              (item) =>
                item.id ===
                editando
                  ? registro
                  : item
            )
          : [
              ...atual.professores,
              registro,
            ],
      }));

      limparProfessor();
      alert(
        editando
          ? "Professor atualizado."
          : "Professor cadastrado."
      );
    };

  const editarProfessor = (
    professor: Professor
  ) => {
    setEditando(
      professor.id
    );
    setNome(professor.nome);
    setDisciplinas(
      professor.disciplinas.join(
        ", "
      )
    );
    setValorHoraAula(
      String(
        professor.valorHoraAula
      ).replace(".", ",")
    );
    setAulasSemanais(
      String(
        professor.aulasSemanais
      )
    );
    setValorCombustivel(
      String(
        professor.valorCombustivel
      ).replace(".", ",")
    );
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const alternarProfessor = (
    id: string
  ) =>
    setDados((atual) => ({
      ...atual,
      professores:
        atual.professores.map(
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

  const selecionarProfessor = (
    id: string
  ) => {
    setProfessorSelecionado(id);
    const professor =
      dados.professores.find(
        (item) =>
          item.id === id
      );
    setValorUnitario(
      professor
        ? String(
            professor.valorHoraAula
          ).replace(".", ",")
        : ""
    );
    setCombustivelLancamento(
      professor
        ? String(
            professor.valorCombustivel
          ).replace(".", ",")
        : ""
    );
  };

  const limparLancamento =
    () => {
      setData(hojeISO());
      setTipoAtividade(
        "Aula"
      );
      setQuantidade("");
      setValorUnitario(
        professorAtual
          ? String(
              professorAtual.valorHoraAula
            ).replace(".", ",")
          : ""
      );
      setPagarCombustivel(
        false
      );
      setPagarPedagio(false);
      setValorPedagio("");
      setObservacao("");
    };

  const adicionarLancamento =
    () => {
      const qtd =
        converterNumero(
          quantidade
        );
      const unitario =
        converterNumero(
          valorUnitario
        );

      if (
        !professorSelecionado
      ) {
        alert(
          "Selecione o professor."
        );
        return;
      }

      if (
        !competencia ||
        !data
      ) {
        alert(
          "Informe a competência e o dia da atividade."
        );
        return;
      }

      if (
        !tipoAtividade.trim() ||
        qtd <= 0 ||
        unitario < 0
      ) {
        alert(
          "Informe atividade, quantidade e valor unitário."
        );
        return;
      }

      const registro: LancamentoProfessor =
        {
          id: `aula-${Date.now()}-${Math.random()}`,
          professorId:
            professorSelecionado,
          competencia,
          data,
          tipoAtividade:
            tipoAtividade.trim(),
          quantidade: qtd,
          valorUnitario:
            unitario,
          pagarCombustivel,
          valorCombustivel:
            pagarCombustivel
              ? converterNumero(
                  combustivelLancamento
                )
              : 0,
          pagarPedagio,
          valorPedagio:
            pagarPedagio
              ? converterNumero(
                  valorPedagio
                )
              : 0,
          observacao:
            observacao.trim(),
          pago: false,
          dataPagamento: "",
        };

      setDados((atual) => ({
        ...atual,
        lancamentos: [
          ...atual.lancamentos,
          registro,
        ],
      }));
      limparLancamento();
    };

  const excluirLancamento = (
    item: LancamentoProfessor
  ) => {
    if (item.pago) {
      alert(
        "Um lançamento já pago não pode ser excluído."
      );
      return;
    }

    if (
      !window.confirm(
        "Deseja excluir este lançamento?"
      )
    ) {
      return;
    }

    setDados((atual) => ({
      ...atual,
      lancamentos:
        atual.lancamentos.filter(
          (registro) =>
            registro.id !==
            item.id
        ),
    }));
  };

  const ajustarValores = (
    item: LancamentoProfessor
  ) => {
    if (!administrador) {
      return;
    }

    const unitario =
      window.prompt(
        "Valor unitário da atividade:",
        String(
          item.valorUnitario
        ).replace(".", ",")
      );

    if (unitario === null) {
      return;
    }

    const combustivel =
      item.pagarCombustivel
        ? window.prompt(
            "Valor do combustível:",
            String(
              item.valorCombustivel
            ).replace(".", ",")
          )
        : "0";

    if (combustivel === null) {
      return;
    }

    const pedagio =
      item.pagarPedagio
        ? window.prompt(
            "Valor do pedágio:",
            String(
              item.valorPedagio
            ).replace(".", ",")
          )
        : "0";

    if (pedagio === null) {
      return;
    }

    setDados((atual) => ({
      ...atual,
      lancamentos:
        atual.lancamentos.map(
          (registro) =>
            registro.id ===
            item.id
              ? {
                  ...registro,
                  valorUnitario:
                    converterNumero(
                      unitario
                    ),
                  valorCombustivel:
                    converterNumero(
                      combustivel
                    ),
                  valorPedagio:
                    converterNumero(
                      pedagio
                    ),
                }
              : registro
        ),
    }));
  };

  const registrarPagamento =
    () => {
      if (
        !professorAtual ||
        pendentes.length === 0
      ) {
        alert(
          "Não existem valores pendentes para este professor no mês."
        );
        return;
      }

      if (!bancoPagamento) {
        alert(
          "Selecione o banco ou conta do pagamento."
        );
        return;
      }

      if (!unidadePagamento) {
        alert(
          "Selecione a unidade."
        );
        return;
      }

      if (
        !window.confirm(
          `Confirma o pagamento de ${moeda(
            totalPendente
          )} para ${professorAtual.nome}?`
        )
      ) {
        return;
      }

      const dataPagamento =
        hojeISO();
      const ids =
        new Set(
          pendentes.map(
            (item) =>
              item.id
          )
        );

      setDados((atual) => ({
        ...atual,
        lancamentos:
          atual.lancamentos.map(
            (item) =>
              ids.has(item.id)
                ? {
                    ...item,
                    pago: true,
                    dataPagamento,
                  }
                : item
          ),
      }));

      onRegistrarPagamento({
        id: `pagamento-professor-${professorAtual.id}-${competencia}-${Date.now()}`,
        professorNome:
          professorAtual.nome,
        competencia,
        valor:
          totalPendente,
        data:
          dataPagamento,
        banco:
          bancoPagamento,
        unidade:
          unidadePagamento,
      });

      alert(
        "Pagamento registrado no financeiro."
      );
    };

  return (
    <div>
      <header style={estilos.cabecalho}>
        <div>
          <h1 style={{ margin: 0 }}>
            Professores
          </h1>
          <p style={estilos.textoCinza}>
            Cadastro, aulas dadas e pagamento mensal.
          </p>
        </div>
      </header>

      <div style={estilos.abas}>
        {(
          (administrador
            ? [
                "Cadastro",
                "Controle mensal",
              ]
            : [
                "Controle mensal",
              ]) as (
            | "Cadastro"
            | "Controle mensal"
          )[]
        ).map((item) => (
          <button
            key={item}
            onClick={() =>
              setAba(item)
            }
            style={{
              ...estilos.botaoAba,
              background:
                aba === item
                  ? "#101a2d"
                  : "white",
              color:
                aba === item
                  ? "white"
                  : "#101a2d",
            }}
          >
            {item}
          </button>
        ))}
      </div>

      {aba === "Cadastro" ? (
        <>
          <section style={estilos.caixa}>
            <h2>
              {editando
                ? "Editar professor"
                : "Novo professor"}
            </h2>
            <div style={estilos.formGrid}>
              <Campo
                label="Nome"
                value={nome}
                onChange={setNome}
              />
              <Campo
                label="Disciplina(s)"
                value={disciplinas}
                onChange={setDisciplinas}
                placeholder="Ex.: Matemática, Física"
              />
              <Campo
                label="Valor hora/aula"
                value={valorHoraAula}
                onChange={setValorHoraAula}
                placeholder="Ex.: 65,00"
              />
              <Campo
                label="Aulas semanais"
                value={aulasSemanais}
                onChange={setAulasSemanais}
                type="number"
              />
              <Campo
                label="Repasse de combustível"
                value={valorCombustivel}
                onChange={setValorCombustivel}
                placeholder="Ex.: 200,00"
              />
            </div>
            <div style={estilos.botoes}>
              <button
                onClick={salvarProfessor}
                style={estilos.botaoPrincipal}
              >
                {editando
                  ? "Salvar alterações"
                  : "Cadastrar professor"}
              </button>
              {editando && (
                <button
                  onClick={limparProfessor}
                  style={estilos.botaoSecundario}
                >
                  Cancelar edição
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
              Professores cadastrados
            </h2>
            {dados.professores.length ===
            0 ? (
              <div style={estilos.vazio}>
                Nenhum professor cadastrado.
              </div>
            ) : (
              <div style={estilos.tabelaContainer}>
                <table style={estilos.tabela}>
                  <thead>
                    <tr>
                      <th style={estilos.th}>
                        Professor
                      </th>
                      <th style={estilos.th}>
                        Disciplinas
                      </th>
                      <th style={estilos.th}>
                        Hora/aula
                      </th>
                      <th style={estilos.th}>
                        Aulas semanais
                      </th>
                      <th style={estilos.th}>
                        Combustível
                      </th>
                      <th style={estilos.th}>
                        Situação
                      </th>
                      <th style={estilos.th}>
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {dados.professores.map(
                      (professor) => (
                        <tr key={professor.id}>
                          <td style={estilos.td}>
                            {professor.nome}
                          </td>
                          <td style={estilos.td}>
                            {professor.disciplinas.join(
                              ", "
                            ) || "—"}
                          </td>
                          <td style={estilos.td}>
                            {moeda(
                              professor.valorHoraAula
                            )}
                          </td>
                          <td style={estilos.td}>
                            {professor.aulasSemanais}
                          </td>
                          <td style={estilos.td}>
                            {moeda(
                              professor.valorCombustivel
                            )}
                          </td>
                          <td style={estilos.td}>
                            {professor.situacao}
                          </td>
                          <td style={estilos.td}>
                            <div style={estilos.botoesLinha}>
                              <button
                                onClick={() =>
                                  editarProfessor(
                                    professor
                                  )
                                }
                                style={estilos.botaoEditar}
                              >
                                Editar
                              </button>
                              <button
                                onClick={() =>
                                  alternarProfessor(
                                    professor.id
                                  )
                                }
                                style={estilos.botaoSecundario}
                              >
                                {professor.situacao ===
                                "Ativo"
                                  ? "Inativar"
                                  : "Ativar"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : (
        <>
          <section style={estilos.caixa}>
            <h2>
              Lançar atividade do mês
            </h2>
            <div style={estilos.formGrid}>
              <CampoSelect
                label="Professor"
                value={professorSelecionado}
                onChange={selecionarProfessor}
                opcoes={dados.professores
                  .filter(
                    (item) =>
                      item.situacao ===
                      "Ativo"
                  )
                  .map((item) => ({
                    valor: item.id,
                    texto: item.nome,
                  }))}
              />
              <Campo
                label="Competência"
                value={competencia}
                onChange={setCompetencia}
                type="month"
              />
              <Campo
                label="Dia da atividade"
                value={data}
                onChange={setData}
                type="date"
              />
              <Campo
                label="Atividade"
                value={tipoAtividade}
                onChange={setTipoAtividade}
                placeholder="Aula, monitoria, redação..."
              />
              <Campo
                label="Quantidade"
                value={quantidade}
                onChange={setQuantidade}
                type="number"
              />
              {administrador && (
                <Campo
                  label="Valor unitário"
                  value={valorUnitario}
                  onChange={setValorUnitario}
                  placeholder="Valor da hora/aula"
                />
              )}
            </div>

            <div style={estilos.adicionais}>
              <label style={estilos.checkbox}>
                <input
                  type="checkbox"
                  checked={pagarCombustivel}
                  onChange={(evento) =>
                    setPagarCombustivel(
                      evento.target.checked
                    )
                  }
                />
                Pagar combustível neste dia
              </label>
              {pagarCombustivel &&
                administrador && (
                <Campo
                  label="Valor do combustível"
                  value={combustivelLancamento}
                  onChange={setCombustivelLancamento}
                />
              )}

              <label style={estilos.checkbox}>
                <input
                  type="checkbox"
                  checked={pagarPedagio}
                  onChange={(evento) =>
                    setPagarPedagio(
                      evento.target.checked
                    )
                  }
                />
                Pagar pedágio neste dia
              </label>
              {pagarPedagio &&
                administrador && (
                <Campo
                  label="Valor do pedágio"
                  value={valorPedagio}
                  onChange={setValorPedagio}
                />
              )}
            </div>

            <Campo
              label="Observação"
              value={observacao}
              onChange={setObservacao}
              placeholder="Informações adicionais"
            />

            <div style={estilos.botoes}>
              <button
                onClick={adicionarLancamento}
                style={estilos.botaoPrincipal}
              >
                Adicionar atividade
              </button>
            </div>
          </section>

          {administrador && (
            <section style={estilos.cards}>
            <Card
              titulo="Quantidade de aulas/atividades"
              valor={String(totalAulas)}
            />
            <Card
              titulo="Hora/aula"
              valor={moeda(totalHoras)}
            />
            <Card
              titulo="Combustível"
              valor={moeda(totalCombustivel)}
            />
            <Card
              titulo="Pedágio"
              valor={moeda(totalPedagio)}
            />
            <Card
              titulo="Total do mês"
              valor={moeda(totalMes)}
            />
            </section>
          )}

          <section
            style={{
              ...estilos.caixa,
              marginTop: 24,
            }}
          >
            <h2>
              Dias e atividades lançados
            </h2>
            {!professorSelecionado ? (
              <div style={estilos.vazio}>
                Selecione um professor.
              </div>
            ) : lancamentosFiltrados.length ===
              0 ? (
              <div style={estilos.vazio}>
                Nenhuma atividade lançada neste mês.
              </div>
            ) : (
              <div style={estilos.tabelaContainer}>
                <table style={estilos.tabela}>
                  <thead>
                    <tr>
                      <th style={estilos.th}>
                        Data
                      </th>
                      <th style={estilos.th}>
                        Atividade
                      </th>
                      <th style={estilos.th}>
                        Quantidade
                      </th>
                      {administrador && (
                        <>
                          <th style={estilos.th}>
                            Valor unitário
                          </th>
                          <th style={estilos.th}>
                            Combustível
                          </th>
                          <th style={estilos.th}>
                            Pedágio
                          </th>
                          <th style={estilos.th}>
                            Total
                          </th>
                        </>
                      )}
                      <th style={estilos.th}>
                        Status
                      </th>
                      <th style={estilos.th}>
                        Ação
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {lancamentosFiltrados.map(
                      (item) => (
                        <tr key={item.id}>
                          <td style={estilos.td}>
                            {new Date(
                              `${item.data}T00:00:00`
                            ).toLocaleDateString(
                              "pt-BR"
                            )}
                          </td>
                          <td style={estilos.td}>
                            {item.tipoAtividade}
                          </td>
                          <td style={estilos.td}>
                            {item.quantidade}
                          </td>
                          {administrador && (
                            <>
                              <td style={estilos.td}>
                                {moeda(
                                  item.valorUnitario
                                )}
                              </td>
                              <td style={estilos.td}>
                                {item.pagarCombustivel
                                  ? moeda(
                                      item.valorCombustivel
                                    )
                                  : "—"}
                              </td>
                              <td style={estilos.td}>
                                {item.pagarPedagio
                                  ? moeda(
                                      item.valorPedagio
                                    )
                                  : "—"}
                              </td>
                              <td style={estilos.td}>
                                <strong>
                                  {moeda(
                                    totalLancamento(
                                      item
                                    )
                                  )}
                                </strong>
                              </td>
                            </>
                          )}
                          <td style={estilos.td}>
                            {item.pago
                              ? "Pago"
                              : "Pendente"}
                          </td>
                          <td style={estilos.td}>
                            <div style={estilos.botoesLinha}>
                              {administrador && (
                                <button
                                  onClick={() =>
                                    ajustarValores(
                                      item
                                    )
                                  }
                                  disabled={item.pago}
                                  style={estilos.botaoEditar}
                                >
                                  Ajustar valores
                                </button>
                              )}
                              <button
                                onClick={() =>
                                  excluirLancamento(
                                    item
                                  )
                                }
                                disabled={item.pago}
                                style={estilos.botaoExcluir}
                              >
                                Excluir
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {administrador && (
            <section
            style={{
              ...estilos.caixa,
              marginTop: 24,
            }}
          >
            <h2>
              Pagamento do professor
            </h2>
            <p style={estilos.textoCinza}>
              Valor pendente:{" "}
              <strong>
                {moeda(totalPendente)}
              </strong>
            </p>
            <div style={estilos.formGrid}>
              <CampoSelect
                label="Banco / Conta"
                value={bancoPagamento}
                onChange={setBancoPagamento}
                opcoes={configuracoes.bancos.map(
                  (item) => ({
                    valor: item,
                    texto: item,
                  })
                )}
              />
              <CampoSelect
                label="Unidade"
                value={unidadePagamento}
                onChange={setUnidadePagamento}
                opcoes={configuracoes.unidades.map(
                  (item) => ({
                    valor: item,
                    texto: item,
                  })
                )}
              />
            </div>
            <div style={estilos.botoes}>
              <button
                onClick={registrarPagamento}
                style={estilos.botaoPagar}
              >
                Registrar pagamento do mês
              </button>
            </div>
            </section>
          )}

          {administrador && (
            <section
              style={{
                ...estilos.caixa,
                marginTop: 24,
              }}
            >
              <h2>
                Relatório administrativo
              </h2>
              <p style={estilos.textoCinza}>
                Consulte um mês completo ou qualquer intervalo de datas.
              </p>
              <div style={estilos.formGrid}>
                <CampoSelect
                  label="Professor"
                  value={professorRelatorio}
                  onChange={setProfessorRelatorio}
                  opcoes={[
                    {
                      valor: "Todos",
                      texto: "Todos os professores",
                    },
                    ...dados.professores.map(
                      (item) => ({
                        valor: item.id,
                        texto: item.nome,
                      })
                    ),
                  ]}
                />
                <Campo
                  label="Data inicial"
                  value={dataInicialRelatorio}
                  onChange={setDataInicialRelatorio}
                  type="date"
                />
                <Campo
                  label="Data final"
                  value={dataFinalRelatorio}
                  onChange={setDataFinalRelatorio}
                  type="date"
                />
              </div>

              <div style={estilos.botoes}>
                <button
                  onClick={gerarPdfProfessor}
                  style={estilos.botaoPdf}
                >
                  PDF do professor
                </button>
                <button
                  onClick={gerarPdfGeral}
                  style={estilos.botaoPdfGeral}
                >
                  PDF geral
                </button>
              </div>

              <div
                style={{
                  ...estilos.card,
                  marginTop: 20,
                }}
              >
                <span style={estilos.textoCinza}>
                  Total previsto no período
                </span>
                <strong style={{ fontSize: 27 }}>
                  {moeda(totalRelatorio)}
                </strong>
              </div>

              {resumoRelatorio.length ===
              0 ? (
                <div style={estilos.vazio}>
                  Nenhum lançamento encontrado no período.
                </div>
              ) : (
                <div style={estilos.tabelaContainer}>
                  <table style={estilos.tabela}>
                    <thead>
                      <tr>
                        <th style={estilos.th}>
                          Professor
                        </th>
                        <th style={estilos.th}>
                          Quantidade
                        </th>
                        <th style={estilos.th}>
                          Aulas/atividades
                        </th>
                        <th style={estilos.th}>
                          Combustível
                        </th>
                        <th style={estilos.th}>
                          Pedágio
                        </th>
                        <th style={estilos.th}>
                          Total
                        </th>
                        <th style={estilos.th}>
                          Descrição do pagamento
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {resumoRelatorio.map(
                        (item) => (
                          <tr
                            key={
                              item.professor.id
                            }
                          >
                            <td style={estilos.td}>
                              {item.professor.nome}
                            </td>
                            <td style={estilos.td}>
                              {item.aulas}
                            </td>
                            <td style={estilos.td}>
                              {moeda(
                                item.aulasValor
                              )}
                            </td>
                            <td style={estilos.td}>
                              {moeda(
                                item.combustivel
                              )}
                            </td>
                            <td style={estilos.td}>
                              {moeda(
                                item.pedagio
                              )}
                            </td>
                            <td style={estilos.td}>
                              <strong>
                                {moeda(
                                  item.total
                                )}
                              </strong>
                            </td>
                            <td
                              style={{
                                ...estilos.td,
                                whiteSpace: "normal",
                                minWidth: 360,
                              }}
                            >
                              {item.descricoes.join(
                                " | "
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
          )}
        </>
      )}
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
  onChange: (
    valor: string
  ) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label style={estilos.campoGrupo}>
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
  opcoes: {
    valor: string;
    texto: string;
  }[];
}) {
  return (
    <label style={estilos.campoGrupo}>
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
        {opcoes.map((item) => (
          <option
            key={item.valor}
            value={item.valor}
          >
            {item.texto}
          </option>
        ))}
      </select>
    </label>
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
      <span style={estilos.textoCinza}>
        {titulo}
      </span>
      <strong style={{ fontSize: 23 }}>
        {valor}
      </strong>
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
  abas: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginBottom: 22,
  },
  botaoAba: {
    padding: "12px 18px",
    border:
      "1px solid #ccd3dd",
    borderRadius: 10,
    cursor: "pointer",
    fontWeight: "bold",
  },
  caixa: {
    background: "white",
    minWidth: 0,
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
    marginTop: 12,
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: "13px 14px",
    border:
      "1px solid #ccd3dd",
    borderRadius: 9,
    fontSize: 15,
  },
  botoes: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 24,
  },
  botoesLinha: {
    display: "flex",
    gap: 7,
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
  botaoPagar: {
    background: "#101a2d",
    color: "white",
    border: "none",
    borderRadius: 9,
    padding: "13px 20px",
    cursor: "pointer",
    fontWeight: "bold",
  },
  botaoPdf: {
    background: "#2563eb",
    color: "white",
    border: "none",
    borderRadius: 9,
    padding: "13px 20px",
    cursor: "pointer",
    fontWeight: "bold",
  },
  botaoPdfGeral: {
    background: "#7c3aed",
    color: "white",
    border: "none",
    borderRadius: 9,
    padding: "13px 20px",
    cursor: "pointer",
    fontWeight: "bold",
  },
  botaoSecundario: {
    background: "white",
    color: "#101a2d",
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
  botaoExcluir: {
    background: "#b91c1c",
    color: "white",
    border: "none",
    borderRadius: 8,
    padding: "9px 12px",
    cursor: "pointer",
  },
  adicionais: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit,minmax(220px,1fr))",
    gap: 16,
    alignItems: "end",
    marginTop: 22,
    padding: 18,
    borderRadius: 12,
    background: "#f4f6f8",
  },
  checkbox: {
    display: "flex",
    alignItems: "center",
    gap: 9,
    minHeight: 46,
    fontWeight: "bold",
  },
  cards: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit,minmax(180px,1fr))",
    gap: 16,
    marginTop: 24,
  },
  card: {
    background: "white",
    padding: 20,
    borderRadius: 14,
    display: "flex",
    flexDirection: "column",
    gap: 10,
    boxShadow:
      "0 6px 18px rgba(0,0,0,.06)",
  },
  tabelaContainer: {
    width: "100%",
    overflowX: "auto",
  },
  tabela: {
    width: "100%",
    minWidth: 900,
    borderCollapse:
      "collapse",
    marginTop: 18,
  },
  th: {
    padding: 12,
    textAlign: "left",
    background: "#101a2d",
    color: "white",
    whiteSpace: "nowrap",
  },
  td: {
    padding: 12,
    borderBottom:
      "1px solid #e8ebef",
    whiteSpace: "nowrap",
  },
  vazio: {
    padding: 35,
    textAlign: "center",
    color: "#8c96a8",
  },
};

export default Professores;

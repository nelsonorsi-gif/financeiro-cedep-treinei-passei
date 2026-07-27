import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type Dispatch,
  type SetStateAction,
} from "react";

import * as XLSX from "xlsx";

import Contas, { type Conta } from "./Contas";
import Relatorios from "./Relatorios";
import Cadastros from "./Cadastros";
import Professores, {
  type PagamentoProfessorFinanceiro,
} from "./Professores";
import Mensalidades from "./Mensalidades";
import Secretaria, {
  type RecebimentoCaixa,
} from "./Secretaria";
import Documentos from "./Documentos";
import Nuvem from "./Nuvem";
import Academico from "./Academico";
import GestaoFinanceira from "./GestaoFinanceira";
import {
  TelaLogin,
  TelaLoginOnline,
  Usuarios,
  carregarSessao,
  carregarUsuarioOnline,
  encerrarSessaoOnline,
  podeAcessar,
  type UsuarioSessao,
} from "./Acesso";
import {
  supabaseConfigurado,
} from "./lib/supabase";
import {
  iniciarSincronizacaoAutomatica,
  prepararSincronizacaoInicial,
} from "./servicos/sincronizacaoAutomatica";

import Configuracoes, {
  carregarConfiguracoes,
  type ConfiguracoesFinanceiras,
} from "./Configuracoes";

/* =========================================================
   TIPOS
========================================================= */

type Lancamento = {
  id: string;

  dia: string;

  data: string;

  competencia: string;

  descricao: string;

  tipoEntrada: string;

  tipoSaida: string;

  formaPagamento: string;

  entrada: number;

  saida: number;

  unidade: string;

  origem?: "manual" | "excel";
};

type ImportacaoSalva = {
  nomeArquivo: string;

  dataImportacao: string;
};

type FormularioLancamento = {
  data: string;

  descricao: string;

  valor: string;

  tipoEntrada: string;

  tipoSaida: string;

  formaPagamento: string;

  unidade: string;
};

type ResumoBanco = {
  nome: string;

  entradas: number;

  saidas: number;

  saldo: number;

  quantidade: number;
};

type PontoFluxo = {
  chave: string;

  rotulo: string;

  entradas: number;

  saidas: number;
};

/* =========================================================
   CHAVES DE SALVAMENTO
========================================================= */

const CHAVE_LANCAMENTOS =
  "financeiro-cedep-lancamentos";

const CHAVE_IMPORTACOES =
  "financeiro-cedep-importacoes";

/* =========================================================
   FUNÇÕES DE DATA
========================================================= */

const hojeISO = () => {
  const hoje = new Date();

  const ano = hoje.getFullYear();

  const mes = String(
    hoje.getMonth() + 1
  ).padStart(2, "0");

  const dia = String(
    hoje.getDate()
  ).padStart(2, "0");

  return `${ano}-${mes}-${dia}`;
};

const competenciaDaData = (
  data: string
) => {
  if (!data) {
    return "";
  }

  const partes = data.split("-");

  if (partes.length !== 3) {
    return "";
  }

  return `${partes[1]}/${partes[0]}`;
};

const diaDaData = (
  data: string
) => {
  if (!data) {
    return "";
  }

  return (
    data.split("-")[2] || ""
  );
};

/* =========================================================
   IDENTIFICAR MÊS E ANO DO ARQUIVO
========================================================= */

const detectarMesAnoArquivo = (
  nomeArquivo: string
) => {
  const meses: Record<
    string,
    string
  > = {
    JANEIRO: "01",
    FEVEREIRO: "02",
    MARCO: "03",
    ABRIL: "04",
    MAIO: "05",
    JUNHO: "06",
    JULHO: "07",
    AGOSTO: "08",
    SETEMBRO: "09",
    OUTUBRO: "10",
    NOVEMBRO: "11",
    DEZEMBRO: "12",
  };

  const nomeNormalizado =
    nomeArquivo
      .toUpperCase()
      .normalize("NFD")
      .replace(
        /[\u0300-\u036f]/g,
        ""
      );

  let mesEncontrado = "";

  for (
    const [
      nomeMes,
      numeroMes,
    ] of Object.entries(meses)
  ) {
    if (
      nomeNormalizado.includes(
        nomeMes
      )
    ) {
      mesEncontrado =
        numeroMes;

      break;
    }
  }

  const anoEncontrado =
    nomeNormalizado.match(
      /\b(20\d{2})\b/
    )?.[1] || "";

  return {
    mes: mesEncontrado,

    ano: anoEncontrado,
  };
};

/* =========================================================
   FORMULÁRIO PADRÃO
========================================================= */

const criarFormularioVazio =
  (): FormularioLancamento => ({
    data: hojeISO(),

    descricao: "",

    valor: "",

    tipoEntrada: "",

    tipoSaida: "",

    formaPagamento: "",

    unidade: "CEDEP",
  });

/* =========================================================
   APP
========================================================= */

function App() {
  const [
    usuarioAtual,
    setUsuarioAtual,
  ] =
    useState<UsuarioSessao | null>(
      null
    );
  const [
    verificandoAcesso,
    setVerificandoAcesso,
  ] = useState(true);

  const [
    pagina,
    setPagina,
  ] = useState("Dashboard");

  const [
    menuMobileAberto,
    setMenuMobileAberto,
  ] = useState(false);

  useEffect(() => {
    const fecharComEscape = (
      evento: KeyboardEvent
    ) => {
      if (
        evento.key === "Escape"
      ) {
        setMenuMobileAberto(
          false
        );
      }
    };

    window.addEventListener(
      "keydown",
      fecharComEscape
    );

    return () => {
      window.removeEventListener(
        "keydown",
        fecharComEscape
      );
    };
  }, []);

  useEffect(() => {
    let ativo = true;

    const verificar =
      async () => {
        try {
          const online =
            await carregarUsuarioOnline();

          if (online) {
            const alterou =
              await prepararSincronizacaoInicial(
                online.id,
                online.perfil !==
                  "Consulta",
                online.perfil
              );

            if (alterou) {
              window.location.reload();
              return;
            }
          }

          if (ativo) {
            setUsuarioAtual(
              online ??
                (!supabaseConfigurado
                  ? carregarSessao()
                  : null)
            );
          }
        } catch {
          if (ativo) {
            setUsuarioAtual(
              null
            );
          }
        } finally {
          if (ativo) {
            setVerificandoAcesso(
              false
            );
          }
        }
      };

    void verificar();

    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    if (
      !usuarioAtual ||
      !supabaseConfigurado
    ) {
      return;
    }

    return iniciarSincronizacaoAutomatica(
      usuarioAtual.id,
      usuarioAtual.perfil !==
        "Consulta",
      usuarioAtual.perfil
    );
  }, [usuarioAtual]);

  const [
    lancamentos,
    setLancamentos,
  ] =
    useState<Lancamento[]>(
      []
    );

  const [
    preVisualizacao,
    setPreVisualizacao,
  ] =
    useState<Lancamento[]>(
      []
    );

  const [
    importacoes,
    setImportacoes,
  ] =
    useState<
      ImportacaoSalva[]
    >([]);

  const [
    arquivoNome,
    setArquivoNome,
  ] = useState("");

  const [
    mensagem,
    setMensagem,
  ] = useState("");

  const [
    carregado,
    setCarregado,
  ] = useState(false);

  const [
    formulario,
    setFormulario,
  ] =
    useState<FormularioLancamento>(
      criarFormularioVazio()
    );

  const [
    lancamentoEditando,
    setLancamentoEditando,
  ] =
    useState<string | null>(
      null
    );

  const [
    busca,
    setBusca,
  ] = useState("");

  const [
    filtroTipo,
    setFiltroTipo,
  ] = useState("Todos");

  const [
    paginaLancamentos,
    setPaginaLancamentos,
  ] = useState(1);

  const [
    itensPorPagina,
    setItensPorPagina,
  ] = useState(10);

  const [
    competenciaDashboard,
    setCompetenciaDashboard,
  ] = useState("Todas");

  const [
    bancoSelecionado,
    setBancoSelecionado,
  ] =
    useState<string | null>(
      null
    );

  const [
    configuracoes,
    setConfiguracoes,
  ] =
    useState<ConfiguracoesFinanceiras>(
      carregarConfiguracoes()
    );

  /* =======================================================
     ATUALIZAR LISTAS DE CONFIGURAÇÃO
  ======================================================= */

  useEffect(() => {
    const atualizarConfiguracoes =
      () => {
        setConfiguracoes(
          carregarConfiguracoes()
        );
      };

    window.addEventListener(
      "financeiro-config-atualizada",
      atualizarConfiguracoes
    );

    return () => {
      window.removeEventListener(
        "financeiro-config-atualizada",
        atualizarConfiguracoes
      );
    };
  }, []);

  /* =======================================================
     CARREGAR DADOS SALVOS
  ======================================================= */

  useEffect(() => {
    try {
      const dadosLancamentos =
        localStorage.getItem(
          CHAVE_LANCAMENTOS
        );

      const dadosImportacoes =
        localStorage.getItem(
          CHAVE_IMPORTACOES
        );

      if (dadosLancamentos) {
        const dadosAntigos =
          JSON.parse(
            dadosLancamentos
          ) as Lancamento[];

        /*
          MIGRAÇÃO AUTOMÁTICA

          Os lançamentos antigos,
          sem data e competência,
          são considerados Junho/2026.

          Os lançamentos que já têm
          data não são alterados.
        */

        const dadosCorrigidos =
          dadosAntigos.map(
            (item) => {
              if (
                item.data &&
                item.competencia
              ) {
                return item;
              }

              if (
                item.dia &&
                /^(0[1-9]|[12][0-9]|3[01])$/.test(
                  item.dia
                )
              ) {
                return {
                  ...item,

                  data:
                    `2026-06-${item.dia}`,

                  competencia:
                    "06/2026",
                };
              }

              return {
                ...item,

                data:
                  item.data || "",

                competencia:
                  item.competencia ||
                  "",
              };
            }
          );

        setLancamentos(
          dadosCorrigidos
        );
      }

      if (dadosImportacoes) {
        setImportacoes(
          JSON.parse(
            dadosImportacoes
          )
        );
      }
    } catch (erro) {
      console.error(
        "Erro ao carregar dados:",
        erro
      );
    } finally {
      setCarregado(true);
    }
  }, []);

  /* =======================================================
     SALVAMENTO AUTOMÁTICO
  ======================================================= */

  useEffect(() => {
    if (!carregado) {
      return;
    }

    localStorage.setItem(
      CHAVE_LANCAMENTOS,
      JSON.stringify(
        lancamentos
      )
    );
  }, [
    lancamentos,
    carregado,
  ]);

  useEffect(() => {
    if (!carregado) {
      return;
    }

    localStorage.setItem(
      CHAVE_IMPORTACOES,
      JSON.stringify(
        importacoes
      )
    );
  }, [
    importacoes,
    carregado,
  ]);

  /* =======================================================
     UTILIDADES
  ======================================================= */

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
    valor: unknown
  ): number => {
    if (
      typeof valor ===
      "number"
    ) {
      return valor;
    }

    if (
      valor === null ||
      valor === undefined ||
      valor === ""
    ) {
      return 0;
    }

    let texto = String(
      valor
    )
      .trim()
      .replace("R$", "")
      .replace(/\s/g, "");

    if (
      texto.includes(",")
    ) {
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

  /* =======================================================
     TOTAIS
  ======================================================= */

  const competenciasDashboard =
    useMemo(() => {
      const valores = Array.from(
        new Set(
          lancamentos
            .map((item) =>
              item.competencia.trim()
            )
            .filter(Boolean)
        )
      );

      return valores.sort(
        (a, b) => {
          const [mesA, anoA] =
            a.split("/");
          const [mesB, anoB] =
            b.split("/");

          return (
            Number(anoB) * 100 +
            Number(mesB) -
            (Number(anoA) * 100 +
              Number(mesA))
          );
        }
      );
    }, [lancamentos]);

  const lancamentosDashboard =
    useMemo(
      () =>
        competenciaDashboard ===
        "Todas"
          ? lancamentos
          : lancamentos.filter(
              (item) =>
                item.competencia ===
                competenciaDashboard
            ),
      [
        lancamentos,
        competenciaDashboard,
      ]
    );

  const entradasDashboard =
    lancamentosDashboard.reduce(
      (total, item) =>
        total + item.entrada,
      0
    );

  const saidasDashboard =
    lancamentosDashboard.reduce(
      (total, item) =>
        total + item.saida,
      0
    );

  const saldoDashboard =
    entradasDashboard -
    saidasDashboard;

  const fluxoDashboard =
    useMemo<PontoFluxo[]>(() => {
      const pontos = new Map<
        string,
        PontoFluxo
      >();

      lancamentosDashboard.forEach(
        (item) => {
          const chave =
            competenciaDashboard ===
            "Todas"
              ? item.competencia ||
                "Sem período"
              : item.data ||
                item.dia;

          const rotulo =
            competenciaDashboard ===
            "Todas"
              ? chave
              : item.data
                ? item.data
                    .split("-")
                    .reverse()
                    .slice(0, 2)
                    .join("/")
                : item.dia;

          const atual =
            pontos.get(chave) ?? {
              chave,
              rotulo,
              entradas: 0,
              saidas: 0,
            };

          atual.entradas +=
            item.entrada;
          atual.saidas +=
            item.saida;

          pontos.set(chave, atual);
        }
      );

      return Array.from(
        pontos.values()
      ).sort((a, b) => {
        if (
          competenciaDashboard ===
          "Todas"
        ) {
          const [mesA, anoA] =
            a.chave.split("/");
          const [mesB, anoB] =
            b.chave.split("/");

          return (
            Number(anoA) * 100 +
            Number(mesA) -
            (Number(anoB) * 100 +
              Number(mesB))
          );
        }

        return a.chave.localeCompare(
          b.chave
        );
      });
    }, [
      lancamentosDashboard,
      competenciaDashboard,
    ]);

  const previewEntradas =
    preVisualizacao.reduce(
      (total, item) =>
        total +
        item.entrada,
      0
    );

  const previewSaidas =
    preVisualizacao.reduce(
      (total, item) =>
        total +
        item.saida,
      0
    );

  const previewSaldo =
    previewEntradas -
    previewSaidas;

  /* =======================================================
     BANCOS
  ======================================================= */

  const resumoBancos =
    useMemo<
      ResumoBanco[]
    >(() => {
      const mapa =
        new Map<
          string,
          ResumoBanco
        >();

      lancamentos.forEach(
        (lancamento) => {
          const nome =
            lancamento
              .formaPagamento
              .trim() ||
            "Não informado";

          const chave =
            nome.toUpperCase();

          const atual =
            mapa.get(chave) ??
            {
              nome,

              entradas: 0,

              saidas: 0,

              saldo: 0,

              quantidade: 0,
            };

          atual.entradas +=
            lancamento.entrada;

          atual.saidas +=
            lancamento.saida;

          atual.quantidade += 1;

          atual.saldo =
            atual.entradas -
            atual.saidas;

          mapa.set(
            chave,
            atual
          );
        }
      );

      return Array.from(
        mapa.values()
      ).sort(
        (a, b) =>
          b.entradas +
          b.saidas -
          (a.entradas +
            a.saidas)
      );
    }, [lancamentos]);

  const movimentacoesBanco =
    useMemo(() => {
      if (
        !bancoSelecionado
      ) {
        return [];
      }

      return lancamentos.filter(
        (item) =>
          (
            item.formaPagamento.trim() ||
            "Não informado"
          ).toUpperCase() ===
          bancoSelecionado.toUpperCase()
      );
    }, [
      lancamentos,
      bancoSelecionado,
    ]);

  /* =======================================================
     IMPORTAÇÃO EXCEL
  ======================================================= */

  const importarExcel = (
    arquivo: File
  ) => {
    setArquivoNome(
      arquivo.name
    );

    setMensagem(
      "Lendo a planilha..."
    );

    setPreVisualizacao([]);

    const periodoArquivo =
      detectarMesAnoArquivo(
        arquivo.name
      );

    if (
      !periodoArquivo.mes ||
      !periodoArquivo.ano
    ) {
      setMensagem(
        "Não consegui identificar o mês e o ano pelo nome do arquivo. Use um nome como JULHO 2026.xlsx."
      );

      return;
    }

    const jaImportado =
      importacoes.some(
        (item) =>
          item.nomeArquivo.toLowerCase() ===
          arquivo.name.toLowerCase()
      );

    if (jaImportado) {
      setMensagem(
        "Este arquivo já foi importado anteriormente. A importação foi bloqueada para evitar duplicidade."
      );

      return;
    }

    const leitor =
      new FileReader();

    leitor.onload = (
      evento
    ) => {
      try {
        const conteudo =
          evento.target
            ?.result;

        if (!conteudo) {
          setMensagem(
            "Não foi possível abrir o arquivo."
          );

          return;
        }

        const workbook =
          XLSX.read(
            conteudo,
            {
              type: "array",

              cellDates: true,
            }
          );

        const novosLancamentos: Lancamento[] =
          [];

        const abasDias =
          workbook.SheetNames.filter(
            (nome) =>
              /^(0[1-9]|[12][0-9]|3[01])$/.test(
                nome
              )
          );

        abasDias.forEach(
          (nomeAba) => {
            const planilha =
              workbook.Sheets[
                nomeAba
              ];

            if (!planilha) {
              return;
            }

            const linhas =
              XLSX.utils.sheet_to_json<
                unknown[]
              >(planilha, {
                header: 1,

                defval: "",

                raw: true,

                range: "A2:H41",
              });

            linhas.forEach(
              (
                linha,
                indice
              ) => {
                const descricao =
                  String(
                    linha[0] ??
                      ""
                  ).trim();

                const tipoEntrada =
                  String(
                    linha[2] ??
                      ""
                  ).trim();

                const tipoSaida =
                  String(
                    linha[3] ??
                      ""
                  ).trim();

                const formaPagamento =
                  String(
                    linha[4] ??
                      ""
                  ).trim();

                const entrada =
                  converterNumero(
                    linha[5]
                  );

                const saida =
                  converterNumero(
                    linha[6]
                  );

                const unidade =
                  String(
                    linha[7] ??
                      ""
                  ).trim();

                if (
                  descricao ===
                    "" ||
                  (entrada === 0 &&
                    saida === 0)
                ) {
                  return;
                }

                const dataCompleta =
                  `${periodoArquivo.ano}-${periodoArquivo.mes}-${nomeAba}`;

                novosLancamentos.push(
                  {
                    id: `${arquivo.name}-${nomeAba}-${indice}-${Date.now()}-${Math.random()}`,

                    dia:
                      nomeAba,

                    data:
                      dataCompleta,

                    competencia:
                      `${periodoArquivo.mes}/${periodoArquivo.ano}`,

                    descricao,

                    tipoEntrada,

                    tipoSaida,

                    formaPagamento,

                    entrada,

                    saida,

                    unidade,

                    origem:
                      "excel",
                  }
                );
              }
            );
          }
        );

        setPreVisualizacao(
          novosLancamentos
        );

        if (
          novosLancamentos.length ===
          0
        ) {
          setMensagem(
            "Nenhum lançamento foi encontrado."
          );

          return;
        }

        setMensagem(
          `${novosLancamentos.length} lançamentos encontrados para ${periodoArquivo.mes}/${periodoArquivo.ano}. Confira os valores e confirme a importação.`
        );
      } catch (erro) {
        console.error(
          "Erro ao importar:",
          erro
        );

        setMensagem(
          "Erro ao ler a planilha. Nenhum dado foi salvo."
        );
      }
    };

    leitor.onerror = () => {
      setMensagem(
        "Não foi possível abrir o arquivo selecionado."
      );
    };

    leitor.readAsArrayBuffer(
      arquivo
    );
  };

  const confirmarImportacao =
    () => {
      if (
        preVisualizacao.length ===
          0 ||
        !arquivoNome
      ) {
        return;
      }

      setLancamentos(
        (dadosAtuais) => [
          ...dadosAtuais,

          ...preVisualizacao,
        ]
      );

      setImportacoes(
        (dadosAtuais) => [
          ...dadosAtuais,

          {
            nomeArquivo:
              arquivoNome,

            dataImportacao:
              new Date().toLocaleString(
                "pt-BR"
              ),
          },
        ]
      );

      setMensagem(
        "Importação confirmada e salva com sucesso."
      );

      setPreVisualizacao(
        []
      );

      setArquivoNome("");
    };

  const cancelarImportacao =
    () => {
      setPreVisualizacao(
        []
      );

      setArquivoNome("");

      setMensagem("");
    };

  /* =======================================================
     RECEITAS E DESPESAS
  ======================================================= */

  const salvarLancamentoManual =
    (
      tipo:
        | "Entrada"
        | "Saída"
    ) => {
      const descricao =
        formulario.descricao.trim();

      const valor =
        converterNumero(
          formulario.valor
        );

      if (
        !formulario.data
      ) {
        alert(
          "Informe a data."
        );

        return;
      }

      if (!descricao) {
        alert(
          "Digite uma descrição."
        );

        return;
      }

      if (valor <= 0) {
        alert(
          "Digite um valor maior que zero."
        );

        return;
      }

      if (
        !formulario.formaPagamento
      ) {
        alert(
          "Selecione um banco ou conta."
        );

        return;
      }

      if (
        !formulario.unidade
      ) {
        alert(
          "Selecione uma unidade."
        );

        return;
      }

      if (
        tipo === "Entrada" &&
        !formulario.tipoEntrada
      ) {
        alert(
          "Selecione o tipo de entrada."
        );

        return;
      }

      if (
        tipo === "Saída" &&
        !formulario.tipoSaida
      ) {
        alert(
          "Selecione o tipo de saída."
        );

        return;
      }

      const novoLancamento: Lancamento =
        {
          id:
            lancamentoEditando ??
            `manual-${Date.now()}-${Math.random()}`,

          dia:
            diaDaData(
              formulario.data
            ),

          data:
            formulario.data,

          competencia:
            competenciaDaData(
              formulario.data
            ),

          descricao,

          tipoEntrada:
            tipo ===
            "Entrada"
              ? formulario.tipoEntrada
              : "",

          tipoSaida:
            tipo ===
            "Saída"
              ? formulario.tipoSaida
              : "",

          formaPagamento:
            formulario.formaPagamento,

          entrada:
            tipo ===
            "Entrada"
              ? valor
              : 0,

          saida:
            tipo ===
            "Saída"
              ? valor
              : 0,

          unidade:
            formulario.unidade,

          origem:
            "manual",
        };

      if (
        lancamentoEditando
      ) {
        setLancamentos(
          (dadosAtuais) =>
            dadosAtuais.map(
              (item) =>
                item.id ===
                lancamentoEditando
                  ? novoLancamento
                  : item
            )
        );
      } else {
        setLancamentos(
          (dadosAtuais) => [
            ...dadosAtuais,

            novoLancamento,
          ]
        );
      }

      const estavaEditando =
        Boolean(
          lancamentoEditando
        );

      setFormulario(
        criarFormularioVazio()
      );

      setLancamentoEditando(
        null
      );

      alert(
        estavaEditando
          ? "Lançamento atualizado com sucesso."
          : "Lançamento salvo com sucesso."
      );
    };

  const editarLancamento =
    (
      lancamento: Lancamento
    ) => {
      setLancamentoEditando(
        lancamento.id
      );

      setFormulario({
        data:
          lancamento.data ||
          hojeISO(),

        descricao:
          lancamento.descricao,

        valor: String(
          lancamento.entrada >
            0
            ? lancamento.entrada
            : lancamento.saida
        ).replace(
          ".",
          ","
        ),

        tipoEntrada:
          lancamento.tipoEntrada,

        tipoSaida:
          lancamento.tipoSaida,

        formaPagamento:
          lancamento.formaPagamento,

        unidade:
          lancamento.unidade ||
          "CEDEP",
      });

      setPagina(
        lancamento.entrada >
          0
          ? "Receitas"
          : "Despesas"
      );

      window.scrollTo({
        top: 0,

        behavior: "smooth",
      });
    };

  const excluirLancamento =
    (
      lancamento: Lancamento
    ) => {
      const confirmar =
        window.confirm(
          `Deseja realmente excluir "${lancamento.descricao}"?`
        );

      if (!confirmar) {
        return;
      }

      setLancamentos(
        (dadosAtuais) =>
          dadosAtuais.filter(
            (item) =>
              item.id !==
              lancamento.id
          )
      );
    };

  const cancelarEdicao =
    () => {
      setFormulario(
        criarFormularioVazio()
      );

      setLancamentoEditando(
        null
      );
    };

  /* =======================================================
     BAIXA CONTAS A RECEBER / PAGAR
  ======================================================= */

  const baixarContaFinanceira =
    (
      conta: Conta
    ) => {
      const dataBaixa =
        hojeISO();

      const novoLancamento: Lancamento =
        {
          id: `baixa-${conta.id}-${Date.now()}`,

          dia:
            diaDaData(
              dataBaixa
            ),

          data:
            dataBaixa,

          competencia:
            competenciaDaData(
              dataBaixa
            ),

          descricao:
            conta.descricao,

          tipoEntrada:
            conta.tipo ===
            "receber"
              ? conta.categoria ||
                "Conta Recebida"
              : "",

          tipoSaida:
            conta.tipo ===
            "pagar"
              ? conta.categoria ||
                "Conta Paga"
              : "",

          formaPagamento:
            conta.banco,

          entrada:
            conta.tipo ===
            "receber"
              ? conta.valor
              : 0,

          saida:
            conta.tipo ===
            "pagar"
              ? conta.valor
              : 0,

          unidade:
            conta.unidade,

          origem:
            "manual",
        };

      setLancamentos(
        (atuais) => [
          ...atuais,

          novoLancamento,
        ]
      );
    };

  const registrarReceitaSecretaria =
    (
      recebimento:
        RecebimentoCaixa
    ) => {
      const data =
        hojeISO();

      const novoLancamento: Lancamento =
        {
          id: `secretaria-${recebimento.id}`,
          dia:
            diaDaData(data),
          data,
          competencia:
            competenciaDaData(
              data
            ),
          descricao:
            `${recebimento.descricao} - ${recebimento.alunoNome}`,
          tipoEntrada:
            "Mensalidade",
          tipoSaida: "",
          formaPagamento:
            recebimento.formaPagamento,
          entrada:
            recebimento.valor,
          saida: 0,
          unidade:
            recebimento.unidade,
          origem: "manual",
        };

      setLancamentos(
        (atuais) => [
          ...atuais,
          novoLancamento,
        ]
      );
    };

  const registrarPagamentoProfessor =
    (
      pagamento:
        PagamentoProfessorFinanceiro
    ) => {
      const novoLancamento: Lancamento =
        {
          id: pagamento.id,
          dia:
            diaDaData(
              pagamento.data
            ),
          data:
            pagamento.data,
          competencia:
            competenciaDaData(
              pagamento.data
            ),
          descricao:
            `Pagamento professor ${pagamento.professorNome} - ${pagamento.competencia}`,
          tipoEntrada: "",
          tipoSaida:
            "Pagamento de Professor",
          formaPagamento:
            pagamento.banco,
          entrada: 0,
          saida:
            pagamento.valor,
          unidade:
            pagamento.unidade,
          origem: "manual",
        };

      setLancamentos(
        (atuais) => [
          ...atuais,
          novoLancamento,
        ]
      );
    };

  /* =======================================================
     ZERAR LANÇAMENTOS
  ======================================================= */

   /* =======================================================
     FILTROS
  ======================================================= */

  const lancamentosFiltrados =
    useMemo(() => {
      return lancamentosDashboard.filter(
        (item) => {
          const correspondeBusca =
            item.descricao
              .toLowerCase()
              .includes(
                busca.toLowerCase()
              );

          const correspondeTipo =
            filtroTipo ===
              "Todos" ||
            (filtroTipo ===
              "Entradas" &&
              item.entrada >
                0) ||
            (filtroTipo ===
              "Saídas" &&
              item.saida > 0);

          return (
            correspondeBusca &&
            correspondeTipo
          );
        }
      );
    }, [
      lancamentosDashboard,

      busca,

      filtroTipo,
    ]);

  const lancamentosOrdenados =
    useMemo(
      () =>
        [
          ...lancamentosFiltrados,
        ].reverse(),
      [lancamentosFiltrados]
    );

  const totalPaginasLancamentos =
    Math.max(
      1,
      Math.ceil(
        lancamentosOrdenados.length /
          itensPorPagina
      )
    );

  const lancamentosDaPagina =
    useMemo(() => {
      const inicio =
        (paginaLancamentos - 1) *
        itensPorPagina;

      return lancamentosOrdenados.slice(
        inicio,
        inicio + itensPorPagina
      );
    }, [
      lancamentosOrdenados,
      paginaLancamentos,
      itensPorPagina,
    ]);

  useEffect(() => {
    setPaginaLancamentos(1);
  }, [
    busca,
    filtroTipo,
    competenciaDashboard,
    itensPorPagina,
  ]);

  useEffect(() => {
    setPaginaLancamentos(
      (paginaAtual) =>
        Math.min(
          paginaAtual,
          totalPaginasLancamentos
        )
    );
  }, [
    totalPaginasLancamentos,
  ]);

  const receitas =
    lancamentos.filter(
      (item) =>
        item.entrada > 0
    );

  const despesas =
    lancamentos.filter(
      (item) =>
        item.saida > 0
    );

  const menu = [
    "Dashboard",

    "Cadastros",

    "Professores",

    "Mensalidades",

    "Matrículas e Turmas",

    "Secretaria e Caixa",

    "Documentos",

    "Receitas",

    "Despesas",

    "Contas a Receber",

    "Contas a Pagar",

    "Bancos",

    "Importar Excel",

    "Relatórios",

    "Gestão e Fechamento",

    "Configurações",

    "Nuvem e Backup",

    "Usuários",
  ].filter((item) =>
    usuarioAtual
      ? podeAcessar(
          usuarioAtual,
          item
        )
      : false
  );

  const concluirEntrada =
    async (
      usuario: UsuarioSessao
    ) => {
      if (
        supabaseConfigurado
      ) {
        const alterou =
          await prepararSincronizacaoInicial(
            usuario.id,
            usuario.perfil !==
              "Consulta",
            usuario.perfil
          );

        if (alterou) {
          window.location.reload();
          return;
        }
      }

      setUsuarioAtual(usuario);
      setPagina("Dashboard");
    };

  /* =======================================================
     INTERFACE
  ======================================================= */

  if (verificandoAcesso) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background:
            "#101a2d",
          color: "white",
          fontFamily:
            "Arial, Helvetica, sans-serif",
        }}
      >
        Verificando acesso...
      </div>
    );
  }

  if (!usuarioAtual) {
    if (supabaseConfigurado) {
      return (
        <TelaLoginOnline
          onEntrar={async (
            usuario
          ) => {
            await concluirEntrada(
              usuario
            );
          }}
        />
      );
    }

    return (
      <TelaLogin
        onEntrar={async (
          usuario
        ) => {
          await concluirEntrada(
            usuario
          );
        }}
      />
    );
  }

  return (
    <div
      className="erp-app"
      style={estilos.app}
    >
      <header
        className="erp-topo-mobile notranslate"
        lang="pt-BR"
        translate="no"
      >
        <button
          type="button"
          className="erp-menu-mobile-botao"
          aria-label={
            menuMobileAberto
              ? "Fechar menu"
              : "Abrir menu"
          }
          aria-expanded={
            menuMobileAberto
          }
          onClick={() =>
            setMenuMobileAberto(
              (aberto) =>
                !aberto
            )
          }
        >
          <span />
          <span />
          <span />
        </button>

        <img
          src="/logo-cedep-branca.png"
          alt="CEDEP Cursos"
        />

        <div>
          <strong>
            {pagina}
          </strong>
          <span>
            {usuarioAtual.nome}
          </span>
        </div>
      </header>

      {menuMobileAberto && (
        <button
          type="button"
          className="erp-menu-mobile-fundo"
          aria-label="Fechar menu"
          onClick={() =>
            setMenuMobileAberto(
              false
            )
          }
        />
      )}

      {/* MENU */}

      <aside
        className={`erp-sidebar notranslate${
          menuMobileAberto
            ? " erp-sidebar-aberta"
            : ""
        }`}
        lang="pt-BR"
        translate="no"
        style={
          estilos.sidebar
        }
      >
        <div
          style={{
            marginBottom: 35,
          }}
        >
          <img
            src="/logo-cedep-branca.png"
            alt="CEDEP Cursos"
            style={estilos.logoSidebar}
          />

          <h2
            style={{
              margin: "18px 0 0",

              fontSize: 20,
            }}
          >
            Sistema Financeiro
          </h2>

          <p
            style={
              estilos.subtituloMenu
            }
          >
            CEDEP | Treinei, Passei!
          </p>
        </div>

        <nav
          aria-label="Menu principal do ERP"
        >
          {menu.map(
            (item) => (
              <button
                key={item}
                type="button"
                lang="pt-BR"
                translate="no"
                onClick={() => {
                  setPagina(
                    item
                  );

                  setMenuMobileAberto(
                    false
                  );

                  if (
                    item !==
                      "Receitas" &&
                    item !==
                      "Despesas"
                  ) {
                    cancelarEdicao();
                  }
                }}
                style={{
                  ...estilos.botaoMenu,

                  background:
                    pagina ===
                    item
                      ? "#ed232b"
                      : "transparent",
                }}
              >
                {item}
              </button>
            )
          )}
        </nav>

        <div
          style={
            estilos.usuarioSidebar
          }
        >
          <strong>
            {usuarioAtual.nome}
          </strong>

          <span>
            {usuarioAtual.perfil}
          </span>

          <button
            onClick={async () => {
              await encerrarSessaoOnline();

              setUsuarioAtual(
                null
              );

              setPagina(
                "Dashboard"
              );
            }}
            style={
              estilos.botaoSair
            }
          >
            Sair
          </button>
        </div>
      </aside>

      {/* CONTEÚDO */}

      <main
        className="erp-conteudo"
        style={
          estilos.conteudo
        }
      >
        {/* DASHBOARD */}

        {pagina ===
          "Dashboard" && (
          <>
            <Cabecalho
              titulo="Dashboard Financeiro"
              subtitulo="Visão geral das suas finanças"
            />

            <section
              style={
                estilos.dashboardToolbar
              }
            >
              <div
                style={
                  estilos.marcaDashboard
                }
              >
                <img
                  src="/logo-cedep.png"
                  alt="CEDEP Cursos"
                  style={
                    estilos.logoDashboard
                  }
                />

                <div>
                  <strong>
                    Período do Dashboard
                  </strong>

                  <div
                    style={
                      estilos.textoCinza
                    }
                  >
                    Os indicadores e a
                    tabela seguem a
                    competência escolhida.
                  </div>
                </div>
              </div>

              <label
                style={
                  estilos.campoPeriodo
                }
              >
                <strong>
                  Competência
                </strong>

                <select
                  value={
                    competenciaDashboard
                  }
                  onChange={(evento) =>
                    setCompetenciaDashboard(
                      evento.target.value
                    )
                  }
                  style={estilos.input}
                >
                  <option value="Todas">
                    Todos os períodos
                  </option>

                  {competenciasDashboard.map(
                    (competencia) => (
                      <option
                        key={
                          competencia
                        }
                        value={
                          competencia
                        }
                      >
                        {competencia}
                      </option>
                    )
                  )}
                </select>
              </label>
            </section>

            <section
              style={estilos.cards}
            >
              <Card
                titulo="Saldo do período"
                valor={moeda(
                  saldoDashboard
                )}
              />

              <Card
                titulo="Entradas"
                valor={moeda(
                  entradasDashboard
                )}
              />

              <Card
                titulo="Saídas"
                valor={moeda(
                  saidasDashboard
                )}
              />

              <Card
                titulo="Lançamentos"
                valor={String(
                  lancamentosDashboard.length
                )}
              />
            </section>

            <section
              style={
                estilos.gradeDashboard
              }
            >
              <div
                style={
                  estilos.caixa
                }
              >
                <h2>
                  {competenciaDashboard ===
                  "Todas"
                    ? "Comparativo mensal"
                    : "Fluxo de caixa diário"}
                </h2>

                <GraficoFluxo
                  pontos={
                    fluxoDashboard
                  }
                />
              </div>

              <div
                style={
                  estilos.caixa
                }
              >
                <h2>
                  Resumo
                </h2>

                <Resumo
                  nome="Entradas"
                  valor={moeda(
                    entradasDashboard
                  )}
                />

                <Resumo
                  nome="Saídas"
                  valor={moeda(
                    saidasDashboard
                  )}
                />

                <Resumo
                  nome="Resultado"
                  valor={moeda(
                    saldoDashboard
                  )}
                />
              </div>
            </section>

            <section
              style={
                estilos.caixaLancamentos
              }
            >
              <h2>
                Lançamentos do período
              </h2>

              <Filtros
                busca={busca}

                setBusca={
                  setBusca
                }

                filtroTipo={
                  filtroTipo
                }

                setFiltroTipo={
                  setFiltroTipo
                }
              />

              {lancamentosFiltrados.length ===
              0 ? (
                <div
                  style={
                    estilos.vazio
                  }
                >
                  Nenhum lançamento encontrado.
                </div>
              ) : (
                <Tabela
                  lancamentos={
                    lancamentosDaPagina
                  }

                  editarLancamento={
                    editarLancamento
                  }

                  excluirLancamento={
                    excluirLancamento
                  }
                />
              )}

              {lancamentosFiltrados.length >
                0 && (
                <div
                  style={
                    estilos.paginacao
                  }
                >
                  <div
                    style={
                      estilos.resumoPaginacao
                    }
                  >
                    Exibindo{" "}
                    {Math.min(
                      (paginaLancamentos -
                        1) *
                        itensPorPagina +
                        1,
                      lancamentosFiltrados.length
                    )}{" "}
                    a{" "}
                    {Math.min(
                      paginaLancamentos *
                        itensPorPagina,
                      lancamentosFiltrados.length
                    )}{" "}
                    de{" "}
                    {
                      lancamentosFiltrados.length
                    }{" "}
                    lançamentos
                  </div>

                  <label
                    style={
                      estilos.itensPorPagina
                    }
                  >
                    <span>
                      Por página
                    </span>
                    <select
                      value={
                        itensPorPagina
                      }
                      onChange={(
                        evento
                      ) =>
                        setItensPorPagina(
                          Number(
                            evento
                              .target
                              .value
                          )
                        )
                      }
                      style={
                        estilos.selectPaginacao
                      }
                    >
                      <option
                        value={10}
                      >
                        10
                      </option>
                      <option
                        value={15}
                      >
                        15
                      </option>
                    </select>
                  </label>

                  <div
                    style={
                      estilos.botoesPaginacao
                    }
                  >
                    <button
                      onClick={() =>
                        setPaginaLancamentos(
                          (atual) =>
                            Math.max(
                              atual -
                                1,
                              1
                            )
                        )
                      }
                      disabled={
                        paginaLancamentos ===
                        1
                      }
                      style={{
                        ...estilos.botaoPagina,
                        opacity:
                          paginaLancamentos ===
                          1
                            ? 0.45
                            : 1,
                      }}
                    >
                      Anterior
                    </button>
                    <strong>
                      Página{" "}
                      {
                        paginaLancamentos
                      }{" "}
                      de{" "}
                      {
                        totalPaginasLancamentos
                      }
                    </strong>
                    <button
                      onClick={() =>
                        setPaginaLancamentos(
                          (atual) =>
                            Math.min(
                              atual +
                                1,
                              totalPaginasLancamentos
                            )
                        )
                      }
                      disabled={
                        paginaLancamentos ===
                        totalPaginasLancamentos
                      }
                      style={{
                        ...estilos.botaoPagina,
                        opacity:
                          paginaLancamentos ===
                          totalPaginasLancamentos
                            ? 0.45
                            : 1,
                      }}
                    >
                      Próxima
                    </button>
                  </div>
                </div>
              )}
            </section>
          </>
        )}

        {/* RECEITAS */}

        {pagina ===
          "Cadastros" && (
          <Cadastros />
        )}

        {pagina ===
          "Professores" && (
          <Professores
            perfil={
              usuarioAtual.perfil
            }
            onRegistrarPagamento={
              registrarPagamentoProfessor
            }
          />
        )}

        {pagina ===
          "Mensalidades" && (
          <Mensalidades />
        )}

        {pagina ===
          "Matrículas e Turmas" && (
          <Academico
            usuarioAtual={
              usuarioAtual
            }
          />
        )}

        {pagina ===
          "Secretaria e Caixa" && (
          <Secretaria
            onRegistrarReceita={
              registrarReceitaSecretaria
            }
          />
        )}

        {pagina ===
          "Documentos" && (
          <Documentos />
        )}

        {pagina ===
          "Receitas" && (
          <>
            <Cabecalho
              titulo="Receitas"

              subtitulo="Cadastro e controle de entradas"
            />

            <FormularioLancamento
              tipo="Entrada"

              configuracoes={
                configuracoes
              }

              formulario={
                formulario
              }

              setFormulario={
                setFormulario
              }

              salvar={() =>
                salvarLancamentoManual(
                  "Entrada"
                )
              }

              editando={Boolean(
                lancamentoEditando
              )}

              cancelarEdicao={
                cancelarEdicao
              }
            />

            <section
              style={{
                ...estilos.caixa,

                marginTop: 25,
              }}
            >
              <h2>
                Receitas cadastradas
              </h2>

              {receitas.length ===
              0 ? (
                <p
                  style={
                    estilos.textoCinza
                  }
                >
                  Nenhuma receita cadastrada.
                </p>
              ) : (
                <Tabela
                  lancamentos={[
                    ...receitas,
                  ].reverse()}

                  editarLancamento={
                    editarLancamento
                  }

                  excluirLancamento={
                    excluirLancamento
                  }
                />
              )}
            </section>
          </>
        )}

        {/* DESPESAS */}

        {pagina ===
          "Despesas" && (
          <>
            <Cabecalho
              titulo="Despesas"

              subtitulo="Cadastro e controle de saídas"
            />

            <FormularioLancamento
              tipo="Saída"

              configuracoes={
                configuracoes
              }

              formulario={
                formulario
              }

              setFormulario={
                setFormulario
              }

              salvar={() =>
                salvarLancamentoManual(
                  "Saída"
                )
              }

              editando={Boolean(
                lancamentoEditando
              )}

              cancelarEdicao={
                cancelarEdicao
              }
            />

            <section
              style={{
                ...estilos.caixa,

                marginTop: 25,
              }}
            >
              <h2>
                Despesas cadastradas
              </h2>

              {despesas.length ===
              0 ? (
                <p
                  style={
                    estilos.textoCinza
                  }
                >
                  Nenhuma despesa cadastrada.
                </p>
              ) : (
                <Tabela
                  lancamentos={[
                    ...despesas,
                  ].reverse()}

                  editarLancamento={
                    editarLancamento
                  }

                  excluirLancamento={
                    excluirLancamento
                  }
                />
              )}
            </section>
          </>
        )}

        {/* CONTAS */}

        {pagina ===
          "Contas a Receber" && (
          <Contas
            tipo="receber"

            onBaixar={
              baixarContaFinanceira
            }
            usuarioAtual={
              usuarioAtual
            }
          />
        )}

        {pagina ===
          "Contas a Pagar" && (
          <Contas
            tipo="pagar"

            onBaixar={
              baixarContaFinanceira
            }
            usuarioAtual={
              usuarioAtual
            }
          />
        )}

        {/* BANCOS */}

        {pagina ===
          "Bancos" && (
          <>
            <Cabecalho
              titulo="Bancos"

              subtitulo="Resumo financeiro por banco e forma de pagamento"
            />

            {resumoBancos.length ===
            0 ? (
              <section
                style={
                  estilos.caixa
                }
              >
                <h2>
                  Nenhuma movimentação
                </h2>

                <p
                  style={
                    estilos.textoCinza
                  }
                >
                  Os bancos aparecerão automaticamente quando houver lançamentos.
                </p>
              </section>
            ) : (
              <>
                <section
                  style={
                    estilos.cardsBancos
                  }
                >
                  {resumoBancos.map(
                    (banco) => (
                      <div
                        key={
                          banco.nome
                        }

                        style={
                          estilos.cardBanco
                        }
                      >
                        <div
                          style={
                            estilos.iconeBanco
                          }
                        >
                          🏦
                        </div>

                        <h2>
                          {
                            banco.nome
                          }
                        </h2>

                        <span
                          style={
                            estilos.textoCinza
                          }
                        >
                          {
                            banco.quantidade
                          }{" "}
                          movimentações
                        </span>

                        <ResumoBancoLinha
                          nome="Entradas"

                          valor={moeda(
                            banco.entradas
                          )}
                        />

                        <ResumoBancoLinha
                          nome="Saídas"

                          valor={moeda(
                            banco.saidas
                          )}
                        />

                        <div
                          style={
                            estilos.saldoBanco
                          }
                        >
                          <span>
                            Saldo
                          </span>

                          <strong>
                            {moeda(
                              banco.saldo
                            )}
                          </strong>
                        </div>

                        <button
                          onClick={() =>
                            setBancoSelecionado(
                              banco.nome
                            )
                          }

                          style={
                            estilos.botaoVer
                          }
                        >
                          Ver movimentações
                        </button>
                      </div>
                    )
                  )}
                </section>

                <section
                  style={{
                    ...estilos.caixa,

                    marginTop: 25,
                  }}
                >
                  <div
                    style={
                      estilos.topoBanco
                    }
                  >
                    <h2>
                      {bancoSelecionado
                        ? `Movimentações — ${bancoSelecionado}`
                        : "Movimentações por banco"}
                    </h2>

                    {bancoSelecionado && (
                      <button
                        onClick={() =>
                          setBancoSelecionado(
                            null
                          )
                        }

                        style={
                          estilos.botaoSecundario
                        }
                      >
                        Limpar seleção
                      </button>
                    )}
                  </div>

                  {!bancoSelecionado ? (
                    <div
                      style={
                        estilos.vazio
                      }
                    >
                      Selecione um banco.
                    </div>
                  ) : (
                    <Tabela
                      lancamentos={[
                        ...movimentacoesBanco,
                      ].reverse()}

                      editarLancamento={
                        editarLancamento
                      }

                      excluirLancamento={
                        excluirLancamento
                      }
                    />
                  )}
                </section>
              </>
            )}
          </>
        )}

        {/* IMPORTAÇÃO */}

        {pagina ===
          "Importar Excel" && (
          <>
            <Cabecalho
              titulo="Importar Excel"

              subtitulo="Importação das planilhas financeiras"
            />

            <section
              style={
                estilos.caixa
              }
            >
              <h2>
                Importar planilha financeira
              </h2>

              <p
                style={
                  estilos.textoCinza
                }
              >
                O arquivo deve ter o mês e o ano no nome. Exemplo:
                <strong>
                  {" "}
                  JULHO 2026.xlsx
                </strong>
              </p>

              <div
                style={
                  estilos.botoes
                }
              >
                <label
                  style={
                    estilos.botaoVermelho
                  }
                >
                  Selecionar arquivo XLSX

                  <input
                    type="file"

                    accept=".xlsx,.xls"

                    style={{
                      display:
                        "none",
                    }}

                    onChange={(
                      evento
                    ) => {
                      const arquivo =
                        evento.target
                          .files?.[0];

                      if (
                        arquivo
                      ) {
                        importarExcel(
                          arquivo
                        );
                      }

                      evento.target.value =
                        "";
                    }}
                  />
                </label>

                {preVisualizacao.length >
                  0 && (
                  <>
                    <button
                      onClick={
                        confirmarImportacao
                      }

                      style={
                        estilos.botaoConfirmar
                      }
                    >
                      Confirmar importação
                    </button>

                    <button
                      onClick={
                        cancelarImportacao
                      }

                      style={
                        estilos.botaoSecundario
                      }
                    >
                      Cancelar
                    </button>
                  </>
                )}
              </div>

              {(arquivoNome ||
                mensagem) && (
                <div
                  style={
                    estilos.status
                  }
                >
                  {arquivoNome && (
                    <div>
                      <strong>
                        Arquivo:
                      </strong>{" "}
                      {
                        arquivoNome
                      }
                    </div>
                  )}

                  <div>
                    <strong>
                      Status:
                    </strong>{" "}
                    {mensagem}
                  </div>
                </div>
              )}

              {preVisualizacao.length >
                0 && (
                <>
                  <div
                    style={
                      estilos.cardsImportacao
                    }
                  >
                    <MiniCard
                      titulo="Lançamentos"

                      valor={String(
                        preVisualizacao.length
                      )}
                    />

                    <MiniCard
                      titulo="Entradas"

                      valor={moeda(
                        previewEntradas
                      )}
                    />

                    <MiniCard
                      titulo="Saídas"

                      valor={moeda(
                        previewSaidas
                      )}
                    />

                    <MiniCard
                      titulo="Saldo"

                      valor={moeda(
                        previewSaldo
                      )}
                    />
                  </div>

                  <Tabela
                    lancamentos={preVisualizacao.slice(
                      0,
                      50
                    )}
                  />
                </>
              )}

              <div
                style={{
                  marginTop: 40,
                }}
              >
                <h2>
                  Arquivos já importados
                </h2>

                {importacoes.map(
                  (
                    item,
                    indice
                  ) => (
                    <div
                      key={`${item.nomeArquivo}-${indice}`}

                      style={
                        estilos.importacaoSalva
                      }
                    >
                      <strong>
                        {
                          item.nomeArquivo
                        }
                      </strong>

                      <span>
                        {
                          item.dataImportacao
                        }
                      </span>
                    </div>
                  )
                )}
              </div>
            </section>
          </>
        )}

        {/* RELATÓRIOS */}

        {pagina ===
          "Relatórios" && (
          <Relatorios
            lancamentos={
              lancamentos
            }
          />
        )}

        {pagina ===
          "Gestão e Fechamento" && (
          <GestaoFinanceira
            usuarioAtual={
              usuarioAtual
            }
          />
        )}

        {/* CONFIGURAÇÕES */}

        {pagina ===
          "Configurações" && (
          <Configuracoes />
        )}

        {/* NUVEM E BACKUP */}

        {pagina ===
          "Nuvem e Backup" && (
          <Nuvem />
        )}

        {/* USUÁRIOS E PERMISSÕES */}

        {pagina ===
          "Usuários" && (
          <Usuarios
            usuarioAtual={
              usuarioAtual
            }
          />
        )}
      </main>
    </div>
  );
}

/* =========================================================
   GRÁFICO DO DASHBOARD
========================================================= */

function GraficoFluxo({
  pontos,
}: {
  pontos: PontoFluxo[];
}) {
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

  if (pontos.length === 0) {
    return (
      <div
        style={
          estilos.areaGrafico
        }
      >
        O gráfico aparecerá quando
        houver movimentações no
        período selecionado.
      </div>
    );
  }

  const maiorValor = Math.max(
    ...pontos.flatMap(
      (ponto) => [
        ponto.entradas,
        ponto.saidas,
      ]
    ),
    1
  );

  return (
    <div>
      <div
        style={
          estilos.legendaGrafico
        }
      >
        <span>
          <i
            style={{
              ...estilos.marcadorLegenda,
              background:
                "#15803d",
            }}
          />
          Entradas
        </span>

        <span>
          <i
            style={{
              ...estilos.marcadorLegenda,
              background:
                "#ed232b",
            }}
          />
          Saídas
        </span>
      </div>

      <div
        style={
          estilos.graficoScroll
        }
      >
        <div
          style={{
            ...estilos.graficoBarras,
            minWidth: Math.max(
              540,
              pontos.length * 58
            ),
          }}
        >
          {pontos.map(
            (ponto) => (
              <div
                key={
                  ponto.chave
                }
                style={
                  estilos.grupoBarra
                }
              >
                <div
                  style={
                    estilos.barras
                  }
                >
                  <div
                    title={`Entradas: ${moeda(
                      ponto.entradas
                    )}`}
                    style={{
                      ...estilos.barraEntrada,
                      height: `${Math.max(
                        ponto.entradas >
                          0
                          ? 5
                          : 0,
                        (ponto.entradas /
                          maiorValor) *
                          100
                      )}%`,
                    }}
                  />

                  <div
                    title={`Saídas: ${moeda(
                      ponto.saidas
                    )}`}
                    style={{
                      ...estilos.barraSaida,
                      height: `${Math.max(
                        ponto.saidas > 0
                          ? 5
                          : 0,
                        (ponto.saidas /
                          maiorValor) *
                          100
                      )}%`,
                    }}
                  />
                </div>

                <span
                  style={
                    estilos.rotuloGrafico
                  }
                >
                  {ponto.rotulo}
                </span>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   FORMULÁRIO
========================================================= */

function FormularioLancamento({
  tipo,

  formulario,

  setFormulario,

  salvar,

  editando,

  cancelarEdicao,

  configuracoes,
}: {
  tipo:
    | "Entrada"
    | "Saída";

  formulario:
    FormularioLancamento;

  setFormulario: Dispatch<
    SetStateAction<FormularioLancamento>
  >;

  salvar: () => void;

  editando: boolean;

  cancelarEdicao:
    () => void;

  configuracoes:
    ConfiguracoesFinanceiras;
}) {
  return (
    <section
      style={
        estilos.caixa
      }
    >
      <h2>
        {editando
          ? `Editar ${tipo}`
          : `Nova ${tipo}`}
      </h2>

      <div
        style={
          estilos.formGrid
        }
      >
        <label
          style={
            estilos.campoGrupo
          }
        >
          <strong>
            Data
          </strong>

          <input
            type="date"

            value={
              formulario.data
            }

            onChange={(
              evento
            ) =>
              setFormulario(
                (atual) => ({
                  ...atual,

                  data:
                    evento.target
                      .value,
                })
              )
            }

            style={
              estilos.input
            }
          />
        </label>

        <Campo
          label="Descrição"

          value={
            formulario.descricao
          }

          onChange={(valor) =>
            setFormulario(
              (atual) => ({
                ...atual,

                descricao:
                  valor,
              })
            )
          }
        />

        <Campo
          label="Valor"

          value={
            formulario.valor
          }

          placeholder="Ex.: 350,00"

          onChange={(valor) =>
            setFormulario(
              (atual) => ({
                ...atual,

                valor,
              })
            )
          }
        />

        <CampoSelect
          label={
            tipo ===
            "Entrada"
              ? "Tipo de Entrada"
              : "Tipo de Saída"
          }

          value={
            tipo ===
            "Entrada"
              ? formulario.tipoEntrada
              : formulario.tipoSaida
          }

          opcoes={
            tipo ===
            "Entrada"
              ? configuracoes.tiposEntrada
              : configuracoes.tiposSaida
          }

          onChange={(valor) =>
            setFormulario(
              (atual) =>
                tipo ===
                "Entrada"
                  ? {
                      ...atual,

                      tipoEntrada:
                        valor,
                    }
                  : {
                      ...atual,

                      tipoSaida:
                        valor,
                    }
            )
          }
        />

        <CampoSelect
          label="Banco / Conta"

          value={
            formulario.formaPagamento
          }

          opcoes={
            configuracoes.bancos
          }

          onChange={(valor) =>
            setFormulario(
              (atual) => ({
                ...atual,

                formaPagamento:
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
            configuracoes.unidades
          }

          onChange={(valor) =>
            setFormulario(
              (atual) => ({
                ...atual,

                unidade:
                  valor,
              })
            )
          }
        />
      </div>

      <div
        style={
          estilos.competenciaInfo
        }
      >
        <strong>
          Competência:
        </strong>{" "}

        {competenciaDaData(
          formulario.data
        )}
      </div>

      <div
        style={
          estilos.botoes
        }
      >
        <button
          onClick={
            salvar
          }

          style={
            tipo ===
            "Entrada"
              ? estilos.botaoConfirmar
              : estilos.botaoVermelho
          }
        >
          {editando
            ? "Salvar alterações"
            : tipo ===
                "Entrada"
              ? "Salvar entrada"
              : "Salvar saída"}
        </button>

        {editando && (
          <button
            onClick={
              cancelarEdicao
            }

            style={
              estilos.botaoSecundario
            }
          >
            Cancelar edição
          </button>
        )}
      </div>
    </section>
  );
}

/* =========================================================
   CAMPOS
========================================================= */

function Campo({
  label,

  value,

  onChange,

  placeholder = "",
}: {
  label: string;

  value: string;

  onChange: (
    valor: string
  ) => void;

  placeholder?: string;
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
        value={value}

        placeholder={
          placeholder
        }

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

function CampoSelect({
  label,

  value,

  opcoes,

  onChange,
}: {
  label: string;

  value: string;

  opcoes: string[];

  onChange: (
    valor: string
  ) => void;
}) {
  const opcoesComValorAtual =
    value &&
    !opcoes.includes(value)
      ? [
          value,

          ...opcoes,
        ]
      : opcoes;

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
        <option value="">
          Selecione...
        </option>

        {opcoesComValorAtual.map(
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

/* =========================================================
   FILTROS
========================================================= */

function Filtros({
  busca,

  setBusca,

  filtroTipo,

  setFiltroTipo,
}: {
  busca: string;

  setBusca: (
    valor: string
  ) => void;

  filtroTipo: string;

  setFiltroTipo: (
    valor: string
  ) => void;
}) {
  return (
    <div
      style={
        estilos.filtros
      }
    >
      <input
        value={busca}

        placeholder="Buscar por descrição..."

        onChange={(
          evento
        ) =>
          setBusca(
            evento.target.value
          )
        }

        style={
          estilos.input
        }
      />

      <select
        value={
          filtroTipo
        }

        onChange={(
          evento
        ) =>
          setFiltroTipo(
            evento.target.value
          )
        }

        style={
          estilos.input
        }
      >
        <option>
          Todos
        </option>

        <option>
          Entradas
        </option>

        <option>
          Saídas
        </option>
      </select>
    </div>
  );
}

/* =========================================================
   CABEÇALHO
========================================================= */

function Cabecalho({
  titulo,

  subtitulo,
}: {
  titulo: string;

  subtitulo: string;
}) {
  return (
    <header
      style={
        estilos.cabecalho
      }
    >
      <div>
        <h1
          style={{
            margin: 0,

            fontSize: 32,
          }}
        >
          {titulo}
        </h1>

        <p
          style={
            estilos.textoCinza
          }
        >
          {subtitulo}
        </p>
      </div>

      <div
        style={
          estilos.usuario
        }
      >
        CEDEP Cursos
      </div>
    </header>
  );
}

/* =========================================================
   CARDS
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
          fontSize: 28,
        }}
      >
        {valor}
      </strong>
    </div>
  );
}

function MiniCard({
  titulo,

  valor,
}: {
  titulo: string;

  valor: string;
}) {
  return (
    <div
      style={
        estilos.miniCard
      }
    >
      <span>
        {titulo}
      </span>

      <strong>
        {valor}
      </strong>
    </div>
  );
}

function Resumo({
  nome,

  valor,
}: {
  nome: string;

  valor: string;
}) {
  return (
    <div
      style={
        estilos.resumo
      }
    >
      <span>
        {nome}
      </span>

      <strong
        style={{
          marginLeft: 14,
          textAlign: "right",
          overflowWrap:
            "anywhere",
        }}
      >
        {valor}
      </strong>
    </div>
  );
}

function ResumoBancoLinha({
  nome,

  valor,
}: {
  nome: string;

  valor: string;
}) {
  return (
    <div
      style={
        estilos.resumoBancoLinha
      }
    >
      <span>
        {nome}
      </span>

      <strong>
        {valor}
      </strong>
    </div>
  );
}

/* =========================================================
   TABELA
========================================================= */

function Tabela({
  lancamentos,

  editarLancamento,

  excluirLancamento,
}: {
  lancamentos:
    Lancamento[];

  editarLancamento?: (
    lancamento:
      Lancamento
  ) => void;

  excluirLancamento?: (
    lancamento:
      Lancamento
  ) => void;
}) {
  const moedaTabela = (
    valor: number
  ) =>
    valor.toLocaleString(
      "pt-BR",
      {
        style: "currency",

        currency: "BRL",
      }
    );

  const formatarData = (
    data: string
  ) => {
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
  };

  return (
    <div
      className="tabela-scroll"
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

            {(editarLancamento ||
              excluirLancamento) && (
              <th
                style={
                  estilos.th
                }
              >
                Ações
              </th>
            )}
          </tr>
        </thead>

        <tbody>
          {lancamentos.map(
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
                    ? formatarData(
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
                    ? moedaTabela(
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
                    ? moedaTabela(
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

                {(editarLancamento ||
                  excluirLancamento) && (
                  <td
                    style={
                      estilos.td
                    }
                  >
                    <div
                      style={{
                        display:
                          "flex",

                        gap: 7,
                      }}
                    >
                      {editarLancamento && (
                        <button
                          onClick={() =>
                            editarLancamento(
                              item
                            )
                          }

                          style={
                            estilos.botaoEditar
                          }
                        >
                          Editar
                        </button>
                      )}

                      {excluirLancamento && (
                        <button
                          onClick={() =>
                            excluirLancamento(
                              item
                            )
                          }

                          style={
                            estilos.botaoExcluir
                          }
                        >
                          Excluir
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  );
}

/* =========================================================
   ESTILOS
========================================================= */

const estilos: Record<
  string,
  CSSProperties
> = {
  app: {
    minHeight: "100vh",

    display: "flex",

    width: "100%",

    maxWidth: "100vw",

    overflowX: "hidden",

    background: "#f4f6f8",

    color: "#0d1b30",

    fontFamily:
      "Arial, Helvetica, sans-serif",
  },

  sidebar: {
    width: 300,

    minHeight: "100vh",

    background: "#101a2d",

    color: "white",

    padding: "28px 24px",

    boxSizing: "border-box",

    flexShrink: 0,
  },

  subtituloMenu: {
    color: "#b9c4d5",
  },

  logoSidebar: {
    display: "block",

    width: "100%",

    maxWidth: 210,

    height: "auto",

    objectFit: "contain",
  },

  botaoMenu: {
    display: "block",

    width: "100%",

    padding: "15px 18px",

    marginBottom: 7,

    border: "none",

    borderRadius: 11,

    color: "white",

    fontSize: 16,

    textAlign: "left",

    cursor: "pointer",
  },

  usuarioSidebar: {
    marginTop: 28,

    paddingTop: 20,

    borderTop:
      "1px solid rgba(255,255,255,.16)",

    display: "flex",

    flexDirection: "column",

    gap: 7,

    color: "white",
  },

  botaoSair: {
    marginTop: 8,

    width: "100%",

    padding: "11px 14px",

    border:
      "1px solid rgba(255,255,255,.35)",

    borderRadius: 9,

    background:
      "transparent",

    color: "white",

    cursor: "pointer",
  },

  conteudo: {
    flex: 1,

    minWidth: 0,

    width: "100%",

    padding: 38,

    overflowX: "auto",

    boxSizing: "border-box",
  },

  cabecalho: {
    display: "flex",

    justifyContent:
      "space-between",

    alignItems: "center",

    marginBottom: 30,
  },

  usuario: {
    background: "white",

    padding: "18px 26px",

    borderRadius: 14,

    boxShadow:
      "0 6px 20px rgba(0,0,0,.08)",
  },

  textoCinza: {
    color: "#657084",

    lineHeight: 1.6,
  },

  dashboardToolbar: {
    display: "flex",

    justifyContent:
      "space-between",

    alignItems: "center",

    gap: 24,

    flexWrap: "wrap",

    background: "white",

    padding: "18px 22px",

    marginBottom: 22,

    borderRadius: 17,

    boxShadow:
      "0 6px 18px rgba(0,0,0,.06)",
  },

  marcaDashboard: {
    display: "flex",

    alignItems: "center",

    gap: 18,

    minWidth: 280,
  },

  logoDashboard: {
    width: 112,

    height: 58,

    objectFit: "contain",
  },

  campoPeriodo: {
    display: "flex",

    flexDirection: "column",

    gap: 7,

    minWidth: 220,
  },

  cards: {
    display: "grid",

    gridTemplateColumns:
      "repeat(auto-fit,minmax(220px,1fr))",

    gap: 22,
  },

  card: {
    background: "white",

    padding: 25,

    borderRadius: 17,

    display: "flex",

    flexDirection: "column",

    gap: 15,

    textAlign: "center",

    boxShadow:
      "0 6px 18px rgba(0,0,0,.06)",
  },

  gradeDashboard: {
    marginTop: 35,

    display: "grid",

    gridTemplateColumns:
      "repeat(auto-fit,minmax(min(100%,320px),1fr))",

    gap: 22,
  },

  caixa: {
    background: "white",

    minWidth: 0,

    padding: 28,

    borderRadius: 17,

    boxShadow:
      "0 6px 18px rgba(0,0,0,.06)",
  },

  areaGrafico: {
    minHeight: 260,

    border:
      "2px dashed #d9dfe8",

    borderRadius: 13,

    display: "flex",

    justifyContent:
      "center",

    alignItems: "center",

    color: "#929db0",
  },

  legendaGrafico: {
    display: "flex",

    gap: 20,

    justifyContent:
      "flex-end",

    marginBottom: 12,

    color: "#657084",

    fontSize: 14,
  },

  marcadorLegenda: {
    display: "inline-block",

    width: 10,

    height: 10,

    borderRadius: 3,

    marginRight: 7,
  },

  graficoScroll: {
    width: "100%",

    maxWidth: "100%",

    overflowX: "auto",

    paddingBottom: 5,
  },

  graficoBarras: {
    height: 255,

    display: "flex",

    alignItems:
      "stretch",

    gap: 10,

    padding:
      "16px 12px 0",

    borderLeft:
      "1px solid #d9dfe8",

    borderBottom:
      "1px solid #d9dfe8",

    background:
      "repeating-linear-gradient(to top, transparent 0, transparent 49px, #eef1f5 50px)",
  },

  grupoBarra: {
    flex: 1,

    minWidth: 44,

    display: "flex",

    flexDirection: "column",

    alignItems: "center",
  },

  barras: {
    width: "100%",

    flex: 1,

    display: "flex",

    alignItems:
      "flex-end",

    justifyContent:
      "center",

    gap: 4,
  },

  barraEntrada: {
    width: "38%",

    maxWidth: 18,

    minHeight: 0,

    background: "#15803d",

    borderRadius:
      "5px 5px 0 0",

    transition:
      "height .2s ease",
  },

  barraSaida: {
    width: "38%",

    maxWidth: 18,

    minHeight: 0,

    background: "#ed232b",

    borderRadius:
      "5px 5px 0 0",

    transition:
      "height .2s ease",
  },

  rotuloGrafico: {
    minHeight: 34,

    paddingTop: 8,

    color: "#657084",

    fontSize: 11,

    textAlign: "center",

    whiteSpace: "nowrap",
  },

  resumo: {
    display: "flex",

    justifyContent:
      "space-between",

    alignItems: "center",

    gap: 12,

    minWidth: 0,

    padding: "18px 0",

    borderBottom:
      "1px solid #e6e9ee",
  },

  caixaLancamentos: {
    background: "white",

    marginTop: 22,

    padding: 28,

    borderRadius: 17,

    boxShadow:
      "0 6px 18px rgba(0,0,0,.06)",
  },

  vazio: {
    color: "#8c96a8",

    padding: 35,

    textAlign: "center",
  },

  botoes: {
    display: "flex",

    gap: 12,

    flexWrap: "wrap",

    marginTop: 25,
  },

  botaoVermelho: {
    background: "#ed232b",

    color: "white",

    padding: "14px 22px",

    border: "none",

    borderRadius: 10,

    cursor: "pointer",
  },

  botaoConfirmar: {
    background: "#15803d",

    color: "white",

    padding: "14px 22px",

    border: "none",

    borderRadius: 10,

    cursor: "pointer",
  },

  botaoSecundario: {
    background: "white",

    padding: "14px 22px",

    border:
      "1px solid #ccd3dd",

    borderRadius: 10,

    cursor: "pointer",
  },

  botaoEditar: {
    background: "#2563eb",

    color: "white",

    border: "none",

    borderRadius: 7,

    padding: "8px 11px",

    cursor: "pointer",
  },

  botaoExcluir: {
    background: "#b91c1c",

    color: "white",

    border: "none",

    borderRadius: 7,

    padding: "8px 11px",

    cursor: "pointer",
  },

  botaoVer: {
    width: "100%",

    marginTop: 18,

    background: "#101a2d",

    color: "white",

    border: "none",

    borderRadius: 9,

    padding: 12,

    cursor: "pointer",
  },

  status: {
    marginTop: 25,

    background: "#f4f6f8",

    padding: 18,

    borderRadius: 10,
  },

  cardsImportacao: {
    display: "grid",

    gridTemplateColumns:
      "repeat(auto-fit,minmax(180px,1fr))",

    gap: 15,

    marginTop: 25,
  },

  miniCard: {
    border:
      "1px solid #e1e5eb",

    borderRadius: 12,

    padding: 18,

    display: "flex",

    flexDirection: "column",

    gap: 10,
  },

  importacaoSalva: {
    display: "flex",

    justifyContent:
      "space-between",

    padding: "15px 0",

    borderBottom:
      "1px solid #e7eaee",
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
    padding: "13px 14px",

    border:
      "1px solid #ccd3dd",

    borderRadius: 9,

    fontSize: 15,

    width: "100%",

    boxSizing: "border-box",
  },

  competenciaInfo: {
    marginTop: 18,

    background: "#eef2f7",

    padding: 12,

    borderRadius: 9,

    display: "inline-block",
  },

  filtros: {
    display: "grid",

    gridTemplateColumns:
      "2fr 1fr",

    gap: 12,

    marginBottom: 20,
  },

  cardsBancos: {
    display: "grid",

    gridTemplateColumns:
      "repeat(auto-fit,minmax(260px,1fr))",

    gap: 20,
  },

  cardBanco: {
    background: "white",

    padding: 24,

    borderRadius: 17,

    boxShadow:
      "0 6px 18px rgba(0,0,0,.06)",
  },

  iconeBanco: {
    fontSize: 30,
  },

  resumoBancoLinha: {
    display: "flex",

    justifyContent:
      "space-between",

    padding: "12px 0",

    borderBottom:
      "1px solid #edf0f3",
  },

  saldoBanco: {
    display: "flex",

    justifyContent:
      "space-between",

    paddingTop: 17,
  },

  topoBanco: {
    display: "flex",

    justifyContent:
      "space-between",

    alignItems: "center",
  },

  tabelaContainer: {
    overflowX: "scroll",

    marginTop: 20,

    paddingBottom: 4,
  },

  tabela: {
    width: "100%",

    minWidth: 1250,

    borderCollapse:
      "collapse",
  },

  th: {
    background: "#101a2d",

    color: "white",

    padding: 12,

    textAlign: "left",
  },

  td: {
    padding: 12,

    borderBottom:
      "1px solid #e8ebef",

    whiteSpace: "nowrap",
  },

  paginacao: {
    display: "flex",
    justifyContent:
      "space-between",
    alignItems: "center",
    gap: 16,
    flexWrap: "wrap",
    marginTop: 18,
    paddingTop: 18,
    borderTop:
      "1px solid #e2e8f0",
  },

  resumoPaginacao: {
    color: "#475569",
    fontWeight: 600,
  },

  itensPorPagina: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    color: "#334155",
    fontWeight: 600,
  },

  selectPaginacao: {
    padding: "8px 10px",
    color: "#0f172a",
    background: "white",
    border:
      "1px solid #94a3b8",
    borderRadius: 8,
  },

  botoesPaginacao: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },

  botaoPagina: {
    padding: "9px 14px",
    color: "white",
    background: "#101a2d",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 700,
  },
};

export default App;

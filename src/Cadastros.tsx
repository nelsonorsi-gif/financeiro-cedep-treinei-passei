import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

import {
  carregarConfiguracoes,
  type ConfiguracoesFinanceiras,
} from "./Configuracoes";
import {
  carregarCatalogoCursos,
  type CatalogoCursos,
  type Plano,
} from "./CatalogoCursos";
import Escolas from "./Escolas";
import AlunoPerfil from "./AlunoPerfil";
import type { UsuarioSessao } from "./Acesso";

type Situacao = "Ativo" | "Inativo";

export type Aluno = {
  id: string;
  nome: string;
  cpf: string;
  nascimento: string;
  telefone: string;
  email: string;
  unidade: string;
  cursoId: string;
  curso: string;
  planoId: string;
  planoNome: string;
  parcelas: number;
  bancoMensalidade: string;
  valorTabela: number;
  desconto: number;
  valorMensalidade: number;
  responsavelNome: string;
  responsavelCpf: string;
  responsavelTelefone: string;
  situacao: Situacao;
};

export type Parceiro = {
  id: string;
  nome: string;
  documento: string;
  telefone: string;
  email: string;
  tipo: string;
  observacao: string;
  situacao: Situacao;
};

type DadosCadastros = {
  alunos: Aluno[];
  parceiros: Parceiro[];
};

export const CHAVE_CADASTROS =
  "financeiro-cedep-cadastros";

const somenteNumeros = (
  valor: string
) =>
  valor.replace(/\D/g, "");

const formatarCpf = (
  valor: string
) =>
  somenteNumeros(valor)
    .slice(0, 11)
    .replace(
      /(\d{3})(\d)/,
      "$1.$2"
    )
    .replace(
      /(\d{3})(\d)/,
      "$1.$2"
    )
    .replace(
      /(\d{3})(\d{1,2})$/,
      "$1-$2"
    );

const formatarTelefone = (
  valor: string
) => {
  const numeros =
    somenteNumeros(
      valor
    ).slice(0, 11);

  if (numeros.length <= 10) {
    return numeros
      .replace(
        /(\d{2})(\d)/,
        "($1) $2"
      )
      .replace(
        /(\d{4})(\d)/,
        "$1-$2"
      );
  }

  return numeros
    .replace(
      /(\d{2})(\d)/,
      "($1) $2"
    )
    .replace(
      /(\d{5})(\d)/,
      "$1-$2"
    );
};

const formatarCpfCnpj = (
  valor: string
) => {
  const numeros =
    somenteNumeros(
      valor
    ).slice(0, 14);

  if (numeros.length <= 11) {
    return formatarCpf(
      numeros
    );
  }

  return numeros
    .replace(
      /(\d{2})(\d)/,
      "$1.$2"
    )
    .replace(
      /(\d{3})(\d)/,
      "$1.$2"
    )
    .replace(
      /(\d{3})(\d)/,
      "$1/$2"
    )
    .replace(
      /(\d{4})(\d{1,2})$/,
      "$1-$2"
    );
};

const campoIncompleto = (
  valor: string,
  tamanhos: number[]
) =>
  Boolean(valor) &&
  !tamanhos.includes(
    somenteNumeros(valor)
      .length
  );

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

const moeda = (valor: number) =>
  valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

const valorParaCampo = (
  valor: number
) =>
  valor > 0
    ? valor
        .toFixed(2)
        .replace(".", ",")
    : "";

const alunoVazio = (): Omit<
  Aluno,
  "id"
> => ({
  nome: "",
  cpf: "",
  nascimento: "",
  telefone: "",
  email: "",
  unidade: "CEDEP",
  cursoId: "",
  curso: "",
  planoId: "",
  planoNome: "",
  parcelas: 1,
  bancoMensalidade: "",
  valorTabela: 0,
  desconto: 0,
  valorMensalidade: 0,
  responsavelNome: "",
  responsavelCpf: "",
  responsavelTelefone: "",
  situacao: "Ativo",
});

const parceiroVazio = (): Omit<
  Parceiro,
  "id"
> => ({
  nome: "",
  documento: "",
  telefone: "",
  email: "",
  tipo: "",
  observacao: "",
  situacao: "Ativo",
});

function Cadastros({
  usuarioAtual,
}: {
  usuarioAtual: UsuarioSessao;
}) {
  const exibirCamposFinanceirosLegados =
    useMemo(() => false, []);
  const [aba, setAba] =
    useState<
      | "Alunos"
      | "Parceiros"
      | "Escolas"
    >(
      "Alunos"
    );
  const [alunoPerfil, setAlunoPerfil] =
    useState<Aluno | null>(null);

  const [dados, setDados] =
    useState<DadosCadastros>({
      alunos: [],
      parceiros: [],
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

  const [
    catalogo,
    setCatalogo,
  ] = useState<CatalogoCursos>(
    carregarCatalogoCursos()
  );

  const [aluno, setAluno] =
    useState(alunoVazio());
  const [
    valorTabelaTexto,
    setValorTabelaTexto,
  ] = useState("");
  const [
    descontoTexto,
    setDescontoTexto,
  ] = useState("");
  const [
    valorMensalidadeTexto,
    setValorMensalidadeTexto,
  ] = useState("");

  const [parceiro, setParceiro] =
    useState(parceiroVazio());

  const [editando, setEditando] =
    useState<string | null>(null);

  const [busca, setBusca] =
    useState("");

  useEffect(() => {
    try {
      const salvos =
        localStorage.getItem(
          CHAVE_CADASTROS
        );

      if (salvos) {
        const conteudo =
          JSON.parse(salvos);

        setDados({
          alunos: Array.isArray(
            conteudo.alunos
          )
            ? conteudo.alunos.map(
                (item: Aluno) => ({
                  ...item,
                  cursoId:
                    item.cursoId ?? "",
                  curso:
                    item.curso ?? "",
                  planoId:
                    item.planoId ?? "",
                  planoNome:
                    item.planoNome ?? "",
                  parcelas:
                    item.parcelas ?? 1,
                  bancoMensalidade:
                    item.bancoMensalidade ??
                    "",
                  valorTabela:
                    item.valorTabela ?? 0,
                  desconto:
                    item.desconto ?? 0,
                  valorMensalidade:
                    item.valorMensalidade ??
                    0,
                })
              )
            : [],
          parceiros: Array.isArray(
            conteudo.parceiros
          )
            ? conteudo.parceiros
            : [],
        });
      }
    } catch (erro) {
      console.error(
        "Erro ao carregar cadastros:",
        erro
      );
    } finally {
      setCarregado(true);
    }
  }, []);

  useEffect(() => {
    if (!carregado) return;

    localStorage.setItem(
      CHAVE_CADASTROS,
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

  useEffect(() => {
    const atualizarCatalogo =
      () =>
        setCatalogo(
          carregarCatalogoCursos()
        );

    window.addEventListener(
      "financeiro-mensalidades-atualizada",
      atualizarCatalogo
    );

    return () =>
      window.removeEventListener(
        "financeiro-mensalidades-atualizada",
        atualizarCatalogo
      );
  }, []);

  const cursosAtivos =
    catalogo.cursos.filter(
      (item) =>
        item.situacao === "Ativo"
    );

  const planosDoCurso =
    catalogo.planos.filter(
      (item) =>
        item.situacao === "Ativo" &&
        (!aluno.cursoId ||
          item.cursoId ===
            aluno.cursoId ||
          item.curso ===
            aluno.curso)
    );

  const aplicarPlano = (
    plano: Plano
  ) => {
    const curso =
      catalogo.cursos.find(
        (item) =>
          item.id ===
          plano.cursoId
      );

    setAluno((atual) => ({
      ...atual,
      cursoId:
        curso?.id ||
        plano.cursoId ||
        "",
      curso:
        curso?.nome ||
        plano.curso,
      planoId: plano.id,
      planoNome: plano.nome,
      parcelas: plano.parcelas,
      bancoMensalidade:
        plano.banco ?? "",
      unidade:
        plano.unidade ||
        atual.unidade,
      valorTabela: plano.valor,
      desconto: 0,
      valorMensalidade:
        plano.valor,
    }));
    setValorTabelaTexto(
      valorParaCampo(plano.valor)
    );
    setDescontoTexto("");
    setValorMensalidadeTexto(
      valorParaCampo(plano.valor)
    );
  };

  const limpar = () => {
    setAluno(alunoVazio());
    setValorTabelaTexto("");
    setDescontoTexto("");
    setValorMensalidadeTexto("");
    setParceiro(parceiroVazio());
    setEditando(null);
  };

  const salvarAluno = () => {
    if (!aluno.nome.trim()) {
      alert(
        "Informe o nome do aluno."
      );
      return;
    }

    if (
      campoIncompleto(
        aluno.cpf,
        [11]
      )
    ) {
      alert(
        "O CPF do aluno está incompleto."
      );
      return;
    }

    if (
      campoIncompleto(
        aluno.telefone,
        [10, 11]
      )
    ) {
      alert(
        "O telefone do aluno está incompleto."
      );
      return;
    }

    if (
      campoIncompleto(
        aluno.responsavelCpf,
        [11]
      )
    ) {
      alert(
        "O CPF do responsável está incompleto."
      );
      return;
    }

    if (
      campoIncompleto(
        aluno.responsavelTelefone,
        [10, 11]
      )
    ) {
      alert(
        "O telefone do responsável está incompleto."
      );
      return;
    }

    if (!aluno.unidade) {
      alert(
        "Selecione a unidade."
      );
      return;
    }

    if (
      aluno.curso.trim() &&
      aluno.valorMensalidade <= 0
    ) {
      alert(
        "Informe o valor real da mensalidade deste aluno."
      );
      return;
    }

    const registro: Aluno = {
      ...aluno,
      id:
        editando ??
        `aluno-${Date.now()}`,
      nome: aluno.nome.trim(),
      curso: aluno.curso.trim(),
      planoNome:
        aluno.planoNome.trim(),
    };

    setDados((atual) => ({
      ...atual,
      alunos: editando
        ? atual.alunos.map(
            (item) =>
              item.id === editando
                ? registro
                : item
          )
        : [
            ...atual.alunos,
            registro,
          ],
    }));

    limpar();
    alert(
      editando
        ? "Aluno atualizado."
        : "Aluno cadastrado."
    );
  };

  const salvarParceiro = () => {
    if (!parceiro.nome.trim()) {
      alert(
        "Informe o nome do parceiro."
      );
      return;
    }

    if (
      campoIncompleto(
        parceiro.documento,
        [11, 14]
      )
    ) {
      alert(
        "O CPF ou CNPJ está incompleto."
      );
      return;
    }

    if (
      campoIncompleto(
        parceiro.telefone,
        [10, 11]
      )
    ) {
      alert(
        "O telefone está incompleto."
      );
      return;
    }

    const registro: Parceiro = {
      ...parceiro,
      id:
        editando ??
        `parceiro-${Date.now()}`,
      nome: parceiro.nome.trim(),
    };

    setDados((atual) => ({
      ...atual,
      parceiros: editando
        ? atual.parceiros.map(
            (item) =>
              item.id === editando
                ? registro
                : item
          )
        : [
            ...atual.parceiros,
            registro,
          ],
    }));

    limpar();
    alert(
      editando
        ? "Parceiro atualizado."
        : "Parceiro cadastrado."
    );
  };

  const editarAluno = (
    registro: Aluno
  ) => {
    const { id, ...formulario } =
      registro;
    setAluno(formulario);
    setValorTabelaTexto(
      valorParaCampo(
        registro.valorTabela
      )
    );
    setDescontoTexto(
      valorParaCampo(
        registro.desconto
      )
    );
    setValorMensalidadeTexto(
      valorParaCampo(
        registro.valorMensalidade
      )
    );
    setEditando(id);
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const editarParceiro = (
    registro: Parceiro
  ) => {
    const { id, ...formulario } =
      registro;
    setParceiro(formulario);
    setEditando(id);
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const alternarSituacao = (
    id: string
  ) => {
    setDados((atual) => ({
      alunos: atual.alunos.map(
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
      parceiros:
        atual.parceiros.map(
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

  const excluir = (
    id: string,
    nome: string
  ) => {
    if (
      !window.confirm(
        `Deseja excluir "${nome}"?`
      )
    ) {
      return;
    }

    setDados((atual) => ({
      alunos: atual.alunos.filter(
        (item) => item.id !== id
      ),
      parceiros:
        atual.parceiros.filter(
          (item) => item.id !== id
        ),
    }));
  };

  const alunosFiltrados =
    useMemo(
      () =>
        dados.alunos.filter(
          (item) =>
            `${item.nome} ${item.cpf} ${item.responsavelNome} ${item.curso}`
              .toLowerCase()
              .includes(
                busca.toLowerCase()
              )
        ),
      [dados.alunos, busca]
    );

  const parceirosFiltrados =
    useMemo(
      () =>
        dados.parceiros.filter(
          (item) =>
            `${item.nome} ${item.documento} ${item.tipo}`
              .toLowerCase()
              .includes(
                busca.toLowerCase()
              )
        ),
      [dados.parceiros, busca]
    );

  const mudarAba = (
    novaAba:
      | "Alunos"
      | "Parceiros"
      | "Escolas"
  ) => {
    setAba(novaAba);
    setBusca("");
    limpar();
  };

  return (
    <div>
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
            Cadastros
          </h1>

          <p
            style={
              estilos.textoCinza
            }
          >
            Alunos, responsáveis
            financeiros, parceiros e
            escolas da plataforma.
          </p>
        </div>
      </header>

      <div
        style={
          estilos.abas
        }
      >
        {(
          [
            "Alunos",
            "Parceiros",
            "Escolas",
          ] as const
        ).map((item) => (
          <button
            key={item}
            onClick={() =>
              mudarAba(item)
            }
            style={{
              ...estilos.botaoAba,
              background:
                aba === item
                  ? "#ed232b"
                  : "white",
              color:
                aba === item
                  ? "white"
                  : "#0d1b30",
            }}
          >
            {item}
          </button>
        ))}
      </div>

      {aba === "Alunos" ? (
        <>
          {alunoPerfil && (
            <AlunoPerfil
              aluno={alunoPerfil}
              usuarioAtual={usuarioAtual}
              fechar={() =>
                setAlunoPerfil(null)
              }
            />
          )}
          <section
            style={
              estilos.caixa
            }
          >
            <h2>
              {editando
                ? "Editar aluno"
                : "Novo aluno"}
            </h2>

            <div
              style={
                estilos.formGrid
              }
            >
              <Campo
                label="Nome completo"
                value={aluno.nome}
                onChange={(valor) =>
                  setAluno(
                    (atual) => ({
                      ...atual,
                      nome: valor,
                    })
                  )
                }
              />

              <Campo
                label="CPF"
                value={aluno.cpf}
                placeholder="000.000.000-00"
                inputMode="numeric"
                onChange={(valor) =>
                  setAluno(
                    (atual) => ({
                      ...atual,
                      cpf:
                        formatarCpf(
                          valor
                        ),
                    })
                  )
                }
              />

              <Campo
                label="Data de nascimento"
                type="date"
                value={
                  aluno.nascimento
                }
                onChange={(valor) =>
                  setAluno(
                    (atual) => ({
                      ...atual,
                      nascimento:
                        valor,
                    })
                  )
                }
              />

              <Campo
                label="Telefone"
                value={
                  aluno.telefone
                }
                placeholder="(00) 00000-0000"
                inputMode="numeric"
                onChange={(valor) =>
                  setAluno(
                    (atual) => ({
                      ...atual,
                      telefone:
                        formatarTelefone(
                          valor
                        ),
                    })
                  )
                }
              />

              <Campo
                label="E-mail"
                type="email"
                value={aluno.email}
                onChange={(valor) =>
                  setAluno(
                    (atual) => ({
                      ...atual,
                      email: valor,
                    })
                  )
                }
              />

              <CampoSelect
                label="Unidade"
                value={
                  aluno.unidade
                }
                opcoes={
                  configuracoes.unidades
                }
                onChange={(valor) =>
                  setAluno(
                    (atual) => ({
                      ...atual,
                      unidade: valor,
                    })
                  )
                }
              />
            </div>

            {exibirCamposFinanceirosLegados && (
              <>
            <h3
              style={{
                marginTop: 28,
              }}
            >
              Curso e valor contratado
            </h3>

            <p
              style={
                estilos.textoCinza
              }
            >
              Informe o valor específico
              deste aluno. Ele será usado
              na geração das mensalidades.
            </p>

            <div
              style={
                estilos.formGrid
              }
            >
              <CampoSelect
                label="Curso do aluno"
                value={aluno.cursoId}
                opcoes={cursosAtivos.map(
                  (item) => ({
                    valor: item.id,
                    rotulo: item.nome,
                  })
                )}
                onChange={(cursoId) => {
                  const selecionado =
                    catalogo.cursos.find(
                      (item) =>
                        item.id ===
                        cursoId
                    );

                  setAluno(
                    (atual) => ({
                      ...atual,
                      cursoId,
                      curso:
                        selecionado?.nome ||
                        "",
                      planoId: "",
                      planoNome: "",
                      parcelas: 1,
                      bancoMensalidade:
                        "",
                      valorTabela: 0,
                      desconto: 0,
                      valorMensalidade:
                        0,
                    })
                  );
                  setValorTabelaTexto(
                    ""
                  );
                  setDescontoTexto("");
                  setValorMensalidadeTexto(
                    ""
                  );
                }}
              />

              <CampoSelect
                label="Plano contratado"
                value={aluno.planoId}
                opcoes={planosDoCurso.map(
                  (item) => ({
                    valor: item.id,
                    rotulo: `${
                      item.nome
                    } — ${
                      item.parcelas
                    }x ${moeda(
                      item.valor
                    )}`,
                  })
                )}
                onChange={(planoId) => {
                  const selecionado =
                    catalogo.planos.find(
                      (item) =>
                        item.id ===
                        planoId
                    );

                  if (selecionado) {
                    aplicarPlano(
                      selecionado
                    );
                  }
                }}
              />

              <Campo
                label="Valor padrão do curso"
                value={
                  valorTabelaTexto
                }
                placeholder="Ex.: 650,00"
                inputMode="decimal"
                onChange={(valor) => {
                  const valorTabela =
                    converterNumero(valor);
                  const valorReal =
                    Math.max(
                      valorTabela -
                        aluno.desconto,
                      0
                    );

                  setValorTabelaTexto(
                    valor
                  );
                  setValorMensalidadeTexto(
                    valorParaCampo(
                      valorReal
                    )
                  );

                  setAluno(
                    (atual) => ({
                      ...atual,
                      valorTabela,
                      valorMensalidade:
                        valorReal,
                    })
                  );
                }}
              />

              <Campo
                label="Desconto mensal"
                value={
                  descontoTexto
                }
                placeholder="Ex.: 50,00"
                inputMode="decimal"
                onChange={(valor) => {
                  const desconto =
                    converterNumero(valor);
                  const valorReal =
                    Math.max(
                      aluno.valorTabela -
                        desconto,
                      0
                    );

                  setDescontoTexto(
                    valor
                  );
                  setValorMensalidadeTexto(
                    valorParaCampo(
                      valorReal
                    )
                  );

                  setAluno(
                    (atual) => ({
                      ...atual,
                      desconto,
                      valorMensalidade:
                        valorReal,
                    })
                  );
                }}
              />

              <Campo
                label="Valor real da mensalidade"
                value={
                  valorMensalidadeTexto
                }
                placeholder="Ex.: 600,00"
                inputMode="decimal"
                onChange={(valor) => {
                  setValorMensalidadeTexto(
                    valor
                  );
                  setAluno(
                    (atual) => ({
                      ...atual,
                      valorMensalidade:
                        converterNumero(
                          valor
                        ),
                    })
                  )
                }}
              />

              <Campo
                label="Quantidade de parcelas"
                type="number"
                value={String(
                  aluno.parcelas
                )}
                onChange={(valor) =>
                  setAluno(
                    (atual) => ({
                      ...atual,
                      parcelas:
                        Math.max(
                          Number(valor) ||
                            1,
                          1
                        ),
                    })
                  )
                }
              />

              <CampoSelect
                label="Banco / Conta"
                value={
                  aluno.bancoMensalidade
                }
                opcoes={
                  configuracoes.bancos
                }
                onChange={(valor) =>
                  setAluno(
                    (atual) => ({
                      ...atual,
                      bancoMensalidade:
                        valor,
                    })
                  )
                }
              />
            </div>

              </>
            )}

            <div
              style={{
                marginTop: 28,
                padding: 16,
                borderLeft:
                  "4px solid #2563eb",
                borderRadius: 8,
                background: "#eff6ff",
                color: "#1e3a8a",
                lineHeight: 1.5,
              }}
            >
              <strong>
                Curso e condições financeiras
              </strong>
              <br />
              Agora são definidos na
              geração do contrato. Assim,
              o cadastro do aluno fica
              somente com os dados pessoais
              e do responsável, evitando
              valores repetidos ou
              divergentes.
            </div>

            <h3
              style={{
                marginTop: 28,
              }}
            >
              Responsável financeiro
            </h3>

            <div
              style={
                estilos.formGrid
              }
            >
              <Campo
                label="Nome do responsável"
                value={
                  aluno.responsavelNome
                }
                onChange={(valor) =>
                  setAluno(
                    (atual) => ({
                      ...atual,
                      responsavelNome:
                        valor,
                    })
                  )
                }
              />

              <Campo
                label="CPF do responsável"
                value={
                  aluno.responsavelCpf
                }
                placeholder="000.000.000-00"
                inputMode="numeric"
                onChange={(valor) =>
                  setAluno(
                    (atual) => ({
                      ...atual,
                      responsavelCpf:
                        formatarCpf(
                          valor
                        ),
                    })
                  )
                }
              />

              <Campo
                label="Telefone do responsável"
                value={
                  aluno.responsavelTelefone
                }
                placeholder="(00) 00000-0000"
                inputMode="numeric"
                onChange={(valor) =>
                  setAluno(
                    (atual) => ({
                      ...atual,
                      responsavelTelefone:
                        formatarTelefone(
                          valor
                        ),
                    })
                  )
                }
              />
            </div>

            <AcoesFormulario
              editando={Boolean(
                editando
              )}
              salvar={salvarAluno}
              cancelar={limpar}
            />
          </section>

          <Lista
            titulo="Alunos cadastrados"
            busca={busca}
            setBusca={setBusca}
            vazio={
              alunosFiltrados.length ===
              0
            }
          >
            {alunosFiltrados.map(
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
                      {item.unidade}
                      {item.cpf
                        ? ` • CPF ${item.cpf}`
                        : ""}
                      {item.curso
                        ? ` • Curso: ${item.curso}`
                        : ""}
                      {item.planoNome
                        ? ` • Plano: ${item.planoNome}`
                        : ""}
                      {item.valorMensalidade >
                      0
                        ? ` • Mensalidade: ${moeda(
                            item.valorMensalidade
                          )}`
                        : ""}
                      {item.responsavelNome
                        ? ` • Responsável: ${item.responsavelNome}`
                        : ""}
                    </div>
                  </div>

                  <AcoesRegistro
                    situacao={
                      item.situacao
                    }
                    editar={() =>
                      editarAluno(
                        item
                      )
                    }
                    perfil={() => {
                      setAlunoPerfil(item);
                      window.scrollTo({
                        top: 0,
                        behavior: "smooth",
                      });
                    }}
                    alternar={() =>
                      alternarSituacao(
                        item.id
                      )
                    }
                    excluir={() =>
                      excluir(
                        item.id,
                        item.nome
                      )
                    }
                  />
                </div>
              )
            )}
          </Lista>
        </>
      ) : aba === "Parceiros" ? (
        <>
          <section
            style={
              estilos.caixa
            }
          >
            <h2>
              {editando
                ? "Editar parceiro"
                : "Novo parceiro"}
            </h2>

            <div
              style={
                estilos.formGrid
              }
            >
              <Campo
                label="Nome / Razão social"
                value={
                  parceiro.nome
                }
                onChange={(valor) =>
                  setParceiro(
                    (atual) => ({
                      ...atual,
                      nome: valor,
                    })
                  )
                }
              />

              <Campo
                label="CPF / CNPJ"
                value={
                  parceiro.documento
                }
                placeholder="000.000.000-00"
                inputMode="numeric"
                onChange={(valor) =>
                  setParceiro(
                    (atual) => ({
                      ...atual,
                      documento:
                        formatarCpfCnpj(
                          valor
                        ),
                    })
                  )
                }
              />

              <Campo
                label="Tipo de parceria"
                value={
                  parceiro.tipo
                }
                placeholder="Ex.: Professor, fornecedor"
                onChange={(valor) =>
                  setParceiro(
                    (atual) => ({
                      ...atual,
                      tipo: valor,
                    })
                  )
                }
              />

              <Campo
                label="Telefone"
                value={
                  parceiro.telefone
                }
                placeholder="(00) 00000-0000"
                inputMode="numeric"
                onChange={(valor) =>
                  setParceiro(
                    (atual) => ({
                      ...atual,
                      telefone:
                        formatarTelefone(
                          valor
                        ),
                    })
                  )
                }
              />

              <Campo
                label="E-mail"
                type="email"
                value={
                  parceiro.email
                }
                onChange={(valor) =>
                  setParceiro(
                    (atual) => ({
                      ...atual,
                      email: valor,
                    })
                  )
                }
              />

              <Campo
                label="Observação"
                value={
                  parceiro.observacao
                }
                onChange={(valor) =>
                  setParceiro(
                    (atual) => ({
                      ...atual,
                      observacao:
                        valor,
                    })
                  )
                }
              />
            </div>

            <AcoesFormulario
              editando={Boolean(
                editando
              )}
              salvar={
                salvarParceiro
              }
              cancelar={limpar}
            />
          </section>

          <Lista
            titulo="Parceiros cadastrados"
            busca={busca}
            setBusca={setBusca}
            vazio={
              parceirosFiltrados.length ===
              0
            }
          >
            {parceirosFiltrados.map(
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
                      {item.tipo ||
                        "Tipo não informado"}
                      {item.documento
                        ? ` • ${item.documento}`
                        : ""}
                    </div>
                  </div>

                  <AcoesRegistro
                    situacao={
                      item.situacao
                    }
                    editar={() =>
                      editarParceiro(
                        item
                      )
                    }
                    alternar={() =>
                      alternarSituacao(
                        item.id
                      )
                    }
                    excluir={() =>
                      excluir(
                        item.id,
                        item.nome
                      )
                    }
                  />
                </div>
              )
            )}
          </Lista>
        </>
      ) : (
        <Escolas
          parceiros={
            dados.parceiros
          }
        />
      )}
    </div>
  );
}

function Campo({
  label,
  value,
  onChange,
  placeholder = "",
  type = "text",
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (
    valor: string
  ) => void;
  placeholder?: string;
  type?: string;
  inputMode?:
    | "numeric"
    | "decimal"
    | "tel"
    | "text"
    | "email";
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
        inputMode={inputMode}
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
  opcoes,
  onChange,
}: {
  label: string;
  value: string;
  opcoes: Array<
    | string
    | {
        valor: string;
        rotulo: string;
      }
  >;
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

function AcoesFormulario({
  editando,
  salvar,
  cancelar,
}: {
  editando: boolean;
  salvar: () => void;
  cancelar: () => void;
}) {
  return (
    <div
      style={
        estilos.acoes
      }
    >
      <button
        onClick={salvar}
        style={
          estilos.botaoSalvar
        }
      >
        {editando
          ? "Salvar alterações"
          : "Cadastrar"}
      </button>
      {editando && (
        <button
          onClick={cancelar}
          style={
            estilos.botaoSecundario
          }
        >
          Cancelar edição
        </button>
      )}
    </div>
  );
}

function Lista({
  titulo,
  busca,
  setBusca,
  vazio,
  children,
}: {
  titulo: string;
  busca: string;
  setBusca: (
    valor: string
  ) => void;
  vazio: boolean;
  children: ReactNode;
}) {
  return (
    <section
      style={{
        ...estilos.caixa,
        marginTop: 25,
      }}
    >
      <div
        style={
          estilos.topoLista
        }
      >
        <h2
          style={
            estilos.tituloLista
          }
        >
          {titulo}
        </h2>
        <input
          value={busca}
          placeholder="Buscar..."
          onChange={(evento) =>
            setBusca(
              evento.target.value
            )
          }
          style={{
            ...estilos.input,
            maxWidth: 320,
            color: "#0f172a",
            background: "#ffffff",
          }}
        />
      </div>

      {vazio ? (
        <div
          style={
            estilos.vazio
          }
        >
          Nenhum cadastro encontrado.
        </div>
      ) : (
        children
      )}
    </section>
  );
}

function AcoesRegistro({
  situacao,
  perfil,
  editar,
  alternar,
  excluir,
}: {
  situacao: Situacao;
  perfil?: () => void;
  editar: () => void;
  alternar: () => void;
  excluir: () => void;
}) {
  return (
    <div
      style={
        estilos.acoesRegistro
      }
    >
      <span
        style={{
          ...estilos.status,
          background:
            situacao === "Ativo"
              ? "#dcfce7"
              : "#e5e7eb",
          color:
            situacao === "Ativo"
              ? "#166534"
              : "#475569",
        }}
      >
        {situacao}
      </span>
      {perfil && (
        <button
          onClick={perfil}
          style={estilos.botaoPerfil}
        >
          Ver perfil
        </button>
      )}
      <button
        onClick={editar}
        style={
          estilos.botaoEditar
        }
      >
        Editar
      </button>
      <button
        onClick={alternar}
        style={
          estilos.botaoSecundario
        }
      >
        {situacao === "Ativo"
          ? "Inativar"
          : "Ativar"}
      </button>
      <button
        onClick={excluir}
        style={
          estilos.botaoExcluir
        }
      >
        Excluir
      </button>
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
    color: "#475569",
    lineHeight: 1.6,
  },
  tituloLista: {
    margin: 0,
    color: "#0f172a",
    fontWeight: 800,
  },
  abas: {
    display: "flex",
    gap: 10,
    marginBottom: 22,
  },
  botaoAba: {
    padding: "12px 22px",
    border:
      "1px solid #d9dfe8",
    borderRadius: 10,
    cursor: "pointer",
    fontWeight: "bold",
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
    fontSize: 15,
    boxSizing: "border-box",
    color: "#0f172a",
    background: "#ffffff",
  },
  acoes: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 25,
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
    color: "#334155",
    border:
      "1px solid #94a3b8",
    borderRadius: 8,
    padding: "9px 12px",
    cursor: "pointer",
    fontWeight: 600,
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
    flexWrap: "wrap",
    padding: "17px 0",
    borderBottom:
      "1px solid #e8ebef",
  },
  acoesRegistro: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    flexWrap: "wrap",
  },
  status: {
    padding: "7px 10px",
    borderRadius: 20,
    fontSize: 13,
    fontWeight: "bold",
  },
  botaoEditar: {
    background: "#2563eb",
    color: "white",
    border: "none",
    borderRadius: 8,
    padding: "9px 12px",
    cursor: "pointer",
  },
  botaoPerfil: {
    background: "#17233a",
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
  vazio: {
    padding: 35,
    color: "#8c96a8",
    textAlign: "center",
  },
};

export default Cadastros;

import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import QRCode from "qrcode";

import {
  CHAVE_CADASTROS,
  type Aluno,
} from "./Cadastros";

import {
  CHAVE_CONTAS,
  type Conta,
} from "./Contas";

import {
  CHAVE_MENSALIDADES,
  type Plano,
} from "./Mensalidades";

import {
  CHAVE_SECRETARIA,
  type RecebimentoCaixa,
  type SessaoCaixa,
} from "./Secretaria";

type Aba =
  | "Contratos"
  | "Carnês"
  | "Comprovantes";

type ConfiguracaoPix = {
  chave: string;
  beneficiario: string;
  cidade: string;
};

const CHAVE_CONFIGURACAO_PIX =
  "financeiro-cedep-configuracao-pix";

const moeda = (valor: number) =>
  valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

const escapar = (valor: unknown) =>
  String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const formatarData = (
  data: string
) => {
  if (!data) return "";

  const valor = data.includes("T")
    ? new Date(
        data
      ).toLocaleDateString(
        "pt-BR"
      )
    : data
        .split("-")
        .reverse()
        .join("/");

  return valor;
};

const campoPix = (
  id: string,
  valor: string
) =>
  `${id}${String(
    valor.length
  ).padStart(2, "0")}${valor}`;

const normalizarPix = (
  valor: string,
  limite: number
) =>
  valor
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .replace(
      /[^a-zA-Z0-9 .-]/g,
      ""
    )
    .trim()
    .toUpperCase()
    .slice(0, limite);

const crc16Pix = (
  texto: string
) => {
  let crc = 0xffff;

  for (
    let indice = 0;
    indice < texto.length;
    indice += 1
  ) {
    crc ^=
      texto.charCodeAt(
        indice
      ) << 8;

    for (
      let bit = 0;
      bit < 8;
      bit += 1
    ) {
      crc =
        crc & 0x8000
          ? ((crc << 1) ^
              0x1021) &
            0xffff
          : (crc << 1) &
            0xffff;
    }
  }

  return crc
    .toString(16)
    .toUpperCase()
    .padStart(4, "0");
};

const gerarPixCopiaECola = ({
  chave,
  beneficiario,
  cidade,
  valor,
  identificador,
}: ConfiguracaoPix & {
  valor: number;
  identificador: string;
}) => {
  const contaPix =
    campoPix(
      "00",
      "BR.GOV.BCB.PIX"
    ) +
    campoPix("01", chave);
  const adicional = campoPix(
    "05",
    identificador
      .replace(
        /[^a-zA-Z0-9]/g,
        ""
      )
      .slice(0, 25) || "***"
  );

  const semCrc =
    campoPix("00", "01") +
    campoPix("26", contaPix) +
    campoPix("52", "0000") +
    campoPix("53", "986") +
    campoPix(
      "54",
      valor.toFixed(2)
    ) +
    campoPix("58", "BR") +
    campoPix(
      "59",
      normalizarPix(
        beneficiario,
        25
      )
    ) +
    campoPix(
      "60",
      normalizarPix(
        cidade,
        15
      )
    ) +
    campoPix("62", adicional) +
    "6304";

  return (
    semCrc +
    crc16Pix(semCrc)
  );
};

const abrirDocumento = (
  titulo: string,
  conteudo: string
) => {
  const janela = window.open(
    "",
    "_blank",
    "width=900,height=700"
  );

  if (!janela) {
    alert(
      "O navegador bloqueou a janela. Permita pop-ups para imprimir o documento."
    );
    return;
  }

  janela.document.write(`
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>${escapar(titulo)}</title>
        <style>
          @page { size: A4; margin: 18mm; }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            color: #172033;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 12pt;
            line-height: 1.55;
          }
          header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 24px;
            padding-bottom: 18px;
            margin-bottom: 24px;
            border-bottom: 2px solid #ed232b;
          }
          header img { width: 170px; height: auto; }
          h1, h2, h3 { color: #101a2d; }
          h1 { font-size: 22pt; margin: 0; }
          h2 { font-size: 15pt; }
          .muted { color: #657084; }
          .box {
            border: 1px solid #d9dfe8;
            border-radius: 8px;
            padding: 14px;
            margin: 12px 0;
          }
          .grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 10px 22px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 18px;
          }
          th, td {
            padding: 9px;
            text-align: left;
            border: 1px solid #cfd6df;
          }
          th { color: white; background: #101a2d; }
          .assinaturas {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 50px;
            margin-top: 70px;
          }
          .assinatura {
            padding-top: 8px;
            text-align: center;
            border-top: 1px solid #172033;
          }
          .parcela {
            break-inside: avoid;
            border: 1px dashed #657084;
            padding: 14px;
            margin-bottom: 12px;
          }
          .folha-carne {
            min-height: 255mm;
            display: grid;
            align-content: start;
            gap: 5mm;
            break-after: page;
            page-break-after: always;
          }
          .folha-carne:last-child {
            break-after: auto;
            page-break-after: auto;
          }
          .grade-carne {
            display: grid;
            gap: 5mm;
          }
          .parcela-carne {
            min-width: 0;
            overflow: hidden;
            break-inside: avoid;
            display: grid;
            grid-template-columns: 58mm minmax(0, 1fr);
            border: 1.5px solid #172033;
            background: white;
            font-size: 9pt;
            line-height: 1.2;
          }
          .canhoto,
          .via-escola {
            min-width: 0;
          }
          .canhoto {
            display: flex;
            flex-direction: column;
            border-right: 1px dashed #172033;
          }
          .via-escola {
            display: grid;
            grid-template-columns: minmax(0, 1fr) 33mm;
          }
          .campo-carne {
            min-width: 0;
            padding: 3px 5px;
            border-bottom: 1px solid #9ca3af;
          }
          .campo-carne small {
            display: block;
            color: #475569;
            font-size: 6.8pt;
            line-height: 1.1;
          }
          .campo-carne strong {
            display: block;
            overflow-wrap: anywhere;
            font-size: 9pt;
          }
          .nome-aluno strong,
          .curso-carne strong {
            font-size: 11pt;
            text-transform: uppercase;
          }
          .duas-colunas {
            display: grid;
            grid-template-columns: 1fr 1fr;
          }
          .tres-colunas {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
          }
          .duas-colunas > *,
          .tres-colunas > * {
            border-right: 1px solid #9ca3af;
          }
          .duas-colunas > *:last-child,
          .tres-colunas > *:last-child {
            border-right: 0;
          }
          .valor-carne strong {
            font-size: 12pt;
            font-weight: bold;
          }
          .rodape-canhoto {
            margin-top: auto;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            padding: 5px;
          }
          .rodape-canhoto img {
            width: 70px;
            height: auto;
          }
          .via-cliente {
            font-size: 9pt;
            font-weight: 800;
          }
          .dados-principais {
            min-width: 0;
            display: flex;
            flex-direction: column;
          }
          .instrucoes {
            padding: 5px;
            font-size: 7.5pt;
            line-height: 1.25;
          }
          .instrucoes p {
            margin: 2px 0;
          }
          .pagamento {
            display: grid;
            grid-template-rows: auto 1fr auto;
            border-left: 1px solid #9ca3af;
            text-align: center;
          }
          .qr-pix {
            width: 27mm;
            height: 27mm;
            margin: 3px auto;
          }
          .pix-chave {
            padding: 2px 4px;
            font-size: 6.6pt;
            overflow-wrap: anywhere;
            text-align: center;
          }
          .total-pago {
            min-height: 12mm;
            padding: 3px;
            border-top: 1px solid #9ca3af;
            text-align: left;
          }
          .total-pago small {
            display: block;
            color: #475569;
            font-size: 6.8pt;
          }
          .folha-carne.compacto {
            grid-template-columns: 1fr;
            gap: 3mm;
          }
          .folha-carne.compacto .grade-carne {
            gap: 3mm;
          }
          .folha-carne.compacto .parcela-carne {
            grid-template-columns: 50mm minmax(0, 1fr);
            font-size: 7.5pt;
          }
          .folha-carne.compacto .campo-carne {
            padding: 2px 4px;
          }
          .folha-carne.compacto .campo-carne strong {
            font-size: 7.5pt;
          }
          .folha-carne.compacto .nome-aluno strong,
          .folha-carne.compacto .curso-carne strong {
            font-size: 8.5pt;
          }
          .folha-carne.compacto .qr-pix {
            width: 19mm;
            height: 19mm;
          }
          .folha-carne.compacto .instrucoes {
            font-size: 6.6pt;
          }
          .linha-corte {
            margin: -2.5mm 0;
            color: #64748b;
            font-size: 6pt;
            letter-spacing: 1px;
            text-align: center;
          }
          .total {
            font-size: 15pt;
            font-weight: bold;
          }
          @media print {
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <button class="no-print" onclick="window.print()" style="margin-bottom:18px;padding:10px 16px">
          Imprimir / Salvar em PDF
        </button>
        ${conteudo}
      </body>
    </html>
  `);
  janela.document.close();
};

function cabecalho(
  titulo: string
) {
  return `
    <header>
      <img src="${window.location.origin}/logo-cedep.png" alt="CEDEP Cursos" />
      <div>
        <h1>${escapar(titulo)}</h1>
        <div class="muted">CEDEP | Treinei, Passei!</div>
      </div>
    </header>
  `;
}

function Documentos() {
  const [aba, setAba] =
    useState<Aba>("Contratos");
  const [alunos, setAlunos] =
    useState<Aluno[]>([]);
  const [planos, setPlanos] =
    useState<Plano[]>([]);
  const [contas, setContas] =
    useState<Conta[]>([]);
  const [recebimentos, setRecebimentos] =
    useState<RecebimentoCaixa[]>([]);

  const [alunoContrato, setAlunoContrato] =
    useState("");
  const [planoContrato, setPlanoContrato] =
    useState("");
  const [inicioContrato, setInicioContrato] =
    useState("");
  const [
    terminoContrato,
    setTerminoContrato,
  ] = useState("");
  const [
    diaVencimentoContrato,
    setDiaVencimentoContrato,
  ] = useState("10");
  const [
    enderecoContrato,
    setEnderecoContrato,
  ] = useState("");
  const [
    cidadeContrato,
    setCidadeContrato,
  ] = useState("Astorga - PR");
  const [
    autorizacaoImagem,
    setAutorizacaoImagem,
  ] = useState("Não autorizo");
  const [clausulas, setClausulas] =
    useState(
      ""
    );

  const [alunoCarne, setAlunoCarne] =
    useState("");
  const [
    parcelasPorFolha,
    setParcelasPorFolha,
  ] = useState<2 | 4>(2);
  const [
    configuracaoPix,
    setConfiguracaoPix,
  ] = useState<ConfiguracaoPix>({
    chave: "",
    beneficiario: "CEDEP CURSOS",
    cidade: "",
  });
  const [
    recebimentoSelecionado,
    setRecebimentoSelecionado,
  ] = useState("");

  useEffect(() => {
    try {
      const cadastros =
        localStorage.getItem(
          CHAVE_CADASTROS
        );
      const mensalidades =
        localStorage.getItem(
          CHAVE_MENSALIDADES
        );
      const contasSalvas =
        localStorage.getItem(
          CHAVE_CONTAS
        );
      const secretaria =
        localStorage.getItem(
          CHAVE_SECRETARIA
        );
      const pixSalvo =
        localStorage.getItem(
          CHAVE_CONFIGURACAO_PIX
        );

      if (cadastros) {
        const dados =
          JSON.parse(cadastros);
        setAlunos(
          Array.isArray(dados.alunos)
            ? dados.alunos
            : []
        );
      }

      if (mensalidades) {
        const dados =
          JSON.parse(mensalidades);
        setPlanos(
          Array.isArray(dados.planos)
            ? dados.planos
            : []
        );
      }

      if (contasSalvas) {
        const dados =
          JSON.parse(contasSalvas);
        setContas(
          Array.isArray(dados)
            ? dados
            : []
        );
      }

      if (secretaria) {
        const dados =
          JSON.parse(secretaria);
        const sessoes: SessaoCaixa[] =
          Array.isArray(dados.sessoes)
            ? dados.sessoes
            : [];

        setRecebimentos(
          sessoes.flatMap(
            (item) =>
              item.recebimentos ?? []
          )
        );
      }

      if (pixSalvo) {
        setConfiguracaoPix({
          chave: "",
          beneficiario:
            "CEDEP CURSOS",
          cidade: "",
          ...JSON.parse(
            pixSalvo
          ),
        });
      }
    } catch (erro) {
      console.error(
        "Erro ao carregar documentos:",
        erro
      );
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      CHAVE_CONFIGURACAO_PIX,
      JSON.stringify(
        configuracaoPix
      )
    );
  }, [configuracaoPix]);

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

  const contasCarne = useMemo(() => {
    const aluno = alunos.find(
      (item) =>
        item.id === alunoCarne
    );

    if (!aluno) return [];

    return contas
      .filter(
        (item) =>
          item.tipo === "receber" &&
          (item.observacao?.includes(
            `Aluno: ${aluno.nome}`
          ) ||
            item.descricao.includes(
              aluno.nome
            ))
      )
      .sort((a, b) =>
        a.vencimento.localeCompare(
          b.vencimento
        )
      );
  }, [
    alunoCarne,
    alunos,
    contas,
  ]);

  const gerarContrato = () => {
    const aluno = alunos.find(
      (item) =>
        item.id === alunoContrato
    );
    const plano = planos.find(
      (item) =>
        item.id === planoContrato
    );

    if (
      !aluno ||
      !plano ||
      !inicioContrato ||
      !terminoContrato
    ) {
      alert(
        "Selecione aluno, plano e informe as datas de início e término."
      );
      return;
    }

    const parcelas =
      aluno.parcelas ||
      plano.parcelas;
    const valorMensal =
      aluno.valorMensalidade ||
      plano.valor;
    const valorTabela =
      aluno.valorTabela ||
      plano.valor;
    const desconto =
      aluno.desconto || 0;
    const valorTotal =
      valorMensal * parcelas;

    abrirDocumento(
      `Contrato - ${aluno.nome}`,
      `
        ${cabecalho("Contrato de Prestação de Serviços Educacionais")}
        <p>
          Pelo presente instrumento particular, de um lado
          <strong>NELSON LUIS ORSI DE PAIVA CENTRO DE ESTUDOS E TREINAMENTOS</strong>,
          inscrita no CNPJ sob nº <strong>23.014.836/0001-40</strong>,
          com sede na Rua Minas Gerais, 263, Centro, Astorga/PR, doravante denominada
          <strong>CONTRATADA</strong>; e, de outro, o responsável financeiro identificado
          abaixo, doravante denominado <strong>CONTRATANTE</strong>, celebram o presente
          contrato, regido pelas condições seguintes e pela legislação aplicável.
        </p>

        <h2>Identificação das partes</h2>
        <div class="box grid">
          <div><strong>Aluno:</strong> ${escapar(aluno.nome)}</div>
          <div><strong>CPF:</strong> ${escapar(aluno.cpf)}</div>
          <div><strong>Data de nascimento:</strong> ${escapar(formatarData(aluno.nascimento))}</div>
          <div><strong>Responsável:</strong> ${escapar(aluno.responsavelNome || aluno.nome)}</div>
          <div><strong>CPF do responsável:</strong> ${escapar(aluno.responsavelCpf || aluno.cpf)}</div>
          <div><strong>Telefone:</strong> ${escapar(aluno.responsavelTelefone || aluno.telefone)}</div>
          <div><strong>E-mail:</strong> ${escapar(aluno.email)}</div>
          <div><strong>Endereço:</strong> ${escapar(enderecoContrato || "Não informado")}</div>
          <div><strong>Cidade/UF:</strong> ${escapar(cidadeContrato || "Não informada")}</div>
          <div><strong>Unidade:</strong> ${escapar(aluno.unidade)}</div>
        </div>

        <h2>Quadro-resumo do serviço contratado</h2>
        <div class="box grid">
          <div><strong>Plano:</strong> ${escapar(aluno.planoNome || plano.nome)}</div>
          <div><strong>Curso:</strong> ${escapar(aluno.curso || plano.curso)}</div>
          <div><strong>Início:</strong> ${escapar(formatarData(inicioContrato))}</div>
          <div><strong>Término previsto:</strong> ${escapar(formatarData(terminoContrato))}</div>
          <div><strong>Condição:</strong> ${parcelas} parcela(s) de ${escapar(moeda(valorMensal))}</div>
          <div><strong>Vencimento:</strong> dia ${escapar(diaVencimentoContrato)} de cada mês</div>
          <div><strong>Valor padrão:</strong> ${escapar(moeda(valorTabela))}</div>
          <div><strong>Desconto mensal:</strong> ${escapar(moeda(desconto))}</div>
          <div><strong>Valor total contratado:</strong> ${escapar(moeda(valorTotal))}</div>
          <div><strong>Banco/conta:</strong> ${escapar(aluno.bancoMensalidade || plano.banco)}</div>
        </div>

        <h2>Cláusula 1ª - Objeto e natureza do serviço</h2>
        <p>
          A CONTRATADA prestará os serviços educacionais correspondentes ao curso e ao
          período indicados no quadro-resumo, conforme planejamento pedagógico, calendário,
          carga horária, corpo docente e metodologia definidos pela instituição. A contratação
          não constitui promessa de aprovação em vestibular, concurso ou exame, pois o resultado
          depende também da participação, frequência e desempenho individual do aluno.
        </p>

        <h2>Cláusula 2ª - Organização das aulas e deveres acadêmicos</h2>
        <p>
          As aulas poderão ser ministradas nas dependências da CONTRATADA ou em outro local
          previamente comunicado, de forma presencial ou por recurso tecnológico compatível
          com o plano contratado. O aluno deverá respeitar horários, professores, colegas,
          instalações, normas de convivência e orientações acadêmicas. Faltas do aluno não
          geram abatimento, salvo reposição ou compensação expressamente oferecida pela CONTRATADA.
        </p>

        <h2>Cláusula 3ª - Preço, parcelas e desconto</h2>
        <p>
          O CONTRATANTE pagará o valor total indicado no quadro-resumo, dividido nas parcelas
          ali especificadas. O desconto informado integra a condição comercial individual deste
          contrato. Quando identificado como desconto de pontualidade, sua manutenção dependerá
          do pagamento até o vencimento, sem alterar o valor total de referência expressamente
          informado ao CONTRATANTE.
        </p>

        <h2>Cláusula 4ª - Atraso e cobrança</h2>
        <p>
          Sobre parcela vencida poderão incidir multa moratória de até 2% e juros de mora de
          1% ao mês, calculados proporcionalmente aos dias de atraso, além de atualização
          monetária quando legalmente aplicável. A cobrança e eventual comunicação aos órgãos
          de proteção ao crédito somente poderão ocorrer após o vencimento, mediante observância
          da legislação e da notificação prévia cabível, sem exposição do aluno a constrangimento.
        </p>

        <h2>Cláusula 5ª - Cancelamento e desistência</h2>
        <p>
          O cancelamento deverá ser solicitado por escrito pelo aluno maior de idade ou pelo
          responsável legal. Serão devidos os valores vencidos, os serviços efetivamente prestados
          até a data de encerramento e materiais individuais já entregues. Não haverá cobrança
          automática das mensalidades posteriores à efetivação do cancelamento. Eventual custo
          administrativo deverá ser previamente informado, proporcional e compatível com os
          prejuízos efetivamente suportados, respeitada a legislação de proteção do consumidor.
        </p>
        <p>
          Quando a contratação ocorrer fora do estabelecimento comercial ou por meio eletrônico,
          será assegurado o direito de arrependimento no prazo legal. O pedido deverá ser
          protocolado por canal que permita comprovar a data da solicitação.
        </p>

        <h2>Cláusula 6ª - Material didático e bens pessoais</h2>
        <p>
          Materiais individuais, quando contratados, serão discriminados separadamente. Não será
          exigido material de uso coletivo como cobrança adicional. A CONTRATADA não responde por
          objetos pessoais deixados nas dependências, salvo quando o dano decorrer de ação ou
          omissão comprovada de seus prepostos.
        </p>

        <h2>Cláusula 7ª - Proteção de dados pessoais</h2>
        <p>
          Os dados do aluno e do responsável serão tratados para matrícula, execução do contrato,
          comunicação acadêmica e financeira, cumprimento de obrigações legais e exercício regular
          de direitos. O acesso será limitado a pessoas autorizadas e os dados serão conservados
          pelo período necessário às finalidades informadas e aos prazos legais. O titular poderá
          solicitar informações, correção e demais direitos pelos canais oficiais da CONTRATADA.
        </p>

        <h2>Cláusula 8ª - Uso de imagem e voz</h2>
        <div class="box">
          <strong>Opção do CONTRATANTE: ${escapar(autorizacaoImagem)}</strong>
          <p>
            A autorização, quando concedida, limita-se à divulgação institucional e acadêmica do
            CEDEP, sem uso ofensivo ou incompatível com essa finalidade. É gratuita, específica
            e poderá ser revogada para utilizações futuras mediante solicitação escrita, sem
            afetar materiais legitimamente produzidos antes da revogação. A recusa não prejudica
            a matrícula nem a prestação do serviço.
          </p>
        </div>

        <h2>Cláusula 9ª - Comunicações e documentos</h2>
        <p>
          Comunicações acadêmicas e financeiras poderão ser realizadas pelos telefones, e-mails
          e aplicativos informados no cadastro. O CONTRATANTE deverá manter seus dados atualizados.
          Contrato, carnê, recibos e avisos poderão ser disponibilizados em meio físico ou eletrônico.
        </p>

        <h2>Cláusula 10ª - Disposições gerais</h2>
        <p>
          Eventual tolerância não representa renúncia de direito. Se alguma disposição for
          considerada inválida, as demais permanecerão vigentes. Fica assegurado ao consumidor
          o acesso aos órgãos de defesa e ao foro legalmente competente, inclusive o de seu
          domicílio quando aplicável.
        </p>

        ${
          clausulas.trim()
            ? `
              <h2>Condições adicionais individualizadas</h2>
              <p>${escapar(clausulas).replaceAll("\n", "<br />")}</p>
            `
            : ""
        }

        <h2>Anexo - Normas essenciais de convivência</h2>
        <p>
          O aluno compromete-se a cumprir os horários; seguir as orientações do corpo docente;
          tratar colegas e colaboradores com respeito; preservar móveis, equipamentos e materiais;
          e observar as regras de segurança e a proibição de fumar nas dependências da instituição.
          Danos causados com dolo ou culpa poderão ser objeto de reparação, após apuração.
        </p>

        <p>
          As partes declaram ter lido o quadro-resumo e todas as cláusulas, recebendo uma via
          deste instrumento. Firmam o presente contrato em
          ${escapar(new Date().toLocaleDateString("pt-BR"))}.
        </p>

        <div class="assinaturas">
          <div class="assinatura">CONTRATANTE: ${escapar(aluno.responsavelNome || aluno.nome)}</div>
          <div class="assinatura">CONTRATADA: CEDEP Cursos</div>
          <div class="assinatura">Testemunha 1 - Nome e CPF</div>
          <div class="assinatura">Testemunha 2 - Nome e CPF</div>
        </div>
      `
    );
  };

  const gerarCarne = async () => {
    const aluno = alunos.find(
      (item) =>
        item.id === alunoCarne
    );

    if (!aluno) {
      alert(
        "Selecione um aluno."
      );
      return;
    }

    if (contasCarne.length === 0) {
      alert(
        "Não existem mensalidades geradas para este aluno."
      );
      return;
    }

    if (
      !configuracaoPix.chave.trim() ||
      !configuracaoPix.beneficiario.trim() ||
      !configuracaoPix.cidade.trim()
    ) {
      alert(
        "Informe a chave PIX, o beneficiário e a cidade antes de gerar o carnê."
      );
      return;
    }

    const parcelasComQr =
      await Promise.all(
        contasCarne.map(
          async (item) => {
            const pix =
              gerarPixCopiaECola({
                ...configuracaoPix,
                chave:
                  configuracaoPix.chave.trim(),
                valor: item.valor,
                identificador:
                  item.id,
              });
            const qrCode =
              await QRCode.toDataURL(
                pix,
                {
                  width: 240,
                  margin: 1,
                  errorCorrectionLevel:
                    "M",
                }
              );

            return {
              item,
              pix,
              qrCode,
            };
          }
        )
      );

    const folhas = Array.from(
      {
        length: Math.ceil(
          parcelasComQr.length /
            parcelasPorFolha
        ),
      },
      (_, indiceFolha) =>
        parcelasComQr.slice(
          indiceFolha *
            parcelasPorFolha,
          indiceFolha *
            parcelasPorFolha +
            parcelasPorFolha
        )
    );
    const dataEmissao =
      new Date().toLocaleDateString(
        "pt-BR"
      );

    abrirDocumento(
      `Carnê - ${aluno.nome}`,
      `
        ${folhas
          .map(
            (
              folha,
              indiceFolha
            ) => `
              <section class="folha-carne ${parcelasPorFolha === 4 ? "compacto" : ""}">
                <div class="grade-carne">
                  ${folha
                    .map(
                      (
                        parcela,
                        indiceNaFolha
                      ) => {
                        const indice =
                          indiceFolha *
                            parcelasPorFolha +
                          indiceNaFolha;
                        const item =
                          parcela.item;
                        const curso =
                          aluno.curso ||
                          item.descricao;

                        return `
                          <article class="parcela-carne">
                            <section class="canhoto">
                              <div class="campo-carne nome-aluno">
                                <small>Aluno(a)</small>
                                <strong>${escapar(aluno.nome)}</strong>
                              </div>
                              <div class="duas-colunas">
                                <div class="campo-carne"><small>Parcela</small><strong>${indice + 1}/${contasCarne.length}</strong></div>
                                <div class="campo-carne"><small>Data de emissão</small><strong>${escapar(dataEmissao)}</strong></div>
                              </div>
                              <div class="duas-colunas">
                                <div class="campo-carne"><small>Data de vencimento</small><strong>${escapar(formatarData(item.vencimento))}</strong></div>
                                <div class="campo-carne valor-carne"><small>Valor</small><strong>${escapar(moeda(item.valor))}</strong></div>
                              </div>
                              <div class="duas-colunas">
                                <div class="campo-carne"><small>Juros</small><strong>&nbsp;</strong></div>
                                <div class="campo-carne"><small>Multa</small><strong>&nbsp;</strong></div>
                              </div>
                              <div class="campo-carne"><small>Total pago</small><strong>&nbsp;</strong></div>
                              <div class="rodape-canhoto">
                                <img src="${window.location.origin}/logo-cedep.png" alt="CEDEP Cursos" />
                                <span class="via-cliente">VIA CLIENTE</span>
                              </div>
                            </section>
                            <section class="via-escola">
                              <div class="dados-principais">
                                <div class="campo-carne nome-aluno">
                                  <small>Aluno(a)</small>
                                  <strong>${escapar(aluno.nome)}</strong>
                                </div>
                                <div class="duas-colunas">
                                  <div class="campo-carne"><small>Responsável financeiro</small><strong>${escapar(aluno.responsavelNome || aluno.nome)}</strong></div>
                                  <div class="campo-carne"><small>Unidade</small><strong>${escapar(item.unidade)}</strong></div>
                                </div>
                                <div class="tres-colunas">
                                  <div class="campo-carne"><small>Parcela</small><strong>${indice + 1}/${contasCarne.length}</strong></div>
                                  <div class="campo-carne"><small>Data de emissão</small><strong>${escapar(dataEmissao)}</strong></div>
                                  <div class="campo-carne"><small>Data de vencimento</small><strong>${escapar(formatarData(item.vencimento))}</strong></div>
                                </div>
                                <div class="duas-colunas">
                                  <div class="campo-carne curso-carne"><small>Curso</small><strong>${escapar(curso)}</strong></div>
                                  <div class="campo-carne valor-carne"><small>Valor</small><strong>${escapar(moeda(item.valor))}</strong></div>
                                </div>
                                <div class="instrucoes">
                                  <p><strong>Pagamento:</strong> na Secretaria da Escola ou via PIX.</p>
                                  <p><strong>Beneficiário:</strong> ${escapar(configuracaoPix.beneficiario)}</p>
                                  <p><strong>Chave PIX:</strong> ${escapar(configuracaoPix.chave)}</p>
                                  <p>O QR Code já contém o valor desta mensalidade.</p>
                                  <p><strong>Enviar comprovante no WhatsApp do CEDEP: 44 99810-2004</strong></p>
                                </div>
                              </div>
                              <div class="pagamento">
                                <div class="pix-chave"><strong>PIX - escaneie para pagar</strong></div>
                                <img class="qr-pix" src="${parcela.qrCode}" alt="QR Code PIX da mensalidade" />
                                <div class="total-pago"><small>Multa / Juros / Total pago</small><strong>&nbsp;</strong></div>
                              </div>
                            </section>
                          </article>
                        `;
                      }
                    )
                    .join('<div class="linha-corte">- - - - - - - - - - LINHA DE CORTE - - - - - - - - - -</div>')}
                </div>
              </section>
            `
          )
          .join("")}
      `
    );
  };

  const gerarComprovante = () => {
    const recebimento =
      recebimentos.find(
        (item) =>
          item.id ===
          recebimentoSelecionado
      );

    if (!recebimento) {
      alert(
        "Selecione um recebimento."
      );
      return;
    }

    abrirDocumento(
      `Comprovante - ${recebimento.alunoNome}`,
      `
        ${cabecalho("Comprovante de Pagamento")}
        <div class="box">
          <p>Recebemos de <strong>${escapar(recebimento.alunoNome)}</strong> a importância de:</p>
          <p class="total">${escapar(moeda(recebimento.valor))}</p>
          <div class="grid">
            <div><strong>Referente a:</strong> ${escapar(recebimento.descricao)}</div>
            <div><strong>Forma de pagamento:</strong> ${escapar(recebimento.formaPagamento)}</div>
            <div><strong>Data:</strong> ${escapar(new Date(recebimento.dataHora).toLocaleString("pt-BR"))}</div>
            <div><strong>Unidade:</strong> ${escapar(recebimento.unidade)}</div>
            <div><strong>Número:</strong> ${escapar(recebimento.id)}</div>
          </div>
        </div>
        <div class="assinaturas">
          <div class="assinatura">CEDEP Cursos</div>
          <div class="assinatura">${escapar(recebimento.alunoNome)}</div>
        </div>
      `
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
          Documentos
        </h1>
        <p
          style={
            estilos.textoCinza
          }
        >
          Contratos, carnês e
          comprovantes prontos para
          impressão ou PDF.
        </p>
      </header>

      <div
        style={
          estilos.abas
        }
      >
        {(
          [
            "Contratos",
            "Carnês",
            "Comprovantes",
          ] as const
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

      <section
        style={
          estilos.caixa
        }
      >
        {aba === "Contratos" && (
          <>
            <h2>Gerar contrato</h2>
            <div
              style={
                estilos.formGrid
              }
            >
              <CampoSelect
                label="Aluno"
                value={
                  alunoContrato
                }
                opcoes={alunosAtivos.map(
                  (item) => ({
                    valor: item.id,
                    rotulo: item.nome,
                  })
                )}
                onChange={
                  setAlunoContrato
                }
              />
              <CampoSelect
                label="Plano"
                value={
                  planoContrato
                }
                opcoes={planos
                  .filter(
                    (item) =>
                      item.situacao ===
                      "Ativo"
                  )
                  .map((item) => ({
                    valor: item.id,
                    rotulo:
                      `${item.nome} — ${item.parcelas}x ${moeda(item.valor)}`,
                  }))}
                onChange={
                  setPlanoContrato
                }
              />
              <CampoData
                label="Data de início"
                value={
                  inicioContrato
                }
                onChange={
                  setInicioContrato
                }
              />
              <CampoData
                label="Data de término prevista"
                value={
                  terminoContrato
                }
                onChange={
                  setTerminoContrato
                }
              />
              <CampoTexto
                label="Dia de vencimento"
                value={
                  diaVencimentoContrato
                }
                placeholder="Ex.: 10"
                onChange={
                  setDiaVencimentoContrato
                }
              />
              <CampoTexto
                label="Endereço do aluno/responsável"
                value={
                  enderecoContrato
                }
                placeholder="Rua, número, bairro e CEP"
                onChange={
                  setEnderecoContrato
                }
              />
              <CampoTexto
                label="Cidade / UF"
                value={
                  cidadeContrato
                }
                placeholder="Ex.: Astorga - PR"
                onChange={
                  setCidadeContrato
                }
              />
              <CampoSelect
                label="Autorização de imagem e voz"
                value={
                  autorizacaoImagem
                }
                opcoes={[
                  {
                    valor:
                      "Não autorizo",
                    rotulo:
                      "Não autorizo",
                  },
                  {
                    valor:
                      "Autorizo",
                    rotulo:
                      "Autorizo",
                  },
                ]}
                onChange={
                  setAutorizacaoImagem
                }
              />
            </div>
            <label
              style={
                estilos.campoGrupo
              }
            >
              <strong>
                Condições adicionais individualizadas (opcional)
              </strong>
              <textarea
                value={clausulas}
                onChange={(evento) =>
                  setClausulas(
                    evento.target.value
                  )
                }
                rows={4}
                placeholder="Use apenas para condições específicas deste aluno que não estejam no modelo padrão."
                style={
                  estilos.input
                }
              />
            </label>
            <Botao
              onClick={
                gerarContrato
              }
            >
              Gerar contrato
            </Botao>
          </>
        )}

        {aba === "Carnês" && (
          <>
            <h2>Gerar carnê</h2>
            <div
              style={
                estilos.formGrid
              }
            >
              <CampoTexto
                label="Chave PIX"
                value={
                  configuracaoPix.chave
                }
                placeholder="CPF, CNPJ, e-mail, telefone ou chave aleatória"
                onChange={(valor) =>
                  setConfiguracaoPix(
                    (atual) => ({
                      ...atual,
                      chave: valor,
                    })
                  )
                }
              />
              <CampoTexto
                label="Nome do beneficiário"
                value={
                  configuracaoPix.beneficiario
                }
                placeholder="Ex.: CEDEP CURSOS"
                onChange={(valor) =>
                  setConfiguracaoPix(
                    (atual) => ({
                      ...atual,
                      beneficiario:
                        valor,
                    })
                  )
                }
              />
              <CampoTexto
                label="Cidade do beneficiário"
                value={
                  configuracaoPix.cidade
                }
                placeholder="Ex.: SAO PAULO"
                onChange={(valor) =>
                  setConfiguracaoPix(
                    (atual) => ({
                      ...atual,
                      cidade: valor,
                    })
                  )
                }
              />
            </div>
            <CampoSelect
              label="Aluno"
              value={alunoCarne}
              opcoes={alunosAtivos.map(
                (item) => ({
                  valor: item.id,
                  rotulo: item.nome,
                })
              )}
              onChange={
                setAlunoCarne
              }
            />
            <CampoSelect
              label="Formato de impressão"
              value={String(
                parcelasPorFolha
              )}
              opcoes={[
                {
                  valor: "2",
                  rotulo:
                    "Bloco - 2 parcelas por folha (recomendado)",
                },
                {
                  valor: "4",
                  rotulo:
                    "Compacto - 4 parcelas por folha",
                },
              ]}
              onChange={(valor) =>
                setParcelasPorFolha(
                  valor === "4"
                    ? 4
                    : 2
                )
              }
            />
            {alunoCarne && (
              <div
                style={
                  estilos.resumo
                }
              >
                {contasCarne.length} parcela(s)
                encontrada(s), totalizando{" "}
                <strong>
                  {moeda(
                    contasCarne.reduce(
                      (total, item) =>
                        total +
                        item.valor,
                      0
                    )
                  )}
                </strong>
              </div>
            )}
            <Botao
              onClick={gerarCarne}
            >
              Gerar carnê
            </Botao>
          </>
        )}

        {aba ===
          "Comprovantes" && (
          <>
            <h2>
              Gerar comprovante
            </h2>
            <CampoSelect
              label="Recebimento"
              value={
                recebimentoSelecionado
              }
              opcoes={[
                ...recebimentos,
              ]
                .reverse()
                .map((item) => ({
                  valor: item.id,
                  rotulo:
                    `${item.alunoNome} — ${moeda(item.valor)} — ${new Date(
                      item.dataHora
                    ).toLocaleDateString(
                      "pt-BR"
                    )}`,
                }))}
              onChange={
                setRecebimentoSelecionado
              }
            />
            <Botao
              onClick={
                gerarComprovante
              }
            >
              Gerar comprovante
            </Botao>
          </>
        )}
      </section>
    </div>
  );
}

type Opcao = {
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
        {opcoes.map((opcao) => (
          <option
            key={opcao.valor}
            value={opcao.valor}
          >
            {opcao.rotulo}
          </option>
        ))}
      </select>
    </label>
  );
}

function CampoTexto({
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
      <strong>{label}</strong>
      <input
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
      <strong>{label}</strong>
      <input
        type="date"
        value={value}
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

function Botao({
  onClick,
  children,
}: {
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={
        estilos.botaoGerar
      }
    >
      {children}
    </button>
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
  },
  campoGrupo: {
    display: "flex",
    flexDirection: "column",
    gap: 7,
    marginTop: 18,
  },
  input: {
    width: "100%",
    padding: "13px 14px",
    border:
      "1px solid #ccd3dd",
    borderRadius: 9,
    boxSizing: "border-box",
    fontSize: 15,
    fontFamily: "inherit",
  },
  botaoGerar: {
    marginTop: 25,
    background: "#15803d",
    color: "white",
    border: "none",
    borderRadius: 9,
    padding: "13px 20px",
    cursor: "pointer",
    fontWeight: "bold",
  },
  resumo: {
    marginTop: 20,
    padding: 16,
    borderRadius: 10,
    background: "#eef2f7",
    color: "#334155",
  },
};

export default Documentos;

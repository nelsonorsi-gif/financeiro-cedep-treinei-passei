import type { UsuarioSessao } from "../Acesso";
import type { Aluno } from "../Cadastros";
import type { Conta } from "../Contas";
import type { SessaoCaixa } from "../Secretaria";
import type { RegistroContrato } from "./contratos";

export type PrioridadeNotificacao = "urgente" | "atencao" | "informativa" | "sucesso";

export type NotificacaoERP = {
  id: string;
  prioridade: PrioridadeNotificacao;
  titulo: string;
  descricao: string;
  modulo: string;
  acao: string;
  dataReferencia: string;
  alunoId?: string;
  entidadeId?: string;
};

type PreferenciasNotificacao = {
  lidas: Record<string, string>;
  dispensadas: Record<string, string>;
  lembrarDepois: Record<string, string>;
};

export type NotificacaoComEstado = NotificacaoERP & {
  lida: boolean;
  dispensada: boolean;
  adiada: boolean;
};

const CHAVE_CADASTROS = "financeiro-cedep-cadastros";
const CHAVE_CONTAS = "financeiro-cedep-contas";
const CHAVE_CONTRATOS = "financeiro-cedep-configuracoes-contratos";
const CHAVE_CAIXA = "financeiro-cedep-secretaria";
const CHAVE_LANCAMENTOS = "financeiro-cedep-lancamentos";
export const EVENTO_NOTIFICACOES = "financeiro-notificacoes-atualizadas";

const ler = <T,>(chave: string, padrao: T): T => {
  try {
    const valor = localStorage.getItem(chave);
    return valor ? JSON.parse(valor) as T : padrao;
  } catch {
    return padrao;
  }
};

const dataLocal = (valor: string) => {
  if (!valor) return null;
  const data = new Date(valor.length === 10 ? valor + "T12:00:00" : valor);
  return Number.isNaN(data.getTime()) ? null : data;
};

const diasEntre = (inicio: Date, fim: Date) =>
  Math.floor((fim.getTime() - inicio.getTime()) / 86_400_000);

const agora = () => new Date();

const chavePreferencias = (usuarioId: string) =>
  "financeiro-cedep-notificacoes-" + usuarioId;

const preferenciasVazias = (): PreferenciasNotificacao => ({
  lidas: {},
  dispensadas: {},
  lembrarDepois: {},
});

const carregarPreferencias = (usuarioId: string) => {
  const salvas = ler<Partial<PreferenciasNotificacao>>(chavePreferencias(usuarioId), {});
  return {
    lidas: salvas.lidas ?? {},
    dispensadas: salvas.dispensadas ?? {},
    lembrarDepois: salvas.lembrarDepois ?? {},
  };
};

const salvarPreferencias = (usuarioId: string, preferencias: PreferenciasNotificacao) => {
  localStorage.setItem(chavePreferencias(usuarioId), JSON.stringify(preferencias));
  window.dispatchEvent(new CustomEvent(EVENTO_NOTIFICACOES, { detail: { usuarioId } }));
};

const alunoAtivo = (alunos: Aluno[], alunoId?: string) =>
  !alunoId || alunos.find((aluno) => aluno.id === alunoId)?.situacao === "Ativo";

const contaVencida = (conta: Conta, hoje: Date) => {
  const vencimento = dataLocal(conta.vencimento);
  return Boolean(
    vencimento &&
    vencimento < hoje &&
    (conta.status === "Pendente" || conta.status === "Parcial")
  );
};

export function gerarNotificacoes(usuario: UsuarioSessao): NotificacaoERP[] {
  const notificacoes: NotificacaoERP[] = [];
  const dadosCadastros = ler<{ alunos?: Aluno[] }>(CHAVE_CADASTROS, {});
  const alunos = Array.isArray(dadosCadastros.alunos) ? dadosCadastros.alunos : [];
  const contas = ler<Conta[]>(CHAVE_CONTAS, []);
  const contratos = ler<Record<string, RegistroContrato>>(CHAVE_CONTRATOS, {});
  const dadosCaixa = ler<{ sessoes?: SessaoCaixa[] }>(CHAVE_CAIXA, {});
  const sessoes = Array.isArray(dadosCaixa.sessoes) ? dadosCaixa.sessoes : [];
  const lancamentos = ler<Array<{
    id: string;
    data?: string;
    descricao?: string;
    tipoEntrada?: string;
    entrada?: number;
    estornoDeId?: string;
  }>>(CHAVE_LANCAMENTOS, []);
  const hoje = agora();
  const ehAdministrativo = usuario.perfil === "Administrador";
  const ehFinanceiro = usuario.perfil === "Financeiro";
  const ehSecretaria = usuario.perfil === "Secretaria";

  sessoes
    .filter((sessao) =>
      sessao.status === "Aberto" &&
      (usuario.perfil === "Administrador" ||
        sessao.operadorId === usuario.id ||
        (!sessao.operadorId && sessao.operador === usuario.nome))
    )
    .forEach((sessao) => {
      const abertura = dataLocal(sessao.abertura);
      if (abertura && (hoje.getTime() - abertura.getTime()) / 3_600_000 >= 12) {
        notificacoes.push({
          id: "caixa-aberto-12h-" + sessao.id,
          prioridade: "urgente",
          titulo: "Caixa aberto há mais de 12 horas",
          descricao: "O caixa de " + sessao.operador + " está aberto desde " + abertura.toLocaleString("pt-BR") + ".",
          modulo: "Secretaria e Caixa",
          acao: "Abrir caixa",
          dataReferencia: sessao.abertura,
          entidadeId: sessao.id,
        });
      }
    });

  if (ehAdministrativo || ehSecretaria) {
    Object.entries(contratos).forEach(([alunoId, contrato]) => {
      if (!alunoAtivo(alunos, alunoId)) return;
      const aluno = alunos.find((item) => item.id === alunoId);
      const parcelas = contas.filter((conta) =>
        conta.alunoId === alunoId &&
        conta.tipo === "receber" &&
        conta.status !== "Cancelado" &&
        (conta.origem === "mensalidade" || conta.observacao?.includes("Contrato: " + alunoId))
      );
      if (parcelas.length === 0) {
        notificacoes.push({
          id: "contrato-sem-parcelas-" + alunoId,
          prioridade: "atencao",
          titulo: "Contrato sem parcelas",
          descricao: "O contrato de " + (aluno?.nome || "aluno não identificado") + " não possui parcelas ativas.",
          modulo: "Documentos",
          acao: "Abrir contrato",
          dataReferencia: contrato.atualizadoEm || contrato.criadoEm || hoje.toISOString(),
          alunoId,
          entidadeId: alunoId,
        });
      }

      const termino = dataLocal(contrato.terminoContrato || "");
      if (termino) {
        const dias = diasEntre(hoje, termino);
        if (dias >= 0 && dias <= 30) {
          notificacoes.push({
            id: "contrato-vencendo-" + alunoId + "-" + contrato.terminoContrato,
            prioridade: "atencao",
            titulo: "Contrato próximo do vencimento",
            descricao: "O contrato de " + (aluno?.nome || "aluno") + " vence em " + dias + " dia(s), em " + termino.toLocaleDateString("pt-BR") + ".",
            modulo: "Documentos",
            acao: "Revisar contrato",
            dataReferencia: contrato.terminoContrato || hoje.toISOString(),
            alunoId,
            entidadeId: alunoId,
          });
        }
      }
    });

    alunos
      .filter((aluno) => aluno.situacao === "Ativo")
      .forEach((aluno) => {
        const pendencias: string[] = [];
        if ((aluno.cpf || "").replace(/D/g, "").length !== 11) pendencias.push("CPF");
        if (!(aluno.telefone || "").trim()) pendencias.push("telefone");
        if (!(aluno.email || "").trim()) pendencias.push("e-mail");
        if (!(aluno.responsavelNome || "").trim()) pendencias.push("responsável");
        if (pendencias.length > 0) {
          notificacoes.push({
            id: "documento-pendente-" + aluno.id + "-" + pendencias.join("-"),
            prioridade: "atencao",
            titulo: "Documento ou cadastro pendente",
            descricao: aluno.nome + ": falta informar " + pendencias.join(", ") + ".",
            modulo: "Cadastros",
            acao: "Completar cadastro",
            dataReferencia: hoje.toISOString(),
            alunoId: aluno.id,
            entidadeId: aluno.id,
          });
        }
      });
  }

  if (ehAdministrativo || ehFinanceiro || ehSecretaria) {
    const vencidasPorAluno = new Map<string, { aluno: string; dias: number; quantidade: number; valor: number }>();
    contas.forEach((conta) => {
      if (!contaVencida(conta, hoje) || conta.tipo !== "receber") return;
      const vencimento = dataLocal(conta.vencimento);
      if (!vencimento) return;
      const dias = diasEntre(vencimento, hoje);
      if (dias < 30) return;
      const chave = conta.alunoId || conta.alunoNome || conta.id;
      const atual = vencidasPorAluno.get(chave);
      vencidasPorAluno.set(chave, {
        aluno: conta.alunoNome || conta.descricao,
        dias: Math.max(atual?.dias ?? 0, dias),
        quantidade: (atual?.quantidade ?? 0) + 1,
        valor: (atual?.valor ?? 0) + Math.max(0, conta.valor - (conta.valorPago ?? 0)),
      });
    });
    vencidasPorAluno.forEach((dados, id) => {
      notificacoes.push({
        id: "inadimplente-30d-" + id,
        prioridade: "urgente",
        titulo: "Aluno inadimplente há 30 dias ou mais",
        descricao: dados.aluno + " possui " + dados.quantidade + " parcela(s) vencida(s); atraso máximo de " + dados.dias + " dias.",
        modulo: "Contas a Receber",
        acao: "Ver parcelas",
        dataReferencia: hoje.toISOString(),
        alunoId: id,
        entidadeId: id,
      });
    });
  }

  sessoes
    .filter((sessao) =>
      sessao.status === "Fechado" &&
      Math.abs(sessao.diferenca ?? 0) >= 0.01 &&
      (usuario.perfil === "Administrador" ||
        sessao.operadorId === usuario.id ||
        (!sessao.operadorId && sessao.operador === usuario.nome))
    )
    .slice(-10)
    .forEach((sessao) => {
      notificacoes.push({
        id: "diferenca-caixa-" + sessao.id,
        prioridade: "urgente",
        titulo: "Diferença no fechamento do caixa",
        descricao: "Caixa de " + sessao.operador + " fechado com diferença de R$ " + Math.abs(sessao.diferenca ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) + ".",
        modulo: "Secretaria e Caixa",
        acao: "Conferir fechamento",
        dataReferencia: sessao.fechamento || sessao.abertura,
        entidadeId: sessao.id,
      });
    });

  if (ehAdministrativo || ehFinanceiro || ehSecretaria) {
    lancamentos
      .filter((item) => {
        const data = dataLocal(item.data || "");
        return Boolean(
          data &&
          diasEntre(data, hoje) <= 7 &&
          diasEntre(data, hoje) >= 0 &&
          (item.entrada ?? 0) > 0 &&
          !item.estornoDeId &&
          ((item.tipoEntrada || "").toLowerCase().includes("mensalidade") ||
            (item.descricao || "").toLowerCase().includes("mensalidade"))
        );
      })
      .slice(-5)
      .forEach((item) => {
        notificacoes.push({
          id: "mensalidade-recebida-" + item.id,
          prioridade: "sucesso",
          titulo: "Mensalidade recebida",
          descricao: item.descricao || "Recebimento de mensalidade confirmado.",
          modulo: "Contas a Receber",
          acao: "Ver recebimentos",
          dataReferencia: item.data || hoje.toISOString(),
          entidadeId: item.id,
        });
      });
  }

  return notificacoes.sort((a, b) => {
    const ordem: Record<PrioridadeNotificacao, number> = {
      urgente: 0,
      atencao: 1,
      informativa: 2,
      sucesso: 3,
    };
    return ordem[a.prioridade] - ordem[b.prioridade] ||
      new Date(b.dataReferencia).getTime() - new Date(a.dataReferencia).getTime();
  });
}

export function notificacoesComEstado(usuario: UsuarioSessao): NotificacaoComEstado[] {
  const preferencias = carregarPreferencias(usuario.id);
  const instante = Date.now();
  return gerarNotificacoes(usuario).map((notificacao) => ({
    ...notificacao,
    lida: Boolean(preferencias.lidas[notificacao.id]),
    dispensada: Boolean(preferencias.dispensadas[notificacao.id]),
    adiada: new Date(preferencias.lembrarDepois[notificacao.id] || 0).getTime() > instante,
  }));
}

export function atualizarEstadoNotificacao(
  usuarioId: string,
  notificacaoId: string,
  acao: "ler" | "nao_ler" | "dispensar" | "lembrar"
) {
  const preferencias = carregarPreferencias(usuarioId);
  if (acao === "ler") preferencias.lidas[notificacaoId] = new Date().toISOString();
  if (acao === "nao_ler") delete preferencias.lidas[notificacaoId];
  if (acao === "dispensar") preferencias.dispensadas[notificacaoId] = new Date().toISOString();
  if (acao === "lembrar") {
    preferencias.lembrarDepois[notificacaoId] =
      new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  }
  salvarPreferencias(usuarioId, preferencias);
}

export function limparPreferenciasAntigas(usuario: UsuarioSessao) {
  const preferencias = carregarPreferencias(usuario.id);
  const idsAtivos = new Set(gerarNotificacoes(usuario).map((item) => item.id));
  const novas = preferenciasVazias();
  (["lidas", "dispensadas", "lembrarDepois"] as const).forEach((campo) => {
    Object.entries(preferencias[campo]).forEach(([id, valor]) => {
      if (idsAtivos.has(id)) novas[campo][id] = valor;
    });
  });
  salvarPreferencias(usuario.id, novas);
}
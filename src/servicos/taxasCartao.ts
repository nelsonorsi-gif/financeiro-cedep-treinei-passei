export type ModalidadeCartao = "debito" | "credito";

export type TaxaCartao = {
  modalidade: ModalidadeCartao;
  parcelas: number;
  percentual: number;
  taxaFixa: number;
  ativa: boolean;
};

export const CHAVE_TAXAS_CARTAO = "financeiro-cedep-taxas-cartao";
export const EVENTO_TAXAS_CARTAO = "financeiro-taxas-cartao-atualizadas";

export const TAXAS_CARTAO_PADRAO: TaxaCartao[] = [
  { modalidade: "debito", parcelas: 1, percentual: 0, taxaFixa: 0, ativa: true },
  ...Array.from({ length: 12 }, (_, indice) => ({
    modalidade: "credito" as const,
    parcelas: indice + 1,
    percentual: 0,
    taxaFixa: 0,
    ativa: true,
  })),
];

export function carregarTaxasCartao(): TaxaCartao[] {
  try {
    const salvo = localStorage.getItem(CHAVE_TAXAS_CARTAO);
    if (!salvo) return TAXAS_CARTAO_PADRAO;
    const taxas = JSON.parse(salvo);
    if (!Array.isArray(taxas)) return TAXAS_CARTAO_PADRAO;
    return TAXAS_CARTAO_PADRAO.map((padrao) => {
      const encontrada = taxas.find(
        (item: TaxaCartao) =>
          item.modalidade === padrao.modalidade &&
          Number(item.parcelas) === padrao.parcelas
      );
      return encontrada
        ? {
            ...padrao,
            ...encontrada,
            percentual: Number(encontrada.percentual) || 0,
            taxaFixa: Number(encontrada.taxaFixa) || 0,
          }
        : padrao;
    });
  } catch {
    return TAXAS_CARTAO_PADRAO;
  }
}

export function salvarTaxasCartao(taxas: TaxaCartao[]) {
  localStorage.setItem(CHAVE_TAXAS_CARTAO, JSON.stringify(taxas));
  window.dispatchEvent(new Event(EVENTO_TAXAS_CARTAO));
}

export function calcularTaxaCartao(
  valorBruto: number,
  formaPagamento: string,
  parcelas = 1
) {
  const texto = formaPagamento.toLowerCase();
  const modalidade: ModalidadeCartao | null = texto.includes("débito") || texto.includes("debito")
    ? "debito"
    : texto.includes("crédito") || texto.includes("credito")
      ? "credito"
      : null;

  if (!modalidade) {
    return { taxa: 0, liquido: valorBruto, modalidade: null, parcelas: 1 };
  }

  const quantidade = modalidade === "debito" ? 1 : Math.min(12, Math.max(1, parcelas));
  const configuracao = carregarTaxasCartao().find(
    (item) =>
      item.modalidade === modalidade &&
      item.parcelas === quantidade &&
      item.ativa
  );
  const taxa = configuracao
    ? Math.max(0, valorBruto * configuracao.percentual / 100 + configuracao.taxaFixa)
    : 0;

  return {
    taxa: Math.min(valorBruto, taxa),
    liquido: Math.max(0, valorBruto - taxa),
    modalidade,
    parcelas: quantidade,
  };
}

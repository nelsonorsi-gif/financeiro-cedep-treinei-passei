const chaveUnidade = (valor: string) =>
  valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/gi, "").toLowerCase();

export const UNIDADE_TREINEI_PASSEI = "TREINEI, PASSEI!";
export const UNIDADE_ADMINISTRATIVO = "ADMINISTRATIVO";

export const normalizarUnidade = (valor: string) => {
  const chave = chaveUnidade(valor);
  if (chave === "treineipassei") return UNIDADE_TREINEI_PASSEI;
  if (chave === "administrativo") return UNIDADE_ADMINISTRATIVO;
  return valor.trim();
};

export const normalizarListaUnidades = (valores: string[]) =>
  Array.from(new Set(valores.map(normalizarUnidade).filter(Boolean)));

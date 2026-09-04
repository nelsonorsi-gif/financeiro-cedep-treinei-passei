const chaveUnidade = (valor: string) =>
  valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/gi, "").toLowerCase();

export const UNIDADE_TREINEI_PASSEI = "TREINEI, PASSEI!";

export const normalizarUnidade = (valor: string) =>
  chaveUnidade(valor) === "treineipassei" ? UNIDADE_TREINEI_PASSEI : valor.trim();

export const normalizarListaUnidades = (valores: string[]) =>
  Array.from(new Set(valores.map(normalizarUnidade).filter(Boolean)));

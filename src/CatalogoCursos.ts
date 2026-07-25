export const CHAVE_MENSALIDADES =
  "financeiro-cedep-mensalidades";

export type Curso = {
  id: string;
  nome: string;
  descricao: string;
  situacao: "Ativo" | "Inativo";
};

export type Plano = {
  id: string;
  nome: string;
  cursoId?: string;
  curso: string;
  valor: number;
  parcelas: number;
  banco: string;
  unidade: string;
  situacao: "Ativo" | "Inativo";
};

export type CatalogoCursos = {
  cursos: Curso[];
  planos: Plano[];
};

export const carregarCatalogoCursos =
  (): CatalogoCursos => {
    try {
      const salvo =
        localStorage.getItem(
          CHAVE_MENSALIDADES
        );

      if (!salvo) {
        return {
          cursos: [],
          planos: [],
        };
      }

      const conteudo =
        JSON.parse(salvo);

      const planos: Plano[] =
        Array.isArray(
          conteudo.planos
        )
          ? conteudo.planos
          : [];

      let cursos: Curso[] =
        Array.isArray(
          conteudo.cursos
        )
          ? conteudo.cursos
          : [];

      if (cursos.length === 0) {
        cursos = Array.from(
          new Set(
            planos
              .map((item) =>
                item.curso?.trim()
              )
              .filter(Boolean)
          )
        ).map((nome) => ({
          id: `curso-legado-${nome
            .toLocaleLowerCase(
              "pt-BR"
            )
            .replace(
              /[^a-z0-9]+/g,
              "-"
            )}`,
          nome,
          descricao:
            "Curso recuperado dos planos existentes.",
          situacao: "Ativo",
        }));
      }

      return {
        cursos,
        planos: planos.map(
          (plano) => ({
            ...plano,
            cursoId:
              plano.cursoId ||
              cursos.find(
                (curso) =>
                  curso.nome
                    .trim()
                    .toLocaleLowerCase(
                      "pt-BR"
                    ) ===
                  plano.curso
                    ?.trim()
                    .toLocaleLowerCase(
                      "pt-BR"
                    )
              )?.id,
          })
        ),
      };
    } catch {
      return {
        cursos: [],
        planos: [],
      };
    }
  };

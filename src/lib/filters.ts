import { z } from "zod";
import type { Filtros } from "./types";

export const filtrosSchema = z.object({
  credor: z.string(),
  elemento: z.string(),
  fonte: z.string(),
  classe: z.string(),
  tipo: z.string(),
  dataInicio: z.string(),
  dataFim: z.string(),
});

export type FiltrosForm = z.infer<typeof filtrosSchema>;

export const filtrosVazios: Filtros = {
  credor: "",
  elemento: "",
  fonte: "",
  classe: "",
  tipo: "",
  dataInicio: "",
  dataFim: "",
};

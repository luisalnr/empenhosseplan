import { z } from "zod";
import type { Filtros } from "./types";

export const filtrosSchema = z.object({
  credor: z.array(z.string()),
  elemento: z.array(z.string()),
  fonte: z.array(z.string()),
  classe: z.array(z.string()),
  tipo: z.array(z.string()),
  dataInicio: z.string(),
  dataFim: z.string(),
});

export type FiltrosForm = z.infer<typeof filtrosSchema>;

export const filtrosVazios: Filtros = {
  credor: [],
  elemento: [],
  fonte: [],
  classe: [],
  tipo: [],
  dataInicio: "",
  dataFim: "",
};

import { randomBytes } from "node:crypto";

/** ID opaco (hex) para PKs de usuários e auditoria. */
export function newId(bytes = 16): string {
  return randomBytes(bytes).toString("hex");
}

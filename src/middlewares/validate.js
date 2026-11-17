import { badRequest } from "../erreurs.js";

const SOURCES = ["params", "query", "body"];

// Liste lisible des champs fautifs, préfixés par leur origine.
function toFieldErrors(issues, source) {
  return issues.map((issue) => ({
    champ: [source, ...issue.path].join("."),
    message: issue.message,
  }));
}

// Valide params, query et body avec des schémas Zod.
// Les valeurs nettoyées (champs inconnus retirés) sont exposées dans req.valid.
export function validate(schemas) {
  return (req, res, next) => {
    req.valid ??= {};
    const errors = [];

    for (const source of SOURCES) {
      const schema = schemas[source];
      if (!schema) continue;
      const result = schema.safeParse(req[source] ?? {});
      if (result.success) req.valid[source] = result.data;
      else errors.push(...toFieldErrors(result.error.issues, source));
    }

    next(errors.length > 0 ? badRequest("Données invalides", errors) : undefined);
  };
}

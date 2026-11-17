import { Router } from "express";
import { validate } from "../middlewares/validate.js";
import { idParamsSchema } from "../schemas/common.schema.js";
import { createLoanSchema, listLoansQuerySchema, updateLoanSchema } from "../schemas/loan.schema.js";

const byId = validate({ params: idParamsSchema });

// Routeur /api/emprunts : traduit HTTP vers le service, sans règle métier.
export function createLoansRouter({ loanService }) {
  const router = Router();

  router.get("/", validate({ query: listLoansQuerySchema }), async (req, res) => {
    res.json(await loanService.list(req.valid.query));
  });

  router.get("/:id", byId, async (req, res) => {
    res.json(await loanService.getById(req.valid.params.id));
  });

  router.post("/", validate({ body: createLoanSchema }), async (req, res) => {
    res.status(201).json(await loanService.create(req.valid.body));
  });

  router.patch("/:id", validate({ params: idParamsSchema, body: updateLoanSchema }), async (req, res) => {
    res.json(await loanService.update(req.valid.params.id, req.valid.body));
  });

  router.delete("/:id", byId, async (req, res) => {
    await loanService.remove(req.valid.params.id);
    res.status(204).end();
  });

  router.post("/:id/retour", byId, async (req, res) => {
    res.json(await loanService.returnLoan(req.valid.params.id));
  });

  return router;
}

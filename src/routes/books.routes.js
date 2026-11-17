import { Router } from "express";
import { validate } from "../middlewares/validate.js";
import { createBookSchema, listBooksQuerySchema, updateBookSchema } from "../schemas/book.schema.js";
import { idParamsSchema } from "../schemas/common.schema.js";

const byId = validate({ params: idParamsSchema });

// Routeur /api/ouvrages : traduit HTTP vers le service, sans règle métier.
export function createBooksRouter({ bookService }) {
  const router = Router();

  router.get("/", validate({ query: listBooksQuerySchema }), async (req, res) => {
    res.json(await bookService.list(req.valid.query));
  });

  router.get("/:id", byId, async (req, res) => {
    res.json(await bookService.getById(req.valid.params.id));
  });

  router.post("/", validate({ body: createBookSchema }), async (req, res) => {
    res.status(201).json(await bookService.create(req.valid.body));
  });

  router.patch("/:id", validate({ params: idParamsSchema, body: updateBookSchema }), async (req, res) => {
    res.json(await bookService.update(req.valid.params.id, req.valid.body));
  });

  router.delete("/:id", byId, async (req, res) => {
    await bookService.remove(req.valid.params.id);
    res.status(204).end();
  });

  return router;
}

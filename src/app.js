import express from "express";
import { errorHandler, notFoundHandler } from "./middlewares/error-handler.js";
import { requestLogger } from "./middlewares/request-logger.js";
import { createDataAccess } from "./repositories/index.js";
import { createBooksRouter } from "./routes/books.routes.js";
import { createHealthRouter } from "./routes/health.routes.js";
import { createLoansRouter } from "./routes/loans.routes.js";
import { createBookService } from "./services/book.service.js";
import { createLoanService } from "./services/loan.service.js";

// Assemble l'application à partir d'un client Prisma, sans démarrer de serveur.
export function createApp({ prisma }) {
  const dataAccess = createDataAccess(prisma);
  const bookService = createBookService(dataAccess);
  const loanService = createLoanService(dataAccess);

  const app = express();
  app.disable("x-powered-by");
  app.use(requestLogger);
  app.use(express.json());

  app.use("/sante", createHealthRouter({ prisma }));
  app.use("/api/ouvrages", createBooksRouter({ bookService }));
  app.use("/api/emprunts", createLoansRouter({ loanService }));

  // 404 après toutes les routes, gestionnaire d'erreurs en dernier.
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

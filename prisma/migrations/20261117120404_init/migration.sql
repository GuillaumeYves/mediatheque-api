-- CreateTable
CREATE TABLE "Ouvrage" (
    "id" SERIAL NOT NULL,
    "titre" VARCHAR(150) NOT NULL,
    "auteur" VARCHAR(120) NOT NULL,
    "annee" INTEGER NOT NULL,
    "disponible" BOOLEAN NOT NULL DEFAULT true,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifieLe" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ouvrage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Emprunt" (
    "id" SERIAL NOT NULL,
    "ouvrageId" INTEGER NOT NULL,
    "emprunteur" VARCHAR(80) NOT NULL,
    "empruntLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retourPrevuLe" TIMESTAMP(3) NOT NULL,
    "rendu" BOOLEAN NOT NULL DEFAULT false,
    "renduLe" TIMESTAMP(3),

    CONSTRAINT "Emprunt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Ouvrage_disponible_idx" ON "Ouvrage"("disponible");

-- CreateIndex
CREATE INDEX "Emprunt_ouvrageId_rendu_idx" ON "Emprunt"("ouvrageId", "rendu");

-- CreateIndex
CREATE INDEX "Emprunt_rendu_idx" ON "Emprunt"("rendu");

-- AddForeignKey
ALTER TABLE "Emprunt" ADD CONSTRAINT "Emprunt_ouvrageId_fkey" FOREIGN KEY ("ouvrageId") REFERENCES "Ouvrage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

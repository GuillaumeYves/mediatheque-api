-- Consommation de l'assistant : une ligne par réponse, somme par jour pour le quota.

-- CreateTable
CREATE TABLE "consommation_ia" (
    "id" SERIAL NOT NULL,
    "utilisateurId" INTEGER NOT NULL,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "jetonsEntree" INTEGER NOT NULL,
    "jetonsSortie" INTEGER NOT NULL,

    CONSTRAINT "consommation_ia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "consommation_ia_utilisateurId_creeLe_idx" ON "consommation_ia"("utilisateurId", "creeLe");

-- AddForeignKey
ALTER TABLE "consommation_ia" ADD CONSTRAINT "consommation_ia_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "Utilisateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;


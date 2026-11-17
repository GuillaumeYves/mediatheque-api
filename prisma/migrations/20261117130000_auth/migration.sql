-- Comptes, rôles et refresh tokens ; l'emprunteur devient une référence à un compte.

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('membre', 'bibliothecaire');

-- CreateTable
CREATE TABLE "Utilisateur" (
    "id" SERIAL NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "motDePasseHache" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'membre',
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Utilisateur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" SERIAL NOT NULL,
    "empreinte" CHAR(64) NOT NULL,
    "utilisateurId" INTEGER NOT NULL,
    "expireLe" TIMESTAMP(3) NOT NULL,
    "revoqueLe" TIMESTAMP(3),
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- Les emprunts existants portent un nom libre, impossible à rattacher à un compte.
-- Ce sont des données de démonstration : ils sont supprimés puis recréés par le seeder.
DELETE FROM "Emprunt";
UPDATE "Ouvrage" SET "disponible" = true;

-- AlterTable
ALTER TABLE "Emprunt" DROP COLUMN "emprunteur",
ADD COLUMN     "emprunteurId" INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Utilisateur_email_key" ON "Utilisateur"("email");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_empreinte_key" ON "RefreshToken"("empreinte");

-- CreateIndex
CREATE INDEX "RefreshToken_utilisateurId_idx" ON "RefreshToken"("utilisateurId");

-- CreateIndex
CREATE INDEX "Emprunt_emprunteurId_rendu_idx" ON "Emprunt"("emprunteurId", "rendu");

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "Utilisateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Emprunt" ADD CONSTRAINT "Emprunt_emprunteurId_fkey" FOREIGN KEY ("emprunteurId") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

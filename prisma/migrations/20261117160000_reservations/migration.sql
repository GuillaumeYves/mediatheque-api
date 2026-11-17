-- Réservations : file d'attente sur les ouvrages indisponibles.
-- enCours vaut true pour une réservation active et NULL une fois clôturée :
-- PostgreSQL traite les NULL comme distincts, l'unicité ne porte donc que sur les réservations actives.

-- CreateEnum
CREATE TYPE "StatutReservation" AS ENUM ('active', 'annulee', 'honoree');

-- CreateTable
CREATE TABLE "Reservation" (
    "id" SERIAL NOT NULL,
    "ouvrageId" INTEGER NOT NULL,
    "membreId" INTEGER NOT NULL,
    "statut" "StatutReservation" NOT NULL DEFAULT 'active',
    "enCours" BOOLEAN DEFAULT true,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clotureLe" TIMESTAMP(3),
    "empruntId" INTEGER,

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Reservation_empruntId_key" ON "Reservation"("empruntId");

-- CreateIndex
CREATE INDEX "Reservation_ouvrageId_statut_creeLe_idx" ON "Reservation"("ouvrageId", "statut", "creeLe");

-- CreateIndex
CREATE INDEX "Reservation_membreId_statut_idx" ON "Reservation"("membreId", "statut");

-- CreateIndex
CREATE UNIQUE INDEX "Reservation_ouvrageId_membreId_enCours_key" ON "Reservation"("ouvrageId", "membreId", "enCours");

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_ouvrageId_fkey" FOREIGN KEY ("ouvrageId") REFERENCES "Ouvrage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_membreId_fkey" FOREIGN KEY ("membreId") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_empruntId_fkey" FOREIGN KEY ("empruntId") REFERENCES "Emprunt"("id") ON DELETE SET NULL ON UPDATE CASCADE;


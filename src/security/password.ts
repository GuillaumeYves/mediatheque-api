import bcrypt from "bcrypt";

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, hash: string | undefined): Promise<boolean>;
}

// Hachage bcrypt, exécuté dans le pool de threads de libuv : la boucle reste libre.
export function createPasswordHasher({ cost }: { cost: number }): PasswordHasher {
  // Empreinte factice : un compte inconnu coûte le même temps qu'un mauvais mot de passe.
  const dummyHash = bcrypt.hashSync("compte-inexistant", cost);

  return {
    hash: (password) => bcrypt.hash(password, cost),

    // Compare toujours, même sans compte, pour ne rien révéler par le temps de réponse.
    verify: (password, hash) => bcrypt.compare(password, hash ?? dummyHash),
  };
}

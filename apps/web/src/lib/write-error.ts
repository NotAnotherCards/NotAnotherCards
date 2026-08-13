// The store surfaces low-level failures ("Database not initialized"). Keep that
// message, since it is the only clue the user gets, but fall back to something
// readable when the rejection carries none.
export const writeErrorMessage = (err: unknown, fallback: string) =>
  err instanceof Error && err.message ? err.message : fallback;

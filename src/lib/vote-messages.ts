/**
 * Classic Knekro catchphrases displayed after casting or changing a vote.
 */
export const VOTE_THANK_YOU_MESSAGES = [
  "Grande loquete",
  "jeje goz",
  "Un saludito?",
  "Cracabuuuuut",
  "PUUUUUUM",
] as const;

export type VoteThankYouMessage = (typeof VOTE_THANK_YOU_MESSAGES)[number];

/**
 * Returns a random thank-you catchphrase, avoiding immediate repetition if lastMessage is provided.
 */
export function getRandomVoteThankYouMessage(lastMessage?: string): string {
  const pool =
    lastMessage && VOTE_THANK_YOU_MESSAGES.length > 1
      ? VOTE_THANK_YOU_MESSAGES.filter((msg) => msg !== lastMessage)
      : VOTE_THANK_YOU_MESSAGES;
  const index = Math.floor(Math.random() * pool.length);
  return pool[index];
}

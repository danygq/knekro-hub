/**
 * Twitch category/game IDs that are non-game or excluded categories
 * that should not be inserted or reconciled into the `games` table.
 */
export const IGNORED_TWITCH_CATEGORIES: Record<string, string> = {
  "509663": "Eventos especiales",
  "509658": "Just Chatting",
  "509672": "IRL",
  "518203": "Deportes",
  "509667": "Comida y bebida",
  "26936": "Musica",
  "509659": "ASMR",
  "27284": "Retro",
  "66082": "Games + demos",
  "488190": "Poker",
  "498592": "I'm only sleeping",
  "1669431183": "DJ",
  "509660": "Art",
  "498566": "Slots",
  "499634": "Crypto",
  "509670": "Ciencia y tecnología",
  "116747788": "Piscinas, jacuzzis y playas",
  "515214": "Política",
  "743": "Ajedrez",
  "1599346425": "cotrabajo y estudio",
  "272263131": "animales, acuarios y zoológicos",
  "417752": "Talk shows y podcasts",
  "1469308723": "Desarrollo de software y juegos",
  "509673": "Manualidades y artesanía",
  "772157971": "Narrativa y escritura",
  "43579844": "LEGO y construcción con bloques",
  "1397210469": "miniaturas y modelos",
};

export const IGNORED_TWITCH_CATEGORY_IDS = new Set<string>(
  Object.keys(IGNORED_TWITCH_CATEGORIES),
);

/**
 * Returns true if the given category ID should be ignored during game reconciliation.
 */
export function isIgnoredTwitchCategory(
  categoryId: string | null | undefined,
): boolean {
  if (!categoryId) return false;
  return IGNORED_TWITCH_CATEGORY_IDS.has(categoryId.trim());
}

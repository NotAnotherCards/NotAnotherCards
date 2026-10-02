import { languageFor } from '@repo/schemas';

type DeckTypeLabelDeck = {
  note_type: string;
  native_language_id?: string | null;
  target_language_id?: string | null;
};

type TranslateDeckType = (
  key: 'basic' | 'word' | 'unknown',
  options?: { noteType: string },
) => string;

function languageName(
  locale: string,
  language: NonNullable<ReturnType<typeof languageFor>>,
) {
  try {
    const name = new Intl.DisplayNames([locale], { type: 'language' }).of(
      language.locale,
    );
    return name
      ? name[0].toLocaleUpperCase(locale) + name.slice(1)
      : language.name;
  } catch {
    return language.name;
  }
}

/**
 * Full, localized name for a deck type used by tooltips and assistive tools.
 * The short visible flag label stays in the data package because it needs no
 * interface translation.
 */
export function deckTypeAccessibilityLabel(
  deck: DeckTypeLabelDeck,
  locale: string,
  translate: TranslateDeckType,
): string {
  if (deck.note_type === 'word') {
    const native = languageFor(deck.native_language_id);
    const target = languageFor(deck.target_language_id);
    return native && target
      ? `${native.flag} ${languageName(locale, native)} → ${target.flag} ${languageName(locale, target)}`
      : translate('word');
  }

  if (deck.note_type === 'basic') return translate('basic');
  return translate('unknown', { noteType: deck.note_type });
}

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ModerationVerdict {
  ok: boolean;
  /** Why the deck was refused when no individual card was flagged. */
  reason?: string;
  flagged: { cardId: string; reason: string }[];
}

export interface ModerationInput {
  deckId: string;
  cards: { id: string; front: string; back: string }[];
}

@Injectable()
export class ModerationService {
  constructor(private readonly config: ConfigService) {}

  // Until #263 fills this in it fails closed, so a deck can only go public
  // where someone opted in: staging sets the flag for the #289 demo,
  // production and CI do not. The stub has nothing to await and ignores the
  // cards it is handed, which is what the disabled rules are complaining about.
  // eslint-disable-next-line @typescript-eslint/require-await, @typescript-eslint/no-unused-vars
  async check(input: ModerationInput): Promise<ModerationVerdict> {
    if (this.config.get('MODERATION_ALLOW_ALL') === '1') {
      return { ok: true, flagged: [] };
    }
    return { ok: false, reason: 'moderation unavailable', flagged: [] };
  }
}

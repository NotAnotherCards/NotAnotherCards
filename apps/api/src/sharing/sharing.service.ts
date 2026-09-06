import {
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { and, desc, eq, isNull, or, sql } from 'drizzle-orm';
import { DATABASE_CONNECTION } from '../database/database-connection';
import type { AppDatabase } from '../database/database-schema';
import {
  userCards,
  userDecks,
  userNoteDecks,
  userNotes,
  userProfiles,
} from '../sync/schema';
import { syncScopeLockKey } from '../sync/sync-store';
import { ModerationService } from './moderation.service';

/** How much of a deck a stranger gets to read before importing it. */
const PREVIEW_CARDS = 10;

const activeCardCount = sql<number>`(
  select count(*)::int
  from ${userNoteDecks} nd
  join ${userNotes} n on n.id = nd.note_id and n.deleted_at is null
  join ${userCards} c
    on c.note_id = n.id and c.active and c.deleted_at is null
  where nd.deck_id = ${userDecks.id} and nd.active and nd.deleted_at is null
)`;

const summaryColumns = {
  id: userDecks.id,
  title: userDecks.title,
  description: userDecks.description,
  noteType: userDecks.noteType,
  nativeLanguageId: userDecks.nativeLanguageId,
  targetLanguageId: userDecks.targetLanguageId,
  updatedAt: userDecks.updatedAt,
  cardCount: activeCardCount,
  // Left join: a deck published before its owner finished onboarding has no
  // profile row, and dropping it from the list would be the stranger bug.
  username: userProfiles.username,
};

const toSummary = <T extends { username: string | null }>({
  username,
  ...deck
}: T) => ({ ...deck, owner: { username } });

@Injectable()
export class SharingService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: AppDatabase,
    private readonly moderation: ModerationService,
  ) {}

  async publish(userId: string, deckId: string) {
    const visibility = await this.ownedVisibility(userId, deckId);
    if (visibility === 'public') return { visibility };

    const verdict = await this.moderation.check({
      deckId,
      cards: await this.deckCards(deckId),
    });
    if (!verdict.ok) {
      throw new UnprocessableEntityException({
        reason: verdict.reason,
        flagged: verdict.flagged,
      });
    }

    await this.setVisibility(userId, deckId, 'public');
    return { visibility: 'public' as const };
  }

  async unpublish(userId: string, deckId: string) {
    const visibility = await this.ownedVisibility(userId, deckId);
    if (visibility === 'private') return { visibility };

    await this.setVisibility(userId, deckId, 'private');
    return { visibility: 'private' as const };
  }

  async listShared(limit: number, offset: number) {
    const decks = await this.db
      .select(summaryColumns)
      .from(userDecks)
      .leftJoin(
        userProfiles,
        and(
          eq(userProfiles.userId, userDecks.userId),
          isNull(userProfiles.deletedAt),
        ),
      )
      .where(
        and(eq(userDecks.visibility, 'public'), isNull(userDecks.deletedAt)),
      )
      .orderBy(desc(userDecks.updatedAt), desc(userDecks.id))
      .limit(limit)
      .offset(offset);

    return { decks: decks.map(toSummary) };
  }

  async previewShared(userId: string, deckId: string) {
    const [deck] = await this.db
      .select(summaryColumns)
      .from(userDecks)
      .leftJoin(
        userProfiles,
        and(
          eq(userProfiles.userId, userDecks.userId),
          isNull(userProfiles.deletedAt),
        ),
      )
      .where(
        and(
          eq(userDecks.id, deckId),
          isNull(userDecks.deletedAt),
          or(eq(userDecks.visibility, 'public'), eq(userDecks.userId, userId)),
        ),
      );
    if (!deck) throw new NotFoundException('Deck not found');

    const cards = await this.deckCards(deckId, PREVIEW_CARDS);
    return {
      deck: {
        ...toSummary(deck),
        // Text only. `image` and `word_audio` fields hold file ids that no
        // route serves, so a preview cannot render them anyway.
        cards: cards.map(({ front, back }) => ({ front, back })),
      },
    };
  }

  /** 404 rather than 403 for someone else's deck: 403 would confirm the id. */
  private async ownedVisibility(userId: string, deckId: string) {
    const [deck] = await this.db
      .select({ visibility: userDecks.visibility })
      .from(userDecks)
      .where(
        and(
          eq(userDecks.id, deckId),
          eq(userDecks.userId, userId),
          isNull(userDecks.deletedAt),
        ),
      );
    if (!deck) throw new NotFoundException('Deck not found');
    return deck.visibility;
  }

  private async setVisibility(
    userId: string,
    deckId: string,
    visibility: 'public' | 'private',
  ) {
    await this.db.transaction(async (tx) => {
      // The same lock push takes, so a visibility write cannot interleave
      // with the owner's own changes to the deck.
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(${syncScopeLockKey(userId).toString()})`,
      );
      await tx
        .update(userDecks)
        .set({
          visibility,
          // Without a fresh rev the row is invisible to every client pull.
          rev: sql`nextval('remelon_rev')`,
          updatedAt: Date.now(),
        })
        .where(
          and(
            eq(userDecks.id, deckId),
            eq(userDecks.userId, userId),
            isNull(userDecks.deletedAt),
          ),
        );
    });
  }

  /** The deck's active cards, already rendered by the client that pushed them. */
  private async deckCards(deckId: string, limit?: number) {
    const query = this.db
      .select({
        id: userCards.id,
        front: userCards.front,
        back: userCards.back,
      })
      .from(userNoteDecks)
      .innerJoin(userNotes, eq(userNotes.id, userNoteDecks.noteId))
      .innerJoin(userCards, eq(userCards.noteId, userNotes.id))
      .where(
        and(
          eq(userNoteDecks.deckId, deckId),
          eq(userNoteDecks.active, true),
          isNull(userNoteDecks.deletedAt),
          isNull(userNotes.deletedAt),
          eq(userCards.active, true),
          isNull(userCards.deletedAt),
        ),
      )
      .orderBy(userCards.createdAt, userCards.id);

    return limit === undefined ? query : query.limit(limit);
  }
}

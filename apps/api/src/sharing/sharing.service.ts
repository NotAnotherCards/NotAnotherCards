import {
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { DATABASE_CONNECTION } from '../database/database-connection';
import type { AppDatabase } from '../database/database-schema';
import { userCards, userDecks, userNoteDecks, userNotes } from '../sync/schema';
import { syncScopeLockKey } from '../sync/sync-store';
import { ModerationService } from './moderation.service';

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
  private async deckCards(deckId: string) {
    return this.db
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
  }
}

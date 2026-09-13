import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  and,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  sql,
} from 'drizzle-orm';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { cardId, noteDeckId } from '@repo/offline-db';
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
import { aiGenerationJobs } from '../ai/schema';
import {
  deckReports,
  deckTakedowns,
  publishedDecks,
  type PublishedContent,
  type StoredModerationVerdict,
} from './schema';

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
  // Inner join on a live profile with a username, so a deck is listed only
  // with a real owner name. Onboarding sets the username before anything
  // else is reachable, and publish refuses without one, so nothing real is
  // dropped. The column is nullable in the table; the join's isNotNull is
  // what makes this string honest.
  username: sql<string>`${userProfiles.username}`,
};

const toSummary = <T extends { username: string }>({
  username,
  ...deck
}: T) => ({ ...deck, owner: { username } });

const publishedSummaryColumns = {
  id: publishedDecks.deckId,
  title: publishedDecks.title,
  description: publishedDecks.description,
  noteType: publishedDecks.noteType,
  nativeLanguageId: publishedDecks.nativeLanguageId,
  targetLanguageId: publishedDecks.targetLanguageId,
  cardCount: publishedDecks.cardCount,
  updatedAt: sql<number>`(extract(epoch from ${publishedDecks.publishedAt}) * 1000)::double precision`,
  username: sql<string>`${userProfiles.username}`,
};

const publicGate = and(
  eq(userDecks.visibility, 'public'),
  isNull(userDecks.deletedAt),
);
const visibleSnapshot = eq(publishedDecks.moderationStatus, 'visible');
const liveOwner = and(
  eq(userProfiles.userId, userDecks.userId),
  isNull(userProfiles.deletedAt),
  isNotNull(userProfiles.username),
);

@Injectable()
export class SharingService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: AppDatabase,
    private readonly moderation: ModerationService,
    private readonly config: ConfigService,
  ) {}

  async publish(userId: string, deckId: string) {
    await this.ownedVisibility(userId, deckId);
    // Browse and preview join on the owner's username, so a deck published
    // by an account that never finished onboarding would be public and yet
    // invisible to everyone, its owner included. Refuse instead.
    if (!(await this.hasUsername(userId))) {
      throw new UnprocessableEntityException({
        reason: 'finish onboarding before publishing',
        flagged: [],
      });
    }

    // Publish exactly the snapshot checked, even if the live deck changes
    // during moderation. No transaction or scope lock spans the model call.
    const snapshot = await this.db.transaction(
      (tx) => this.readSnapshot(userId, deckId, tx),
      { isolationLevel: 'repeatable read', accessMode: 'read only' },
    );
    const verdict = await this.moderation.check({
      deckId,
      cards: snapshot.content.cards.map(({ id, front, back }) => ({
        id,
        front,
        back,
      })),
    });
    if (!verdict.ok) {
      throw new UnprocessableEntityException({
        reason: verdict.reason,
        flagged: verdict.flagged,
      });
    }

    await this.setVisibility(userId, deckId, 'public', snapshot, {
      flagged: [],
      warnings: verdict.warnings,
      results: verdict.results,
    });
    return { visibility: 'public' as const, warnings: verdict.warnings };
  }

  async unpublish(userId: string, deckId: string) {
    await this.setVisibility(userId, deckId, 'private');
    return { visibility: 'private' as const };
  }

  async importShared(userId: string, sourceId: string) {
    return this.db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(${syncScopeLockKey(userId).toString()})`,
      );
      const [source] = await tx
        .select({ snapshot: publishedDecks })
        .from(publishedDecks)
        .innerJoin(userDecks, eq(userDecks.id, publishedDecks.deckId))
        .where(
          and(eq(publishedDecks.deckId, sourceId), publicGate, visibleSnapshot),
        );
      if (!source) throw new NotFoundException('Deck not found');

      const { snapshot } = source;
      const deckId = randomUUID();
      const now = Date.now();
      const timestamps = { createdAt: now, updatedAt: now };
      await tx.insert(userDecks).values({
        id: deckId,
        userId,
        rev: sql`nextval('remelon_rev')`,
        visibility: 'private',
        title: snapshot.title,
        description: snapshot.description,
        noteType: snapshot.noteType,
        nativeLanguageId: snapshot.nativeLanguageId,
        targetLanguageId: snapshot.targetLanguageId,
        ...timestamps,
      });
      const noteIds = new Map(
        snapshot.content.notes.map((note) => [note.id, randomUUID()]),
      );
      // Each statement stays small even for large decks; all writes still
      // share the transaction and scope lock, so pull sees a complete copy.
      for (const note of snapshot.content.notes) {
        const id = noteIds.get(note.id)!;
        await tx.insert(userNotes).values({
          id,
          userId,
          rev: sql`nextval('remelon_rev')`,
          noteType: note.note_type,
          fieldsVersion: note.fields_version,
          fieldsJson: note.fields_json,
          additionalContent: note.additional_content,
          ...timestamps,
        });
        await tx.insert(userNoteDecks).values({
          id: noteDeckId(id, deckId),
          userId,
          rev: sql`nextval('remelon_rev')`,
          noteId: id,
          deckId,
          active: true,
          ...timestamps,
        });
      }
      for (const card of snapshot.content.cards) {
        const noteId = noteIds.get(card.note_id);
        if (!noteId) throw new Error('Published card has no note');
        await tx.insert(userCards).values({
          id: cardId(noteId, card.template_key),
          userId,
          rev: sql`nextval('remelon_rev')`,
          noteId,
          templateKey: card.template_key,
          active: true,
          front: card.front,
          back: card.back,
          dueAt: now,
          scheduledIntervalMinutes: 0,
          ...timestamps,
        });
      }
      return { deckId };
    });
  }

  async listShared(limit: number, offset: number) {
    const decks = await this.db
      .select(publishedSummaryColumns)
      .from(publishedDecks)
      .innerJoin(userDecks, eq(userDecks.id, publishedDecks.deckId))
      .innerJoin(userProfiles, liveOwner)
      .where(and(publicGate, visibleSnapshot))
      .orderBy(desc(publishedDecks.publishedAt), desc(publishedDecks.deckId))
      .limit(limit)
      .offset(offset);

    // Wrapped like every other controller here ({ job }, { jobs }, { quota })
    // rather than a bare array: the web parses one envelope shape.
    return { decks: decks.map(toSummary) };
  }

  async previewShared(userId: string, deckId: string) {
    const [published] = await this.db
      .select({ ...publishedSummaryColumns, content: publishedDecks.content })
      .from(publishedDecks)
      .innerJoin(userDecks, eq(userDecks.id, publishedDecks.deckId))
      .innerJoin(userProfiles, liveOwner)
      .where(
        and(eq(publishedDecks.deckId, deckId), publicGate, visibleSnapshot),
      );
    if (published) {
      const { content, ...summary } = published;
      return {
        deck: {
          ...toSummary(summary),
          cards: content.cards
            .slice(0, PREVIEW_CARDS)
            .map(({ front, back }) => ({ front, back })),
        },
      };
    }

    // Only the owner may preview the current unpublished working copy.
    const [deck] = await this.db
      .select(summaryColumns)
      .from(userDecks)
      .innerJoin(
        userProfiles,
        and(
          eq(userProfiles.userId, userDecks.userId),
          isNull(userProfiles.deletedAt),
          isNotNull(userProfiles.username),
        ),
      )
      .where(
        and(
          eq(userDecks.id, deckId),
          isNull(userDecks.deletedAt),
          eq(userDecks.userId, userId),
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

  async report(userId: string, deckId: string, reason: string) {
    const reportId = randomUUID();
    const maxDailyReports = Number(
      this.config.get<string>('MODERATION_MAX_DAILY_REPORTS_PER_USER') ?? 10,
    );
    const recheckWindowHours = Number(
      this.config.get<string>('MODERATION_RECHECK_WINDOW_HOURS') ?? 24,
    );

    return this.db.transaction(async (tx) => {
      // Serialize both quota reservations and per-deck enqueue decisions.
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext('deck_report_user_' || ${userId}))`,
      );
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext('deck_report_deck_' || ${deckId}))`,
      );

      const [published] = await tx
        .select({
          ownerId: publishedDecks.userId,
          publishedAt: publishedDecks.publishedAt,
          moderatedAt: publishedDecks.moderatedAt,
        })
        .from(publishedDecks)
        .innerJoin(userDecks, eq(userDecks.id, publishedDecks.deckId))
        .where(
          and(eq(publishedDecks.deckId, deckId), publicGate, visibleSnapshot),
        );
      if (!published) throw new NotFoundException('Deck not found');
      if (published.ownerId === userId) {
        throw new BadRequestException('You cannot report your own deck');
      }

      const [existing] = await tx
        .select({ id: deckReports.id })
        .from(deckReports)
        .where(
          and(
            eq(deckReports.reporterUserId, userId),
            eq(deckReports.deckId, deckId),
          ),
        );
      if (existing) throw new ConflictException('Deck already reported');

      const windowStart = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const [daily] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(deckReports)
        .where(
          and(
            eq(deckReports.reporterUserId, userId),
            gte(deckReports.createdAt, windowStart),
          ),
        );
      if (Number(daily?.count ?? 0) >= maxDailyReports) {
        throw new HttpException(
          `Daily deck report cap reached (max allowed: ${maxDailyReports})`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      const [report] = await tx
        .insert(deckReports)
        .values({
          id: reportId,
          deckId,
          reporterUserId: userId,
          reason,
          snapshotPublishedAt: published.publishedAt,
        })
        .returning();

      const cacheCutoff = new Date(
        Date.now() - recheckWindowHours * 60 * 60 * 1000,
      );
      if (published.moderatedAt && published.moderatedAt >= cacheCutoff) {
        return { report, recheck: 'cached' as const };
      }

      const [active] = await tx
        .select({ id: aiGenerationJobs.id })
        .from(aiGenerationJobs)
        .where(
          and(
            sql`${aiGenerationJobs.payload} ->> 'deckId' = ${deckId}`,
            eq(aiGenerationJobs.type, 'deck_moderation'),
            inArray(aiGenerationJobs.status, ['pending', 'processing']),
          ),
        );
      if (active) return { report, recheck: 'pending' as const };

      await tx.insert(aiGenerationJobs).values({
        id: randomUUID(),
        userId,
        type: 'deck_moderation',
        payload: {
          deckId,
          snapshotPublishedAt: published.publishedAt.toISOString(),
        },
      });
      return { report, recheck: 'queued' as const };
    });
  }

  async ownerModerationStatus(userId: string, deckId: string) {
    await this.ownedVisibility(userId, deckId);
    const [snapshot] = await this.db
      .select({
        status: publishedDecks.moderationStatus,
        verdict: publishedDecks.moderationVerdict,
        moderatedAt: publishedDecks.moderatedAt,
      })
      .from(publishedDecks)
      .where(
        and(
          eq(publishedDecks.deckId, deckId),
          eq(publishedDecks.userId, userId),
        ),
      );
    if (!snapshot) {
      return { status: 'clear' as const };
    }
    if (snapshot.status === 'visible') {
      const warnings = snapshot.verdict?.warnings ?? [];
      return warnings.length > 0
        ? { status: 'visible' as const, warnings }
        : { status: 'clear' as const };
    }
    return {
      status: 'blocked' as const,
      reason: snapshot.verdict?.reason,
      flagged: snapshot.verdict?.flagged ?? [],
      warnings: snapshot.verdict?.warnings ?? [],
      results: snapshot.verdict?.results ?? [],
      moderatedAt: snapshot.moderatedAt,
    };
  }

  async moderationExplanationInput(
    userId: string,
    deckId: string,
    cardIdToExplain: string,
    reason: string,
    source: 'working' | 'published',
  ) {
    await this.ownedVisibility(userId, deckId);

    // A takedown explains the immutable card that was actually classified,
    // even if the owner has since edited the working copy.
    if (source === 'published') {
      const [snapshot] = await this.db
        .select({
          content: publishedDecks.content,
          verdict: publishedDecks.moderationVerdict,
        })
        .from(publishedDecks)
        .where(
          and(
            eq(publishedDecks.deckId, deckId),
            eq(publishedDecks.userId, userId),
          ),
        );
      const isFinding = [
        ...(snapshot?.verdict?.flagged ?? []),
        ...(snapshot?.verdict?.warnings ?? []),
      ].some(
        (finding) =>
          finding.cardId === cardIdToExplain && finding.reason === reason,
      );
      const publishedCard = snapshot?.content.cards.find(
        (card) => card.id === cardIdToExplain,
      );
      if (!publishedCard || !isFinding) {
        throw new NotFoundException('Moderation finding not found');
      }
      return {
        cardId: publishedCard.id,
        front: publishedCard.front,
        back: publishedCard.back,
        reason,
      };
    }

    // A refused publish explains the current active card, not a possibly
    // older blocked snapshot retained from a previous publication.
    const card = (await this.deckCards(deckId)).find(
      ({ id }) => id === cardIdToExplain,
    );
    if (!card) throw new NotFoundException('Card not found');
    return {
      cardId: card.id,
      front: card.front,
      back: card.back,
      reason,
    };
  }

  async listReports(limit: number, offset: number) {
    const reports = await this.db
      .select({
        id: deckReports.id,
        deckId: deckReports.deckId,
        reporterUserId: deckReports.reporterUserId,
        reason: deckReports.reason,
        snapshotPublishedAt: deckReports.snapshotPublishedAt,
        createdAt: deckReports.createdAt,
        currentSnapshotPublishedAt: publishedDecks.publishedAt,
        moderationStatus: publishedDecks.moderationStatus,
        moderationVerdict: publishedDecks.moderationVerdict,
        moderatedAt: publishedDecks.moderatedAt,
      })
      .from(deckReports)
      .leftJoin(publishedDecks, eq(publishedDecks.deckId, deckReports.deckId))
      .orderBy(desc(deckReports.createdAt), desc(deckReports.id))
      .limit(limit)
      .offset(offset);
    return { reports };
  }

  async operatorTakedown(deckId: string, reason: string) {
    const verdict: StoredModerationVerdict = {
      reason,
      flagged: [],
      warnings: [],
      results: [],
    };
    const blocked = await this.blockPublishedSnapshot(
      deckId,
      verdict,
      'operator',
    );
    if (!blocked) throw new NotFoundException('Deck not found');
    return { status: 'blocked' as const };
  }

  private async blockPublishedSnapshot(
    deckId: string,
    verdict: StoredModerationVerdict,
    source: 'operator',
  ) {
    return this.db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext('deck_report_deck_' || ${deckId}))`,
      );
      const [snapshot] = await tx
        .select({
          userId: publishedDecks.userId,
          publishedAt: publishedDecks.publishedAt,
        })
        .from(publishedDecks)
        .innerJoin(userDecks, eq(userDecks.id, publishedDecks.deckId))
        .where(
          and(eq(publishedDecks.deckId, deckId), publicGate, visibleSnapshot),
        );
      if (!snapshot) return false;
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(${syncScopeLockKey(snapshot.userId).toString()})`,
      );
      const [lockedSnapshot] = await tx
        .select({ publishedAt: publishedDecks.publishedAt })
        .from(publishedDecks)
        .innerJoin(userDecks, eq(userDecks.id, publishedDecks.deckId))
        .where(
          and(eq(publishedDecks.deckId, deckId), publicGate, visibleSnapshot),
        );
      if (!lockedSnapshot) return false;

      const now = new Date();
      await tx
        .update(publishedDecks)
        .set({
          moderationStatus: 'blocked',
          moderationVerdict: verdict,
          moderatedAt: now,
        })
        .where(eq(publishedDecks.deckId, deckId));
      await tx.insert(deckTakedowns).values({
        id: randomUUID(),
        deckId,
        source,
        reason: verdict.reason,
        verdict,
        snapshotPublishedAt: lockedSnapshot.publishedAt,
      });
      await tx
        .update(userDecks)
        .set({
          visibility: 'private',
          rev: sql`nextval('remelon_rev')`,
          updatedAt: Date.now(),
        })
        .where(
          and(
            eq(userDecks.id, deckId),
            eq(userDecks.userId, snapshot.userId),
            isNull(userDecks.deletedAt),
          ),
        );
      return true;
    });
  }

  /** 404 rather than 403 for someone else's deck: 403 would confirm the id. */
  private async ownedVisibility(
    userId: string,
    deckId: string,
    db: Pick<AppDatabase, 'select'> = this.db,
  ) {
    const [deck] = await db
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

  private async hasUsername(userId: string) {
    const [profile] = await this.db
      .select({ username: userProfiles.username })
      .from(userProfiles)
      .where(
        and(
          eq(userProfiles.userId, userId),
          isNull(userProfiles.deletedAt),
          isNotNull(userProfiles.username),
        ),
      );
    return profile !== undefined;
  }

  private async setVisibility(
    userId: string,
    deckId: string,
    visibility: 'public' | 'private',
    snapshot?: typeof publishedDecks.$inferInsert,
    moderationVerdict?: StoredModerationVerdict,
  ) {
    await this.db.transaction(async (tx) => {
      // The same lock push takes, so a visibility write cannot interleave
      // with the owner's own changes to the deck.
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(${syncScopeLockKey(userId).toString()})`,
      );
      const current = await this.ownedVisibility(userId, deckId, tx);
      if (snapshot) {
        const values = {
          ...snapshot,
          moderationStatus: 'visible' as const,
          moderationVerdict: moderationVerdict ?? null,
          moderatedAt: null,
          publishedAt: new Date(),
        };
        await tx.insert(publishedDecks).values(values).onConflictDoUpdate({
          target: publishedDecks.deckId,
          set: values,
        });
      } else {
        await tx
          .delete(publishedDecks)
          .where(eq(publishedDecks.deckId, deckId));
        if (current === 'private') return;
      }
      const written = await tx
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
        )
        .returning({ id: userDecks.id });
      // If a non-sync deletion removes the deck, roll back the snapshot too.
      if (written.length === 0) throw new NotFoundException('Deck not found');
    });
  }

  private async readSnapshot(
    userId: string,
    deckId: string,
    db: Pick<AppDatabase, 'select'>,
  ) {
    const [deck] = await db
      .select({
        deckId: userDecks.id,
        userId: userDecks.userId,
        title: userDecks.title,
        description: userDecks.description,
        noteType: userDecks.noteType,
        nativeLanguageId: userDecks.nativeLanguageId,
        targetLanguageId: userDecks.targetLanguageId,
      })
      .from(userDecks)
      .where(
        and(
          eq(userDecks.id, deckId),
          eq(userDecks.userId, userId),
          isNull(userDecks.deletedAt),
        ),
      );
    if (!deck) throw new NotFoundException('Deck not found');
    const rows = await this.deckCards(deckId, undefined, db);
    const notes = new Map<string, PublishedContent['notes'][number]>();
    const cards = rows.map(({ note, ...card }) => {
      if (!notes.has(note.id)) {
        const fields = z
          .record(z.string(), z.unknown())
          .parse(JSON.parse(note.fields_json));
        delete fields.image;
        delete fields.word_audio;
        notes.set(note.id, { ...note, fields_json: JSON.stringify(fields) });
      }
      return card;
    });
    return {
      ...deck,
      cardCount: cards.length,
      content: { notes: [...notes.values()], cards },
    };
  }

  /** The deck's active cards, already rendered by the client that pushed them. */
  private async deckCards(
    deckId: string,
    limit?: number,
    db: Pick<AppDatabase, 'select'> = this.db,
  ) {
    const query = db
      .select({
        id: userCards.id,
        note_id: userCards.noteId,
        template_key: userCards.templateKey,
        front: userCards.front,
        back: userCards.back,
        note: {
          id: userNotes.id,
          note_type: userNotes.noteType,
          fields_version: userNotes.fieldsVersion,
          fields_json: userNotes.fieldsJson,
          additional_content: userNotes.additionalContent,
        },
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

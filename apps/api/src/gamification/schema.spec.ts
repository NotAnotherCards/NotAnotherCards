import { getTableConfig } from 'drizzle-orm/pg-core';
import { badgeAwards, dailyChallengeCompletions } from './schema';

describe('gamification persistence schema', () => {
  it('uniquely identifies one badge award per user and code', () => {
    const config = getTableConfig(badgeAwards);
    expect(config.primaryKeys.map((key) => key.getName())).toEqual([
      'badge_awards_user_code_pk',
    ]);
    expect(config.checks.map((constraint) => constraint.name)).toEqual([
      'badge_awards_code_check',
    ]);
  });

  it('uniquely identifies one challenge completion per UTC date', () => {
    const config = getTableConfig(dailyChallengeCompletions);
    expect(config.primaryKeys.map((key) => key.getName())).toEqual([
      'daily_challenge_completions_user_code_date_pk',
    ]);
    expect(config.checks.map((constraint) => constraint.name)).toEqual([
      'daily_challenge_completions_code_check',
    ]);
    expect(dailyChallengeCompletions.utcDate.getSQLType()).toBe('date');
  });
});

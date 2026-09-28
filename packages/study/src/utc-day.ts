export const MILLISECONDS_PER_DAY = 86_400_000;

export interface UtcDay {
  readonly key: string;
  readonly ordinal: number;
}

export function utcDayAt(timestamp: number): UtcDay {
  return {
    key: new Date(timestamp).toISOString().slice(0, 10),
    ordinal: Math.floor(timestamp / MILLISECONDS_PER_DAY),
  };
}

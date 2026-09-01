// One definition for Better Auth's additional user fields, shared by the
// runtime config (auth.service.ts) and the CLI schema config
// (auth-config.ts) so the two cannot drift.
export const userAdditionalFields = {
  timezone: {
    type: 'string',
    required: false,
    defaultValue: 'UTC',
  },
  onBoardingComplete: {
    type: 'boolean',
    required: false,
    // Server-owned: only the /onboard transaction may set this. Without
    // input: false, Better Auth accepts the field from the signup body.
    input: false,
    defaultValue: false,
  },
} as const;

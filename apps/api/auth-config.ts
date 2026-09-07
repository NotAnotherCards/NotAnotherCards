import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { drizzle } from 'drizzle-orm/node-postgres';
import { twoFactor } from 'better-auth/plugins';
import 'dotenv/config';
import { userAdditionalFields } from './src/auth/auth-fields';

// Only used by the better-auth CLI to generate src/database/schema.ts,
// never actually connects to a db. If the api adds better-auth plugins
// they need to be mirrored here and the schema regenerated (see README).
const db = drizzle(process.env.DATABASE_URL!);

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg' }),
  user: {
    additionalFields: userAdditionalFields,
  },
  plugins: [
    twoFactor({
      issuer: 'NotAnotherCards',
      skipVerificationOnEnable: false,
      allowPasswordless: false,
      accountLockout: {
        enabled: true,
        maxFailedAttempts: 5,
        durationSeconds: 300,
      },
      backupCodeOptions: {
        storeBackupCodes: 'encrypted',
        amount: 10,
      },
    }),
  ],
});

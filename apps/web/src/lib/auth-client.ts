import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: "http://localhost:3000",
  plugins: [
    inferAdditionalFields({
      user: {
        timezone: {
          type: "string",
          required: false,
          defaultValue: "UTC",
        },
      },
    }),
  ],
});

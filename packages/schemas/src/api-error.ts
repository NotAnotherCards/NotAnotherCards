import z from 'zod';

/**
 * The one field the clients read from an API error body. Any body that is
 * not an object with a string `message` (null, HTML, an empty response)
 * parses to `{}`, so `parse` never throws and callers keep their own
 * fallback text: `apiErrorBodySchema.parse(body).message || 'Failed to save'`.
 */
export const apiErrorBodySchema = z
  .object({ message: z.string() })
  .partial()
  .catch({});

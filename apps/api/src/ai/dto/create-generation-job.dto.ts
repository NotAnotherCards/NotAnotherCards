// The job schema is shared with the clients; one list of gateway aliases.
export {
  AI_MODELS,
  createAiJobSchema,
  type AiModel,
  type CreateAiJobInput,
} from '@repo/schemas';
import type { CreateAiJobInput } from '@repo/schemas';

export type CreateGenerationJobDto = CreateAiJobInput;

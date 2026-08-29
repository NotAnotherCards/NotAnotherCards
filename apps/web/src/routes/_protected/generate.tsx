import { AiGenerationPlaygroundComponent } from '@/components/ai/AiGenerationPlaygroundComponent';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_protected/generate')({
  component: AiGenerationPlaygroundComponent,
});

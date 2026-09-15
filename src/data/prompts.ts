import { PROMPT_DEFINITIONS, type PromptDefinition } from '../../shared/prompts';

export type Prompt = PromptDefinition;
export const PROMPTS: Prompt[] = PROMPT_DEFINITIONS;

export function pickPromptIndex(used: number[]): number {
  const available = PROMPTS.map((_, index) => index).filter((index) => !used.includes(index));
  const pool = available.length > 0 ? available : PROMPTS.map((_, index) => index);
  return pool[Math.floor(Math.random() * pool.length)];
}

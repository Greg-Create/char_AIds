export interface Prompt {
  id: string;
  label: string;
  emoji: string;
  color: string;
}

/** Placeholder charades prompts. Swap for a real prompt bank / API later. */
export const PROMPTS: Prompt[] = [
  { id: 'dinosaur', label: 'Dinosaur', emoji: '🦖', color: '#4ADE80' },
  { id: 'michael-jackson', label: 'Michael Jackson', emoji: '🕺', color: '#FF6BB5' },
  { id: 'astronaut', label: 'Astronaut', emoji: '🧑‍🚀', color: '#38BDF8' },
  { id: 'baby', label: 'Baby', emoji: '👶', color: '#FFD93D' },
  { id: 'pirate', label: 'Pirate', emoji: '🏴‍☠️', color: '#FF8A3D' },
  { id: 'superhero', label: 'Superhero', emoji: '🦸', color: '#A78BFA' },
  { id: 'grandma', label: 'Grandma', emoji: '👵', color: '#4ADE80' },
  { id: 'rock-star', label: 'Rock Star', emoji: '🎸', color: '#FF6BB5' },
  { id: 'chicken', label: 'Chicken', emoji: '🐔', color: '#38BDF8' },
  { id: 'zombie', label: 'Zombie', emoji: '🧟', color: '#FFD93D' },
  { id: 'taylor-swift', label: 'Taylor Swift', emoji: '🎤', color: '#FF8A3D' },
  { id: 'monkey', label: 'Monkey', emoji: '🐒', color: '#A78BFA' },
];

/** Pick a random prompt index, avoiding recently used ones when possible. */
export function pickPromptIndex(used: number[]): number {
  const available = PROMPTS.map((_, i) => i).filter((i) => !used.includes(i));
  const pool = available.length > 0 ? available : PROMPTS.map((_, i) => i);
  return pool[Math.floor(Math.random() * pool.length)];
}

export function generateGameCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return code;
}

export interface PromptDefinition {
  id: string;
  label: string;
  emoji: string;
  color: string;
}

export const PROMPT_DEFINITIONS: PromptDefinition[] = [
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

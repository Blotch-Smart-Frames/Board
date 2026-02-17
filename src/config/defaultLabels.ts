type DefaultLabel = {
  name: string;
  emoji: string;
  color: string;
};

export const defaultLabels: DefaultLabel[] = [
  { name: 'Hot', emoji: '🔥', color: '#EF4444' },
  { name: 'Urgent', emoji: '⚡', color: '#F59E0B' },
  { name: 'Idea', emoji: '💡', color: '#FBBF24' },
  { name: 'Favorite', emoji: '⭐', color: '#3B82F6' },
  { name: 'Watching', emoji: '👀', color: '#8B5CF6' },
  { name: 'Important', emoji: '📌', color: '#EC4899' },
];

export const labelColors = [
  '#EF4444', // red
  '#F97316', // orange
  '#F59E0B', // amber
  '#FBBF24', // yellow
  '#84CC16', // lime
  '#22C55E', // green
  '#14B8A6', // teal
  '#06B6D4', // cyan
  '#0EA5E9', // sky
  '#3B82F6', // blue
  '#6366F1', // indigo
  '#8B5CF6', // violet
  '#A855F7', // purple
  '#D946EF', // fuchsia
  '#EC4899', // pink
  '#F43F5E', // rose
];

/**
 * Deterministic hash-to-color function for community avatars.
 * Returns both background and text color for maximum flexibility.
 */
export function stringToColor(str: string): { bg: string; text: string } {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return {
    bg: `hsl(${hue}, 65%, 45%)`,
    text: '#ffffff',
  };
}

/** Extract 1-2 character initials from a community name. */
export function getCommunityInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() || '')
    .join('');
}

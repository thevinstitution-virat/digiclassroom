/**
 * Parses a YouTube video ID from various URL formats.
 *
 * Supports:
 * - youtu.be/ID
 * - youtube.com/watch?v=ID
 * - youtube.com/embed/ID
 * - youtube.com/v/ID
 * - youtube.com/shorts/ID
 * - Raw 11-character video IDs
 *
 * @param url The YouTube URL or raw video ID
 * @returns The 11-character video ID, or null if parsing fails
 */
export function parseYouTubeVideoId(url: string): string | null {
  if (!url) return null;

  // If it's already an 11-character ID, just return it
  if (/^[a-zA-Z0-9_-]{11}$/.test(url)) {
    return url;
  }

  // Regex to extract video ID from common YouTube URL formats
  const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
  const match = url.match(regex);

  if (match && match[1]) {
    return match[1];
  }

  return null;
}

/**
 * Format seconds into mm:ss or hh:mm:ss
 */
export function formatSeconds(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

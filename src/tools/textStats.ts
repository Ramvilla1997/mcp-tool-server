const WORDS_PER_MINUTE = 220;

export interface TextStats {
  words: number;
  sentences: number;
  characters: number;
  readingMinutes: number;
}

export function computeTextStats(text: string): TextStats {
  const words = text.split(/\s+/).filter(Boolean).length;
  const sentences = text
    .split(/[.!?]+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean).length;

  return {
    words,
    sentences,
    characters: [...text].length,
    readingMinutes: Number((words / WORDS_PER_MINUTE).toFixed(1)),
  };
}

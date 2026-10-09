/// <reference lib="es2022.intl" />

const sentenceSegmenter = new Intl.Segmenter("en", { granularity: "sentence" });

/** Preserve the wording of saved prose while exposing individual detail points. */
export function planDetailPoints(detail: string): string[] {
  return detail
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      const bullet = line.match(/^(?:[-*•]|\d+[.)])\s+(.+)$/);
      if (bullet) return [bullet[1]!];
      return Array.from(sentenceSegmenter.segment(line), ({ segment }) => segment.trim());
    });
}

/** Original catalog values remain available for provenance and comparisons. */
export const originalTitle = (name: string) => name;

/** Casing only: do not rename historical events or guess campaign spellings. */
export function displayTitle(name: string) {
  return name
    .replace(/^phỏng vấn\b/iu, "Phỏng vấn")
    .replace(/\bFIRST MEETING\b/g, "First Meeting")
    .replace(/\bGEN\b/g, "Gen");
}

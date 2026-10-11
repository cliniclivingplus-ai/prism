// Turns a pasted block of text into separate list items.
//
// A coach writes a checklist somewhere else — a document, a message, their
// notes — and pastes the whole thing in. Whatever markers came with it
// (1., 2), -, •, *) are the list's formatting, not part of the item, so
// they are stripped. The text itself is never otherwise altered.
export function splitPastedList(text: string): string[] {
  return (text || '')
    .split(/\r?\n/)
    // A list pasted as one line, separated by bullets, still reads as a list.
    .flatMap((line) => (/\s[•·]\s/.test(line) ? line.split(/\s*[•·]\s+/) : [line]))
    .map((line) =>
      line
        // Leading bullet or number: "1." "2)" "-" "–" "*" "•"
        .replace(/^\s*(?:[-*–—•·▪◦]|\(?\d{1,3}[.)])\s+/, '')
        .replace(/^\s*(?:[-*–—•·▪◦])\s*/, '')
        .trim()
    )
    .filter(Boolean)
}

// True when a paste should become several items rather than land in one box.
export function isMultiItemPaste(text: string): boolean {
  return splitPastedList(text).length > 1
}

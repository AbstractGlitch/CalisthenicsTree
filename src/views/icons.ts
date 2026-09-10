/** Inline nav icons. Stroked paths on currentColor, matching magnetic-practice. */
const wrap = (paths: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
     stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

export const ICON = {
  today: wrap('<path d="M3 12l2-2 7-7 7 7 2 2"/><path d="M5 10v10h14V10"/>'),
  // A branching tree growing upward. Deliberately not three nodes joined by two edges,
  // which is the universally recognised "share" glyph.
  tree: wrap('<path d="M12 21v-4M12 17L6 12M12 17l6-5M6 12V8M18 12V8"/><circle cx="6" cy="6" r="2"/><circle cx="18" cy="6" r="2"/>'),
  history: wrap('<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>'),
  settings: wrap('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1"/>'),
} as const;

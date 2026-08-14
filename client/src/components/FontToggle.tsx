import { useEffect, useState } from "react";

// Two-position font toggle, always visible bottom-right.
//   "a" → Hyperlegible preset (default — max readability)
//   "A" → Editorial preset    (Playfair display + Inter body, magazine feel)
//
// Each button's glyph is rendered in its own preset so users see a live
// preview of the font behind it. Choice persists across reloads.

type FontMode = "hyperlegible" | "editorial";

const STORAGE_KEY = "cacti-font-toggle";
const LEGACY_STORAGE_KEY = "cacti-font-preset"; // D2 debug picker — clean up on first mount

const PRESETS: Record<FontMode, { display: string; body: string; mono: string }> = {
  hyperlegible: {
    display: "'Atkinson Hyperlegible', sans-serif",
    body: "'Atkinson Hyperlegible', sans-serif",
    mono: "'JetBrains Mono', monospace",
  },
  editorial: {
    display: "'Playfair Display', Georgia, serif",
    body: "'Inter', sans-serif",
    mono: "'JetBrains Mono', monospace",
  },
};

function applyPreset(mode: FontMode) {
  const root = document.documentElement;
  const p = PRESETS[mode];
  root.style.setProperty("--font-display", p.display);
  root.style.setProperty("--font-body", p.body);
  root.style.setProperty("--font-mono", p.mono);
}

function readSavedMode(): FontMode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === "editorial" ? "editorial" : "hyperlegible";
  } catch {
    return "hyperlegible";
  }
}

export function FontToggle() {
  const [mode, setMode] = useState<FontMode>(readSavedMode);

  // One-time cleanup of the D2 debug picker's old key.
  useEffect(() => {
    try {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    applyPreset(mode);
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      /* ignore */
    }
  }, [mode]);

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex rounded-full border border-border bg-background/95 backdrop-blur shadow-lg overflow-hidden"
      role="group"
      aria-label="Font style"
    >
      <button
        onClick={() => setMode("hyperlegible")}
        className={`h-10 w-10 flex items-center justify-center text-lg leading-none transition-colors ${
          mode === "hyperlegible"
            ? "bg-primary/20 text-primary"
            : "text-muted-foreground hover:bg-muted/40"
        }`}
        style={{ fontFamily: "'Atkinson Hyperlegible', sans-serif" }}
        aria-pressed={mode === "hyperlegible"}
        aria-label="Hyperlegible — maximum readability"
        title="Hyperlegible — maximum readability"
      >
        a
      </button>
      <button
        onClick={() => setMode("editorial")}
        className={`h-10 w-10 flex items-center justify-center text-lg leading-none transition-colors ${
          mode === "editorial"
            ? "bg-primary/20 text-primary"
            : "text-muted-foreground hover:bg-muted/40"
        }`}
        style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
        aria-pressed={mode === "editorial"}
        aria-label="Editorial — Playfair headings, Inter body"
        title="Editorial — Playfair headings, Inter body"
      >
        A
      </button>
    </div>
  );
}

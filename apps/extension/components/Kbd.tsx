import { For } from "solid-js";

const isMac = navigator.platform?.includes("Mac") || navigator.userAgent?.includes("Mac");

const SYMBOL_MAP: Record<string, string> = {
  "Command": "⌘",
  "Cmd": "⌘",
  "⌘": "⌘",
  "Ctrl": isMac ? "⌃" : "Ctrl",
  "Control": isMac ? "⌃" : "Ctrl",
  "Shift": "⇧",
  "⇧": "⇧",
  "Alt": isMac ? "⌥" : "Alt",
  "Option": "⌥",
  "⌥": "⌥",
  "Enter": "⏎",
  "Return": "⏎",
  "Backspace": "⌫",
  "Delete": "⌦",
  "Escape": "Esc",
  "Tab": "⇥",
  "Space": "␣",
  "Up": "↑",
  "Down": "↓",
  "Left": "←",
  "Right": "→",
};

function parseShortcut(shortcut: string): string[] {
  // Chrome returns shortcuts like "⌘⇧S" or "Ctrl+Shift+S"
  // Split on + if present, otherwise try to parse symbol sequences
  if (shortcut.includes("+")) {
    return shortcut.split("+").map((k) => k.trim());
  }
  // Parse symbol-based shortcuts (e.g. "⌘⇧S")
  const keys: string[] = [];
  let remaining = shortcut;
  const symbols = ["⌘", "⇧", "⌥", "⌃"];
  for (const sym of symbols) {
    if (remaining.includes(sym)) {
      keys.push(sym);
      remaining = remaining.replace(sym, "");
    }
  }
  if (remaining.trim()) {
    keys.push(remaining.trim());
  }
  return keys;
}

function formatKey(key: string): string {
  return SYMBOL_MAP[key] || key;
}

interface KbdProps {
  shortcut: string;
}

export default function Kbd(props: KbdProps) {
  const keys = () => parseShortcut(props.shortcut).map(formatKey);

  return (
    <span class="inline-flex items-center gap-0.5">
      <For each={keys()}>
        {(key) => (
          <kbd class="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 text-xs font-medium text-muted-foreground bg-muted/50 rounded">
            {key}
          </kbd>
        )}
      </For>
    </span>
  );
}

function PaneIcon({ count }: { count: 1 | 2 | 3 | 4 }) {
  if (count === 1) {
    return (
      <svg viewBox="0 0 20 14" aria-hidden>
        <rect x="1.2" y="1.2" width="17.6" height="11.6" rx="1.2" />
      </svg>
    );
  }
  if (count === 2) {
    return (
      <svg viewBox="0 0 20 14" aria-hidden>
        <rect x="1.2" y="1.2" width="8" height="11.6" rx="1" />
        <rect x="10.8" y="1.2" width="8" height="11.6" rx="1" />
      </svg>
    );
  }
  if (count === 3) {
    return (
      <svg viewBox="0 0 20 14" aria-hidden>
        <rect x="1.2" y="1.2" width="8" height="11.6" rx="1" />
        <rect x="10.8" y="1.2" width="8" height="5.2" rx="1" />
        <rect x="10.8" y="7.6" width="8" height="5.2" rx="1" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 20 14" aria-hidden>
      <rect x="1.2" y="1.2" width="8" height="5.2" rx="1" />
      <rect x="10.8" y="1.2" width="8" height="5.2" rx="1" />
      <rect x="1.2" y="7.6" width="8" height="5.2" rx="1" />
      <rect x="10.8" y="7.6" width="8" height="5.2" rx="1" />
    </svg>
  );
}

function FocusIcon() {
  return (
    <svg viewBox="0 0 20 14" aria-hidden>
      <rect x="1.2" y="1.2" width="17.6" height="7.2" rx="1" />
      <rect x="1.2" y="9.4" width="5" height="3.4" rx="0.8" />
      <rect x="7.5" y="9.4" width="5" height="3.4" rx="0.8" />
      <rect x="13.8" y="9.4" width="5" height="3.4" rx="0.8" />
    </svg>
  );
}

export function LayoutDock({
  selectedCount,
  availableCount,
  layoutMode,
  onSetCount,
  onSetMode,
}: {
  selectedCount: number;
  availableCount: number;
  layoutMode: "grid" | "focus";
  onSetCount: (count: number) => void;
  onSetMode: (mode: "grid" | "focus") => void;
}) {
  return (
    <div
      className="nr-layout-dock"
      role="toolbar"
      aria-label="Disposition des écrans"
      data-testid="layout-dock"
    >
      {([1, 2, 3, 4] as const).map((count) => (
        <button
          type="button"
          key={count}
          className={`nr-layout-icon ${selectedCount === count ? "is-selected" : ""}`}
          aria-label={`${count} écran${count > 1 ? "s" : ""}`}
          aria-pressed={selectedCount === count}
          data-testid={`layout-count-${count}`}
          disabled={availableCount < count}
          onClick={() => onSetCount(count)}
        >
          <PaneIcon count={count} />
        </button>
      ))}
      <i className="nr-layout-split" aria-hidden />
      <button
        type="button"
        className={`nr-layout-icon ${layoutMode === "grid" ? "is-selected" : ""}`}
        aria-label="Disposition en grille"
        aria-pressed={layoutMode === "grid"}
        data-testid="layout-mode-grid"
        onClick={() => onSetMode("grid")}
      >
        <PaneIcon count={4} />
      </button>
      <button
        type="button"
        className={`nr-layout-icon ${layoutMode === "focus" ? "is-selected" : ""}`}
        aria-label="Mode focus"
        aria-pressed={layoutMode === "focus"}
        data-testid="layout-mode-focus"
        disabled={selectedCount < 2}
        onClick={() => onSetMode("focus")}
      >
        <FocusIcon />
      </button>
    </div>
  );
}

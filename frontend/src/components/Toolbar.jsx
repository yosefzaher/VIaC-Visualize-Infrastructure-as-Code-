/**
 * VIaC – Deployment Toolbar
 *
 * Plan / Apply / Destroy action buttons.
 */

export default function Toolbar({ onPlan, onApply, onDestroy, onDownload, loading, action, hasErrors }) {
  return (
    <div className="h-12 bg-viac-panel border-b border-viac-border flex items-center justify-between px-4">
      {/* ── Left: Title ──────────────────────────── */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#1a8cdb" }}>
          Deployment
        </span>
        {hasErrors && !loading && (
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/15 border border-red-500/25">
            <span className="text-[10px] text-red-400 font-semibold">⛔ Validation errors</span>
          </div>
        )}
        {loading && (
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "#1a8cdb", borderTopColor: "transparent" }} />
            <span className="text-xs animate-pulse capitalize" style={{ color: "#1a8cdb" }}>
              {action}ing...
            </span>
          </div>
        )}
      </div>

      {/* ── Right: Action Buttons ────────────────── */}
      <div className="flex items-center gap-2">
        <button
          onClick={onDownload}
          disabled={loading}
          className="px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-150 border border-viac-border text-viac-muted hover:text-viac-text disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ↓ Download .tf
        </button>

        <button
          onClick={onPlan}
          disabled={loading}
          className="px-4 py-1.5 rounded-md text-xs font-semibold transition-all duration-150
                     border disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background: "rgba(26, 140, 219, 0.12)",
            color: "#1a8cdb",
            borderColor: "rgba(26, 140, 219, 0.3)",
          }}
          onMouseEnter={(e) => { e.target.style.background = "rgba(26, 140, 219, 0.22)"; e.target.style.borderColor = "rgba(26, 140, 219, 0.5)"; }}
          onMouseLeave={(e) => { e.target.style.background = "rgba(26, 140, 219, 0.12)"; e.target.style.borderColor = "rgba(26, 140, 219, 0.3)"; }}
        >
          ▶ Plan
        </button>

        <button
          onClick={onApply}
          disabled={loading}
          className="px-4 py-1.5 rounded-md text-xs font-semibold transition-all duration-150
                     bg-emerald-500/15 text-emerald-400 border border-emerald-500/30
                     hover:bg-emerald-500/25 hover:border-emerald-500/50
                     disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ⬆ Apply
        </button>

        <button
          onClick={onDestroy}
          disabled={loading}
          className="px-4 py-1.5 rounded-md text-xs font-semibold transition-all duration-150
                     bg-red-500/10 text-red-400 border border-red-500/20
                     hover:bg-red-500/20 hover:border-red-500/40
                     disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ✕ Destroy
        </button>
      </div>
    </div>
  );
}

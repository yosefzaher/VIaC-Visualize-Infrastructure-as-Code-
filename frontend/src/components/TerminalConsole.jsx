/**
 * VIaC – Terminal Console
 *
 * Dark terminal-style panel displaying terraform operation logs.
 */

import { useEffect, useRef, useState } from "react";

const LOG_COLORS = {
  info: "text-blue-400",
  stdout: "text-slate-300",
  stderr: "text-amber-400",
  success: "text-emerald-400",
  error: "text-red-400",
  output: "text-cyan-400",
};

export default function TerminalConsole({ logs, onClear }) {
  const [isOpen, setIsOpen] = useState(true);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div
      className="bg-viac-navy border-t border-viac-border flex flex-col transition-all duration-200"
      style={{ height: isOpen ? 200 : 32 }}
    >
      {/* ── Header ───────────────────────────────── */}
      <div
        className="h-8 flex items-center justify-between px-3 border-b border-viac-border cursor-pointer shrink-0"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-viac-electric">▸</span>
          <span className="text-[11px] font-semibold text-viac-muted uppercase tracking-wider">
            Terminal
          </span>
          {logs.length > 0 && (
            <span className="text-[10px] text-viac-muted/60">
              ({logs.length} lines)
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {logs.length > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); onClear?.(); }}
              className="text-[10px] text-viac-muted hover:text-viac-text transition-colors"
            >
              Clear
            </button>
          )}
          <span className="text-viac-muted text-xs">{isOpen ? "▾" : "▴"}</span>
        </div>
      </div>

      {/* ── Log content ──────────────────────────── */}
      {isOpen && (
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-2 font-mono text-[11px] leading-relaxed">
          {logs.length === 0 ? (
            <p className="text-viac-muted/40 italic">Waiting for deployment actions...</p>
          ) : (
            logs.map((log, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-viac-muted/30 shrink-0 select-none">{log.timestamp}</span>
                <pre className={`whitespace-pre-wrap break-all ${LOG_COLORS[log.type] || "text-slate-400"}`}>
                  {log.message}
                </pre>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

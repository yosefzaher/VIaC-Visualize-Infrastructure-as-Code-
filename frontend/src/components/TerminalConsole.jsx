/**
 * VIaC – Terminal Console
 *
 * Dark terminal-style panel displaying terraform operation logs.
 */

import { useEffect, useRef, useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { tomorrow } from "react-syntax-highlighter/dist/esm/styles/prism";

const LOG_COLORS = {
  info: "text-blue-400",
  stdout: "text-slate-300",
  stderr: "text-amber-400",
  success: "text-emerald-400",
  error: "text-red-400",
  output: "text-cyan-400",
};

export default function TerminalConsole({ logs, onClear, hcl = "" }) {
  const [isOpen, setIsOpen] = useState(true);
  const [tab, setTab] = useState("terminal"); // 'terminal' | 'hcl'
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
      <div onClick={() => setIsOpen(!isOpen)} className="h-8 flex items-center justify-between px-3 border-b border-viac-border shrink-0">
        <div className="flex items-center gap-2">
          <button onClick={(e) => { e.stopPropagation(); setTab("terminal"); }} className={`text-[11px] font-semibold uppercase tracking-wider px-2 ${tab === "terminal" ? "text-viac-text" : "text-viac-muted"}`}>
            Terminal
          </button>
          <button onClick={(e) => { e.stopPropagation(); setTab("hcl"); }} className={`text-[11px] font-semibold uppercase tracking-wider px-2 ${tab === "hcl" ? "text-viac-text" : "text-viac-muted"}`}>
            HCL Code
          </button>
          {tab === "terminal" && logs.length > 0 && (
            <span className="text-[10px] text-viac-muted/60">({logs.length} lines)</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {tab === "terminal" && logs.length > 0 && (
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
          {tab === "terminal" ? (
            (logs.length === 0 ? (
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
            ))
          ) : (
            <div className="w-full">
              {hcl ? (
                <SyntaxHighlighter language="hcl" style={tomorrow} customStyle={{ margin: 0, borderRadius: 6 }}>
                  {hcl}
                </SyntaxHighlighter>
              ) : (
                <p className="text-viac-muted/40 italic">No HCL preview available. Click "Download .tf" to render.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

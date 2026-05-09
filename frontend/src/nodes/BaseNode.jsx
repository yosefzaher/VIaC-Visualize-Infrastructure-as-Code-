/**
 * VIaC – Base Node Component
 *
 * Shared shell used by all resource-specific nodes.
 * Provides: colored top stripe, icon, label, handles, selection glow,
 * and a delete button that appears on hover/selection.
 */

import { Handle, Position, useReactFlow } from "@xyflow/react";
import NODE_CONFIG from "../config/nodeConfig";

export default function BaseNode({ id, data, selected, children }) {
  const resourceType = data?.resourceType;
  const config = NODE_CONFIG[resourceType] || {};
  const IconComp = config.iconComponent;
  const hasError = data?._validationError;
  const color = hasError ? "#ef4444" : config.color || "#64748b";
  const label = data?.properties?.name || data?.label || config.label || id;
  const { deleteElements } = useReactFlow();

  const handleDelete = (e) => {
    e.stopPropagation();
    deleteElements({ nodes: [{ id }] });
  };

  return (
    <div
      className="group relative rounded-lg border transition-all duration-200 min-w-[180px]"
      style={{
        background: "var(--color-viac-card)",
        borderColor: hasError
          ? "#ef4444"
          : selected
          ? color
          : "var(--color-viac-border)",
        borderWidth: hasError ? 2 : 1,
        boxShadow: selected
          ? `0 0 20px ${color}40, 0 0 40px ${color}15`
          : hasError
          ? "0 0 12px rgba(239, 68, 68, 0.2)"
          : "0 2px 8px rgba(0,0,0,0.3)",
      }}
    >
      {/* ── Delete button (appears on hover or selection) ──── */}
      <button
        onClick={handleDelete}
        className="absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center
                   bg-red-500/80 text-white text-[10px] font-bold
                   opacity-0 group-hover:opacity-100 transition-opacity duration-150
                   hover:bg-red-500 hover:scale-110 z-10 cursor-pointer shadow-lg"
        style={{ opacity: selected ? 1 : undefined }}
        title="Delete node"
      >
        ✕
      </button>

      {/* ── Color stripe ─────────────────────────── */}
      <div
        className="h-1 rounded-t-lg"
        style={{ background: color }}
      />

      {/* ── Header ───────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 py-2">
        {IconComp && (
          <div style={{ color }} className="shrink-0">
            <IconComp size={20} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-medium uppercase tracking-wider" style={{ color }}>
            {config.label}
          </div>
          <div className="text-xs font-semibold text-viac-text truncate">
            {label}
          </div>
        </div>
        {hasError && (
          <div className="w-4 h-4 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
            <span className="text-red-400 text-[9px] font-bold">!</span>
          </div>
        )}
      </div>

      {/* ── Body (slot for resource-specific content) */}
      {children && (
        <div className="px-3 pb-2 text-[11px] text-viac-muted">
          {children}
        </div>
      )}

      {/* ── Validation error message ────────────── */}
      {hasError && data?._errorMessage && (
        <div className="px-3 pb-2">
          <span className="text-[9px] text-red-400 font-semibold">
            ⛔ {data._errorMessage}
          </span>
        </div>
      )}

      {/* ── Handles ──────────────────────────────── */}
      {config.handles?.target !== false && (
        <Handle
          type="target"
          position={Position.Top}
          className="!bg-viac-slate"
        />
      )}
      {config.handles?.source !== false && (
        <Handle
          type="source"
          position={Position.Bottom}
          className="!bg-viac-slate"
        />
      )}
    </div>
  );
}

/**
 * VIaC – Region Node (Group/Container)
 *
 * A large, resizable container that acts as a parent for VPCs.
 * Uses React Flow's group node pattern.
 */

import { Handle, Position, NodeResizer } from "@xyflow/react";
import { RegionIcon } from "../components/icons/AwsIcons";

export default function RegionNode({ id, data, selected }) {
  const label = data?.properties?.label || data?.label || "us-east-1";
  const color = "var(--color-node-region)";

  return (
    <>
      <NodeResizer
        minWidth={500}
        minHeight={350}
        isVisible={selected}
        lineStyle={{ borderColor: color }}
        handleStyle={{ background: color, width: 8, height: 8 }}
      />

      <div
        className="w-full h-full rounded-xl border-2 border-dashed"
        style={{
          borderColor: selected ? color : "var(--color-viac-border)",
          background: "rgba(99, 102, 241, 0.04)",
          minWidth: 500,
          minHeight: 350,
        }}
      >
        {/* ── Header badge ───────────────────────── */}
        <div
          className="absolute top-0 left-4 -translate-y-1/2 flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold tracking-wide"
          style={{
            background: "var(--color-viac-slate)",
            border: `1.5px solid ${color}`,
            color,
          }}
        >
          <RegionIcon size={14} />
          <span>REGION</span>
          <span className="text-viac-text font-semibold">{label}</span>
        </div>
      </div>
    </>
  );
}

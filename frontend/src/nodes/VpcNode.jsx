/**
 * VIaC – VPC Group Node
 *
 * Container node that holds Subnets, SGs, IGWs, etc.
 */

import { Handle, Position, NodeResizer } from "@xyflow/react";
import { VpcIcon } from "../components/icons/AwsIcons";

export default function VpcNode({ id, data, selected }) {
  const name = data?.properties?.name || "VPC";
  const cidr = data?.properties?.cidr || "";
  const color = "var(--color-node-vpc)";

  return (
    <>
      <NodeResizer
        minWidth={400}
        minHeight={250}
        isVisible={selected}
        lineStyle={{ borderColor: color }}
        handleStyle={{ background: color, width: 8, height: 8 }}
      />

      <div
        className="w-full h-full rounded-lg border"
        style={{
          borderColor: selected ? color : "var(--color-viac-border)",
          background: "rgba(59, 130, 246, 0.05)",
          minWidth: 400,
          minHeight: 250,
        }}
      >
        {/* ── Header ─────────────────────────────── */}
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-t-lg border-b"
          style={{
            background: "rgba(59, 130, 246, 0.1)",
            borderColor: "var(--color-viac-border)",
          }}
        >
          <VpcIcon size={18} className="shrink-0" style={{ color }} />
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color }}>
            VPC
          </span>
          <span className="text-xs font-semibold text-viac-text">{name}</span>
          {cidr && (
            <span className="ml-auto text-[10px] font-mono text-viac-muted px-1.5 py-0.5 rounded bg-viac-navy/50">
              {cidr}
            </span>
          )}
        </div>
      </div>

      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
    </>
  );
}

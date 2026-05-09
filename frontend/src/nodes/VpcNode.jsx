/**
 * VIaC – VPC Group Node
 *
 * Container node that holds Subnets, SGs, IGWs, etc.
 */

import { Handle, Position, NodeResizer, useReactFlow } from "@xyflow/react";
import { VpcIcon } from "../components/icons/AwsIcons";

export default function VpcNode({ id, data, selected }) {
  const name = data?.properties?.name || "VPC";
  const cidr = data?.properties?.cidr || "";
  const color = "var(--color-node-vpc)";
  const { deleteElements, getNodes } = useReactFlow();

  const handleDelete = (e) => {
    e.stopPropagation();
    const all = getNodes();
    const ids = new Set();
    const collect = (nid) => {
      ids.add(nid);
      for (const n of all) {
        if (n.parentId === nid) collect(n.id);
      }
    };
    collect(id);
    const payload = Array.from(ids).map((nid) => ({ id: nid }));
    deleteElements({ nodes: payload });
  };

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
        className="w-full h-full rounded-lg border relative"
        style={{
          borderColor: selected ? color : "var(--color-viac-border)",
          background: "rgba(59, 130, 246, 0.05)",
          minWidth: 400,
          minHeight: 250,
        }}
      >
        <button
          onClick={handleDelete}
          className="absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center
                     bg-red-500/80 text-white text-[10px] font-bold
                     opacity-0 group-hover:opacity-100 hover:bg-red-500 hover:scale-110 z-10 cursor-pointer shadow-lg"
          title="Delete VPC"
          style={{ opacity: selected ? 1 : undefined }}
        >
          ✕
        </button>
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

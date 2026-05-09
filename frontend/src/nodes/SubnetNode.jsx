import { Handle, Position, NodeResizer } from "@xyflow/react";
import { SubnetIcon } from "../components/icons/AwsIcons";

export default function SubnetNode({ id, data, selected }) {
  const name = data?.properties?.name || "Subnet";
  const cidr = data?.properties?.cidr || "";
  const az = data?.properties?.availability_zone || "";
  const isPublic = data?.properties?.public;
  const hasError = data?._validationError;
  const color = hasError ? "#ef4444" : "var(--color-node-subnet)";

  return (
    <>
      <NodeResizer
        minWidth={250}
        minHeight={150}
        isVisible={selected}
        lineStyle={{ borderColor: color }}
        handleStyle={{ background: color, width: 8, height: 8 }}
      />

      <div
        className="w-full h-full rounded-lg border border-dashed"
        style={{
          borderColor: hasError ? "#ef4444" : selected ? "var(--color-node-subnet)" : "var(--color-viac-border)",
          borderWidth: hasError ? 2 : 1,
          background: hasError ? "rgba(239, 68, 68, 0.06)" : "rgba(16, 185, 129, 0.05)",
          minWidth: 250,
          minHeight: 150,
        }}
      >
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-t-lg border-b border-dashed"
          style={{ borderColor: "var(--color-viac-border)" }}
        >
          <SubnetIcon size={16} className="shrink-0" style={{ color }} />
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color }}>
            Subnet
          </span>
          <span className="text-xs font-semibold text-viac-text">{name}</span>
          {isPublic !== undefined && (
            <span className={`ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded ${isPublic ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"}`}>
              {isPublic ? "PUBLIC" : "PRIVATE"}
            </span>
          )}
        </div>

        <div className="px-3 py-1 flex items-center gap-2">
          {cidr && (
            <span className="text-[10px] font-mono text-viac-muted">{cidr}</span>
          )}
          {az && (
            <span
              className="text-[9px] font-mono px-1.5 py-0.5 rounded"
              style={{
                background: hasError ? "rgba(239, 68, 68, 0.15)" : "rgba(26, 140, 219, 0.1)",
                color: hasError ? "#ef4444" : "#1a8cdb",
              }}
            >
              {az}
            </span>
          )}
        </div>

        {/* Error indicator */}
        {hasError && (
          <div className="px-3 py-1">
            <span className="text-[9px] text-red-400 font-semibold">
              ⛔ AZ mismatch with Region
            </span>
          </div>
        )}
      </div>

      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
    </>
  );
}

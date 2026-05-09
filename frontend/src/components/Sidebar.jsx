/**
 * VIaC – Sidebar (Resource Palette)
 *
 * Draggable resource types that can be dropped onto the canvas.
 */

import NODE_CONFIG from "../config/nodeConfig";

const SIDEBAR_GROUPS = [
  { title: "Network", types: ["aws_region", "aws_vpc", "aws_subnet", "aws_internet_gateway"] },
  { title: "Routing", types: ["aws_route_table", "aws_route", "aws_route_table_association"] },
  { title: "Compute", types: ["aws_instance"] },
  { title: "Security", types: ["aws_security_group"] },
];

function DraggableItem({ resourceType }) {
  const config = NODE_CONFIG[resourceType];
  if (!config) return null;

  const Icon = config.iconComponent;

  const onDragStart = (e) => {
    e.dataTransfer.setData("application/viac-resource", resourceType);
    e.dataTransfer.effectAllowed = "move";
  };

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-grab active:cursor-grabbing
                 border border-transparent hover:border-viac-border
                 bg-viac-card/50 hover:bg-viac-card transition-all duration-150
                 hover:shadow-lg hover:shadow-black/20"
    >
      <div
        className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
        style={{ background: `${config.color}18`, color: config.color }}
      >
        {Icon && <Icon size={18} />}
      </div>
      <span className="text-xs font-medium text-viac-text">{config.label}</span>
    </div>
  );
}

export default function Sidebar() {
  return (
    <aside className="w-56 h-full bg-viac-panel border-r border-viac-border flex flex-col overflow-hidden">
      {/* ── Logo ─────────────────────────────────── */}
      <div className="px-4 py-4 border-b border-viac-border">
        <div className="flex items-center gap-2.5">
          <img
            src="/VIaC_Logo.png"
            alt="VIaC"
            className="w-9 h-9 object-contain rounded-lg"
            style={{ background: "var(--color-viac-navy)" }}
          />
          <div>
            <h1 className="text-sm font-extrabold tracking-tight" style={{ color: "#1a8cdb" }}>
              VIaC
            </h1>
            <p className="text-[10px] text-viac-muted">Visual Infrastructure as Code</p>
          </div>
        </div>
      </div>

      {/* ── Resource Groups ──────────────────────── */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {SIDEBAR_GROUPS.map((group) => (
          <div key={group.title}>
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-viac-muted mb-2 px-1">
              {group.title}
            </h2>
            <div className="space-y-1">
              {group.types.map((type) => (
                <DraggableItem key={type} resourceType={type} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* ── Help ──────────────────────────────────── */}
      <div className="px-4 py-3 border-t border-viac-border text-[10px] text-viac-muted">
        Drag resources onto the canvas. Connect them to define dependencies.
      </div>
    </aside>
  );
}

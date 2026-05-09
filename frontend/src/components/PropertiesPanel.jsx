/**
 * VIaC – Properties Panel (Right Sidebar)
 *
 * Dynamically renders editable fields for the selected node.
 * Special rendering for:
 *  • Security Group ingress/egress rules (dynamic list of objects)
 *  • Subnet AZ (context-aware dropdown based on parent Region)
 */

import { useMemo } from "react";
import NODE_CONFIG from "../config/nodeConfig";
import { getAZsForRegion, ALL_REGIONS } from "../config/regionData";

// ── Field display names ─────────────────────────────────────
const FIELD_LABELS = {
  name: "Name",
  label: "Region",
  cidr: "CIDR Block",
  availability_zone: "Availability Zone",
  public: "Public Subnet",
  ami: "AMI ID",
  instance_type: "Instance Type",
  key_name: "Key Pair",
  associate_public_ip: "Public IP",
  description: "Description",
  destination_cidr: "Destination CIDR",
  environment: "Environment",
  ingress_rules: "Inbound Rules",
  egress_rules: "Outbound Rules",
};

// ── Fields to skip in the generic renderer ──────────────────
const COMPLEX_FIELDS = new Set(["ingress_rules", "egress_rules"]);

// ── Preset rule types ───────────────────────────────────────
const RULE_PRESETS = {
  SSH:        { protocol: "tcp", from_port: 22,  to_port: 22 },
  HTTP:       { protocol: "tcp", from_port: 80,  to_port: 80 },
  HTTPS:      { protocol: "tcp", from_port: 443, to_port: 443 },
  RDP:        { protocol: "tcp", from_port: 3389, to_port: 3389 },
  MySQL:      { protocol: "tcp", from_port: 3306, to_port: 3306 },
  PostgreSQL: { protocol: "tcp", from_port: 5432, to_port: 5432 },
  "All Traffic": { protocol: "-1", from_port: 0, to_port: 0 },
  Custom:     { protocol: "tcp", from_port: 0,  to_port: 0 },
};

// ── Shared input class ──────────────────────────────────────
const INPUT_CLS =
  "w-full px-3 py-1.5 rounded-md text-xs font-mono bg-viac-navy border border-viac-border text-viac-text focus:outline-none focus:border-viac-blue focus:ring-1 focus:ring-viac-blue/30 transition-colors placeholder:text-viac-muted/50";

const SELECT_CLS =
  "w-full px-2 py-1.5 rounded-md text-xs font-mono bg-viac-navy border border-viac-border text-viac-text focus:outline-none focus:border-viac-blue cursor-pointer";

// ═══════════════════════════════════════════════════════════
// Security Group Rule Editor
// ═══════════════════════════════════════════════════════════
function RuleEditor({ rules, onChange, direction }) {
  const addRule = () => {
    onChange([
      ...rules,
      {
        type: "SSH",
        protocol: "tcp",
        from_port: 22,
        to_port: 22,
        cidr_blocks: "0.0.0.0/0",
        description: "",
      },
    ]);
  };

  const removeRule = (index) => {
    onChange(rules.filter((_, i) => i !== index));
  };

  const updateRule = (index, field, value) => {
    const updated = rules.map((rule, i) => {
      if (i !== index) return rule;
      const newRule = { ...rule, [field]: value };

      // Auto-fill from preset when type changes
      if (field === "type" && RULE_PRESETS[value]) {
        const preset = RULE_PRESETS[value];
        newRule.protocol = preset.protocol;
        newRule.from_port = preset.from_port;
        newRule.to_port = preset.to_port;
      }

      return newRule;
    });
    onChange(updated);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-medium uppercase tracking-wider text-viac-muted">
          {direction === "ingress" ? "⬇ Inbound Rules" : "⬆ Outbound Rules"}
        </label>
        <button
          onClick={addRule}
          className="text-[10px] font-bold px-2 py-0.5 rounded border transition-colors"
          style={{
            color: "#1a8cdb",
            borderColor: "rgba(26, 140, 219, 0.3)",
            background: "rgba(26, 140, 219, 0.08)",
          }}
        >
          + Add Rule
        </button>
      </div>

      {rules.length === 0 && (
        <p className="text-[10px] text-viac-muted/50 italic py-1">
          No {direction} rules. Click "+ Add Rule" to create one.
        </p>
      )}

      {rules.map((rule, i) => (
        <div
          key={i}
          className="rounded-lg border border-viac-border bg-viac-navy/50 p-2.5 space-y-2"
        >
          {/* Row 1: Type + Delete */}
          <div className="flex items-center gap-2">
            <select
              value={rule.type || "Custom"}
              onChange={(e) => updateRule(i, "type", e.target.value)}
              className={SELECT_CLS + " flex-1"}
            >
              {Object.keys(RULE_PRESETS).map((preset) => (
                <option key={preset} value={preset}>
                  {preset}
                </option>
              ))}
            </select>
            <button
              onClick={() => removeRule(i)}
              className="text-red-400/70 hover:text-red-400 text-xs px-1 transition-colors"
              title="Remove rule"
            >
              ✕
            </button>
          </div>

          {/* Row 2: Protocol + Ports */}
          <div className="grid grid-cols-3 gap-1.5">
            <div>
              <label className="text-[9px] text-viac-muted/70 mb-0.5 block">Protocol</label>
              <select
                value={rule.protocol || "tcp"}
                onChange={(e) => updateRule(i, "protocol", e.target.value)}
                className={SELECT_CLS}
              >
                <option value="tcp">TCP</option>
                <option value="udp">UDP</option>
                <option value="icmp">ICMP</option>
                <option value="-1">All</option>
              </select>
            </div>
            <div>
              <label className="text-[9px] text-viac-muted/70 mb-0.5 block">From Port</label>
              <input
                type="number"
                value={rule.from_port ?? ""}
                onChange={(e) => updateRule(i, "from_port", parseInt(e.target.value) || 0)}
                className={INPUT_CLS}
                min={0}
                max={65535}
              />
            </div>
            <div>
              <label className="text-[9px] text-viac-muted/70 mb-0.5 block">To Port</label>
              <input
                type="number"
                value={rule.to_port ?? ""}
                onChange={(e) => updateRule(i, "to_port", parseInt(e.target.value) || 0)}
                className={INPUT_CLS}
                min={0}
                max={65535}
              />
            </div>
          </div>

          {/* Row 3: Source / CIDR */}
          <div>
            <label className="text-[9px] text-viac-muted/70 mb-0.5 block">Source (CIDR)</label>
            <input
              type="text"
              value={rule.cidr_blocks || ""}
              onChange={(e) => updateRule(i, "cidr_blocks", e.target.value)}
              className={INPUT_CLS}
              placeholder="0.0.0.0/0"
            />
          </div>

          {/* Row 4: Description */}
          <div>
            <label className="text-[9px] text-viac-muted/70 mb-0.5 block">Description</label>
            <input
              type="text"
              value={rule.description || ""}
              onChange={(e) => updateRule(i, "description", e.target.value)}
              className={INPUT_CLS}
              placeholder="Optional description"
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Context-Aware AZ Dropdown
// ═══════════════════════════════════════════════════════════
function AZDropdown({ value, onChange, allNodes, selectedNode, validationErrors }) {
  // Walk up parentId chain to find Region ancestor
  const parentRegion = useMemo(() => {
    if (!allNodes || !selectedNode) return null;
    const nodeMap = new Map(allNodes.map((n) => [n.id, n]));
    let current = selectedNode;
    while (current?.parentId) {
      const parent = nodeMap.get(current.parentId);
      if (!parent) break;
      if (parent.data?.resourceType === "aws_region") {
        return parent.data?.properties?.label || null;
      }
      // Could be VPC → walk up further
      current = parent;
    }
    return null;
  }, [allNodes, selectedNode]);

  const availableAZs = parentRegion ? getAZsForRegion(parentRegion) : [];
  const hasError = validationErrors?.some((e) => e.includes("AZ"));

  return (
    <div>
      <label className="block text-[10px] font-medium uppercase tracking-wider text-viac-muted mb-1">
        Availability Zone
      </label>

      {parentRegion && availableAZs.length > 0 ? (
        <>
          <select
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            className={`${SELECT_CLS} ${hasError ? "!border-red-500 !ring-1 !ring-red-500/30" : ""}`}
          >
            <option value="">Select AZ...</option>
            {availableAZs.map((az) => (
              <option key={az} value={az}>
                {az}
              </option>
            ))}
          </select>
          <p className="text-[9px] text-viac-muted/60 mt-0.5">
            Region: <span style={{ color: "#1a8cdb" }}>{parentRegion}</span>
          </p>
        </>
      ) : (
        <>
          <input
            type="text"
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            className={`${INPUT_CLS} ${hasError ? "!border-red-500 !ring-1 !ring-red-500/30" : ""}`}
            placeholder="us-east-1a"
          />
          {!parentRegion && (
            <p className="text-[9px] text-amber-400/70 mt-0.5">
              ⚠ No parent Region detected. Drop subnet inside a Region → VPC for auto AZ filtering.
            </p>
          )}
        </>
      )}

      {hasError && (
        <p className="text-[9px] text-red-400 mt-1 font-semibold">
          ⛔ {validationErrors.find((e) => e.includes("AZ"))}
        </p>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Region Dropdown
// ═══════════════════════════════════════════════════════════
function RegionDropdown({ value, onChange }) {
  return (
    <div>
      <label className="block text-[10px] font-medium uppercase tracking-wider text-viac-muted mb-1">
        Region
      </label>
      <select
        value={value || "us-east-1"}
        onChange={(e) => onChange(e.target.value)}
        className={SELECT_CLS}
      >
        {ALL_REGIONS.map((region) => (
          <option key={region} value={region}>
            {region}
          </option>
        ))}
      </select>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Main Properties Panel
// ═══════════════════════════════════════════════════════════
export default function PropertiesPanel({
  selectedNode,
  onUpdateNode,
  allNodes,
  validationErrors,
}) {
  if (!selectedNode) {
    return (
      <aside className="w-72 h-full bg-viac-panel border-l border-viac-border flex items-center justify-center">
        <p className="text-xs text-viac-muted text-center px-6">
          Select a node on the canvas to edit its properties
        </p>
      </aside>
    );
  }

  const resourceType = selectedNode.data?.resourceType;
  const config = NODE_CONFIG[resourceType] || {};
  const Icon = config.iconComponent;
  const properties = selectedNode.data?.properties || {};
  const nodeErrors = validationErrors?.get(selectedNode.id) || [];

  const handleChange = (key, value) => {
    onUpdateNode(selectedNode.id, {
      ...selectedNode.data,
      properties: { ...properties, [key]: value },
    });
  };

  const isSG = resourceType === "aws_security_group";
  const isSubnet = resourceType === "aws_subnet";
  const isRegion = resourceType === "aws_region";

  return (
    <aside className="w-72 h-full bg-viac-panel border-l border-viac-border flex flex-col overflow-hidden">
      {/* ── Header ───────────────────────────────── */}
      <div className="px-4 py-3 border-b border-viac-border">
        <div className="flex items-center gap-2">
          {Icon && (
            <div style={{ color: config.color }}>
              <Icon size={20} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-bold text-viac-text">{config.label}</h2>
            <p className="text-[10px] text-viac-muted font-mono">{selectedNode.id}</p>
          </div>
          {nodeErrors.length > 0 && (
            <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
              <span className="text-red-400 text-[10px] font-bold">!</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Validation errors banner ─────────────── */}
      {nodeErrors.length > 0 && (
        <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/20">
          {nodeErrors.map((err, i) => (
            <p key={i} className="text-[10px] text-red-400">
              ⛔ {err}
            </p>
          ))}
        </div>
      )}

      {/* ── Fields ───────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {Object.entries(properties).map(([key, value]) => {
          // Skip internal/computed fields
          if (key.startsWith("_")) return null;

          // Skip complex fields — rendered separately below
          if (COMPLEX_FIELDS.has(key)) return null;

          // ── Special: Region dropdown ──────────────
          if (isRegion && key === "label") {
            return (
              <RegionDropdown
                key={key}
                value={value}
                onChange={(v) => handleChange("label", v)}
              />
            );
          }

          // ── Special: Subnet AZ dropdown ───────────
          if (isSubnet && key === "availability_zone") {
            return (
              <AZDropdown
                key={key}
                value={value}
                onChange={(v) => handleChange("availability_zone", v)}
                allNodes={allNodes}
                selectedNode={selectedNode}
                validationErrors={nodeErrors}
              />
            );
          }

          // ── Generic fields ────────────────────────
          const label = FIELD_LABELS[key] || key;
          const isBool = typeof value === "boolean";

          return (
            <div key={key}>
              <label className="block text-[10px] font-medium uppercase tracking-wider text-viac-muted mb-1">
                {label}
              </label>

              {isBool ? (
                <button
                  onClick={() => handleChange(key, !value)}
                  className={`w-full text-left px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors ${
                    value
                      ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                      : "bg-viac-card border-viac-border text-viac-muted"
                  }`}
                >
                  {value ? "Enabled" : "Disabled"}
                </button>
              ) : (
                <input
                  type="text"
                  value={value ?? ""}
                  onChange={(e) => handleChange(key, e.target.value)}
                  className={INPUT_CLS}
                  placeholder={key}
                />
              )}
            </div>
          );
        })}

        {/* ── Security Group: Ingress Rules ───────── */}
        {isSG && (
          <>
            <div className="border-t border-viac-border pt-3 mt-2">
              <RuleEditor
                rules={properties.ingress_rules || []}
                onChange={(rules) => handleChange("ingress_rules", rules)}
                direction="ingress"
              />
            </div>

            <div className="border-t border-viac-border pt-3">
              <RuleEditor
                rules={properties.egress_rules || []}
                onChange={(rules) => handleChange("egress_rules", rules)}
                direction="egress"
              />
            </div>
          </>
        )}
      </div>

      {/* ── Node ID ──────────────────────────────── */}
      <div className="px-4 py-2 border-t border-viac-border">
        <span className="text-[10px] text-viac-muted">
          Node ID: <code style={{ color: "#1a8cdb" }}>{selectedNode.id}</code>
        </span>
      </div>
    </aside>
  );
}

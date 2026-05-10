/**
 * VIaC – Properties Panel (Right Sidebar)
 *
 * Renders node properties by reading a central schema registry
 * (`src/config/resourceSchema.js`). For resource types not in the
 * schema the panel falls back to a simple generic renderer.
 */

import { useMemo } from "react";
import NODE_CONFIG from "../config/nodeConfig";
import RESOURCE_SCHEMA from "../config/resourceSchema";
import { getAZsForRegion, ALL_REGIONS } from "../config/regionData";

// Shared input styles
const INPUT_CLS =
  "w-full px-3 py-1.5 rounded-md text-xs font-mono bg-viac-navy border border-viac-border text-viac-text focus:outline-none focus:border-viac-blue focus:ring-1 focus:ring-viac-blue/30 transition-colors placeholder:text-viac-muted/50";

const SELECT_CLS =
  "w-full px-2 py-1.5 rounded-md text-xs font-mono bg-viac-navy border border-viac-border text-viac-text focus:outline-none focus:border-viac-blue cursor-pointer";

function ensureArray(v) {
  if (v == null) return [];
  if (Array.isArray(v)) return v;
  if (typeof v === "string") return v.split(",").map((s) => s.trim()).filter(Boolean);
  return [v];
}

// Generic ArrayEditor: renders items using itemSchema
function ArrayEditor({ items = [], onChange, itemSchema, allNodes, title }) {
  const makeDefault = () => {
    if (itemSchema?.defaults) return { ...itemSchema.defaults };
    const obj = {};
    (itemSchema?.fields || []).forEach((f) => {
      if (f.default !== undefined) obj[f.key] = f.default;
      else if (f.type === "array") obj[f.key] = f.default ?? [];
      else obj[f.key] = "";
    });
    return obj;
  };

  const addItem = () => onChange([...items, makeDefault()]);
  const removeItem = (i) => onChange(items.filter((_, idx) => idx !== i));

  const updateItem = (index, key, value) => {
    const updated = items.map((it, i) => (i === index ? { ...it, [key]: value } : it));
    onChange(updated);
  };

  const applyPreset = (index, presetKey) => {
    const presets = itemSchema?.presets || {};
    const preset = presets[presetKey];
    if (!preset) return;
    const updated = items.map((it, i) => (i === index ? { ...it, ...preset } : it));
    onChange(updated);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-medium uppercase tracking-wider text-viac-muted">{title}</label>
        <button
          onClick={addItem}
          className="text-[10px] font-bold px-2 py-0.5 rounded border transition-colors"
          style={{ color: "#1a8cdb", borderColor: "rgba(26, 140, 219, 0.3)", background: "rgba(26, 140, 219, 0.08)" }}
        >
          + Add
        </button>
      </div>

      {items.length === 0 && (
        <p className="text-[10px] text-viac-muted/50 italic py-1">No items. Click "+ Add" to create one.</p>
      )}

      {items.map((item, idx) => (
        <div key={idx} className="rounded-lg border border-viac-border bg-viac-navy/50 p-2.5 space-y-2">
          <div className="flex items-center gap-2">
            {itemSchema?.fields?.some((f) => f.key === "type") && (
              <select
                value={item.type || ""}
                onChange={(e) => {
                  updateItem(idx, "type", e.target.value);
                  // apply preset when present
                  if (itemSchema?.presets && itemSchema.presets[e.target.value]) {
                    applyPreset(idx, e.target.value);
                  }
                }}
                className={SELECT_CLS + " flex-1"}
              >
                {(itemSchema?.fields?.find((f) => f.key === "type")?.options || []).map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            )}

            <button onClick={() => removeItem(idx)} className="text-red-400/70 hover:text-red-400 text-xs px-1">✕</button>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            {itemSchema?.fields?.map((field) => {
              const val = item[field.key];
              // Render basic widgets
              if (field.widget === "select") {
                return (
                  <div key={field.key}>
                    <label className="text-[9px] text-viac-muted/70 mb-0.5 block">{field.label}</label>
                    <select
                      value={val ?? ""}
                      onChange={(e) => updateItem(idx, field.key, e.target.value)}
                      className={SELECT_CLS}
                    >
                      {(field.options || []).map((o) => (<option key={o} value={o}>{o}</option>))}
                    </select>
                  </div>
                );
              }

              if (field.widget === "number") {
                return (
                  <div key={field.key}>
                    <label className="text-[9px] text-viac-muted/70 mb-0.5 block">{field.label}</label>
                    <input type="number" value={val ?? ""} onChange={(e) => updateItem(idx, field.key, e.target.value === "" ? "" : parseInt(e.target.value, 10))} className={INPUT_CLS} />
                  </div>
                );
              }

              if (field.widget === "multi") {
                return (
                  <div key={field.key} className="col-span-3">
                    <label className="text-[9px] text-viac-muted/70 mb-0.5 block">{field.label}</label>
                    <input
                      type="text"
                      value={(val && Array.isArray(val)) ? val.join(", ") : (val || "")}
                      onChange={(e) => updateItem(idx, field.key, e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
                      className={INPUT_CLS}
                      placeholder={"0.0.0.0/0"}
                    />
                  </div>
                );
              }

              if (field.widget === "resourcePicker") {
                const candidates = allNodes?.filter((n) => n.data?.resourceType === field.resourceType) || [];
                return (
                  <div key={field.key}>
                    <label className="text-[9px] text-viac-muted/70 mb-0.5 block">{field.label}</label>
                    <select
                      value={val || ""}
                      onChange={(e) => updateItem(idx, field.key, e.target.value ? `ref:${e.target.value}.id` : "")}
                      className={SELECT_CLS}
                    >
                      <option value="">None</option>
                      {candidates.map((c) => (
                        <option key={c.id} value={c.id}>{c.data?.properties?.name || c.data?.label || c.id}</option>
                      ))}
                    </select>
                  </div>
                );
              }

              // default text input
              return (
                <div key={field.key}>
                  <label className="text-[9px] text-viac-muted/70 mb-0.5 block">{field.label}</label>
                  <input type="text" value={val ?? ""} onChange={(e) => updateItem(idx, field.key, e.target.value)} className={INPUT_CLS} />
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function AZDropdown({ value, onChange, allNodes, selectedNode, validationErrors }) {
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
      current = parent;
    }
    return null;
  }, [allNodes, selectedNode]);

  const availableAZs = parentRegion ? getAZsForRegion(parentRegion) : [];
  const hasError = validationErrors?.some((e) => e.includes("AZ"));

  return (
    <div>
      <label className="block text-[10px] font-medium uppercase tracking-wider text-viac-muted mb-1">Availability Zone</label>
      {parentRegion && availableAZs.length > 0 ? (
        <>
          <select value={value || ""} onChange={(e) => onChange(e.target.value)} className={`${SELECT_CLS} ${hasError ? "!border-red-500 !ring-1 !ring-red-500/30" : ""}`}>
            <option value="">Select AZ...</option>
            {availableAZs.map((az) => (<option key={az} value={az}>{az}</option>))}
          </select>
          <p className="text-[9px] text-viac-muted/60 mt-0.5">Region: <span style={{ color: "#1a8cdb" }}>{parentRegion}</span></p>
        </>
      ) : (
        <>
          <input type="text" value={value || ""} onChange={(e) => onChange(e.target.value)} className={`${INPUT_CLS} ${hasError ? "!border-red-500 !ring-1 !ring-red-500/30" : ""}`} placeholder="us-east-1a" />
          {!parentRegion && (<p className="text-[9px] text-amber-400/70 mt-0.5">⚠ No parent Region detected. Drop subnet inside a Region → VPC for auto AZ filtering.</p>)}
        </>
      )}
      {hasError && (<p className="text-[9px] text-red-400 mt-1 font-semibold">⛔ {validationErrors.find((e) => e.includes("AZ"))}</p>)}
    </div>
  );
}

function RegionDropdown({ value, onChange }) {
  return (
    <div>
      <label className="block text-[10px] font-medium uppercase tracking-wider text-viac-muted mb-1">Region</label>
      <select value={value || "us-east-1"} onChange={(e) => onChange(e.target.value)} className={SELECT_CLS}>
        {ALL_REGIONS.map((region) => (<option key={region} value={region}>{region}</option>))}
      </select>
    </div>
  );
}

export default function PropertiesPanel({ selectedNode, onUpdateNode, allNodes, validationErrors }) {
  if (!selectedNode) {
    return (
      <aside className="w-72 h-full bg-viac-panel border-l border-viac-border flex items-center justify-center">
        <p className="text-xs text-viac-muted text-center px-6">Select a node on the canvas to edit its properties</p>
      </aside>
    );
  }

  const resourceType = selectedNode.data?.resourceType;
  const config = NODE_CONFIG[resourceType] || {};
  const Icon = config.iconComponent;
  const properties = selectedNode.data?.properties || {};
  const nodeErrors = validationErrors?.get(selectedNode.id) || [];
  const schema = RESOURCE_SCHEMA[resourceType];

  const handleChange = (key, value) => {
    onUpdateNode(selectedNode.id, { ...selectedNode.data, properties: { ...properties, [key]: value } });
  };

  // Generic renderer for a field described by schema
  const renderFieldByDef = (fieldDef) => {
    const key = fieldDef.key;
    const value = properties[key];

    // Region label special-case
    if (resourceType === "aws_region" && key === "label") {
      return <RegionDropdown key={key} value={value} onChange={(v) => handleChange(key, v)} />;
    }

    // Subnet AZ special-case
    if (resourceType === "aws_subnet" && key === "availability_zone") {
      return <AZDropdown key={key} value={value} onChange={(v) => handleChange(key, v)} allNodes={allNodes} selectedNode={selectedNode} validationErrors={nodeErrors} />;
    }

    // Array editor
    if (fieldDef.widget === "array" && fieldDef.itemSchema) {
      return (
        <div key={key} className="border-t border-viac-border pt-3 mt-2">
          <ArrayEditor items={ensureArray(value)} onChange={(v) => handleChange(key, v)} itemSchema={fieldDef.itemSchema} allNodes={allNodes} title={fieldDef.label} />
        </div>
      );
    }

    // Reference picker
    if (fieldDef.widget === "resourcePicker") {
      const candidates = allNodes?.filter((n) => n.data?.resourceType === fieldDef.resourceType) || [];
      return (
        <div key={key}>
          <label className="block text-[10px] font-medium uppercase tracking-wider text-viac-muted mb-1">{fieldDef.label}</label>
          <select value={value || ""} onChange={(e) => handleChange(key, e.target.value ? `ref:${e.target.value}.id` : "")} className={SELECT_CLS}>
            <option value="">None</option>
            {candidates.map((c) => (<option key={c.id} value={c.id}>{c.data?.properties?.name || c.data?.label || c.id}</option>))}
          </select>
        </div>
      );
    }

    // Multi-value (comma-separated) -> arrays
    if (fieldDef.widget === "multi") {
      const display = Array.isArray(value) ? value.join(", ") : (value || "");
      return (
        <div key={key}>
          <label className="block text-[10px] font-medium uppercase tracking-wider text-viac-muted mb-1">{fieldDef.label}</label>
          <input type="text" value={display} onChange={(e) => handleChange(key, e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} className={INPUT_CLS} />
        </div>
      );
    }

    // Default: text input
    return (
      <div key={key}>
        <label className="block text-[10px] font-medium uppercase tracking-wider text-viac-muted mb-1">{fieldDef.label}</label>
        <input type="text" value={value ?? ""} onChange={(e) => handleChange(key, e.target.value)} className={INPUT_CLS} />
      </div>
    );
  };

  return (
    <aside className="w-72 h-full bg-viac-panel border-l border-viac-border flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-viac-border">
        <div className="flex items-center gap-2">
          {Icon && (<div style={{ color: config.color }}><Icon size={20} /></div>)}
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-bold text-viac-text">{config.label}</h2>
            <p className="text-[10px] text-viac-muted font-mono">{selectedNode.id}</p>
          </div>
          {nodeErrors.length > 0 && (<div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center shrink-0"><span className="text-red-400 text-[10px] font-bold">!</span></div>)}
        </div>
      </div>

      {nodeErrors.length > 0 && (
        <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/20">
          {nodeErrors.map((err, i) => (<p key={i} className="text-[10px] text-red-400">⛔ {err}</p>))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {schema ? (
          schema.fields.map((f) => renderFieldByDef(f))
        ) : (
          // Fallback: render simple properties list
          Object.entries(properties).map(([k, v]) => {
            if (k.startsWith("_")) return null;
            return (
              <div key={k}>
                <label className="block text-[10px] font-medium uppercase tracking-wider text-viac-muted mb-1">{k}</label>
                <input type="text" value={v ?? ""} onChange={(e) => handleChange(k, e.target.value)} className={INPUT_CLS} />
              </div>
            );
          })
        )}
      </div>

      <div className="px-4 py-2 border-t border-viac-border">
        <span className="text-[10px] text-viac-muted">Node ID: <code style={{ color: "#1a8cdb" }}>{selectedNode.id}</code></span>
      </div>
    </aside>
  );
}

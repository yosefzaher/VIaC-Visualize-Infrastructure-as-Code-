/**
 * VIaC – Canvas → Backend JSON Transformer
 *
 * Converts React Flow nodes + edges into the PlanRequest schema:
 * {
 *   region: "us-east-1",
 *   resources: [
 *     { node_id, resource_type, properties: { ..., vpc_id: "ref:vpc_01.id" } }
 *   ]
 * }
 */

import NODE_CONFIG from "../config/nodeConfig";
import { getConnectionProperty } from "../config/validationRules";

/**
 * Transform canvas state into backend-ready JSON payload.
 *
 * @param {object[]} nodes - React Flow nodes
 * @param {object[]} edges - React Flow edges
 * @returns {object} PlanRequest payload
 */
export default function canvasToPayload(nodes, edges) {
  // ── 1. Detect region ──────────────────────────────────────
  const regionNode = nodes.find((n) => n.data?.resourceType === "aws_region");
  const region = regionNode?.data?.properties?.label || "us-east-1";

  // ── 2. Build node lookup ──────────────────────────────────
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  // ── 3. Build edge-based ref properties per target node ────
  //    For each edge: source → target, the target gets a property
  //    set to "ref:<source_node_id>.id"
  const refOverrides = {};  // nodeId → { property: "ref:..." }

  for (const edge of edges) {
    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);
    if (!sourceNode || !targetNode) continue;

    const sourceResource = sourceNode.data?.resourceType;
    const targetResource = targetNode.data?.resourceType;
    if (!sourceResource || !targetResource) continue;

    const property = getConnectionProperty(sourceResource, targetResource);
    if (!property) continue;

    if (!refOverrides[edge.target]) {
      refOverrides[edge.target] = {};
    }

    // Handle list-type properties (e.g., vpc_security_group_ids)
    if (property === "vpc_security_group_ids") {
      const existing = refOverrides[edge.target][property] || [];
      existing.push(`ref:${edge.source}.id`);
      refOverrides[edge.target][property] = existing;
    } else {
      refOverrides[edge.target][property] = `ref:${edge.source}.id`;
    }
  }

  // ── 4. Build resources array ──────────────────────────────
  const resources = [];

  for (const node of nodes) {
    const resourceType = node.data?.resourceType;
    const config = NODE_CONFIG[resourceType];

    // Skip non-backend resources (e.g., region containers)
    if (!config?.isBackendResource) continue;

    // Merge base properties + ref overrides from edges
    const properties = {
      ...(node.data?.properties || {}),
      ...(refOverrides[node.id] || {}),
    };

    // Remove internal UI-only properties
    const cleanProps = { ...properties };
    delete cleanProps._parentType;

    resources.push({
      node_id: node.id,
      resource_type: resourceType,
      properties: cleanProps,
    });
  }

  return { region, resources };
}

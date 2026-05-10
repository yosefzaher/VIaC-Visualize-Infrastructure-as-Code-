/**
 * VIaC – Canvas Component
 *
 * The central React Flow canvas with:
 *  • Drag-and-drop from sidebar
 *  • Connection validation
 *  • Parent/child nesting (Region > VPC > Subnet)
 *  • Selection state for properties panel
 */

import { useCallback, useRef, forwardRef, useImperativeHandle, useEffect } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  BackgroundVariant,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import NODE_CONFIG from "../config/nodeConfig";
import { isValidConnection as checkValid } from "../config/validationRules";

// ── Custom node imports ─────────────────────────────────────
import RegionNode from "../nodes/RegionNode";
import VpcNode from "../nodes/VpcNode";
import SubnetNode from "../nodes/SubnetNode";
import Ec2Node from "../nodes/Ec2Node";
import SecurityGroupNode from "../nodes/SecurityGroupNode";
import IgwNode from "../nodes/IgwNode";
import RouteTableNode from "../nodes/RouteTableNode";
import RouteNode from "../nodes/RouteNode";
import RtaNode from "../nodes/RtaNode";

// ── Node type registry (MUST be outside component) ──────────
const nodeTypes = {
  regionNode: RegionNode,
  vpcNode: VpcNode,
  subnetNode: SubnetNode,
  ec2Node: Ec2Node,
  sgNode: SecurityGroupNode,
  igwNode: IgwNode,
  rtNode: RouteTableNode,
  routeNode: RouteNode,
  rtaNode: RtaNode,
};

// ── Counter for unique IDs ──────────────────────────────────
let idCounter = 0;
function nextId(resourceType) {
  idCounter += 1;
  // Create terraform-safe ID: aws_vpc → vpc_1, aws_instance → instance_1
  const short = resourceType.replace("aws_", "");
  return `${short}_${idCounter}`;
}

// ── Nesting rules: which groups can accept which children ───
const PARENT_ACCEPTS = {
  aws_region: ["aws_vpc"],
  aws_vpc: [
    "aws_subnet",
    "aws_security_group",
    "aws_internet_gateway",
    "aws_route_table",
    "aws_route",
    "aws_route_table_association",
  ],
  aws_subnet: ["aws_instance"],
};

const Canvas = forwardRef(function Canvas({ onSelectionChange, nodesRef, edgesRef, onNodesUpdate }, ref) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const reactFlowInstance = useReactFlow();
  const wrapperRef = useRef(null);

  // Expose state to parent via refs
  if (nodesRef) nodesRef.current = nodes;
  if (edgesRef) edgesRef.current = edges;

  // ── Node selection → properties panel ─────────────────────
  const handleSelectionChange = useCallback(
    ({ nodes: selected }) => {
      onSelectionChange?.(selected?.[0] || null);
    },
    [onSelectionChange]
  );

  // ── Connection handling ───────────────────────────────────
  const handleIsValidConnection = useCallback(
    (connection) => checkValid(connection, nodes),
    [nodes]
  );

  const onConnect = useCallback(
    (connection) => {
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            animated: true,
            style: { stroke: "var(--color-viac-electric)", strokeWidth: 2 },
          },
          eds
        )
      );
      setTimeout(() => onNodesUpdate?.(), 50);
    },
    [setEdges, onNodesUpdate]
  );

  // ── Drag-and-drop from sidebar ────────────────────────────
  const onDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (e) => {
      e.preventDefault();

      const resourceType = e.dataTransfer.getData("application/viac-resource");
      if (!resourceType) return;

      const config = NODE_CONFIG[resourceType];
      if (!config) return;

      // Convert screen coords → flow coords
      const position = reactFlowInstance.screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      });

      const nodeId = nextId(resourceType);

      // ── Check if dropped inside a group ───────────────────
      let parentId = undefined;
      const existingNodes = reactFlowInstance.getNodes();
      const nodeMap = new Map(existingNodes.map((n) => [n.id, n]));

      // Find the innermost matching group and set parentId
      const computeAbsolutePos = (node) => {
        let x = node.position?.x || 0;
        let y = node.position?.y || 0;
        let cur = node;
        while (cur?.parentId) {
          const p = nodeMap.get(cur.parentId);
          if (!p) break;
          x += p.position?.x || 0;
          y += p.position?.y || 0;
          cur = p;
        }
        return { x, y };
      };

      const matches = [];
      for (const existing of existingNodes) {
        const existingResource = existing.data?.resourceType;
        const accepts = PARENT_ACCEPTS[existingResource];
        if (!accepts || !accepts.includes(resourceType)) continue;

        // Prefer measured width/height (React Flow) then explicit style, then config defaults
        const rawW = existing.width || existing.measured?.width || existing.style?.width;
        const rawH = existing.height || existing.measured?.height || existing.style?.height;
        const w = typeof rawW === "string" ? parseInt(rawW, 10) : rawW || config.minWidth || 300;
        const h = typeof rawH === "string" ? parseInt(rawH, 10) : rawH || config.minHeight || 200;

        const abs = computeAbsolutePos(existing);
        const absX = abs.x;
        const absY = abs.y;

        if (
          position.x >= absX &&
          position.x <= absX + w &&
          position.y >= absY &&
          position.y <= absY + h
        ) {
          // compute nesting depth for tie-breaking (deeper = prefer)
          let depth = 0;
          let cur = existing;
          while (cur?.parentId) {
            const p = nodeMap.get(cur.parentId);
            if (!p) break;
            depth += 1;
            cur = p;
          }
          matches.push({ existing, depth, area: w * h, absX, absY, w, h });
        }
      }

      if (matches.length > 0) {
        // Prefer deepest (largest depth), then smallest area
        matches.sort((a, b) => {
          if (b.depth !== a.depth) return b.depth - a.depth;
          return a.area - b.area;
        });
        const chosen = matches[0];
        parentId = chosen.existing.id;
        position.x -= chosen.absX;
        position.y -= chosen.absY;
      }

      // Helper: find closest Region ancestor label for a given node id
      const findRegionLabel = (startId) => {
        if (!startId) return null;
        let cur = nodeMap.get(startId);
        while (cur) {
          if (cur.data?.resourceType === "aws_region") {
            return cur.data?.properties?.label || null;
          }
          if (!cur.parentId) break;
          cur = nodeMap.get(cur.parentId);
        }
        return null;
      };

      const newNode = {
        id: nodeId,
        type: config.type,
        position,
        data: {
          label: config.label,
          resourceType,
          properties: { ...config.defaults },
        },
        ...(parentId ? { parentId, extent: "parent" } : {}),
        ...(config.isGroup
          ? {
              style: {
                width: config.minWidth || 400,
                height: config.minHeight || 300,
              },
            }
          : {}),
      };

      // If dropped inside a Region (or inside a VPC that is inside a Region),
      // inherit the Region label onto the child's properties so children can
      // be context-aware (AZ dropdowns, validations, translator hints).
      const regionLabel = parentId ? findRegionLabel(parentId) : null;
      if (regionLabel) {
        newNode.data.properties.region = regionLabel;
      }

      setNodes((nds) => [...nds, newNode]);
      setTimeout(() => onNodesUpdate?.(), 50);
    },
    [setNodes, onNodesUpdate]
  );

  // ── Update node data (from properties panel) ──────────────
  const updateNodeData = useCallback(
    (nodeId, newData) => {
      setNodes((nds) => {
        // Update the node itself
        const updated = nds.map((n) => (n.id === nodeId ? { ...n, data: newData } : n));

        // If a Region node's label changed, propagate the region label to all
        // descendant nodes so they remain context-aware.
        const orig = nds.find((n) => n.id === nodeId);
        if (orig && orig.data?.resourceType === "aws_region") {
          const oldLabel = orig.data?.properties?.label;
          const newLabel = newData?.properties?.label;
          if (oldLabel !== newLabel) {
            const nodeIndex = new Map(updated.map((n) => [n.id, n]));
            // Walk all nodes and update those that have this region as an ancestor
            const shouldUpdate = (n) => {
              let cur = n;
              while (cur?.parentId) {
                if (cur.parentId === nodeId) return true;
                cur = nodeIndex.get(cur.parentId);
              }
              return false;
            };

            return updated.map((n) => {
              if (n.id === nodeId) return n;
              if (shouldUpdate(n)) {
                return {
                  ...n,
                  data: {
                    ...n.data,
                    properties: {
                      ...n.data.properties,
                      region: newLabel,
                    },
                  },
                };
              }
              return n;
            });
          }
        }

        return updated;
      });
    },
    [setNodes]
  );

  // ── Keyboard deletion: Delete / Backspace to remove selected nodes ──
  useEffect(() => {
    const handler = (e) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;

      // Ignore when focus is inside an input/textarea/select or a contentEditable element
      const tgt = e.target || document.activeElement;
      const tag = (tgt && tgt.tagName && tgt.tagName.toLowerCase && tgt.tagName.toLowerCase()) || null;
      if (tag === "input" || tag === "textarea" || tag === "select" || (tgt && tgt.isContentEditable)) {
        return;
      }

      const selected = nodes.filter((n) => n.selected);
      if (!selected || selected.length === 0) return;

      // Collect selected ids and all descendants
      const idsToDelete = new Set(selected.map((s) => s.id));
      let added = true;
      while (added) {
        added = false;
        for (const n of nodes) {
          if (!idsToDelete.has(n.id) && n.parentId && idsToDelete.has(n.parentId)) {
            idsToDelete.add(n.id);
            added = true;
          }
        }
      }

      setNodes((nds) => nds.filter((n) => !idsToDelete.has(n.id)));
      setEdges((eds) => eds.filter((edge) => !idsToDelete.has(edge.source) && !idsToDelete.has(edge.target)));
      onNodesUpdate?.();
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [nodes, setNodes, setEdges, onNodesUpdate]);

  // ── Stamp validation errors onto node data for rendering ──
  const setValidationErrors = useCallback(
    (errors) => {
      // errors can be either:
      //  - Map<nodeId, [messages]>  (frontend validation)
      //  - Array of diagnostics [{ node_id, message, ... }] (backend)
      setNodes((nds) =>
        nds.map((n) => {
          let hasErr = false;
          let msg = null;

          if (Array.isArray(errors)) {
            const found = errors.find((d) => d.node_id === n.id || d.nodeId === n.id);
            if (found) {
              hasErr = true;
              msg = found.message || found.msg || String(found);
            }
          } else if (errors instanceof Map) {
            hasErr = errors.has(n.id);
            if (hasErr) {
              const val = errors.get(n.id);
              msg = Array.isArray(val) ? val.join("; ") : String(val);
            }
          } else if (errors && typeof errors === "object") {
            // treat as plain object map
            if (errors[n.id]) {
              hasErr = true;
              const val = errors[n.id];
              msg = Array.isArray(val) ? val.join("; ") : String(val);
            }
          }

          return {
            ...n,
            data: { ...n.data, _validationError: hasErr, _errorMessage: msg },
          };
        })
      );
    },
    [setNodes]
  );

  // Expose methods to parent via ref
  useImperativeHandle(
    ref,
    () => ({ updateNodeData, setValidationErrors }),
    [updateNodeData, setValidationErrors]
  );

  return (
    <div ref={wrapperRef} className="flex-1 h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onSelectionChange={handleSelectionChange}
        isValidConnection={handleIsValidConnection}
        onDrop={onDrop}
        onDragOver={onDragOver}
        fitView
        selectNodesOnDrag={false}
        defaultEdgeOptions={{
          animated: true,
          style: { stroke: "var(--color-viac-electric)", strokeWidth: 2 },
        }}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="rgba(148, 163, 184, 0.12)"
        />
        <Controls
          showInteractive={false}
          className="!bg-viac-slate !border-viac-border !rounded-lg"
        />
        <MiniMap
          nodeStrokeWidth={3}
          nodeColor={(node) => {
            const cfg = NODE_CONFIG[node.data?.resourceType];
            return cfg?.color || "#64748b";
          }}
          maskColor="rgba(15, 23, 42, 0.8)"
        />
      </ReactFlow>
    </div>
  );
});

export default Canvas;

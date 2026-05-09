/**
 * VIaC – Canvas Component
 *
 * The central React Flow canvas with:
 *  • Drag-and-drop from sidebar
 *  • Connection validation
 *  • Parent/child nesting (Region > VPC > Subnet)
 *  • Selection state for properties panel
 */

import { useCallback, useRef, forwardRef, useImperativeHandle } from "react";
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

      // Find the innermost matching group
      for (const existing of existingNodes) {
        const existingResource = existing.data?.resourceType;
        const accepts = PARENT_ACCEPTS[existingResource];
        if (!accepts || !accepts.includes(resourceType)) continue;

        // Check if drop is inside the group bounds
        const measured = existing.measured || {};
        const w = measured.width || config.minWidth || 300;
        const h = measured.height || config.minHeight || 200;

        const absX = existing.position.x + (existing.parentId ? 0 : 0);
        const absY = existing.position.y;

        if (
          position.x >= absX &&
          position.x <= absX + w &&
          position.y >= absY &&
          position.y <= absY + h
        ) {
          parentId = existing.id;
          // Adjust position to be relative to parent
          position.x -= absX;
          position.y -= absY;
        }
      }

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

      setNodes((nds) => [...nds, newNode]);
      setTimeout(() => onNodesUpdate?.(), 50);
    },
    [setNodes, onNodesUpdate]
  );

  // ── Update node data (from properties panel) ──────────────
  const updateNodeData = useCallback(
    (nodeId, newData) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === nodeId ? { ...n, data: newData } : n))
      );
    },
    [setNodes]
  );

  // ── Stamp validation errors onto node data for rendering ──
  const setValidationErrors = useCallback(
    (errors) => {
      setNodes((nds) =>
        nds.map((n) => ({
          ...n,
          data: { ...n.data, _validationError: errors.has(n.id) },
        }))
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

/**
 * VIaC – Main Application Shell
 *
 * Layout: Sidebar | Canvas + Toolbar | Properties Panel
 *         ──────── Terminal Console ────────
 *
 * Now includes canvas validation (AZ-Region checks, SG rules)
 * that blocks Plan/Apply when errors exist.
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { ReactFlowProvider } from "@xyflow/react";

import Sidebar from "./components/Sidebar";
import Canvas from "./components/Canvas";
import PropertiesPanel from "./components/PropertiesPanel";
import Toolbar from "./components/Toolbar";
import TerminalConsole from "./components/TerminalConsole";
import useDeployment from "./hooks/useDeployment";
import canvasToPayload from "./utils/canvasToPayload";
import { validateCanvas } from "./utils/validation";

export default function App() {
  const [selectedNode, setSelectedNode] = useState(null);
  const [validationErrors, setValidationErrors] = useState(new Map());
  const nodesRef = useRef([]);
  const edgesRef = useRef([]);
  const canvasRef = useRef(null);

  const { plan, apply, destroy, loading, action, logs, clearLogs } = useDeployment();

  // ── Run validation whenever nodes change ──────────────────
  const runValidation = useCallback(() => {
    const nodes = nodesRef.current;
    if (!nodes || nodes.length === 0) {
      setValidationErrors(new Map());
      return;
    }
    const { errors } = validateCanvas(nodes);
    setValidationErrors(errors);

    // Stamp _validationError on node data for visual rendering
    canvasRef.current?.setValidationErrors(errors);
  }, []);

  // ── Build payload from canvas state ───────────────────────
  const buildPayload = useCallback(() => {
    return canvasToPayload(nodesRef.current, edgesRef.current);
  }, []);

  // ── Toolbar actions ───────────────────────────────────────
  const handlePlan = useCallback(() => {
    runValidation();

    // Re-check after validation
    const { errors, hasErrors } = validateCanvas(nodesRef.current);
    if (hasErrors) {
      const errorCount = errors.size;
      const errorMessages = [...errors.values()].flat();
      alert(
        `Cannot plan: ${errorCount} node(s) have validation errors:\n\n` +
        errorMessages.map((e) => `• ${e}`).join("\n")
      );
      return;
    }

    const payload = buildPayload();
    if (payload.resources.length === 0) {
      alert("Drop some resources onto the canvas first!");
      return;
    }
    plan(payload);
  }, [buildPayload, plan, runValidation]);

  const handleApply = useCallback(() => {
    runValidation();

    const { errors, hasErrors } = validateCanvas(nodesRef.current);
    if (hasErrors) {
      const errorMessages = [...errors.values()].flat();
      alert(
        `Cannot apply: Validation errors detected:\n\n` +
        errorMessages.map((e) => `• ${e}`).join("\n")
      );
      return;
    }

    const payload = buildPayload();
    if (payload.resources.length === 0) {
      alert("Drop some resources onto the canvas first!");
      return;
    }
    if (window.confirm("This will provision real AWS resources. Continue?")) {
      apply(payload);
    }
  }, [buildPayload, apply, runValidation]);

  const handleDestroy = useCallback(() => {
    if (window.confirm("This will DESTROY all resources in the workspace. Are you sure?")) {
      destroy();
    }
  }, [destroy]);

  // ── Update node from properties panel ─────────────────────
  const handleUpdateNode = useCallback(
    (nodeId, newData) => {
      canvasRef.current?.updateNodeData(nodeId, newData);
      // Also update selectedNode for immediate panel refresh
      setSelectedNode((prev) =>
        prev?.id === nodeId ? { ...prev, data: newData } : prev
      );
      // Re-validate after property change (debounced via setTimeout)
      setTimeout(runValidation, 100);
    },
    [runValidation]
  );

  // ── Handle selection + trigger validation ─────────────────
  const handleSelectionChange = useCallback(
    (node) => {
      setSelectedNode(node);
      runValidation();
    },
    [runValidation]
  );

  return (
    <ReactFlowProvider>
      <div className="w-screen h-screen flex flex-col bg-viac-navy overflow-hidden">
        {/* ── Toolbar ────────────────────────────── */}
        <Toolbar
          onPlan={handlePlan}
          onApply={handleApply}
          onDestroy={handleDestroy}
          loading={loading}
          action={action}
          hasErrors={validationErrors.size > 0}
        />

        {/* ── Main content ───────────────────────── */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left: Resource palette */}
          <Sidebar />

          {/* Center: Canvas */}
          <Canvas
            ref={canvasRef}
            onSelectionChange={handleSelectionChange}
            nodesRef={nodesRef}
            edgesRef={edgesRef}
            onNodesUpdate={runValidation}
          />

          {/* Right: Properties editor */}
          <PropertiesPanel
            selectedNode={selectedNode}
            onUpdateNode={handleUpdateNode}
            allNodes={nodesRef.current}
            validationErrors={validationErrors}
          />
        </div>

        {/* ── Bottom: Terminal ────────────────────── */}
        <TerminalConsole logs={logs} onClear={clearLogs} />
      </div>
    </ReactFlowProvider>
  );
}

/**
 * VIaC – useDeployment Hook
 *
 * Handles API calls to the FastAPI backend for plan/apply/destroy.
 */

import { useState, useCallback } from "react";
import axios from "axios";

const API_BASE = "/api";

const api = axios.create({
  baseURL: API_BASE,
  timeout: 600_000,   // 10 min for apply
  headers: { "Content-Type": "application/json" },
});

export default function useDeployment() {
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState(null);     // "plan" | "apply" | "destroy"
  const [result, setResult] = useState(null);
  const [logs, setLogs] = useState([]);

  const addLog = useCallback((type, message) => {
    const timestamp = new Date().toLocaleTimeString("en-US", { hour12: false });
    setLogs((prev) => [...prev, { type, message, timestamp }]);
  }, []);

  const clearLogs = useCallback(() => setLogs([]), []);

  const plan = useCallback(async (payload) => {
    setLoading(true);
    setAction("plan");
    setResult(null);
    addLog("info", "▶ Starting terraform plan...");

    try {
      const { data } = await api.post("/plan", payload);
      setResult(data);

      if (data.init_result?.stdout) addLog("stdout", data.init_result.stdout);
      if (data.init_result?.stderr) addLog("stderr", data.init_result.stderr);
      if (data.plan_result?.stdout) addLog("stdout", data.plan_result.stdout);
      if (data.plan_result?.stderr) addLog("stderr", data.plan_result.stderr);

      addLog(
        data.success ? "success" : "error",
        data.success ? "✓ Plan completed successfully" : "✗ Plan failed"
      );
      // If backend returned structured diagnostics, log them for visibility
      if (data.diagnostics && Array.isArray(data.diagnostics) && data.diagnostics.length > 0) {
        addLog("error", "─── Diagnostics ───");
        data.diagnostics.forEach((d) => {
          const id = d.node_id || d.nodeId || d.nodeId;
          addLog("error", `${id}: ${d.message || d.resource_address || JSON.stringify(d)}`);
        });
      }
      return data;
    } catch (err) {
      const msg = err.response?.data?.detail || err.message;
      addLog("error", `✗ Plan error: ${msg}`);
      setResult({ success: false, error: msg });
      return null;
    } finally {
      setLoading(false);
    }
  }, [addLog]);

  const render = useCallback(async (payload) => {
    setLoading(true);
    setAction("render");
    addLog("info", "▶ Rendering HCL preview...");
    try {
      const { data } = await api.post("/render", payload);
      if (data?.hcl) {
        addLog("stdout", data.hcl);
      }
      return data;
    } catch (err) {
      const msg = err.response?.data?.detail || err.message;
      addLog("error", `✗ Render error: ${msg}`);
      return null;
    } finally {
      setLoading(false);
    }
  }, [addLog]);

  const apply = useCallback(async (payload) => {
    setLoading(true);
    setAction("apply");
    setResult(null);
    addLog("info", "▶ Starting terraform apply...");

    try {
      const { data } = await api.post("/apply", payload);
      setResult(data);

      if (data.init_result?.stdout) addLog("stdout", data.init_result.stdout);
      if (data.init_result?.stderr) addLog("stderr", data.init_result.stderr);
      if (data.apply_result?.stdout) addLog("stdout", data.apply_result.stdout);
      if (data.apply_result?.stderr) addLog("stderr", data.apply_result.stderr);

      if (data.terraform_outputs) {
        addLog("info", "─── Terraform Outputs ───");
        Object.entries(data.terraform_outputs).forEach(([k, v]) => {
          addLog("output", `  ${k} = ${v}`);
        });
      }

      addLog(
        data.success ? "success" : "error",
        data.success ? "✓ Apply completed successfully" : "✗ Apply failed"
      );
      if (data.diagnostics && Array.isArray(data.diagnostics) && data.diagnostics.length > 0) {
        addLog("error", "─── Diagnostics ───");
        data.diagnostics.forEach((d) => {
          const id = d.node_id || d.nodeId || d.nodeId;
          addLog("error", `${id}: ${d.message || d.resource_address || JSON.stringify(d)}`);
        });
      }
      return data;
    } catch (err) {
      const msg = err.response?.data?.detail || err.message;
      addLog("error", `✗ Apply error: ${msg}`);
      setResult({ success: false, error: msg });
      return null;
    } finally {
      setLoading(false);
    }
  }, [addLog]);

  const destroy = useCallback(async () => {
    setLoading(true);
    setAction("destroy");
    setResult(null);
    addLog("info", "▶ Starting terraform destroy...");

    try {
      const { data } = await api.post("/destroy");
      setResult(data);

      if (data.init_result?.stdout) addLog("stdout", data.init_result.stdout);
      if (data.init_result?.stderr) addLog("stderr", data.init_result.stderr);
      if (data.destroy_result?.stdout) addLog("stdout", data.destroy_result.stdout);
      if (data.destroy_result?.stderr) addLog("stderr", data.destroy_result.stderr);

      addLog(
        data.success ? "success" : "error",
        data.success ? "✓ Destroy completed successfully" : "✗ Destroy failed"
      );
      return data;
    } catch (err) {
      const msg = err.response?.data?.detail || err.message;
      addLog("error", `✗ Destroy error: ${msg}`);
      setResult({ success: false, error: msg });
      return null;
    } finally {
      setLoading(false);
    }
  }, [addLog]);

  return { plan, apply, destroy, render, loading, action, result, logs, clearLogs };
}

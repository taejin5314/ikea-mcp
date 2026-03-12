import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 3099;

const server = spawn("node", [join(__dirname, "dist/http.js")], {
  env: { ...process.env, PORT: String(PORT) },
  stdio: ["ignore", "ignore", "pipe"],
});

await new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error("server start timeout")), 5000);
  server.stderr.on("data", (d) => {
    if (d.toString().includes("listening")) { clearTimeout(t); resolve(); }
  });
});

function parseSse(text) {
  for (const line of text.split("\n")) {
    if (line.startsWith("data: ")) return JSON.parse(line.slice(6));
  }
  throw new Error("no SSE data line: " + text.slice(0, 200));
}

async function post(body) {
  const res = await fetch(`http://localhost:${PORT}/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json, text/event-stream" },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: parseSse(await res.text()) };
}

try {
  // initialize
  const init = await post({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "smoke-http", version: "1" } } });
  console.log("HTTP INIT:", init.json.result?.serverInfo?.name ?? "FAIL " + JSON.stringify(init.json.error));

  // tools/list
  const list = await post({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
  const names = list.json.result?.tools?.map((t) => t.name);
  console.log("HTTP TOOLS:", names);

  // check_store_stock — standard 3-digit
  const cs = await post({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "check_store_stock", arguments: { itemNo: "20522046", storeId: "399" } } });
  if (cs.json.error) {
    console.log("HTTP check_store_stock FAIL:", JSON.stringify(cs.json.error));
  } else {
    const d = JSON.parse(cs.json.result.content[0].text);
    const match = d.storeLabel === "399 (Burbank, CA)" && typeof d.quantity === "number";
    console.log(`HTTP check_store_stock OK — label: ${d.storeLabel} qty: ${d.quantity} shape: ${match ? "OK" : "MISMATCH"}`);
  }

  // find_best_store_for_item
  const best = await post({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "find_best_store_for_item", arguments: { itemNo: "20522046", storeIds: ["399", "026", "921"], maxResults: 2 } } });
  if (best.json.error) {
    console.log("HTTP find_best_store_for_item FAIL:", JSON.stringify(best.json.error));
  } else {
    const d = JSON.parse(best.json.result.content[0].text);
    console.log(`HTTP find_best_store_for_item OK — ${d.length} result(s), top: ${d[0]?.storeId} qty: ${d[0]?.quantity}`);
  }

  // missing Accept header → expect error
  const noAccept = await fetch(`http://localhost:${PORT}/mcp`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  const noAcceptBody = await noAccept.json();
  console.log("HTTP missing Accept:", noAcceptBody.error ? `error code ${noAcceptBody.error.code} OK` : "UNEXPECTED " + JSON.stringify(noAcceptBody).slice(0, 80));

  // invalid path → 404
  const inv = await fetch(`http://localhost:${PORT}/foo`);
  console.log("HTTP invalid path:", inv.status === 404 ? "404 OK" : "UNEXPECTED " + inv.status);

} catch (e) {
  console.error("ERROR:", e.message);
} finally {
  server.kill();
  process.exit(0);
}

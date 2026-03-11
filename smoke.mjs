import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const server = spawn("node", [join(__dirname, "dist/index.js")], {
  stdio: ["pipe", "pipe", "pipe"],
});

let lines = [];
let _buf = "";
server.stdout.on("data", (d) => {
  _buf += d.toString();
  let idx;
  while ((idx = _buf.indexOf("\n")) !== -1) {
    const line = _buf.slice(0, idx);
    _buf = _buf.slice(idx + 1);
    if (line.trim()) lines.push(line);
  }
});
server.stderr.on("data", (d) => process.stderr.write(d));

function send(msg) {
  server.stdin.write(JSON.stringify(msg) + "\n");
}

function readNext(timeout = 10000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), timeout);
    const check = () => {
      if (lines.length > 0) {
        clearTimeout(t);
        resolve(JSON.parse(lines.shift()));
      } else {
        setTimeout(check, 50);
      }
    };
    check();
  });
}

try {
  send({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test", version: "1" } } });
  const init = await readNext();
  console.log("INIT:", init.result?.serverInfo?.name ?? JSON.stringify(init).slice(0, 80));

  send({ jsonrpc: "2.0", method: "notifications/initialized", params: {} });

  send({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
  const list = await readNext();
  console.log("TOOLS:", list.result?.tools?.map((t) => t.name));

  // search_products
  send({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "search_products", arguments: { query: "billy", size: 1 } } });
  const sp = await readNext(15000);
  if (sp.error) {
    console.log("search_products FAIL:", JSON.stringify(sp.error));
  } else {
    const d = JSON.parse(sp.result.content[0].text);
    const item = d.items?.[0];
    console.log("search_products OK — total:", d.total, "name:", item?.name, "itemNo:", item?.itemNo);
  }

  // check_store_stock
  send({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "check_store_stock", arguments: { itemNo: "20522046", storeId: "399" } } });
  const cs = await readNext(10000);
  if (cs.error) {
    console.log("check_store_stock FAIL:", JSON.stringify(cs.error));
  } else {
    const d = JSON.parse(cs.result.content[0].text);
console.log("check_store_stock OK — qty:", d.quantity, "status:", d.messageType);
  }

  // compare_store_stock (399=Burbank CA, 448=Canton MI)
  send({ jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "compare_store_stock", arguments: { itemNo: "20522046", storeIds: ["399", "448"] } } });
  const cmp = await readNext(10000);
  if (cmp.error) {
    console.log("compare_store_stock FAIL:", JSON.stringify(cmp.error));
  } else {
    const d = JSON.parse(cmp.result.content[0].text);
    d.forEach((r) => {
      const qty = r.quantity;
      const err = r.errors?.[0]?.message;
      console.log(`compare_store_stock store ${r.storeId} — qty: ${qty ?? "n/a"} err: ${err ?? "none"}`);
    });
  }
} catch (e) {
  console.error("ERROR:", e.message);
} finally {
  server.kill();
  process.exit(0);
}

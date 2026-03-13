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

  // check_store_stock — standard 3-digit (399 Burbank CA)
  send({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "check_store_stock", arguments: { itemNo: "20522046", storeId: "399" } } });
  const cs = await readNext(10000);
  if (cs.error) {
    console.log("check_store_stock[399] FAIL:", JSON.stringify(cs.error));
  } else {
    const d = JSON.parse(cs.result.content[0].text);
    console.log("check_store_stock[399] OK — label:", d.storeLabel, "qty:", d.quantity, "status:", d.messageType);
  }

  // check_store_stock — leading-zero 3-digit (026 Canton MI)
  send({ jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "check_store_stock", arguments: { itemNo: "20522046", storeId: "026" } } });
  const cs026 = await readNext(10000);
  if (cs026.error) {
    console.log("check_store_stock[026] FAIL:", JSON.stringify(cs026.error));
  } else {
    const d = JSON.parse(cs026.result.content[0].text);
    console.log("check_store_stock[026] OK — label:", d.storeLabel, "qty:", d.quantity, "err:", d.errors?.[0]?.code ?? "none");
  }

  // check_store_stock — 4-digit (921 Brooklyn NY)
  send({ jsonrpc: "2.0", id: 6, method: "tools/call", params: { name: "check_store_stock", arguments: { itemNo: "20522046", storeId: "921" } } });
  const cs921 = await readNext(10000);
  if (cs921.error) {
    console.log("check_store_stock[921] FAIL:", JSON.stringify(cs921.error));
  } else {
    const d = JSON.parse(cs921.result.content[0].text);
    console.log("check_store_stock[921] OK — label:", d.storeLabel, "qty:", d.quantity, "err:", d.errors?.[0]?.code ?? "none");
  }

  // check_store_stock — invalid store (999 → expect 405)
  send({ jsonrpc: "2.0", id: 7, method: "tools/call", params: { name: "check_store_stock", arguments: { itemNo: "20522046", storeId: "999" } } });
  const cs999 = await readNext(10000);
  if (cs999.error) {
    console.log("check_store_stock[999] FAIL:", JSON.stringify(cs999.error));
  } else {
    const d = JSON.parse(cs999.result.content[0].text);
    const code = d.errors?.[0]?.code;
    console.log(`check_store_stock[999] ${code === 405 ? "OK (405 as expected)" : "UNEXPECTED — code: " + code}`);
  }

  // compare_store_stock — mixed: standard + leading-zero + 4-digit
  send({ jsonrpc: "2.0", id: 8, method: "tools/call", params: { name: "compare_store_stock", arguments: { itemNo: "20522046", storeIds: ["399", "026", "921"] } } });
  const cmp = await readNext(10000);
  if (cmp.error) {
    console.log("compare_store_stock FAIL:", JSON.stringify(cmp.error));
  } else {
    const d = JSON.parse(cmp.result.content[0].text);
    d.forEach((r) => {
      console.log(`compare_store_stock[${r.storeId}] — label: ${r.storeLabel ?? "none"} qty: ${r.quantity ?? "n/a"} err: ${r.errors?.[0]?.code ?? "none"}`);
    });
  }
  // find_best_store_for_item — explicit 3-store subset
  send({ jsonrpc: "2.0", id: 9, method: "tools/call", params: { name: "find_best_store_for_item", arguments: { itemNo: "20522046", storeIds: ["399", "026", "921"], maxResults: 3 } } });
  const best = await readNext(15000);
  if (best.error) {
    console.log("find_best_store_for_item FAIL:", JSON.stringify(best.error));
  } else {
    const d = JSON.parse(best.result.content[0].text);
    console.log(`find_best_store_for_item OK — ${d.length} result(s), top: storeId=${d[0]?.storeId} qty=${d[0]?.quantity}`);
  }
  // get_product_details
  send({ jsonrpc: "2.0", id: 10, method: "tools/call", params: { name: "get_product_details", arguments: { itemNo: "20522046" } } });
  const gpd = await readNext(15000);
  if (gpd.error) {
    console.log("get_product_details FAIL:", JSON.stringify(gpd.error));
  } else {
    const d = JSON.parse(gpd.result.content[0].text);
    const ok = d.itemNo === "20522046" && d.name && d.salesPrice?.amount;
    console.log(`get_product_details ${ok ? "OK" : "MISMATCH"} — name: ${d.name} type: ${d.typeName} price: ${d.salesPrice?.amount} measure: ${d.measureText}`);
  }
  // check_multi_item_stock — two real items at store 399
  send({ jsonrpc: "2.0", id: 11, method: "tools/call", params: { name: "check_multi_item_stock", arguments: { storeId: "399", itemNos: ["20522046", "40477340"] } } });
  const multi = await readNext(15000);
  if (multi.error) {
    console.log("check_multi_item_stock FAIL:", JSON.stringify(multi.error));
  } else {
    const d = JSON.parse(multi.result.content[0].text);
    const ordered = d[0]?.itemNo === "20522046" && d[1]?.itemNo === "40477340";
    const allArrayErrors = d.every((r) => Array.isArray(r.errors));
    console.log(`check_multi_item_stock ${ordered && allArrayErrors ? "OK" : "MISMATCH"} — items: ${d.length}, qty[0]: ${d[0]?.quantity}, qty[1]: ${d[1]?.quantity}`);
  }
} catch (e) {
  console.error("ERROR:", e.message);
} finally {
  server.kill();
  process.exit(0);
}

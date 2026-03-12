import { createServer as createHttpServer, IncomingMessage, ServerResponse } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "./server.js";

const PORT = Number(process.env.PORT ?? 3000);
const BODY_LIMIT = 1024 * 1024; // 1 MB

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let raw = "";
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > BODY_LIMIT) {
        reject(new Error("request body too large"));
        req.destroy();
        return;
      }
      raw += chunk.toString();
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : undefined);
      } catch {
        reject(new Error("invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json" }).end(payload);
}

const httpServer = createHttpServer(async (req: IncomingMessage, res: ServerResponse) => {
  const method = req.method ?? "";
  const url = req.url ?? "";
  console.error(`${new Date().toISOString()} ${method} ${url}`);

  try {
    if (url === "/health") {
      sendJson(res, 200, { status: "ok" });
      return;
    }

    if (method === "POST" && url === "/mcp") {
      const body = await readBody(req);
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      await createServer().connect(transport);
      await transport.handleRequest(req, res, body);
      return;
    }

    res.writeHead(404).end("Not found");
  } catch (err) {
    const message = err instanceof Error ? err.message : "internal error";
    console.error(`ERROR ${method} ${url}:`, message);
    if (!res.headersSent) {
      sendJson(res, 500, { error: message });
    }
  }
});

httpServer.listen(PORT, () => {
  console.error(`ikea-mcp HTTP listening on http://localhost:${PORT}/mcp`);
  console.error(`health: http://localhost:${PORT}/health`);
});

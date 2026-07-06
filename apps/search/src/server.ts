import { createServer } from "node:http";
import { handleRequest } from "./index";

const port = Number(process.env.PORT || 3001);
const host = process.env.HOST || "::";

const server = createServer(async (request, response) => {
  try {
    const origin = `http://${request.headers.host || `${host}:${port}`}`;
    const headers = new Headers();
    for (const [name, value] of Object.entries(request.headers)) {
      if (Array.isArray(value)) {
        for (const item of value) headers.append(name, item);
      } else if (value !== undefined) {
        headers.set(name, value);
      }
    }
    const webRequest = new Request(new URL(request.url || "/", origin), {
      method: request.method,
      headers,
    });
    const webResponse = await handleRequest(webRequest);

    response.writeHead(
      webResponse.status,
      Object.fromEntries(webResponse.headers.entries())
    );

    const body = Buffer.from(await webResponse.arrayBuffer());
    response.end(body);
  } catch (error) {
    console.error(error);
    response.writeHead(500, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "Internal server error" }));
  }
});

server.listen(port, host, () => {
  console.log(`Search service listening on http://${host}:${port}`);
});

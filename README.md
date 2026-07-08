# MCP Client ![Version][version-image]

![Angular][angular-image]
![NSP Status][nspstatus-image]

An [Angular](https://angular.dev/) client that demonstrates connecting to the [Model Context Protocol](https://modelcontextprotocol.io/) server in [MCP-Server](https://github.com/arjunkhetia/MCP-Server) directly from browser JavaScript - no MCP SDK, no proxy, just `HttpClient` speaking the Streamable HTTP protocol - and rendering the result of all six demo tools in a single dashboard.

```bash
$ git clone https://github.com/arjunkhetia/MCP-Client.git
```

Install dependencies:

```bash
$ npm install
```

Start the Angular dev server at `http://localhost:4200/`:

```bash
$ npm start
```

This client talks to [MCP-Server](https://github.com/arjunkhetia/MCP-Server) at `http://localhost:3000/mcp`, so that project needs to be running too:

```bash
$ cd ../MCP-Server && npm start
```

Then open `http://localhost:4200` - the dashboard connects automatically and shows a "Connected to mcp-server v1.0.0 · session &hellip;" banner once the handshake succeeds.

# Why MCP-Server needed a small CORS change

MCP-Server's Streamable HTTP transport is **stateful**: `initialize` returns an `Mcp-Session-Id` response header, and every request after that must send it back so the server can find the right in-memory transport. A browser making that request cross-origin (`localhost:4200` &#8594; `localhost:3000`) hits two CORS rules that a same-origin Node/Postman client never runs into:

- A **custom request header** (`Mcp-Session-Id`) triggers a preflight `OPTIONS` request, so the server must explicitly allow it via `Access-Control-Allow-Headers` - and it must actually answer that preflight (browsers expect a fast `2xx`, not the app's normal 404/405 handling).
- A **custom response header** is invisible to client-side JavaScript on a cross-origin response unless the server lists it in `Access-Control-Expose-Headers` - otherwise `initialize`'s session id can never be read back out.

[MCP-Server's `app.js`](https://github.com/arjunkhetia/MCP-Server/blob/main/app.js) now adds `Mcp-Session-Id` to both of those, and short-circuits `OPTIONS` requests with a `204`. Nothing about the MCP server's own protocol handling changed - only what a browser is allowed to see and send.

# Architecture

```
MCP-Client/
├── src/app/
    ├── services/
    │   └── mcp.service.ts      # Streamable HTTP client: session handshake, requests, SSE parsing
    └── components/
        └── dashboard/           # One card per tool, wired to McpService
```

[`McpService`](src/app/services/mcp.service.ts) is a plain Angular service built on `HttpClient` - it does everything an MCP client library would, at a scale small enough to read in one file:

1. **`initialize`** - sends the JSON-RPC handshake, captures the `Mcp-Session-Id` response header.
2. **`notifications/initialized`** - the notification the spec requires right after a successful `initialize`, before any other request.
3. **`tools/list`** - fetches the tool catalog shown as cards.
4. **`tools/call`** - invokes a tool by name with arguments and returns its `content` array.

One detail that trips up a naive `fetch`/`HttpClient` implementation: MCP-Server's transport responds to every request as **Server-Sent Events** (`event: message\ndata: {...}`), even for a single one-shot JSON-RPC reply - it's not a plain JSON body. `McpService` requests the response as text and pulls the JSON-RPC payload out of the last `data:` line rather than assuming a bare JSON body.

# Dashboard tools

Each card calls the matching tool on MCP-Server and renders its result:

| Card | Tool | What it shows |
| --- | --- | --- |
| Ping | `ping` | The echoed `pong: <message>` response. |
| Text Stats | `text-stats` | Word/character/sentence/line counts and estimated reading time as stat tiles. |
| Generate Avatar | `generate-avatar` | The returned base64 SVG, rendered as an `<img>` via a `data:` URI. |
| List Sample Files | `list-files` | Each file as a clickable chip - clicking one loads it into Read Sample File. |
| Read Sample File | `read-file` | The file's raw contents in a scrollable `<pre>` block. |
| Roll Dice | `roll-dice` | Individual rolls and their total. |

# Dashboard (MCP Client) -

### Dashboard
![1](https://github.com/arjunkhetia/MCP-Client/blob/main/public/1.png "1")

### Dashboard (with response)
![2](https://github.com/arjunkhetia/MCP-Client/blob/main/public/2.png "2")

# Connecting to a different server

`MCP_SERVER_URL` in [`mcp.service.ts`](src/app/services/mcp.service.ts) is the only place the server address is configured - point it at a deployed MCP-Server instance (or another Streamable HTTP MCP server) and update its CORS configuration the same way described above.

[version-image]: https://img.shields.io/badge/Version-0.0.0-orange.svg
[angular-image]: https://img.shields.io/badge/Angular-22-dd0031.svg
[nspstatus-image]: https://img.shields.io/badge/nsp-no_known_vulns-blue.svg

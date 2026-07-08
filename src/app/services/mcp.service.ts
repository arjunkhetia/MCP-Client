import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface McpTool {
  name: string;
  title?: string;
  description?: string;
  inputSchema?: unknown;
}

export interface McpContentItem {
  type: string;
  text?: string;
  data?: string;
  mimeType?: string;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id?: number | string | null;
  result?: any;
  error?: { code: number; message: string };
}

// MCP-Server (the Express demo) is a stateful Streamable HTTP server: it
// keeps one transport alive per mcp-session-id, issued on the initialize
// response and required on every request after that.
const MCP_SERVER_URL = 'http://localhost:3000/mcp';

@Injectable({ providedIn: 'root' })
export class McpService {
  readonly connected = signal(false);
  readonly connecting = signal(false);
  readonly sessionId = signal<string | null>(null);
  readonly serverInfo = signal<{ name: string; version: string } | null>(null);
  readonly tools = signal<McpTool[]>([]);
  readonly error = signal<string | null>(null);

  private nextId = 1;

  constructor(private http: HttpClient) {}

  async connect(): Promise<void> {
    if (this.connecting()) {
      return;
    }

    this.connecting.set(true);
    this.error.set(null);
    this.connected.set(false);
    this.sessionId.set(null);

    try {
      const initResult = await this.request(
        'initialize',
        {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'mcp-client-angular', version: '1.0.0' }
        },
        { captureSessionId: true }
      );
      this.serverInfo.set(initResult.serverInfo ?? null);

      // Required by the MCP spec: tells the server the client has finished
      // processing the initialize response before any further requests.
      await this.notify('notifications/initialized');

      const toolsResult = await this.request('tools/list', {});
      this.tools.set(toolsResult.tools ?? []);

      this.connected.set(true);
    } catch (err) {
      this.error.set(this.describeError(err));
    } finally {
      this.connecting.set(false);
    }
  }

  async callTool(name: string, args: Record<string, unknown> = {}): Promise<McpContentItem[]> {
    const result = await this.request('tools/call', { name, arguments: args });
    if (result?.isError) {
      throw new Error(result.content?.[0]?.text || 'Tool call failed');
    }
    return result?.content ?? [];
  }

  private async request(
    method: string,
    params: unknown,
    options: { captureSessionId?: boolean } = {}
  ): Promise<any> {
    const body = { jsonrpc: '2.0', id: this.nextId++, method, params };
    const response = await firstValueFrom(
      this.http.post(MCP_SERVER_URL, body, {
        headers: this.buildHeaders(),
        observe: 'response',
        responseType: 'text'
      })
    );

    if (options.captureSessionId) {
      const sid = response.headers.get('mcp-session-id');
      if (sid) {
        this.sessionId.set(sid);
      }
    }

    const message = parseJsonRpcMessage(response.body ?? '');
    if (message?.error) {
      throw new Error(message.error.message || 'MCP server returned an error');
    }
    return message?.result;
  }

  private async notify(method: string, params: unknown = {}): Promise<void> {
    const body = { jsonrpc: '2.0', method, params };
    await firstValueFrom(
      this.http.post(MCP_SERVER_URL, body, {
        headers: this.buildHeaders(),
        responseType: 'text'
      })
    );
  }

  private buildHeaders(): HttpHeaders {
    let headers = new HttpHeaders({
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream'
    });
    const sid = this.sessionId();
    if (sid) {
      headers = headers.set('mcp-session-id', sid);
    }
    return headers;
  }

  private describeError(err: unknown): string {
    if (err instanceof Error) {
      return err.message;
    }
    return 'Could not reach the MCP server at ' + MCP_SERVER_URL + '. Is it running?';
  }
}

// Streamable HTTP responses arrive either as a single JSON body or as
// Server-Sent Events ("event: message\ndata: {...}\n\n") - MCP-Server always
// uses the latter, so this pulls the JSON-RPC payload out of either shape.
function parseJsonRpcMessage(raw: string): JsonRpcResponse | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return JSON.parse(trimmed);
  }

  const dataLines = trimmed
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim());

  if (!dataLines.length) {
    return null;
  }

  return JSON.parse(dataLines[dataLines.length - 1]);
}

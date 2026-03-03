# Genkit MCP (`genkit_mcp`)

MCP (Model Context Protocol) integration for Genkit Dart.

## MCP Client (Single Server)
Connect to an MCP server and register its tools, prompts, and resources.

```dart
import 'package:genkit/genkit.dart';
import 'package:genkit_mcp/genkit_mcp.dart';

void main() async {
  final ai = Genkit();

  final client = defineMcpClient(
    ai,
    McpClientOptionsWithCache(
      name: 'my-client',
      mcpServer: McpServerConfig(
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', '.'],
      ),
    ),
  );
  await client.ready();

  // Tools are automatically available through the registry.
  final tools = await client.getActiveTools(ai);
}
```

## MCP Host (Multiple Servers)
Connect to multiple MCP servers and aggregate their capabilities.

```dart
final host = defineMcpHost(
  ai,
  McpHostOptionsWithCache(
    name: 'my-host',
    mcpServers: {
      'fs': McpServerConfig(
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', '.'],
      ),
      'memory': McpServerConfig(
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-memory'],
      ),
    },
  ),
);
```

## MCP Server
Expose Genkit actions (tools, prompts, resources) over MCP.

```dart
import 'package:genkit/genkit.dart';
import 'package:genkit_mcp/genkit_mcp.dart';

void main() async {
  final ai = Genkit();

  ai.defineTool(
    name: 'add',
    description: 'Add two numbers together',
    inputSchema: .map(.string(), .dynamicSChema()),
    fn: (input, _) async => (input['a'] + input['b']).toString(),
  );

  ai.defineResource(
    name: 'my-resource',
    uri: 'my://resource',
    fn: (_, _) async => ResourceOutput(content: [TextPart(text: 'my resource')]),
  );

  // Stdio transport by default
  final server = createMcpServer(ai, McpServerOptions(name: 'my-server'));
  await server.start();
}
```

### Streamable HTTP Transport
```dart
import 'dart:io';

final transport = await StreamableHttpServerTransport.bind(
  address: InternetAddress.loopbackIPv4,
  port: 3000,
);
await server.start(transport);
```

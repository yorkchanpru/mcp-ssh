// Export types
export * from "./types.js";

// Export the main server class
export { McpSshServer } from "./mcp-server.js";

// Export the SSH service for advanced usage
export { SshService } from "./ssh-service.js";

// Export logger and logging types
export { createCustomLogger, logger, LoggerOptions } from "./logger.js";

/**
 * Start an MCP SSH server with the given options
 * @param options Server configuration options
 * @returns Promise that resolves to the server instance
 */
import { McpSshServer } from "./mcp-server.js";
import { McpSshServerOptions } from "./types.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SshService } from "./ssh-service.js";
import { createCustomLogger, logger as defaultLogger } from "./logger.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

export async function startServer(options: McpSshServerOptions = {}): Promise<McpSshServer> {
  const server = new McpSshServer(options);
  await server.start();

  // Handle graceful shutdown on SIGINT and SIGTERM
  const shutdown = async () => {
    await server.stop();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  return server;
}

/**
 * Run a server with stdin/stdout transport (for direct LLM communication)
 * This mode is useful for direct integration with LLMs or MCP clients
 * that expect stdio communication
 */
export async function runStdioServer() {
  // Create a simpler logger for stdio mode
  const logger = createCustomLogger({
    level: (process.env.MCP_SSH_LOG_LEVEL || "info") as "debug" | "info" | "warn" | "error",
    prettyPrint: false, // Plain format for file redirection
  });

  // Redirect console to file manually if needed
  if (process.env.MCP_SSH_LOG_FILE) {
    console.warn(`Logging to ${process.env.MCP_SSH_LOG_FILE} not implemented. Using console logging.`);
    console.warn(`You can redirect output manually: node dist/cli.js --stdio > ${process.env.MCP_SSH_LOG_FILE} 2>&1`);
  }

  logger.info("Starting MCP SSH Server in stdio mode");

  // Create the SSH service
  const sshService = new SshService();

  // Create the MCP server
  const server = new Server(
    {
      name: "mcp-ssh",
      description: "MCP server for SSH access to remote virtual machines",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  // Register the handlers
  // Handler that lists available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    logger.debug("Listing available tools");
    return {
      tools: [
        {
          name: "ssh.connect",
          description: "Connect to an SSH server",
          inputSchema: {
            type: "object",
            properties: {
              host: {
                type: "string",
                description: "Hostname or IP address of the remote server",
              },
              port: {
                type: "number",
                description: "SSH port (default: 22)",
              },
              username: {
                type: "string",
                description: "Username for authentication",
              },
              password: {
                type: "string",
                description: "Password for authentication",
              },
              privateKey: {
                type: "string",
                description: "Private key for key-based authentication",
              },
              passphrase: {
                type: "string",
                description: "Passphrase for the private key",
              },
            },
            required: ["host", "username"],
          },
        },
        {
          name: "ssh.execute",
          description: "Execute a command on the remote server",
          inputSchema: {
            type: "object",
            properties: {
              sessionId: {
                type: "string",
                description: "Session ID from a previous successful connect call",
              },
              command: {
                type: "string",
                description: "Command to execute",
              },
            },
            required: ["sessionId", "command"],
          },
        },
        {
          name: "ssh.uploadFile",
          description: "Upload a file to the remote server",
          inputSchema: {
            type: "object",
            properties: {
              sessionId: {
                type: "string",
                description: "Session ID from a previous successful connect call",
              },
              content: {
                type: "string",
                description: "Content to upload",
              },
              remotePath: {
                type: "string",
                description: "Destination path on the remote server",
              },
            },
            required: ["sessionId", "content", "remotePath"],
          },
        },
        {
          name: "ssh.downloadFile",
          description: "Download a file from the remote server",
          inputSchema: {
            type: "object",
            properties: {
              sessionId: {
                type: "string",
                description: "Session ID from a previous successful connect call",
              },
              remotePath: {
                type: "string",
                description: "Path on the remote server",
              },
              encoding: {
                type: "string",
                description: "Encoding to use (default: utf8)",
                enum: ["utf8", "ascii", "base64", "binary", "hex", "latin1", "ucs2", "utf16le"],
              },
            },
            required: ["sessionId", "remotePath"],
          },
        },
        {
          name: "ssh.disconnect",
          description: "Close an SSH connection",
          inputSchema: {
            type: "object",
            properties: {
              sessionId: {
                type: "string",
                description: "Session ID to disconnect",
              },
            },
            required: ["sessionId"],
          },
        },
      ],
    };
  });

  // Handler for tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;
    logger.debug(`Tool call received: ${name}`, { args });

    try {
      switch (name) {
        case "ssh.connect": {
          logger.info(`Connecting to SSH server: ${args.host}:${args.port || 22}`, {
            username: args.username,
            usePrivateKey: !!args.privateKey,
          });
          const result = await sshService.connect({
            host: String(args.host),
            port: typeof args.port === "number" ? args.port : undefined,
            username: String(args.username),
            password: args.password ? String(args.password) : undefined,
            privateKey: args.privateKey ? String(args.privateKey) : undefined,
            passphrase: args.passphrase ? String(args.passphrase) : undefined,
          });

          if (result.success) {
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({
                    sessionId: result.sessionId,
                    success: true,
                  }),
                },
              ],
            };
          } else {
            throw new Error(`SSH connection failed: ${result.error}`);
          }
        }

        case "ssh.execute": {
          try {
            const result = await sshService.executeCommand(String(args.sessionId), String(args.command));

            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(result),
                },
              ],
            };
          } catch (error) {
            throw new Error(`Command execution failed: ${error instanceof Error ? error.message : String(error)}`);
          }
        }

        case "ssh.uploadFile": {
          try {
            const result = await sshService.uploadFile(String(args.sessionId), String(args.content), String(args.remotePath));

            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(result),
                },
              ],
            };
          } catch (error) {
            throw new Error(`File upload failed: ${error instanceof Error ? error.message : String(error)}`);
          }
        }

        case "ssh.downloadFile": {
          try {
            const result = await sshService.downloadFile(
              String(args.sessionId),
              String(args.remotePath),
              args.encoding ? (String(args.encoding) as BufferEncoding) : undefined,
            );

            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(result),
                },
              ],
            };
          } catch (error) {
            throw new Error(`File download failed: ${error instanceof Error ? error.message : String(error)}`);
          }
        }

        case "ssh.disconnect": {
          const success = sshService.disconnect(String(args.sessionId));

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ success }),
              },
            ],
          };
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      logger.error(`Error handling tool call ${name}`, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  });

  // Connect to stdio transport
  const transport = new StdioServerTransport();

  try {
    logger.debug("Connecting to stdio transport");
    await server.connect(transport);
    logger.info("MCP SSH Server running on stdio");
  } catch (error) {
    logger.error("Error connecting to stdio transport", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  }

  // Clean up on exit
  process.on("exit", () => {
    logger.info("Cleaning up SSH sessions");
    sshService.cleanup();
  });
}

/**
 * CLI entry point
 * @param useStdio Whether to use stdio transport instead of HTTP/SSE
 */
export function cli(useStdio = false) {
  if (useStdio) {
    runStdioServer().catch((error) => {
      console.error("Failed to start MCP SSH Server in stdio mode:", error);
      process.exit(1);
    });
  } else {
    startServer({
      port: parseInt(process.env.MCP_SSH_PORT || "3111", 10),
      host: process.env.MCP_SSH_HOST || "localhost",
      logLevel: (process.env.MCP_SSH_LOG_LEVEL || "info") as "debug" | "info" | "warn" | "error",
      logger: {
        prettyPrint: process.env.MCP_SSH_PRETTY_PRINT !== "false",
      },
    }).catch((error) => {
      console.error("Failed to start MCP SSH Server:", error);
      process.exit(1);
    });
  }
}

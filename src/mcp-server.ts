import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { SshService } from "./ssh-service.js";
import { McpSshServerOptions } from "./types.js";
import express from "express";
import cors from "cors";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "http";
import path from "path";
import { createCustomLogger, logger as defaultLogger } from "./logger.js";
import { GetPromptRequestSchema, ListPromptsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { LOG_ANALYSIS_PROMPTS, PROMPT_GENERATORS } from "./prompts.js";

/**
 * MCP Server for SSH operations
 */
export class McpSshServer {
  private server: Server;
  private sshService: SshService;
  private options: Required<McpSshServerOptions>;
  private httpServer: ReturnType<typeof createServer> | null = null;
  private expressApp = express();
  private logger;
  private transport: SSEServerTransport | StdioServerTransport | null = null;

  /**
   * Create a new MCP SSH server
   * @param options Server options
   */
  constructor(options: McpSshServerOptions = {}) {
    this.options = {
      port: options.port || 3000,
      host: options.host || "localhost",
      logLevel: options.logLevel || "info",
      logger: options.logger || {},
    };

    // Initialize logger
    if (options.logger) {
      // Create custom logger with provided options
      const loggerOptions = {
        ...options.logger,
        level: options.logLevel || options.logger.level || "info",
      };
      this.logger = createCustomLogger(loggerOptions);
    } else {
      // Use default logger with log level from options
      defaultLogger.info(`Setting log level to ${this.options.logLevel}`);
      this.logger = defaultLogger;
    }

    this.sshService = new SshService();

    // Create the MCP server
    this.server = new Server(
      {
        name: "mcp-ssh",
        description: "MCP server for SSH access to remote virtual machines",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
          prompts: {},
        },
      },
    );

    // Set up Express app
    this.expressApp.use(cors());
    this.expressApp.use(express.json());

    this.registerHandlers();
  }

  /**
   * Register request handlers for the MCP server
   */
  private registerHandlers(): void {
    // Handler that lists available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      this.logger.debug("Listing available tools");
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
          {
            name: "ssh.extractLogsByLineRange",
            description: "Extract log entries from a file by line number range",
            inputSchema: {
              type: "object",
              properties: {
                sessionId: {
                  type: "string",
                  description: "Session ID from a previous successful connect call",
                },
                filePath: {
                  type: "string",
                  description: "Path to the log file on the remote server",
                },
                startLine: {
                  type: "number",
                  description: "Starting line number (1-indexed)",
                },
                endLine: {
                  type: "number",
                  description: "Ending line number (1-indexed, optional)",
                },
              },
              required: ["sessionId", "filePath", "startLine"],
            },
          },
          {
            name: "ssh.extractLogsByTimeRange",
            description: "Extract log entries from a file by time range",
            inputSchema: {
              type: "object",
              properties: {
                sessionId: {
                  type: "string",
                  description: "Session ID from a previous successful connect call",
                },
                filePath: {
                  type: "string",
                  description: "Path to the log file on the remote server",
                },
                targetTime: {
                  type: "string",
                  description: "Target time to extract logs around (e.g. '2023-05-15 14:30:00')",
                },
                timePattern: {
                  type: "string",
                  description:
                    "Regular expression pattern to extract timestamps from log lines (e.g. '\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}')",
                },
                minutesRange: {
                  type: "number",
                  description: "Number of minutes before and after the target time to include",
                },
              },
              required: ["sessionId", "filePath", "targetTime", "timePattern", "minutesRange"],
            },
          },
        ],
      };
    });

    // Handler that lists available prompts
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => {
      this.logger.debug("Listing available prompts");
      return {
        prompts: LOG_ANALYSIS_PROMPTS,
      };
    });

    // Handler for prompt retrieval
    this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      const { name, arguments: args = {} } = request.params;
      this.logger.debug(`Prompt retrieval: ${name}`, { args });

      try {
        // Find the prompt
        const prompt = LOG_ANALYSIS_PROMPTS.find((p) => p.name === name);
        if (!prompt) {
          throw new Error(`Prompt not found: ${name}`);
        }

        // Get the generator for this prompt
        const generator = PROMPT_GENERATORS[name];
        if (!generator) {
          throw new Error(`No message generator found for prompt: ${name}`);
        }

        // Generate the messages
        const messages = generator(args);

        return {
          description: prompt.description,
          messages,
        };
      } catch (error) {
        this.logger.error(`Error handling prompt ${name}`, {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
        throw error;
      }
    });

    // Handler for tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args = {} } = request.params;
      this.logger.debug(`Tool call received: ${name}`, { args });

      switch (name) {
        case "ssh.connect": {
          this.logger.info(`Connecting to SSH server: ${args.host}:${args.port || 22}`, {
            username: args.username,
            usePrivateKey: !!args.privateKey,
          });
          const result = await this.sshService.connect({
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
            const result = await this.sshService.executeCommand(String(args.sessionId), String(args.command));

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
            const result = await this.sshService.uploadFile(String(args.sessionId), String(args.content), String(args.remotePath));

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
            const result = await this.sshService.downloadFile(
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
          const success = this.sshService.disconnect(String(args.sessionId));

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ success }),
              },
            ],
          };
        }

        case "ssh.extractLogsByLineRange": {
          try {
            const result = await this.sshService.extractLogsByLineRange(
              String(args.sessionId),
              String(args.filePath),
              Number(args.startLine),
              args.endLine ? Number(args.endLine) : undefined,
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
            throw new Error(`Log extraction failed: ${error instanceof Error ? error.message : String(error)}`);
          }
        }

        case "ssh.extractLogsByTimeRange": {
          try {
            const result = await this.sshService.extractLogsByTimeRange(
              String(args.sessionId),
              String(args.filePath),
              String(args.targetTime),
              String(args.timePattern),
              Number(args.minutesRange),
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
            throw new Error(`Log extraction failed: ${error instanceof Error ? error.message : String(error)}`);
          }
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });
  }

  /**
   * Get the SSH service instance
   * @returns The SSH service
   */
  public getSshService(): SshService {
    return this.sshService;
  }

  /**
   * Start the MCP server
   * @returns Promise that resolves when the server has started
   */
  public async start(): Promise<void> {
    // Initialize Express routes for MCP
    this.setupExpressRoutes();

    // Start the HTTP server
    return new Promise<void>((resolve) => {
      this.httpServer = createServer(this.expressApp);

      // Set appropriate timeout (default is 2 minutes which might be too short)
      this.httpServer.timeout = 120000; // 2 minutes
      this.httpServer.keepAliveTimeout = 60000; // 1 minute

      this.httpServer.on("error", (error) => {
        this.logger.error("HTTP server error", {
          error: error.message,
          stack: error.stack,
        });
      });

      this.httpServer.listen(this.options.port, this.options.host, () => {
        this.logger.info(`MCP SSH Server started on ${this.options.host}:${this.options.port}`);
        resolve();
      });
    });
  }

  /**
   * Start the MCP server in stdio mode (for direct LLM communication)
   * @returns Promise that resolves when the server has started
   */
  public async startStdio(): Promise<void> {
    this.logger.info("Starting MCP SSH Server in stdio mode");

    // Create stdio transport
    this.transport = new StdioServerTransport();

    try {
      // Connect to the transport
      await this.server.connect(this.transport);
      this.logger.info("MCP SSH Server running on stdio");
    } catch (error) {
      this.logger.error("Error connecting to stdio transport", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }

    return Promise.resolve();
  }

  /**
   * Set up Express routes for MCP
   */
  private setupExpressRoutes() {
    // Set up the stream endpoint
    this.expressApp.get("/mcp/stream", (req: express.Request, res: express.Response) => {
      this.logger.debug("New SSE connection established", {
        remoteAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });
      // Set up SSE
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      // Create transport and connect to server
      const transport = new SSEServerTransport("/mcp/message", res);

      // Add detailed logging for initialization sequence
      this.logger.debug("Connecting transport to server");
      this.server.connect(transport).catch((error) => {
        this.logger.error("Error connecting transport to server", {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
      });

      this.logger.debug("Transport connected to server");

      // Keep connection alive
      const keepAlive = setInterval(() => {
        res.write(":keepalive\n\n");
        this.logger.debug("Sent keepalive message");
      }, 15000);

      req.on("close", () => {
        this.logger.debug("SSE connection closed by client");
        clearInterval(keepAlive);
      });
    });

    // Set up the message endpoint for receiving messages
    this.expressApp.post("/mcp/message", express.json(), async (req: express.Request, res: express.Response) => {
      try {
        // Log incoming messages with detailed information
        this.logger.debug("Received message from client", {
          body: typeof req.body === "object" ? req.body : "Invalid payload",
          method: req.body?.method || "No method",
          id: req.body?.id || "No ID",
          params: req.body?.params ? JSON.stringify(req.body.params).substring(0, 200) : "No params",
        });

        // Implement basic request timeout handling
        const timeoutMs = 30000; // 30 seconds
        const requestTimeout = setTimeout(() => {
          this.logger.warn("Request processing timeout", {
            method: req.body?.method,
            id: req.body?.id,
          });
          // Note: The actual timeout would need to be handled by the transport
        }, timeoutMs);

        // This endpoint will be handled by the SSE transport
        res.status(200).send("OK");

        // Clear the timeout
        clearTimeout(requestTimeout);
      } catch (error) {
        this.logger.error("Error processing MCP message", {
          error: error instanceof Error ? error.message : String(error),
          body: req.body,
        });
        res.status(500).send("Internal Server Error");
      }
    });

    // Add health check endpoint
    this.expressApp.get("/health", (_: express.Request, res: express.Response) => {
      this.logger.debug("Health check request received");
      res.status(200).send("OK");
    });
  }

  /**
   * Stop the MCP server
   */
  public async stop(): Promise<void> {
    this.logger.info("Stopping MCP SSH Server");
    this.sshService.cleanup();

    // Close the transport if it exists
    if (this.transport) {
      try {
        await this.transport.close();
        this.logger.info("Transport closed");
      } catch (error) {
        this.logger.error("Error closing transport", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Close the HTTP server if it exists
    if (this.httpServer) {
      return new Promise<void>((resolve, reject) => {
        this.httpServer!.close((err) => {
          if (err) {
            this.logger.error("Error closing HTTP server", { error: err.message });
            reject(err);
          } else {
            this.logger.info("HTTP server closed");
            this.httpServer = null;
            resolve();
          }
        });
      });
    }
  }
}

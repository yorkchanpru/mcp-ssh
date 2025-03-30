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
import { LOG_ANALYSIS_PROMPTS, PROMPT_GENERATORS } from "./prompts.js";
import { ListPromptsRequestSchema, GetPromptRequestSchema } from "@modelcontextprotocol/sdk/types.js";

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

  try {
    // Create an instance of McpSshServer with the logger
    const server = new McpSshServer({
      logLevel: (process.env.MCP_SSH_LOG_LEVEL || "info") as "debug" | "info" | "warn" | "error",
      logger: {
        prettyPrint: false,
      },
    });

    // Start the server in stdio mode
    await server.startStdio();

    // Clean up on exit
    process.on("exit", () => {
      logger.info("Cleaning up SSH sessions");
      server.getSshService().cleanup();
    });
  } catch (error) {
    logger.error("Error starting MCP SSH Server in stdio mode", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  }
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

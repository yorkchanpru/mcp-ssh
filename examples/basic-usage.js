// Basic example of using the MCP SSH server
import { startServer } from "../dist/index.js";

// Start the MCP SSH server with custom options
async function main() {
  try {
    const server = await startServer({
      port: 3000,
      host: "localhost",
      logLevel: "info",
    });

    console.log("\n╔══════════════════════════════════════════════════════════╗");
    console.log("║             MCP SSH Server - Ready to Use                ║");
    console.log("╚══════════════════════════════════════════════════════════╝\n");

    console.log("📌 Available Tools:");
    console.log("  • ssh.connect - Establish SSH connections");
    console.log("  • ssh.execute - Run commands on remote servers");
    console.log("  • ssh.uploadFile - Upload files to remote servers");
    console.log("  • ssh.downloadFile - Download files from remote servers");
    console.log("  • ssh.disconnect - Close SSH sessions\n");

    console.log("🌐 Endpoints:");
    console.log("  • Stream API: http://localhost:3000/mcp/stream");
    console.log("  • Message API: http://localhost:3000/mcp/message");
    console.log("  • Health Check: http://localhost:3000/health\n");

    console.log("📋 Example Tool Usage:");
    console.log(`
  // Connect to SSH server
  {
    "name": "ssh.connect",
    "arguments": {
      "host": "example.com",
      "port": 22,
      "username": "user",
      "password": "password" // or use privateKey
    }
  }

  // Execute command
  {
    "name": "ssh.execute", 
    "arguments": {
      "sessionId": "<session-id>", 
      "command": "ls -la"
    }
  }

  // Upload file
  {
    "name": "ssh.uploadFile",
    "arguments": {
      "sessionId": "<session-id>",
      "content": "file content here",
      "remotePath": "/path/to/remote/file.txt"
    }
  }
`);

    console.log("\n⏱️  Server will run until interrupted (Ctrl+C to stop)");

    // Setup graceful shutdown
    process.on("SIGINT", async () => {
      console.log("\nShutting down MCP SSH Server...");
      await server.stop();
      console.log("Server stopped. Goodbye!");
      process.exit(0);
    });
  } catch (error) {
    console.error("❌ Failed to start MCP SSH Server:", error);
    process.exit(1);
  }
}

main();

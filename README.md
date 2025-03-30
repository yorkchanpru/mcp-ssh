# MCP SSH Server

MCP Server for SSH access to remote virtual machines, enabling command execution, file operations, and secure terminal access.

### Features

* **Session Management**: Automatically handles SSH session creation, tracking, and cleanup
* **Comprehensive Error Handling**: Clear error messages for common SSH issues
* **File Transfer Support**: Upload and download files to/from remote servers
* **Multiple Authentication Methods**: Support for both password and key-based authentication
* **Secure Credential Handling**: Security-focused design for handling sensitive information

## Tools

1. `ssh.connect`  
   * Establishes an SSH connection to a remote server  
   * Inputs:  
         * `host` (string): Hostname or IP address of the remote server  
         * `port` (optional number): SSH port (default: 22)  
         * `username` (string): Username for authentication  
         * `password` (optional string): Password for authentication  
         * `privateKey` (optional string): Private key for key-based authentication  
         * `passphrase` (optional string): Passphrase for the private key  
   * Returns: Session ID and success status
2. `ssh.execute`  
   * Executes a command on the remote server  
   * Inputs:  
         * `sessionId` (string): Session ID from a previous successful connect call  
         * `command` (string): Command to execute  
   * Returns: Command output (stdout, stderr) and exit code
3. `ssh.uploadFile`  
   * Uploads a file to the remote server  
   * Inputs:  
         * `sessionId` (string): Session ID  
         * `content` (string): Content to upload  
         * `remotePath` (string): Destination path on the remote server  
   * Returns: Upload success status and remote path
4. `ssh.downloadFile`  
   * Downloads a file from the remote server  
   * Inputs:  
         * `sessionId` (string): Session ID  
         * `remotePath` (string): Path on the remote server  
         * `encoding` (optional string): Encoding to use (default: utf8)  
   * Returns: Downloaded file content and success status
5. `ssh.disconnect`  
   * Closes an SSH connection  
   * Inputs:  
         * `sessionId` (string): Session ID to disconnect  
   * Returns: Success status

## Setup

### SSH Keys/Credentials

For security, we recommend using key-based authentication:

1. Ensure you have SSH keys generated on your system
2. Configure the remote server to accept your public key
3. When using the `ssh.connect` tool, pass your private key as the `privateKey` parameter

For password authentication (less secure but simpler):
1. Simply provide the `password` parameter when calling `ssh.connect`

### Usage with Claude Desktop

To use this with Claude Desktop, add the following to your `claude_desktop_config.json`:

#### Docker

```json
{
  "mcpServers": {
    "ssh": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "mcp/ssh"
      ]
    }
  }
}
```

### NPX

```json
{
  "mcpServers": {
    "ssh": {
      "command": "npx",
      "args": [
        "-y",
        "@york.chan.pru/mcp-ssh"
      ]
    }
  }
}
```

## Installation

### NPM

```bash
npm install @york.chan.pru/mcp-ssh
```

### Direct Usage

```javascript
import { startServer } from '@york.chan.pru/mcp-ssh';

// Start with default options
startServer();

// Or with custom options
startServer({
  port: 8080,
  host: 'localhost',
  logLevel: 'info'
});
```

### Configuration

You can configure the server through environment variables:

```javascript
startServer({
  port: process.env.MCP_SSH_PORT || 3111,
  host: process.env.MCP_SSH_HOST || 'localhost',
  logLevel: process.env.MCP_SSH_LOG_LEVEL || 'info',
  logger: {
    prettyPrint: process.env.MCP_SSH_PRETTY_PRINT !== 'false'
  }
});
```

## Build

Docker build:

```bash
docker build -t mcp/ssh .
```

### Running as a CLI

The package includes a CLI command:

```bash
npx @york.chan.pru/mcp-ssh
```

Environment variables for configuration:
- `MCP_SSH_PORT`: Port to run the server on (default: 3111)
- `MCP_SSH_HOST`: Host to bind to (default: localhost)
- `MCP_SSH_LOG_LEVEL`: Log level (default: info)
- `MCP_SSH_PRETTY_PRINT`: Whether to use pretty formatting for console logs (default: true)

## Logging

The MCP SSH server includes a console-based logging system that supports:

- Multiple log levels (debug, info, warn, error)
- Colorized output for better readability
- JSON formatting option for automated log parsing

### Log Format

Console logs are formatted with timestamps and optional colors for better readability.

### Example Usage

To run with verbose logging:

```bash
MCP_SSH_LOG_LEVEL=debug npx @york.chan.pru/mcp-ssh
```

To disable pretty printing (for machine parsing):

```bash
MCP_SSH_PRETTY_PRINT=false npx @york.chan.pru/mcp-ssh
```

## Security Considerations

- Always store SSH credentials securely
- Use key-based authentication when possible
- Consider using a secure credentials store rather than embedding credentials
- Implement proper access controls for the MCP server
- Be mindful of the commands executed remotely

## License

This MCP server is licensed under the MIT License. This means you are free to use, modify, and distribute the software, subject to the terms and conditions of the MIT License. For more details, please see the LICENSE file in the project repository. 
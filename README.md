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
6. `ssh.extractLogsByLineRange`  
   * Extracts log entries from a file by line number range  
   * Inputs:  
         * `sessionId` (string): Session ID from a previous successful connect call  
         * `filePath` (string): Path to the log file on the remote server  
         * `startLine` (number): Starting line number (1-indexed)  
         * `endLine` (optional number): Ending line number (1-indexed)  
   * Returns: Extracted log content, line count, and line range information
7. `ssh.extractLogsByTimeRange`  
   * Extracts log entries from a file by time range  
   * Inputs:  
         * `sessionId` (string): Session ID from a previous successful connect call  
         * `filePath` (string): Path to the log file on the remote server  
         * `targetTime` (string): Target time to extract logs around (e.g. '2023-05-15 14:30:00')  
         * `timePattern` (string): Regular expression pattern to extract timestamps from log lines  
         * `minutesRange` (number): Number of minutes before and after the target time to include  
   * Returns: Extracted log content, line count, and time range information

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
        "@york.chan.pru/mcp-ssh", 
        "--stdio"
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

## Example Log Analysis Prompts

Here are some example prompts to help you use the MCP SSH server for log analysis:

### Basic Log Analysis

```
I need to analyze logs from a server. Help me extract relevant information using these steps:

1. First, connect to the SSH server at [HOST] with username [USERNAME]
2. Extract the first 20 lines from the log file at [LOG_PATH] to understand its format
3. Analyze the format to identify the timestamp pattern
4. Extract logs around [TIMESTAMP] (±10 minutes)
5. Help me understand any errors or patterns in the extracted logs
```

### Troubleshooting Application Errors

```
I need help troubleshooting an application error that happened around [ERROR_TIME]. 

Please:
1. Connect to our server at [HOST]
2. Look at the application log file at [LOG_PATH]
3. First extract 5-10 lines to identify the timestamp format
4. Then extract logs from 5 minutes before to 5 minutes after [ERROR_TIME]
5. Analyze the extracted logs to:
   - Identify error messages and exceptions
   - Look for unusual patterns or behaviors
   - Suggest potential root causes for the issues
   - Recommend next troubleshooting steps
```

### Monitoring System Performance

```
Help me analyze system performance during a reported slowdown. Here's what I need:

1. Connect to the production server at [HOST] with my credentials
2. Extract the first few lines from the system monitoring log at [LOG_PATH]
3. Identify the timestamp pattern in the logs
4. Extract logs from [SLOWDOWN_TIME] with a ±15 minute window
5. Analyze the logs to identify:
   - CPU, memory, or disk usage spikes
   - Network bottlenecks
   - Process-related issues
   - Any correlation between resource usage and system slowdown
6. Create a timeline of events leading to the performance issue
7. Suggest optimizations or fixes based on the log data
```

### Investigating Security Incidents

```
I need to investigate a potential security incident that was detected at [INCIDENT_TIME]. Please help by:

1. Establishing an SSH connection to our security monitoring server
2. First sampling a few lines from the security log at [LOG_PATH] to understand its format
3. Extracting security logs from 30 minutes before to 30 minutes after the reported incident time
4. Analyzing the extracted logs to:
   - Identify unauthorized access attempts
   - Detect suspicious IP addresses or user activities
   - Find potential malware or attack signatures
   - Create a timeline of the security event
5. Assess the severity of the incident and recommend immediate security measures
```

### Extracting and Parsing Structured Logs

```
I need to extract and analyze structured log data for our data pipeline. Please:

1. Connect to our data processing server
2. Extract a sample from our JSON-formatted logs at [LOG_PATH]
3. Identify the timestamp pattern in the JSON structure
4. Extract logs from [START_TIME] to [END_TIME]
5. Parse the JSON log entries to:
   - Calculate success/failure rates of processing jobs
   - Identify bottlenecks in the data pipeline
   - Extract performance metrics for different processing stages
   - Highlight any recurring errors or exceptions
6. Summarize the findings and suggest optimizations
```

## License

This MCP server is licensed under the MIT License. This means you are free to use, modify, and distribute the software, subject to the terms and conditions of the MIT License. For more details, please see the LICENSE file in the project repository. 
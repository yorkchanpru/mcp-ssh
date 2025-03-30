import { Client, ClientChannel, SFTPWrapper } from "ssh2";
import { v4 as uuidv4 } from "uuid";

/**
 * Connection details for establishing an SSH connection
 */
export interface SshConnectionParams {
  /** Hostname or IP address */
  host: string;
  /** SSH port (default: 22) */
  port?: number;
  /** Username for authentication */
  username: string;
  /** Password for authentication */
  password?: string;
  /** Private key for key-based authentication */
  privateKey?: string;
  /** Passphrase for the private key */
  passphrase?: string;
  /** Connection timeout in milliseconds (default: 10000) */
  timeout?: number;
}

/**
 * Result of connecting to an SSH server
 */
export interface SshConnectionResult {
  /** Unique session ID for this connection */
  sessionId: string;
  /** Whether the connection was successful */
  success: boolean;
  /** Error message if connection failed */
  error?: string;
}

/**
 * Result of executing a command via SSH
 */
export interface SshCommandResult {
  /** The command that was executed */
  command: string;
  /** Standard output from command */
  stdout: string;
  /** Standard error from command */
  stderr: string;
  /** Exit code of the command */
  exitCode: number;
}

/**
 * Result of uploading a file via SSH
 */
export interface SshUploadResult {
  /** Whether the upload was successful */
  success: boolean;
  /** Path on the remote server */
  remotePath: string;
}

/**
 * Result of downloading a file via SSH
 */
export interface SshDownloadResult {
  /** Whether the download was successful */
  success: boolean;
  /** File content */
  content: string;
}

/**
 * Result of extracting logs from a file
 */
export interface SshLogExtractResult {
  /** Whether the extraction was successful */
  success: boolean;
  /** Extracted log content */
  content: string;
  /** Number of lines extracted */
  lineCount: number;
  /** First line number in the extraction (1-indexed) */
  startLine?: number;
  /** Last line number in the extraction (1-indexed) */
  endLine?: number;
  /** Timestamp of the first line (if time-based extraction) */
  startTime?: string;
  /** Timestamp of the last line (if time-based extraction) */
  endTime?: string;
}

/**
 * Internal storage for SSH sessions
 */
interface SshSession {
  /** SSH2 client instance */
  client: Client;
  /** Active channels for this session */
  channels: Map<string, ClientChannel>;
  /** Last activity timestamp */
  lastActivity: number;
}

/**
 * Service for managing SSH connections and operations
 */
export class SshService {
  private sessions: Map<string, SshSession> = new Map();
  private sessionTimeout: number;
  private cleanupInterval: NodeJS.Timeout | null = null;

  /**
   * Create a new SSH service
   * @param sessionTimeout Timeout in milliseconds after which inactive sessions are closed (default: 30 minutes)
   */
  constructor(sessionTimeout: number = 30 * 60 * 1000) {
    this.sessionTimeout = sessionTimeout;
    this.startCleanupInterval();
  }

  /**
   * Connect to an SSH server
   * @param params Connection parameters
   * @returns Promise resolving to connection result
   */
  public async connect(params: SshConnectionParams): Promise<SshConnectionResult> {
    const client = new Client();

    try {
      // Prepare connection configuration
      const config: any = {
        host: params.host,
        port: params.port || 22,
        username: params.username,
        timeout: params.timeout || 10000,
      };

      // Add authentication method
      if (params.password) {
        config.password = params.password;
      } else if (params.privateKey) {
        config.privateKey = params.privateKey;
        if (params.passphrase) {
          config.passphrase = params.passphrase;
        }
      } else {
        throw new Error("No authentication method provided");
      }

      // Connect to the server
      await new Promise<void>((resolve, reject) => {
        client.on("ready", () => {
          resolve();
        });

        client.on("error", (err: Error) => {
          reject(err);
        });

        client.connect(config);
      });

      // Store the session
      const sessionId = uuidv4();
      this.sessions.set(sessionId, {
        client,
        channels: new Map(),
        lastActivity: Date.now(),
      });

      return {
        sessionId,
        success: true,
      };
    } catch (error) {
      // Close the client connection if it failed
      try {
        client.end();
      } catch (_) {
        // Ignore any errors during cleanup
      }

      return {
        sessionId: "",
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Execute a command on the remote server
   * @param sessionId Session ID from a previous successful connect call
   * @param command Command to execute
   * @returns Promise resolving to command execution result
   */
  public async executeCommand(sessionId: string, command: string): Promise<SshCommandResult> {
    const session = this.getSession(sessionId);

    return new Promise<SshCommandResult>((resolve, reject) => {
      session.client.exec(command, (err: Error | undefined, channel: ClientChannel) => {
        if (err) {
          return reject(err);
        }

        let stdout = "";
        let stderr = "";
        let exitCode = 0;

        channel.on("data", (data: Buffer) => {
          stdout += data.toString();
        });

        channel.stderr.on("data", (data: Buffer) => {
          stderr += data.toString();
        });

        channel.on("exit", (code: number | null) => {
          exitCode = code || 0;
        });

        channel.on("close", () => {
          resolve({
            command,
            stdout,
            stderr,
            exitCode,
          });
        });

        channel.on("error", (err: Error) => {
          reject(err);
        });
      });
    });
  }

  /**
   * Upload a file to the remote server
   * @param sessionId Session ID
   * @param content Content to upload
   * @param remotePath Destination path on the remote server
   * @returns Promise resolving to upload result
   */
  public async uploadFile(sessionId: string, content: string, remotePath: string): Promise<SshUploadResult> {
    const session = this.getSession(sessionId);

    return new Promise<SshUploadResult>((resolve, reject) => {
      session.client.sftp((err: Error | undefined, sftp: SFTPWrapper) => {
        if (err) {
          return reject(err);
        }

        const stream = sftp.createWriteStream(remotePath);

        stream.on("error", (err: Error) => {
          reject(err);
        });

        stream.on("close", () => {
          resolve({
            success: true,
            remotePath,
          });
        });

        stream.end(content);
      });
    });
  }

  /**
   * Download a file from the remote server
   * @param sessionId Session ID
   * @param remotePath Path on the remote server
   * @param encoding Encoding to use (default: utf8)
   * @returns Promise resolving to download result
   */
  public async downloadFile(sessionId: string, remotePath: string, encoding: BufferEncoding = "utf8"): Promise<SshDownloadResult> {
    const session = this.getSession(sessionId);

    return new Promise<SshDownloadResult>((resolve, reject) => {
      session.client.sftp((err: Error | undefined, sftp: SFTPWrapper) => {
        if (err) {
          return reject(err);
        }

        const stream = sftp.createReadStream(remotePath);
        let content = "";

        stream.on("data", (data: Buffer) => {
          content += data.toString(encoding);
        });

        stream.on("error", (err: Error) => {
          reject(err);
        });

        stream.on("end", () => {
          resolve({
            success: true,
            content,
          });
        });
      });
    });
  }

  /**
   * Get a session by ID or throw an error if not found
   * @param sessionId Session ID
   * @returns SSH session
   * @throws Error if session not found
   */
  private getSession(sessionId: string): SshSession {
    const session = this.sessions.get(sessionId);

    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Update last activity timestamp
    session.lastActivity = Date.now();

    return session;
  }

  /**
   * Disconnect an SSH session
   * @param sessionId Session ID to disconnect
   * @returns true if session was found and disconnected, false otherwise
   */
  public disconnect(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);

    if (session) {
      // Close all channels
      for (const channel of session.channels.values()) {
        try {
          channel.close();
        } catch (error) {
          // Ignore errors when closing channels
        }
      }

      // End the client connection
      try {
        session.client.end();
      } catch (error) {
        // Ignore errors when ending client
      }

      return this.sessions.delete(sessionId);
    }

    return false;
  }

  /**
   * Clean up inactive sessions
   */
  private cleanupInactiveSessions(): void {
    const now = Date.now();

    for (const [id, session] of this.sessions.entries()) {
      if (now - session.lastActivity > this.sessionTimeout) {
        this.disconnect(id);
      }
    }
  }

  /**
   * Start the cleanup interval
   */
  private startCleanupInterval(): void {
    // Check for inactive sessions every 5 minutes
    const cleanupIntervalTime = 5 * 60 * 1000;

    this.cleanupInterval = setInterval(() => {
      this.cleanupInactiveSessions();
    }, cleanupIntervalTime);
  }

  /**
   * Clean up resources (call when shutting down the service)
   */
  public cleanup(): void {
    // Stop the cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Disconnect all sessions
    for (const id of this.sessions.keys()) {
      this.disconnect(id);
    }
  }

  /**
   * Extract logs from a file by line number range
   * @param sessionId Session ID
   * @param filePath Path to the log file on the remote server
   * @param startLine Starting line number (1-indexed)
   * @param endLine Ending line number (1-indexed, optional)
   * @returns Promise resolving to log extraction result
   */
  public async extractLogsByLineRange(
    sessionId: string,
    filePath: string,
    startLine: number,
    endLine?: number,
  ): Promise<SshLogExtractResult> {
    const session = this.getSession(sessionId);
    session.lastActivity = Date.now();

    try {
      // Create a command to extract lines based on line numbers
      const lineCount = endLine ? endLine - startLine + 1 : undefined;
      const command = lineCount ? `head -n ${endLine} ${filePath} | tail -n ${lineCount}` : `tail -n +${startLine} ${filePath}`;

      const result = await this.executeCommand(sessionId, command);

      if (result.exitCode !== 0) {
        throw new Error(`Failed to extract logs: ${result.stderr}`);
      }

      return {
        success: true,
        content: result.stdout,
        lineCount: result.stdout.split("\n").length,
        startLine,
        endLine,
      };
    } catch (error) {
      return {
        success: false,
        content: error instanceof Error ? error.message : String(error),
        lineCount: 0,
      };
    }
  }

  /**
   * Extract logs from a file by time range
   * @param sessionId Session ID
   * @param filePath Path to the log file on the remote server
   * @param targetTime Target time string to search for
   * @param timePattern Regular expression pattern to extract time from log lines
   * @param minutesRange Number of minutes before and after the target time to include
   * @returns Promise resolving to log extraction result
   */
  public async extractLogsByTimeRange(
    sessionId: string,
    filePath: string,
    targetTime: string,
    timePattern: string,
    minutesRange: number,
  ): Promise<SshLogExtractResult> {
    const session = this.getSession(sessionId);
    session.lastActivity = Date.now();

    try {
      // First, create a script that will extract logs based on a time range
      const extractScript = `
#!/bin/bash
log_file="${filePath}"
target_time="${targetTime}"
time_pattern="${timePattern}"
minutes_range=${minutesRange}

# Convert target time to timestamp
if ! target_timestamp=$(date -d "$target_time" +%s 2>/dev/null); then
  echo "Error: Invalid target time format." >&2
  exit 1
fi

# Calculate the range boundaries
range_start=$((target_timestamp - minutes_range * 60))
range_end=$((target_timestamp + minutes_range * 60))

matching_lines=""
start_time=""
end_time=""
line_count=0
in_range=false

while IFS= read -r line; do
  # Extract timestamp using the provided pattern
  if timestamp_str=$(echo "$line" | grep -o -E "$time_pattern"); then
    if ! line_timestamp=$(date -d "$timestamp_str" +%s 2>/dev/null); then
      # Skip lines where time conversion fails
      continue
    fi
    
    # Check if this line is within the time range
    if (( line_timestamp >= range_start && line_timestamp <= range_end )); then
      if [[ -z "$matching_lines" ]]; then
        start_time="$timestamp_str"
      fi
      end_time="$timestamp_str"
      matching_lines="$matching_lines$line\\n"
      ((line_count++))
      in_range=true
    elif [[ "$in_range" == "true" && line_timestamp > range_end ]]; then
      # We've gone past the end of the range, no need to continue
      break
    fi
  elif [[ "$in_range" == "true" ]]; then
    # Include lines that don't have a timestamp but are within a matching section
    matching_lines="$matching_lines$line\\n"
    ((line_count++))
  fi
done < "$log_file"

# Output the result as JSON for easy parsing
cat << EOF
{
  "lineCount": $line_count,
  "startTime": "$start_time",
  "endTime": "$end_time",
  "content": "$matching_lines"
}
EOF
`;

      // Upload the extraction script
      const scriptPath = `/tmp/extract_logs_${Date.now()}.sh`;
      await this.uploadFile(sessionId, extractScript, scriptPath);

      // Make the script executable
      await this.executeCommand(sessionId, `chmod +x ${scriptPath}`);

      // Execute the script
      const result = await this.executeCommand(sessionId, scriptPath);

      // Clean up
      await this.executeCommand(sessionId, `rm ${scriptPath}`);

      if (result.exitCode !== 0) {
        throw new Error(`Failed to extract logs: ${result.stderr}`);
      }

      // Parse the JSON result
      const extractionResult = JSON.parse(result.stdout);

      return {
        success: true,
        content: extractionResult.content.replace(/\\n/g, "\n"),
        lineCount: extractionResult.lineCount,
        startTime: extractionResult.startTime,
        endTime: extractionResult.endTime,
      };
    } catch (error) {
      return {
        success: false,
        content: error instanceof Error ? error.message : String(error),
        lineCount: 0,
      };
    }
  }
}

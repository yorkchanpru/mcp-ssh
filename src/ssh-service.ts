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
 * Result of a file upload operation
 */
export interface SshUploadResult {
  /** Whether the upload was successful */
  success: boolean;
  /** Remote path where file was uploaded */
  remotePath: string;
  /** Error message if upload failed */
  error?: string;
}

/**
 * Result of a file download operation
 */
export interface SshDownloadResult {
  /** Whether the download was successful */
  success: boolean;
  /** Content of the downloaded file */
  content: string;
  /** Error message if download failed */
  error?: string;
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
}

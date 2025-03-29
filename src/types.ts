/**
 * Types for the MCP SSH server
 */

import { Client, ClientChannel } from "ssh2";
import { LoggerOptions } from "./logger.js";

/**
 * Configuration options for the MCP SSH server
 */
export interface McpSshServerOptions {
  /** Port to run the server on (default: 3000) */
  port?: number;
  /** Host to bind to (default: localhost) */
  host?: string;
  /** Log level (default: info) */
  logLevel?: "debug" | "info" | "warn" | "error";
  /** Logging options */
  logger?: LoggerOptions;
}

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
export interface SshSession {
  /** SSH2 client instance */
  client: Client;
  /** Active channels for this session */
  channels: Map<string, ClientChannel>;
  /** Last activity timestamp */
  lastActivity: number;
}

/**
 * Repository interface for storing SSH sessions
 */
export interface SshSessionRepository {
  /** Create a new session */
  create(client: Client): string;
  /** Get a session by ID */
  get(id: string): SshSession | undefined;
  /** Remove a session */
  remove(id: string): boolean;
  /** Get all session IDs */
  getAllIds(): string[];
}

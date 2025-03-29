import winston from "winston";

export interface LoggerOptions {
  /** Log level (default: 'info') */
  level?: "debug" | "info" | "warn" | "error";
  /** Whether to use pretty formatting for console logs (default: true) */
  prettyPrint?: boolean;
}

class Logger {
  private logger: winston.Logger;
  private options: Required<LoggerOptions>;

  constructor(options: LoggerOptions = {}) {
    this.options = {
      level: options.level || "info",
      prettyPrint: options.prettyPrint !== false,
    };

    // Only use console transport for reliability
    const consoleTransportFormat = this.options.prettyPrint
      ? winston.format.combine(
          winston.format.colorize(),
          winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
          winston.format.printf((info: winston.Logform.TransformableInfo) => {
            const { timestamp, level, message, ...meta } = info;
            return `${timestamp} ${level}: ${message} ${Object.keys(meta).length > 0 ? JSON.stringify(meta) : ""}`;
          }),
        )
      : winston.format.combine(winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }), winston.format.json());

    // Create the logger with console transport only
    this.logger = winston.createLogger({
      level: this.options.level,
      transports: [
        new winston.transports.Console({
          format: consoleTransportFormat,
        }),
      ],
      exitOnError: false,
    });

    // Log initial setup information
    this.info(`Logger initialized with level: ${this.options.level}`);
  }

  debug(message: string, meta: Record<string, any> = {}): void {
    this.logger.debug(message, meta);
  }

  info(message: string, meta: Record<string, any> = {}): void {
    this.logger.info(message, meta);
  }

  warn(message: string, meta: Record<string, any> = {}): void {
    this.logger.warn(message, meta);
  }

  error(message: string, meta: Record<string, any> = {}): void {
    this.logger.error(message, meta);
  }
}

// Export a singleton instance
export const logger = new Logger();

// Export factory function for creating a custom logger
export function createCustomLogger(options: LoggerOptions): Logger {
  return new Logger(options);
}

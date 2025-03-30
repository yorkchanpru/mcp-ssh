import { Prompt, PromptArgument } from "@modelcontextprotocol/sdk/types.js";

/**
 * Message type for MCP
 */
interface Message {
  role: string;
  content: {
    type: string;
    text: string;
  };
}

/**
 * MCP prompts for log analysis
 */
export const LOG_ANALYSIS_PROMPTS: Prompt[] = [
  // Basic log extraction prompt
  {
    name: "analyze-logs",
    description: "Analyze log files on a remote server",
    arguments: [
      {
        name: "host",
        description: "Hostname or IP address of the server",
        required: true,
      },
      {
        name: "username",
        description: "SSH username",
        required: true,
      },
      {
        name: "password",
        description: "SSH password (if not using private key)",
        required: false,
      },
      {
        name: "privateKey",
        description: "SSH private key (if not using password)",
        required: false,
      },
      {
        name: "logPath",
        description: "Path to the log file on the remote server",
        required: true,
      },
    ],
  },

  // Time-based log extraction prompt
  {
    name: "extract-logs-by-time",
    description: "Extract logs from a specific time period",
    arguments: [
      {
        name: "host",
        description: "Hostname or IP address of the server",
        required: true,
      },
      {
        name: "username",
        description: "SSH username",
        required: true,
      },
      {
        name: "password",
        description: "SSH password (if not using private key)",
        required: false,
      },
      {
        name: "privateKey",
        description: "SSH private key (if not using password)",
        required: false,
      },
      {
        name: "logPath",
        description: "Path to the log file on the remote server",
        required: true,
      },
      {
        name: "targetTime",
        description: "Target time to extract logs around (e.g. '2023-05-15 14:30:00')",
        required: true,
      },
      {
        name: "minutesRange",
        description: "Number of minutes before and after the target time to include",
        required: true,
      },
    ],
  },

  // Error investigation prompt
  {
    name: "investigate-error",
    description: "Investigate an error in the logs",
    arguments: [
      {
        name: "host",
        description: "Hostname or IP address of the server",
        required: true,
      },
      {
        name: "username",
        description: "SSH username",
        required: true,
      },
      {
        name: "password",
        description: "SSH password (if not using private key)",
        required: false,
      },
      {
        name: "privateKey",
        description: "SSH private key (if not using password)",
        required: false,
      },
      {
        name: "logPath",
        description: "Path to the log file on the remote server",
        required: true,
      },
      {
        name: "errorTime",
        description: "Approximate time when the error occurred",
        required: true,
      },
      {
        name: "errorDescription",
        description: "Brief description of the error or issue being investigated",
        required: true,
      },
    ],
  },
];

/**
 * Function to generate the message content for the analyze-logs prompt
 * @param args Prompt arguments
 * @returns Array of prompt messages
 */
export function generateAnalyzeLogsPrompt(args: Record<string, unknown>): Message[] {
  return [
    {
      role: "user",
      content: {
        type: "text",
        text: `I need to analyze logs from a server. Help me extract relevant information from ${args.logPath} on the server ${args.host}.

1. First, connect to the SSH server at ${args.host} with username ${args.username}
2. Extract the first 20 lines from the log file at ${args.logPath} to understand its format
3. Analyze the format to identify the timestamp pattern
4. Extract more logs as needed based on patterns you identify
5. Help me understand any errors or patterns in the extracted logs

Please proceed step by step, explaining what you're finding along the way.`,
      },
    },
  ];
}

/**
 * Function to generate the message content for the extract-logs-by-time prompt
 * @param args Prompt arguments
 * @returns Array of prompt messages
 */
export function generateExtractLogsByTimePrompt(args: Record<string, unknown>): Message[] {
  return [
    {
      role: "user",
      content: {
        type: "text",
        text: `I need to extract logs from around a specific time. Please help me analyze logs from ${args.logPath} on the server ${args.host}.

Please follow these steps:
1. Connect to the SSH server at ${args.host} with username ${args.username}
2. Extract the first few lines from the log file at ${args.logPath} to understand its format
3. Analyze the format to identify the timestamp pattern
4. Extract logs from ${args.targetTime} with a ±${args.minutesRange} minute window
5. Analyze the extracted logs for any patterns, errors, or insights

Please explain your analysis process and findings clearly.`,
      },
    },
  ];
}

/**
 * Function to generate the message content for the investigate-error prompt
 * @param args Prompt arguments
 * @returns Array of prompt messages
 */
export function generateInvestigateErrorPrompt(args: Record<string, unknown>): Message[] {
  return [
    {
      role: "user",
      content: {
        type: "text",
        text: `I need help investigating an error that occurred around ${args.errorTime}. The issue is described as: "${args.errorDescription}".

Please help me by following these steps:
1. Connect to the server at ${args.host} with username ${args.username}
2. Look at the log file at ${args.logPath}
3. First extract a few lines to identify the timestamp format
4. Then extract logs from around the time of the error (${args.errorTime})
5. Analyze the extracted logs to:
   - Identify error messages and exceptions related to the described issue
   - Look for unusual patterns or behaviors
   - Suggest potential root causes for the issues
   - Recommend next troubleshooting steps

Please provide a detailed analysis of what might have caused this error.`,
      },
    },
  ];
}

/**
 * Map of prompt generators by prompt name
 */
export const PROMPT_GENERATORS: Record<string, (args: Record<string, unknown>) => Message[]> = {
  "analyze-logs": generateAnalyzeLogsPrompt,
  "extract-logs-by-time": generateExtractLogsByTimePrompt,
  "investigate-error": generateInvestigateErrorPrompt,
};

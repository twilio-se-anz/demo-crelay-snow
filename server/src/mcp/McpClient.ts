import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import dotenv from "dotenv";

/**
 * Interface for tool execution arguments.
 */
export interface ToolArguments {
    [key: string]: any;
}

/**
 * Interface for the result of tool execution.
 */
export interface ToolExecutionResult {
    [key: string]: any;
}

/**
 * Private implementation of IToolExecutor for MCP
 * Handles calling tools via the MCP client
 */
class MCPToolExecutor {
    private mcpClient: Client;

    /**
     * Creates a new MCPToolExecutor
     * @param mcpClient The MCP client to use for tool execution
     */
    constructor(mcpClient: Client) {
        this.mcpClient = mcpClient;
    }

    /**
     * Executes a tool using the MCP client
     * @param toolName The name of the tool to execute
     * @param toolArgs The arguments to pass to the tool
     * @returns A promise that resolves to the result of the tool execution
     */
    public async executeTool(toolName: string, toolArgs: ToolArguments): Promise<ToolExecutionResult> {
        try {
            return await this.mcpClient.callTool({
                name: toolName,
                arguments: toolArgs,
            });
        } catch (error) {
            throw new Error(`Failed to execute tool '${toolName}': ${(error as Error).message}`);
        }
    }
}

// Load environment variables - needed for constructor and connectToMcpServer
dotenv.config();

const {
    ACCOUNT_SID,
    API_KEY,
    API_SECRET,
    TWILIO_NUMBER,
    NGROK_AUTH_TOKEN,
    MCP_SERVER
} = process.env;

/**
 * Interface representing a single MCP tool.
 */
interface Tool {
    name: string;
    description?: string;
    inputSchema?: object;
    // Add other properties as needed
}

/**
 * Interface representing the result of listing tools from the MCP server.
 */
interface ToolListResult {
    tools: Tool[];
}

/**
 * Represents the MCP client for managing tool execution and server connection.
 */
export class MCPClient {
    private transport: StdioClientTransport | null;
    private toolsResult: ToolListResult | null;
    private toolExecutor: MCPToolExecutor | null;
    private mcpClient: Client;

    /**
     * Creates a new MCPClient instance.
     */
    constructor() {
        this.transport = null;
        this.toolsResult = null;
        this.toolExecutor = null;
        this.mcpClient = new Client({ name: "conversation-relay-mcp-client", version: "0.0.1" });
    }

    /**
     * Connects to the MCP server using environment variables.
     * @throws Error if required environment variables are missing.
     */
    public async connectToMcpServer(): Promise<void> {
        if (!ACCOUNT_SID || !API_KEY || !API_SECRET || !TWILIO_NUMBER || !NGROK_AUTH_TOKEN || !MCP_SERVER) {
            throw new Error(
                "One or more required environment variables (ACCOUNT_SID, API_KEY, API_SECRET, TWILIO_NUMBER, NGROK_AUTH_TOKEN, MCP_SERVER) are not set."
            );
        }
        this.transport = new StdioClientTransport({
            command: "npx",
            args: [MCP_SERVER, ACCOUNT_SID, API_KEY, API_SECRET, TWILIO_NUMBER],
            env: {
                ...process.env,
                NGROK_AUTH_TOKEN: NGROK_AUTH_TOKEN,
            },
        });
        await this.mcpClient.connect(this.transport);
        this.toolExecutor = new MCPToolExecutor(this.mcpClient);
    }

    /**
     * Gets the tool executor for running MCP tools.
     * @returns The MCPToolExecutor instance or null if not connected.
     */
    public getToolExecutor(): MCPToolExecutor | null {
        return this.toolExecutor;
    }

    /**
     * Lists all tools available in the MCP server.
     * @returns The ToolListResult object containing available tools.
     * @throws Error if the MCP client is not connected.
     */
    public async listTools(): Promise<ToolListResult> {
        if (!this.mcpClient) {
            throw new Error("MCP client is not connected.");
        }
        this.toolsResult = await this.mcpClient.listTools();
        console.log(
            "Connected to MCP with tools: ",
            this.toolsResult.tools.map((tool: Tool) => tool.name)
        );
        return this.toolsResult;
    }

    /**
     * Converts MCP tools to OpenAI's Responses API format.
     * @returns An array of FunctionTool objects or null if toolsResult is not available.
     */
    public convertToOpenAiTools(): Array<Record<string, any>> | null {
        if (!this.toolsResult) {
            console.warn("MCP tools result not available for conversion.");
            return null;
        }
        return this.toolsResult.tools.map((tool: Tool) => {
            return {
                type: "function",
                name: tool.name,
                description: tool.description,
                parameters: tool.inputSchema || {},
                strict: true,
            };
        });
    }

    /**
     * Cleans up the MCP client and closes the transport connection.
     */
    public async cleanup(): Promise<void> {
        if (this.transport) {
            if (typeof (this.mcpClient as any).close === "function") {
                try {
                    await (this.mcpClient as any).close();
                } catch (error) {
                    console.warn("Error closing MCP client:", (error as Error).message);
                }
            }
        }
        console.log("MCP Client cleaned up.");
    }
}

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import dotenv from "dotenv";

/**
 * Private implementation of IToolExecutor for MCP
 * Handles calling tools via the MCP client
 */
class MCPToolExecutor {
    /**
     * Creates a new MCPToolExecutor
     * @param mcpClient The MCP client to use for tool execution
     */
    constructor(mcpClient) {
        this.mcpClient = mcpClient;
    }
    /**
     * Executes a tool using the MCP client
     * @param toolName The name of the tool to execute
     * @param toolArgs The arguments to pass to the tool
     * @returns A promise that resolves to the result of the tool execution
     */
    async executeTool(toolName, toolArgs) {
        return this.mcpClient.callTool({
            name: toolName,
            arguments: toolArgs,
        });
    }
}
// Load environment variables - needed for constructor and connectToMcpServer
dotenv.config();
const { ACCOUNT_SID, API_KEY, API_SECRET, TWILIO_NUMBER, NGROK_AUTH_TOKEN } = process.env;
class MCPClient {
    constructor() {
        this.transport = null;
        this.toolsResult = null;
        this.toolExecutor = null;
        this.mcpClient = new Client({ name: "typescript-mcp-client", version: "0.0.1" });
    }
    // Connect to the MCP server
    async connectToMcpServer() {
        if (!ACCOUNT_SID || !API_KEY || !API_SECRET || !TWILIO_NUMBER || !NGROK_AUTH_TOKEN) {
            throw new Error("One or more required environment variables (ACCOUNT_SID, API_KEY, API_SECRET, TWILIO_NUMBER, NGROK_AUTH_TOKEN) are not set.");
        }
        // Create the MCP transport to the Server
        this.transport = new StdioClientTransport({
            command: "npx",
            args: ["@deshartman/twilio-messaging-mcp-server", ACCOUNT_SID, API_KEY, API_SECRET, TWILIO_NUMBER],
            env: {
                ...process.env, // Pass all environment variables to the server
                "NGROK_AUTH_TOKEN": NGROK_AUTH_TOKEN,
            }
        });
        // Connect to the MCP server
        await this.mcpClient.connect(this.transport);
        this.toolExecutor = new MCPToolExecutor(this.mcpClient);
    }
    getToolExecutor() {
        return this.toolExecutor;
    }
    // List all tools available in the MCP server
    async listTools() {
        if (!this.mcpClient) {
            throw new Error("MCP client is not connected.");
        }
        this.toolsResult = await this.mcpClient.listTools();
        console.log("Connected to MCP with tools: ", this.toolsResult.tools.map((tool) => tool.name));
        return this.toolsResult;
    }
    /**
     * Converts MCP tools to OpenAI's Responses API format
     * @returns An array of FunctionTool objects or null if toolsResult is not available
     */
    convertToOpenAiTools() {
        if (!this.toolsResult) {
            console.warn("MCP tools result not available for conversion.");
            return null;
        }
        return this.toolsResult.tools.map((tool) => {
            return {
                type: "function",
                name: tool.name,
                description: tool.description,
                parameters: tool.inputSchema || {}, // Ensure parameters is never undefined
                strict: true
            };
        });
    }
    async cleanup() {
        // Ensure transport exists before trying to disconnect/close
        if (this.transport) {
            // Attempt to gracefully close the connection if the client has a close method
            if (typeof this.mcpClient.close === 'function') {
                await this.mcpClient.close();
            }
        }
        console.log("MCP Client cleaned up.");
    }
}
export { MCPClient };

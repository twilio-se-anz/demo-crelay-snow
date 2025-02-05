const EventEmitter = require('events');
const { logOut, logError } = require('../utils/logger');
const toolManifest = require('../assets/toolManifest.json')

export class ToolsService extends EventEmitter {

    constructor() {
        super();
        logOut('ToolsService', `ToolsService constructor called`);

        this.toolDefinitions = toolManifest;
        // Load all the tool functions
        const loadedTools = {};
        this.toolDefinitions.forEach((tool) => {
            let functionName = tool.function.name;
            // Dynamically load all tool files
            this.loadedTools[functionName] = require(`../tools/${functionName}`);
            console.log(`load function: ${functionName}`);
        });
        this.loadedTools = {};
    }


    runTool(tool) {
        logOut('ToolsService', `runTool called for tool: ${tool.function?.name}`);
        if (!tool.function?.name) throw new Error("Tool function name is not set");

        let calledTool = this.loadedTools[tool.function.name];
        let calledToolArgs = JSON.parse(tool.function.arguments);

        // Now run the loaded tool
        let toolResponse = calledTool.calledTool(calledToolArgs);

        // Code to run the tool
        this.emit("toolService.response", toolResponse);
    }
}
module.exports = { ToolsService };
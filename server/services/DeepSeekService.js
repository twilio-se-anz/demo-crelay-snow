/**
 * Service class for handling DeepSeek API interactions and managing conversation flow.
 * Inherits common functionality from ResponseService.
 * 
 * @class
 * @extends ResponseService
 */

const OpenAI = require('openai');
const { ResponseService } = require('./ResponseService');
const { logOut } = require('../utils/logger');
const { DEEPSEEK_API_KEY } = process.env;
const { DEEPSEEK_MODEL } = process.env;

class DeepSeekService extends ResponseService {
    /**
     * Creates a new DeepSeekService instance.
     * Initializes DeepSeek client and sets up initial state.
     * 
     * @throws {Error} If initialization fails
     */
    constructor(contextFile, toolManifestFile) {
        super(contextFile, toolManifestFile);
        this.openai = new OpenAI({
            baseURL: 'https://api.deepseek.com',
            apiKey: DEEPSEEK_API_KEY
        });
        this.model = DEEPSEEK_MODEL;
        logOut('DeepSeekService', 'Initialized');
    }
}

module.exports = { DeepSeekService };

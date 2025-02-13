/**
 * Service class for handling OpenAI API interactions and managing conversation flow.
 * Inherits common functionality from ResponseService.
 * 
 * @class
 * @extends ResponseService
 */

const OpenAI = require('openai');
const { ResponseService } = require('./ResponseService');
const { logOut } = require('../utils/logger');
const { OPENAI_API_KEY } = process.env;
const { OPENAI_MODEL } = process.env;

class OpenAIService extends ResponseService {
    /**
     * Creates a new OpenAIService instance.
     * Initializes OpenAI client and sets up initial state.
     * 
     * @throws {Error} If initialization fails
     */
    constructor() {
        super();
        this.openai = new OpenAI();
        this.model = OPENAI_MODEL;
        logOut('OpenAIService', 'Initialized');
    }
}

module.exports = { OpenAIService };

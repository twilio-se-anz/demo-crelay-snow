/**
 * Service class for handling OpenAI API interactions and managing conversation flow.
 * Inherits common functionality from ResponseService.
 * 
 * @class
 * @extends ResponseService
 */

import OpenAI from 'openai';
import { ResponseService } from './ResponseService.js';
import { logOut } from '../utils/logger.js';

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
        this.model = process.env.OPENAI_MODEL || 'gpt-4';
        logOut('OpenAIService', 'Initialized');
    }
}

export { OpenAIService };

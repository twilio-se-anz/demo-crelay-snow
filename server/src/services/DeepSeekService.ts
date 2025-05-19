/**
 * Service class for handling DeepSeek API interactions and managing conversation flow.
 * Inherits common functionality from ResponseService.
 * 
 * @class
 * @extends ResponseService
 */

import OpenAI from 'openai';
import { ResponseService } from './ResponseService.js';
import { logOut } from '../utils/logger.js';

class DeepSeekService extends ResponseService {
    /**
     * Creates a new DeepSeekService instance.
     * Initializes DeepSeek client and sets up initial state.
     * 
     * @throws {Error} If initialization fails
     */
    constructor() {
        super();
        this.openai = new OpenAI({
            baseURL: 'https://api.deepseek.com',
            apiKey: process.env.DEEPSEEK_API_KEY || ''
        });
        this.model = process.env.DEEPSEEK_MODEL || '';
        logOut('DeepSeekService', 'Initialized');
    }
}

export { DeepSeekService };

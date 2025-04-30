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

const { DEEPSEEK_API_KEY } = process.env;
const { DEEPSEEK_MODEL } = process.env;

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
            apiKey: DEEPSEEK_API_KEY
        });
        this.model = DEEPSEEK_MODEL;
        logOut('DeepSeekService', 'Initialized');
    }
}

export { DeepSeekService };

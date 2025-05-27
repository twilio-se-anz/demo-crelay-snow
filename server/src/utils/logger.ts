/**
 * Logger utility for consistent logging across the application
 */
/**
 * Color codes for console output formatting
 */
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m'
};

/**
 * Gets the host's local timezone
 * @returns {string} The local timezone identifier
 */
const getLocalTimeZone = (): string => {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
};

/**
 * Gets the current timestamp using the host's local timezone
 * @returns {string} Formatted timestamp string
 */
const getTimestamp = (): string => {
    const localTimeZone = getLocalTimeZone();
    return new Date().toLocaleString('en-US', {
        timeZone: localTimeZone,
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
};

/**
 * Logs a standard output message with timestamp and identifier
 * @param {string} identifier - The identifier for the log (e.g., service name)
 * @param {string} message - The message to log
 */
const logOut = (identifier: string, message: string): void => {
    console.log(`${colors.green}[${getTimestamp()}] [${identifier}] ${message}${colors.reset}`);
};

/**
 * Logs an error message with timestamp and identifier
 * @param {string} identifier - The identifier for the log (e.g., service name)
 * @param {string} message - The error message to log
 */
const logError = (identifier: string, message: string): void => {
    console.error(`${colors.red}[${getTimestamp()}] [${identifier}] ${message}${colors.reset}`);
};

export {
    logOut,
    logError
};

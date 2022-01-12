import { OSUtils } from './OSUtils';

/**
 * Random utility methods that don't fit other place.
 */
export class Utils {
    public static secureString(text: string): string {
        const regex = new RegExp('[0-9a-fA-F]{64}', 'g');
        return text.replace(regex, 'HIDDEN_KEY');
    }

    public static validateIsDefined(value: unknown, message: string): void {
        if (value === undefined || value === null) {
            throw new Error(message);
        }
    }

    public static validateIsTrue(value: boolean, message: string): void {
        if (!value) {
            throw new Error(message);
        }
    }
    public static logSameLineMessage(message: string): void {
        process.stdout.write(OSUtils.isWindows() ? '\x1b[0G' : '\r');
        process.stdout.write(message);
    }
}

/**
 * Utility class related to OS differences.
 */
export class OSUtils {
    public static isRoot(): boolean {
        return !OSUtils.isWindows() && process?.getuid() === 0;
    }

    public static isWindows(): boolean {
        return process.platform === 'win32';
    }

    public static logSameLineMessage(message: string): void {
        process.stdout.write(OSUtils.isWindows() ? '\x1b[0G' : '\r');
        process.stdout.write(message);
    }
}

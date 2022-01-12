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
}

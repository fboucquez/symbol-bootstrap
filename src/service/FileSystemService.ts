import { createWriteStream, existsSync, lstatSync, promises as fsPromises, readdirSync, rmdirSync, statSync, unlinkSync } from 'fs';
import { get } from 'https';
import { basename, dirname, join } from 'path';
import { Logger } from '../logger';
import { Constants } from './Constants';
import { KnownError } from './KnownError';
import { Utils } from './Utils';

/**
 * Service handling files and how to store and load them on the file system.
 */
export class FileSystemService {
    constructor(private readonly logger: Logger) {}

    public validateFolder(workingDirFullPath: string): void {
        if (!existsSync(workingDirFullPath)) {
            throw new Error(`${workingDirFullPath} folder does not exist`);
        }
        if (!lstatSync(workingDirFullPath).isDirectory()) {
            throw new Error(`${workingDirFullPath} is not a folder!`);
        }
    }

    public validateSeedFolder(nemesisSeedFolder: string, message: string) {
        this.validateFolder(nemesisSeedFolder);
        const seedData = join(nemesisSeedFolder, '00000', '00001.dat');
        if (!existsSync(seedData)) {
            throw new KnownError(`File ${seedData} doesn't exist! ${message}`);
        }
        const seedIndex = join(nemesisSeedFolder, 'index.dat');
        if (!existsSync(seedIndex)) {
            throw new KnownError(`File ${seedIndex} doesn't exist! ${message}`);
        }
    }

    public deleteFile(file: string): void {
        if (existsSync(file) && lstatSync(file).isFile()) {
            unlinkSync(file);
        }
    }

    public async mkdir(path: string): Promise<void> {
        await fsPromises.mkdir(path, { recursive: true });
    }

    public async mkdirParentFolder(fileName: string): Promise<void> {
        const parentFolder = dirname(fileName);
        if (parentFolder) {
            return this.mkdir(parentFolder);
        }
    }
    public async copyDir(copyFrom: string, copyTo: string, excludeFiles: string[] = [], includeFiles: string[] = []): Promise<void> {
        await this.mkdir(copyTo);
        const files = await fsPromises.readdir(copyFrom);
        await Promise.all(
            files.map(async (file: string) => {
                const fromPath = join(copyFrom, file);
                const toPath = join(copyTo, file);
                // Stat the file to see if we have a file or dir
                const stat = await fsPromises.stat(fromPath);
                if (stat.isFile()) {
                    const fileName = basename(toPath);
                    const notBlacklisted = excludeFiles.indexOf(fileName) === -1;
                    const inWhitelistIfAny = includeFiles.length === 0 || includeFiles.indexOf(fileName) > -1;
                    if (notBlacklisted && inWhitelistIfAny) {
                        await fsPromises.copyFile(fromPath, toPath);
                    }
                } else if (stat.isDirectory()) {
                    await this.mkdir(toPath);
                    await this.copyDir(fromPath, toPath, excludeFiles, includeFiles);
                }
            }),
        );
    }

    public deleteFolder(folder: string, excludeFiles: string[] = []): void {
        if (existsSync(folder)) {
            this.logger.info(`Deleting folder ${folder}`);
        }
        return this.deleteFolderRecursive(folder, excludeFiles);
    }

    private deleteFolderRecursive(folder: string, excludeFiles: string[] = []): void {
        if (existsSync(folder)) {
            readdirSync(folder).forEach((file: string) => {
                const currentPath = join(folder, file);
                if (excludeFiles.find((f) => f === currentPath)) {
                    this.logger.info(`File ${currentPath} excluded from deletion.`);
                    return;
                }
                if (lstatSync(currentPath).isDirectory()) {
                    // recurse
                    this.deleteFolderRecursive(
                        currentPath,
                        excludeFiles.map((file) => join(currentPath, file)),
                    );
                } else {
                    // delete file
                    unlinkSync(currentPath);
                }
            });
            if (!readdirSync(folder).length) rmdirSync(folder);
        }
    }

    public getFilesRecursively(originalPath: string): string[] {
        const isDirectory = (path: string) => statSync(path).isDirectory();
        const getDirectories = (path: string) =>
            readdirSync(path)
                .map((name) => join(path, name))
                .filter(isDirectory);

        const isFile = (path: string) => statSync(path).isFile();
        const getFiles = (path: string): string[] =>
            readdirSync(path)
                .map((name) => join(path, name))
                .filter(isFile);

        const dirs = getDirectories(originalPath);
        const files = dirs
            .map((dir) => this.getFilesRecursively(dir)) // go through each directory
            .reduce((a, b) => a.concat(b), []); // map returns a 2d array (array of file arrays) so flatten
        return files.concat(getFiles(originalPath));
    }
    public getTargetFolder(target: string, absolute: boolean, ...paths: string[]): string {
        if (absolute) {
            return join(process.cwd(), target, ...paths);
        } else {
            return join(target, ...paths);
        }
    }
    public getTargetNodesFolder(target: string, absolute: boolean, ...paths: string[]): string {
        return this.getTargetFolder(target, absolute, Constants.targetNodesFolder, ...paths);
    }

    public getTargetGatewayFolder(target: string, absolute: boolean, ...paths: string[]): string {
        return this.getTargetFolder(target, absolute, Constants.targetGatewaysFolder, ...paths);
    }

    public getTargetNemesisFolder(target: string, absolute: boolean, ...paths: string[]): string {
        return this.getTargetFolder(target, absolute, Constants.targetNemesisFolder, ...paths);
    }

    public getTargetDatabasesFolder(target: string, absolute: boolean, ...paths: string[]): string {
        return this.getTargetFolder(target, absolute, Constants.targetDatabasesFolder, ...paths);
    }
    public async download(
        url: string,
        dest: string,
    ): Promise<{
        downloaded: boolean;
        fileLocation: string;
    }> {
        const destinationSize = existsSync(dest) ? statSync(dest).size : -1;
        const isHttpRequest = url.toLowerCase().startsWith('https:') || url.toLowerCase().startsWith('http:');
        if (!isHttpRequest) {
            const stats = statSync(url);
            if (existsSync(url) && !stats.isDirectory()) {
                return {
                    downloaded: false,
                    fileLocation: url,
                };
            } else {
                throw new Error(`Local file ${url} does not exist`);
            }
        } else {
            this.logger.info(`Checking remote file ${url}`);
            return new Promise((resolve, reject) => {
                function showDownloadingProgress(received: number, total: number) {
                    const percentage = ((received * 100) / total).toFixed(2);
                    const message = percentage + '% | ' + received + ' bytes downloaded out of ' + total + ' bytes.';
                    Utils.logSameLineMessage(message);
                }
                const request = get(url, (response) => {
                    const total = parseInt(response.headers['content-length'] || '0', 10);
                    let received = 0;
                    if (total === destinationSize) {
                        this.logger.info(`File ${dest} is up to date with url ${url}. No need to download!`);
                        request.abort();
                        resolve({
                            downloaded: false,
                            fileLocation: dest,
                        });
                    } else if (response.statusCode === 200) {
                        existsSync(dest) && unlinkSync(dest);
                        const file = createWriteStream(dest, { flags: 'wx' });
                        this.logger.info(`Downloading file ${url}. This could take a while!`);
                        response.pipe(file);
                        response.on('data', function (chunk) {
                            received += chunk.length;
                            showDownloadingProgress(received, total);
                        });

                        file.on('finish', () => {
                            resolve({
                                downloaded: true,
                                fileLocation: dest,
                            });
                        });

                        file.on('error', (err: any) => {
                            file.close();
                            if (err.code === 'EEXIST') {
                                reject(new Error('File already exists'));
                            } else {
                                unlinkSync(dest); // Delete temp file
                                reject(err);
                            }
                        });
                    } else {
                        reject(new Error(`Server responded with ${response.statusCode} ${response.statusMessage || ''}`.trim()));
                    }
                });

                request.on('error', (err) => {
                    existsSync(dest) && unlinkSync(dest); // Delete temp file
                    reject(err.message);
                });
            });
        }
    }

    public async chmodRecursive(path: string, mode: string | number): Promise<void> {
        // Loop through all the files in the config folder
        const stat = await fsPromises.stat(path);
        if (stat.isFile()) {
            await fsPromises.chmod(path, mode);
        } else if (stat.isDirectory()) {
            const files = await fsPromises.readdir(path);
            await Promise.all(
                files.map(async (file: string) => {
                    await this.chmodRecursive(join(path, file), mode);
                }),
            );
        }
    }
}

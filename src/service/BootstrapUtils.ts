import { existsSync, lstatSync, promises as fsPromises, readdirSync, readFileSync, rmdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import * as Handlebars from 'handlebars';
import Logger from '../logger/Logger';
import LoggerFactory from '../logger/LoggerFactory';
import { LogType } from '../logger/LogType';
import * as util from 'util';
import * as Docker from 'dockerode';
import * as _ from 'lodash';
import { textSync } from 'figlet';
import { Addresses, ConfigPreset } from '../model';
import { Preset } from './ConfigService';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const MemoryStream = require('memorystream');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const yaml = require('js-yaml');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const exec = util.promisify(require('child_process').exec);
const logger: Logger = LoggerFactory.getLogger(LogType.System);

export class BootstrapUtils {
    public static targetConfigFolder = 'config';
    public static readonly CURRENT_USER = 'current';
    private static presetInfoLogged = false;
    private static pulledImages: string[] = [];

    public static deleteFolder(folder: string): void {
        if (existsSync(folder)) {
            logger.info(`Deleting folder ${folder}`);
        }
        return BootstrapUtils.deleteFolderRecursive(folder);
    }

    private static deleteFolderRecursive(folder: string): void {
        if (existsSync(folder)) {
            readdirSync(folder).forEach((file: string) => {
                const curPath = join(folder, file);
                if (lstatSync(curPath).isDirectory()) {
                    // recurse
                    this.deleteFolderRecursive(curPath);
                } else {
                    // delete file
                    unlinkSync(curPath);
                }
            });
            rmdirSync(folder);
        }
    }

    public static deleteFile(file: string): void {
        if (existsSync(file) && lstatSync(file).isFile()) {
            unlinkSync(file);
        }
    }

    public static showBanner(): void {
        console.log(textSync('symbol-bootstrap', { horizontalLayout: 'full' }));
    }

    public static createDocker(): Docker {
        return new Docker({ socketPath: '/var/run/docker.sock' });
        // return new Docker({ host: 'localhost', port: 2375 });
        // return new Docker({ socketPath: 'tcp://0.0.0.0:2375' });
    }

    public static async pullImage(docker: Docker, image: string): Promise<void> {
        if (BootstrapUtils.pulledImages.indexOf(image) > -1) {
            return;
        }
        try {
            await docker.getImage(image).inspect();
            logger.info(`Image ${image} found`);
            BootstrapUtils.pulledImages.push(image);
        } catch (e) {
            logger.info(`Pulling image ${image}`);
            //TODO improve how to pull images using dockerone!!!
            const { stdout, stderr } = await exec('docker pull ' + image);
            if (stderr) {
                throw new Error(`Cannot pull image ${image}\n ${stderr}`);
            }
            const outputLines = stdout.toString().split('\n');
            logger.info(`Image pulled: ${outputLines[outputLines.length - 2]}`);
            BootstrapUtils.pulledImages.push(image);
        }
    }

    public static async createImageUsingExec(targetFolder: string, dockerFile: string, tag: string): Promise<string> {
        const runCommand = `docker build -f ${dockerFile} ${targetFolder} -t ${tag}`;
        logger.info(`Creating image image '${tag}' from ${dockerFile}`);
        return (await this.exec(runCommand)).stdout;
    }

    public static async exec(runCommand: string): Promise<{ stdout: string; stderr: string }> {
        logger.info(`Running command: ${runCommand}`);
        const { stdout, stderr } = await exec(runCommand);
        return { stdout, stderr };
    }

    public static async runImageUsingExec(
        image: string,
        userId: string | undefined,
        cmds: string[],
        binds: string[],
    ): Promise<{ stdout: string; stderr: string }> {
        const volumes = binds.map((b) => `-v ${b}`).join(' ');
        const userParam = userId ? `-u ${userId}` : '';
        const environmentParam = '--env LD_LIBRARY_PATH=/usr/catapult/lib:/usr/catapult/deps';
        const runCommand = `docker run --rm ${userParam} ${environmentParam} ${volumes} ${image} ${cmds.map((a) => `"${a}"`).join(' ')}`;
        logger.info(`Running image using Exec: ${image} ${cmds.join(' ')}`);
        return await this.exec(runCommand);
    }

    public static async runImageUsingApi(image: string, userId: string, cmds: string[], binds: string[]): Promise<string> {
        const createOptions = { User: userId, HostConfig: { Binds: binds } };
        const startOptions = {};
        const memStream = new MemoryStream();
        let stdout = '';
        memStream.on('data', (data: any) => {
            stdout += data.toString();
        });
        logger.info(`Running image using API: ${image} ${cmds.join(' ')}`);
        const docker = BootstrapUtils.createDocker();
        await BootstrapUtils.pullImage(docker, image);
        await docker.run(image, cmds, memStream, createOptions, startOptions);
        return stdout;
    }

    public static loadPresetData(
        root: string,
        preset: Preset,
        assembly: string | undefined,
        customPresetFile: string | undefined,
    ): ConfigPreset {
        const sharedPreset = this.loadYaml(join(root, 'presets', 'shared.yml'));
        const networkPreset = this.loadYaml(`${root}/presets/${preset}/network.yml`);
        const assemblyPreset = assembly ? this.loadYaml(`${root}/presets/${preset}/assembly-${assembly}.yml`) : {};
        const customPreset = customPresetFile ? this.loadYaml(customPresetFile) : {};
        //Deep merge
        const presetData = _.merge(sharedPreset, networkPreset, assemblyPreset, customPreset, { preset });
        if (!BootstrapUtils.presetInfoLogged) {
            logger.info(`Generating config from preset ${preset}`);
            if (assembly) {
                logger.info(`Assembly preset ${assembly}`);
            }
            if (customPresetFile) {
                logger.info(`Custom preset file ${customPresetFile}`);
            }
        }
        BootstrapUtils.presetInfoLogged = true;
        if (presetData.assemblies && !assembly) {
            throw new Error(`Preset ${preset} requires assembly (-a, --assembly option). Possible values are: ${presetData.assemblies}`);
        }
        return presetData;
    }

    public static loadExistingPresetData(target: string): ConfigPreset {
        return this.loadYaml(`${target}/config/preset.yml`);
    }

    public static loadExistingAddresses(target: string): Addresses {
        return this.loadYaml(`${target}/config/generated-addresses/addresses.yml`);
    }

    public static sleep(ms: number): Promise<any> {
        // Create a promise that rejects in <ms> milliseconds
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve();
            }, ms);
        });
    }

    public static poll(promiseFunction: () => Promise<boolean>, totalPollingTime: number, pollIntervalMs: number): Promise<boolean> {
        const startTime = new Date().getMilliseconds();
        return promiseFunction().then(async (result) => {
            if (result) {
                return true;
            } else {
                const endTime = new Date().getMilliseconds();
                const newPollingTime: number = Math.max(totalPollingTime - pollIntervalMs - (endTime - startTime), 0);
                if (newPollingTime) {
                    await BootstrapUtils.sleep(pollIntervalMs);
                    return this.poll(promiseFunction, newPollingTime, pollIntervalMs);
                } else {
                    return false;
                }
            }
        });
    }

    public static toAmount(renderedText: string | number): string {
        const numberAsString = (renderedText + '').split("'").join('');
        if (!numberAsString.match(/^\d+$/)) {
            throw new Error(`'${renderedText}' is not a valid integer`);
        }
        return (numberAsString.match(/\d{1,3}(?=(\d{3})*$)/g) || [numberAsString]).join("'");
    }

    public static toHex(renderedText: string): string {
        const numberAsString = renderedText.split("'").join('').replace(/^(0x)/, '');
        return '0x' + (numberAsString.match(/\w{1,4}(?=(\w{4})*$)/g) || [numberAsString]).join("'");
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    public static async generateConfiguration(templateContext: any, copyFrom: string, copyTo: string): Promise<void> {
        // Loop through all the files in the config folder
        await fsPromises.mkdir(copyTo, { recursive: true });
        const files = await fsPromises.readdir(copyFrom);
        await Promise.all(
            files.map(async (file: string) => {
                const fromPath = join(copyFrom, file);
                const toPath = join(copyTo, file);

                // Stat the file to see if we have a file or dir
                const stat = await fsPromises.stat(fromPath);

                if (stat.isFile()) {
                    if (toPath.indexOf('.mustache') > -1) {
                        const destinationFile = toPath.replace('.mustache', '');
                        const template = await fsPromises.readFile(fromPath, 'utf8');
                        Handlebars.registerHelper('toAmount', BootstrapUtils.toAmount);
                        Handlebars.registerHelper('toHex', BootstrapUtils.toHex);
                        const compiledTemplate = Handlebars.compile(template);
                        const renderedTemplate = compiledTemplate({ ...templateContext });
                        await fsPromises.writeFile(destinationFile, renderedTemplate);
                    } else {
                        await fsPromises.copyFile(fromPath, toPath);
                    }
                } else if (stat.isDirectory()) {
                    await fsPromises.mkdir(toPath, { recursive: true });
                    await this.generateConfiguration(templateContext, fromPath, toPath);
                }
            }),
        );
    }

    public static async mkdir(path: string): Promise<void> {
        await fsPromises.mkdir(path, { recursive: true });
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    public static async writeYaml(path: string, object: any): Promise<void> {
        const yamlString = this.toYaml(object);
        await BootstrapUtils.writeTextFile(path, yamlString);
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    public static toYaml(object: any): string {
        return yaml.safeDump(object, { skipInvalid: true, indent: 4, lineWidth: 140, noRefs: true });
    }

    public static fromYaml(yamlString: string): any {
        return yaml.safeLoad(yamlString);
    }

    public static loadYaml(fileLocation: string): any {
        return this.fromYaml(readFileSync(fileLocation, 'utf8'));
    }

    public static async writeTextFile(path: string, text: string): Promise<void> {
        await fsPromises.writeFile(path, text, 'utf8');
    }

    private static dockerUserId: string;

    public static async resolveDockerUserFromParam(paramUser: string | undefined): Promise<string | undefined> {
        if (!paramUser || paramUser.trim() === '') {
            return undefined;
        }
        if (paramUser === BootstrapUtils.CURRENT_USER) {
            return BootstrapUtils.getDockerUserGroup();
        }
        return paramUser;
    }

    public static async getDockerUserGroup(): Promise<string> {
        const isWin = process.platform === 'win32';
        if (isWin) {
            return '';
        }
        if (BootstrapUtils.dockerUserId !== undefined) {
            return BootstrapUtils.dockerUserId;
        }
        try {
            const { stdout } = await this.exec('echo $(id -u):$(id -g)');
            logger.info(`User for docker resolved: ${stdout}`);
            const user = stdout.trim();
            BootstrapUtils.dockerUserId = user;
            return user;
        } catch (e) {
            logger.info(`User for docker could not be resolved: ${e}`);
            return '';
        }
    }
}

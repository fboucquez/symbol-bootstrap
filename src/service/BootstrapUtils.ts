import { existsSync, readdirSync, lstatSync, unlinkSync, rmdirSync, readFileSync, promises as fsPromises } from 'fs';
import { join } from 'path';
import { ConfigPreset } from './ConfigService';
import * as Handlebars from 'handlebars';
import Logger from '../logger/Logger';
import LoggerFactory from '../logger/LoggerFactory';
import { LogType } from '../logger/LogType';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const yaml = require('js-yaml');
import * as util from 'util';
import * as Docker from 'dockerode';
import { textSync } from 'figlet';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const exec = util.promisify(require('child_process').exec);
const logger: Logger = LoggerFactory.getLogger(LogType.System);
export class BootstrapUtils {
    private static presetInfoLogged = false;
    private static pulledImages: string[] = [];

    public static deleteFolderRecursive(folder: string): void {
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

    public static showBanner(): void {
        console.log(textSync('symbol-bootstrap', { horizontalLayout: 'full' }));
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

    public static loadPresetData(
        root: string,
        preset: string,
        assembly: string | undefined,
        customPresetFile: string | undefined,
    ): ConfigPreset {
        const sharedPreset = yaml.safeLoad(readFileSync(`${root}/presets/shared.yml`, 'utf8'));
        const networkPreset = yaml.safeLoad(readFileSync(`${root}/presets/${preset}/network.yml`, 'utf8'));
        const assemblyPreset = assembly ? yaml.safeLoad(readFileSync(`${root}/presets/${preset}/assembly-${assembly}.yml`, 'utf8')) : {};
        const customPreset = customPresetFile ? yaml.safeLoad(readFileSync(customPresetFile, 'utf8')) : {};
        const presetData = { ...sharedPreset, ...networkPreset, ...assemblyPreset, ...customPreset, preset };
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
        return yaml.safeLoad(readFileSync(`${target}/config/preset.yml`, 'utf8'));
    }

    public static toAmount(renderedText: string | number): string {
        const numberAsString = (renderedText + '').split("'").join('');
        return (numberAsString.match(/\d{1,3}(?=(\d{3})*$)/g) || [numberAsString]).join("'");
    }

    public static toHex(renderedText: string): string {
        const numberAsString = renderedText
            .split("'")
            .join('')
            .replace(/^(0x\.)/, '');
        return '0x' + (numberAsString.match(/\w{1,4}(?=(\w{4})*$)/g) || [numberAsString]).join("'");
    }

    public static removeUndefined(obj: any): any {
        return Object.keys(obj).reduce((acc, key) => {
            return obj[key] !== undefined ? { ...acc, [key]: obj[key] } : acc;
        }, {});
    }

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

    public static async writeYaml(path: string, object: any): Promise<void> {
        const yamlString = yaml.safeDump(object, { skipInvalid: true, indent: 4, lineWidth: 140 });
        await BootstrapUtils.writeTextFile(path, yamlString);
    }

    public static async writeTextFile(path: string, text: string): Promise<void> {
        await fsPromises.writeFile(path, text, 'utf8');
    }

    public static dockerUserId: string;

    public static async getDockerUserGroup() {
        if (BootstrapUtils.dockerUserId !== undefined) {
            return BootstrapUtils.dockerUserId;
        }
        try {
            const { stdout }: { stdout: string } = await exec('echo $(id -u):$(id -g)');
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

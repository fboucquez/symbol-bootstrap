import { flags } from '@oclif/command';
import { IOptionFlag } from '@oclif/command/lib/flags';
import { IBooleanFlag } from '@oclif/parser/lib/flags';
import { textSync } from 'figlet';
import { prompt } from 'inquirer';
import { Logger } from 'symbol-bootstrap-core';
import { KeyStore, LazyKeyStore, LocalFileKeyStore } from 'symbol-network-core';
import { Account } from 'symbol-sdk';

export class NetworkCommandUtils {
    public static readonly CLI_TOOL = 'symbol-network';

    public static passwordPromptDefaultMessage = `Enter the password used to encrypt and decrypt the local key store (MASTER PASSWORD).`;
    public static nodePasswordPromptDefaultMessage = `Enter the password used to encrypt and decrypt the node's stored data (NODE PASSWORD).`;

    public static helpFlag: IBooleanFlag<void> = flags.help({ char: 'h', description: 'It shows the help of this command.' });
    public static passwordFlag: IOptionFlag<string | undefined> = NetworkCommandUtils.getPasswordFlag(
        'password',
        `MASTER PASSWORD: A password used to encrypt and decrypt the local key store. This cli prompts for a password by default, can be provided in the command line (--password=XXXX) or disabled in the command line (--noPassword).`,
    );
    public static noPasswordFlag: IBooleanFlag<boolean> = flags.boolean({
        description: 'When provided, the tool will not use a password, so private keys will be stored in plain text. Use with caution.',
        default: false,
    });
    public static nodePasswordFlag: IOptionFlag<string | undefined> = NetworkCommandUtils.getPasswordFlag(
        'nodePassword',
        `NODE PASSWORD: A password used to encrypt and decrypt each node configuration (Inside the nodes folder).`,
    );
    public static noNodePasswordFlag: IBooleanFlag<boolean> = flags.boolean({
        description: 'When provided, the tool will not use a password, so private keys will be stored in plain text. Use with caution.',
        default: false,
    });

    public static getPasswordFlag(paramName: string, description: string): IOptionFlag<string | undefined> {
        return flags.string({
            description: description,
            parse(input: string): string {
                const result = !input || NetworkCommandUtils.isValidPassword(input);
                if (result === true) return input;
                throw new Error(`--${paramName} is invalid, ${result}`);
            },
        });
    }

    public static showBanner(): void {
        console.log(
            textSync(NetworkCommandUtils.CLI_TOOL, {
                horizontalLayout: 'fitted',
            }),
        );
    }
    public static async resolvePassword(
        providedPassword: string | undefined,
        noPassword: boolean,
        message: string,
        logger: Logger | undefined,
    ): Promise<string | undefined> {
        if (!providedPassword) {
            if (noPassword) {
                logger?.warn(`Password has not been provided (--noPassword)! It's recommended to use one for security!`);
                return undefined;
            }
            const responses = await prompt([
                {
                    name: 'password',
                    mask: '*',
                    message: message,
                    type: 'password',
                    validate: this.isValidPassword,
                },
            ]);
            if (responses.password === '' || !responses.password) {
                logger?.warn(`Password has not been provided (empty text)! It's recommended to use one for security!`);
                return undefined;
            }
            logger?.info(`Password has been provided`);
            return responses.password;
        }
        logger?.info(`Password has been provided`);
        return providedPassword;
    }

    public static isValidPassword(input: string | undefined): boolean | string {
        if (!input || input === '') {
            return true;
        }
        if (input.length >= 4) return true;
        return `Password must have at least 4 characters but got ${input.length}`;
    }

    public static async createStore(
        flags: { password?: string; noPassword: boolean },
        logger: Logger,
        lazy: boolean,
        workingDir: string,
    ): Promise<KeyStore> {
        const factory = async () =>
            new LocalFileKeyStore(
                await this.resolvePassword(flags.password, flags.noPassword, this.passwordPromptDefaultMessage, logger),
                false,
                workingDir,
            );
        return lazy ? new LazyKeyStore(factory) : await factory();
    }

    public static async resolveNodePassword(
        flags: { nodePassword: string | undefined; noNodePassword: boolean },
        logger: Logger,
    ): Promise<string | undefined> {
        return await this.resolvePassword(flags.nodePassword, flags.noNodePassword, this.nodePasswordPromptDefaultMessage, logger);
    }

    static shouldAnnounce = async (): Promise<boolean> => {
        return true;
    };

    public static async cosignersPrompt(): Promise<Account[]> {
        throw new Error(`Cannot ask for cosigners yet!!`);
    }
}

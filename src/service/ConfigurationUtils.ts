import { existsSync } from 'fs';
import { join } from 'path';
import { Account, NetworkType, PublicAccount } from 'symbol-sdk';
import { ConfigAccount, ConfigPreset, NodePreset } from '../model';
import { Constants } from './Constants';
import { YamlUtils } from './YamlUtils';

/**
 * Utility class for bootstrap configuration related methods.
 */
export class ConfigurationUtils {
    public static toConfigAccountFomKeys(
        networkType: NetworkType,
        publicKey: string | undefined,
        privateKey: string | undefined,
    ): ConfigAccount | undefined {
        const account = this.toAccount(networkType, publicKey, privateKey);
        if (!account) {
            return undefined;
        }
        return this.toConfigAccount(account);
    }

    public static toAccount(
        networkType: NetworkType,
        publicKey: string | undefined,
        privateKey: string | undefined,
    ): PublicAccount | Account | undefined {
        if (privateKey) {
            const account = Account.createFromPrivateKey(privateKey, networkType);
            if (publicKey && account.publicKey.toUpperCase() != publicKey.toUpperCase()) {
                throw new Error('Invalid provided public key/private key!');
            }
            return account;
        }
        if (publicKey) {
            return PublicAccount.createFromPublicKey(publicKey, networkType);
        }
        return undefined;
    }

    public static toConfigAccount(account: PublicAccount | Account): ConfigAccount {
        // isntanceof doesn't work when loaded in multiple libraries.
        //https://stackoverflow.com/questions/59265098/instanceof-not-work-correctly-in-typescript-library-project
        if (account.constructor.name === Account.name) {
            return {
                privateKey: (account as Account).privateKey,
                publicKey: account.publicKey,
                address: account.address.plain(),
            };
        }
        return {
            publicKey: account.publicKey,
            address: account.address.plain(),
        };
    }

    public static resolveRoles(nodePreset: NodePreset): string {
        if (nodePreset.roles) {
            return nodePreset.roles;
        }
        const roles: string[] = [];
        if (nodePreset.syncsource) {
            roles.push('Peer');
        }
        if (nodePreset.api) {
            roles.push('Api');
        }
        if (nodePreset.voting) {
            roles.push('Voting');
        }
        return roles.join(',');
    }

    public static shouldCreateNemesis(presetData: ConfigPreset): boolean {
        return (
            presetData.nemesis &&
            !presetData.nemesisSeedFolder &&
            (YamlUtils.isYmlFile(presetData.preset) || !existsSync(join(Constants.ROOT_FOLDER, 'presets', presetData.preset, 'seed')))
        );
    }
}

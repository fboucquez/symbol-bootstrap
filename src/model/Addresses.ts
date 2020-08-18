import { NetworkType } from 'symbol-sdk';
import { NodeType } from './NodeType';

export interface CertificatePair {
    privateKey: string;
    publicKey: string;
}

export interface ConfigAccount extends CertificatePair {
    address: string;
}

export interface NodeAccount {
    signing: ConfigAccount;
    ssl: CertificatePair;
    type: NodeType;
    vrf: ConfigAccount;
    name: string;
    friendlyName: string;
}

export interface Addresses {
    nodes?: NodeAccount[];
    gateways?: ConfigAccount[];
    nemesisGenerationHashSeed: string;
    nemesisSigner?: ConfigAccount;
    networkType: NetworkType;
    mosaics?: Record<string, ConfigAccount[]>;
}

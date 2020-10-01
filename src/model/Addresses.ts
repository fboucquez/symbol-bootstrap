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
    ssl: CertificatePair;
    type: NodeType;
    //Signing key is produced if node is peer or voting
    signing?: ConfigAccount;
    // VRF key is produced if node is peer
    vrf?: ConfigAccount;
    // Voting key is produced if node is voting
    voting?: ConfigAccount;
    roles: string;
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

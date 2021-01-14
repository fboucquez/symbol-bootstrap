/*
 * Copyright 2020 NEM
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import {
    Account,
    Deadline,
    PlainMessage,
    PublicAccount,
    RepositoryFactoryHttp,
    TransactionService,
    TransferTransaction,
    UInt64,
} from 'symbol-sdk';
import Logger from '../logger/Logger';
import LoggerFactory from '../logger/LoggerFactory';
import { Addresses, ConfigPreset } from '../model';
import { BootstrapUtils } from './BootstrapUtils';
import { ConfigLoader } from './ConfigLoader';

const logger: Logger = LoggerFactory.getLogger();

export type SupernodeParams = { target: string; readonly password?: string; url: string; maxFee: number };

export class SupernodeService {
    public static readonly defaultParams: SupernodeParams = {
        target: BootstrapUtils.defaultTargetFolder,
        url: 'http://localhost:3000',
        maxFee: 100000,
    };

    private readonly configLoader: ConfigLoader;

    constructor(protected readonly params: SupernodeParams) {
        this.configLoader = new ConfigLoader();
    }

    public async enroll(passedPresetData?: ConfigPreset | undefined, passedAddresses?: Addresses | undefined): Promise<void> {
        const presetData = passedPresetData ?? this.configLoader.loadExistingPresetData(this.params.target, this.params.password);
        const addresses = passedAddresses ?? this.configLoader.loadExistingAddresses(this.params.target, this.params.password);
        if (!presetData.supernodeControllerPublicKey) {
            logger.warn('This network does not have a supernode controller public key. Nodes cannot be registered.');
            return;
        }
        const url = this.params.url.replace(/\/$/, '');
        const repositoryFactory = new RepositoryFactoryHttp(url);
        const currency = (await repositoryFactory.getCurrencies().toPromise()).currency;

        const networkType = await repositoryFactory.getNetworkType().toPromise();
        const supernodeControllerAddress = PublicAccount.createFromPublicKey(presetData.supernodeControllerPublicKey, networkType).address;

        const maxFee = UInt64.fromUint(this.params.maxFee);
        logger.info(
            `Registering super nodes using network url ${url}. Max Fee ${this.params.maxFee / Math.pow(10, currency.divisibility)}`,
        );
        logger.info(`Registration transfer transaction will be sent to ${supernodeControllerAddress.plain()}`);

        const generationHash = await repositoryFactory.getGenerationHash().toPromise();
        if (generationHash !== presetData.nemesisGenerationHashSeed) {
            throw new Error(
                `You are connecting to the wrong network. Expected generation hash is ${presetData.nemesisGenerationHashSeed} but got ${generationHash}`,
            );
        }

        const faucetUrl = presetData.faucetUrl;

        const deadline = Deadline.create(await repositoryFactory.getEpochAdjustment().toPromise());

        const supernodeRegistrationTransactions = (presetData.nodes || [])
            .map((node, index) => {
                const nodeAccount = addresses.nodes![index];
                if (!node.supernode) {
                    return;
                }
                if (!node.voting) {
                    logger.warn(`Node ${node.name} 'voting: true' custom preset flag wasn't provided!`);
                    return;
                }
                const agentPublicKey = nodeAccount.transport.publicKey;
                if (!agentPublicKey) {
                    logger.warn(`Cannot resolve harvester public key of node ${node.name}`);
                    return;
                }
                if (!node.host) {
                    logger.warn(
                        `Node ${node.name} public host name hasn't been provided! Please use 'host: myNodeHost' custom preset param.`,
                    );
                    return;
                }
                const mainAccount = Account.createFromPrivateKey(nodeAccount.main.privateKey, networkType);
                const agentUrl = node.agentUrl || 'https://' + node.host + ':7880';
                const plainMessage = `enrol ${agentPublicKey} ${agentUrl}`;
                const message = PlainMessage.create(plainMessage);
                logger.info(`Sending registration with message '${plainMessage}' using signer ${mainAccount.address.plain()}`);
                const transaction = TransferTransaction.create(deadline, supernodeControllerAddress, [], message, networkType, maxFee);

                return { singedTransaction: mainAccount.sign(transaction, generationHash), node };
            })
            .filter((p) => p);

        if (!supernodeRegistrationTransactions.length) {
            logger.info(`There are no supernodes to register!!! (have you use the custom preset flag 'supernode: true'?)`);
            return;
        }

        const listener = repositoryFactory.createListener();
        await listener.open();
        const service = new TransactionService(
            repositoryFactory.createTransactionRepository(),
            repositoryFactory.createReceiptRepository(),
        );
        try {
            const promises = supernodeRegistrationTransactions.map(async (pair) => {
                if (!pair) return;
                const signer = PublicAccount.createFromPublicKey(pair.singedTransaction.signerPublicKey, networkType).address;
                const noFundsMessage = faucetUrl
                    ? `Does your node signing address have any network coin? Send 3M+ tokens to ${signer.plain()} via ${faucetUrl}/?recipient=${signer.plain()}`
                    : `Does your node signing address have any network coin? Send 3M+ tokens to ${signer.plain()} :).`;
                try {
                    await service.announce(pair.singedTransaction, listener).toPromise();
                    logger.info(`Supernode registration transaction for node '${pair.node.name}' confirmed`);
                } catch (e) {
                    logger.error(
                        `There has been an error sending registration transaction for node '${
                            pair.node.name
                        }, signer is: ${signer.plain()}'. ${noFundsMessage}. ${e}`,
                    );
                }
            });
            await Promise.all(promises);
        } finally {
            listener.close();
        }
    }
}

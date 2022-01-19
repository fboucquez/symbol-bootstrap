/*
 * Copyright 2022 Fernando Boucquez
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
import fetch from 'cross-fetch';
import { lookup } from 'dns';
import * as _ from 'lodash';
import { firstValueFrom } from 'rxjs';
import { ChainInfo, RepositoryFactory, RepositoryFactoryHttp, RoleType } from 'symbol-sdk';
import { Configuration, NodeApi, NodeListFilter, RequestContext } from 'symbol-statistics-service-typescript-fetch-client';
import { Logger } from '../logger';
import { ConfigPreset, PeerInfo } from '../model';
import { KnownError } from './KnownError';
import { Utils } from './Utils';

export interface RepositoryInfo {
    repositoryFactory: RepositoryFactory;
    restGatewayUrl: string;
    chainInfo: ChainInfo;
}
export class RemoteNodeService {
    constructor(private readonly logger: Logger, private readonly presetData: ConfigPreset, private readonly offline: boolean) {}
    private restUrls: string[] | undefined;

    public async resolveCurrentFinalizationEpoch(): Promise<number> {
        const votingNode = this.presetData.nodes?.find((n) => n.voting);
        if (!votingNode || this.offline) {
            return this.presetData.lastKnownNetworkEpoch;
        }
        if (!(await this.isConnectedToInternet())) {
            return this.presetData.lastKnownNetworkEpoch;
        }
        const urls = await this.getRestUrls();
        return (await this.getBestFinalizationEpoch(urls)) || this.presetData.lastKnownNetworkEpoch;
    }

    public async getBestFinalizationEpoch(urls: string[]): Promise<number | undefined> {
        if (!urls.length) {
            return undefined;
        }
        const repositoryInfo = this.sortByHeight(await this.getKnownNodeRepositoryInfos(urls)).find((i) => i);
        const finalizationEpoch = repositoryInfo?.chainInfo.latestFinalizedBlock.finalizationEpoch;
        if (finalizationEpoch) {
            this.logger.info(`The current network finalization epoch is ${finalizationEpoch}`);
        }
        return finalizationEpoch;
    }

    public async getBestRepositoryInfo(url: string | undefined): Promise<RepositoryInfo> {
        const urls = url ? [url] : await this.getRestUrls();
        const repositoryInfo = this.sortByHeight(await this.getKnownNodeRepositoryInfos(urls)).find((i) => i);
        if (!repositoryInfo) {
            throw new Error(`No up and running node could be found out of: \n - ${urls.join('\n - ')}`);
        }
        this.logger.info(`Connecting to node ${repositoryInfo.restGatewayUrl}`);
        return repositoryInfo;
    }

    private sortByHeight(repos: RepositoryInfo[]): RepositoryInfo[] {
        return repos
            .filter((b) => b.chainInfo)
            .sort((a, b) => {
                if (!a.chainInfo) {
                    return 1;
                }
                if (!b.chainInfo) {
                    return -1;
                }
                return b.chainInfo.height.compare(a.chainInfo.height);
            });
    }

    public isConnectedToInternet(): Promise<boolean> {
        return new Promise<boolean>((resolve) => {
            lookup('google.com', (err) => {
                if (err && err.code == 'ENOTFOUND') {
                    resolve(false);
                } else {
                    resolve(true);
                }
            });
        });
    }

    private async getKnownNodeRepositoryInfos(urls: string[]): Promise<RepositoryInfo[]> {
        if (!urls.length) {
            throw new KnownError('There are not known nodes!');
        }
        this.logger.info(`Looking for the best node out of:  \n - ${urls.join('\n - ')}`);
        return (
            await Promise.all(
                urls.map(async (restGatewayUrl): Promise<RepositoryInfo | undefined> => {
                    const repositoryFactory = new RepositoryFactoryHttp(restGatewayUrl);
                    try {
                        const chainInfo = await firstValueFrom(repositoryFactory.createChainRepository().getChainInfo());
                        return {
                            restGatewayUrl,
                            repositoryFactory,
                            chainInfo,
                        };
                    } catch (e) {
                        const message = `There has been an error talking to node ${restGatewayUrl}. Error: ${Utils.getMessage(e)}`;
                        this.logger.warn(message);
                        return undefined;
                    }
                }),
            )
        )
            .filter((i) => i)
            .map((i) => i as RepositoryInfo);
    }

    public async getRestUrls(): Promise<string[]> {
        if (this.restUrls) {
            return this.restUrls;
        }
        const presetData = this.presetData;
        const urls = [...(presetData.knownRestGateways || [])];
        const statisticsServiceUrl = presetData.statisticsServiceUrl;
        if (statisticsServiceUrl && !this.offline) {
            const client = this.createNodeApiRestClient(statisticsServiceUrl);
            try {
                const filter = presetData.statisticsServiceRestFilter as NodeListFilter;
                const limit = presetData.statisticsServiceRestLimit;
                const nodes = await client.getNodes(filter ? filter : undefined, limit);
                urls.push(...nodes.map((n) => n.apiStatus?.restGatewayUrl).filter((url): url is string => !!url));
            } catch (e) {
                this.logger.warn(
                    `There has been an error connecting to statistics ${statisticsServiceUrl}. Rest urls cannot be resolved! Error ${Utils.getMessage(
                        e,
                    )}`,
                );
            }
        }
        if (!urls) {
            throw new Error('Rest URLS could not be resolved!');
        }
        this.restUrls = urls;
        return urls;
    }

    /**
     * Return user friendly role type list
     * @param role combined node role types
     */
    public static getNodeRoles(role: number): string {
        const roles: string[] = [];
        if ((RoleType.PeerNode.valueOf() & role) != 0) {
            roles.push('Peer');
        }
        if ((RoleType.ApiNode.valueOf() & role) != 0) {
            roles.push('Api');
        }
        if ((RoleType.VotingNode.valueOf() & role) != 0) {
            roles.push('Voting');
        }
        return roles.join(',');
    }

    public async getPeerInfos(): Promise<PeerInfo[]> {
        const presetData = this.presetData;
        const statisticsServiceUrl = presetData.statisticsServiceUrl;
        const knownPeers = [...(presetData.knownPeers || [])];
        if (statisticsServiceUrl && !this.offline) {
            const client = this.createNodeApiRestClient(statisticsServiceUrl);
            try {
                const filter = presetData.statisticsServicePeerFilter as NodeListFilter;
                const limit = presetData.statisticsServicePeerLimit;
                const nodes = await client.getNodes(filter ? filter : undefined, limit);
                const peerInfos = nodes
                    .map((n): PeerInfo | undefined => {
                        if (!n.peerStatus?.isAvailable || !n.publicKey || !n.port || !n.friendlyName || !n.roles) {
                            return undefined;
                        }
                        return {
                            publicKey: n.publicKey,
                            endpoint: {
                                host: n.host || '',
                                port: n.port,
                            },
                            metadata: {
                                name: n.friendlyName,
                                roles: RemoteNodeService.getNodeRoles(n.roles),
                            },
                        };
                    })
                    .filter((peerInfo): peerInfo is PeerInfo => !!peerInfo);
                knownPeers.push(...peerInfos);
            } catch (error) {
                this.logger.warn(
                    `There has been an error connecting to statistics ${statisticsServiceUrl}. Peers cannot be resolved! Error ${Utils.getMessage(
                        error,
                    )}`,
                );
            }
        }
        return knownPeers;
    }

    public createNodeApiRestClient(statisticsServiceUrl: string): NodeApi {
        return new NodeApi(
            new Configuration({
                fetchApi: fetch as any,
                basePath: statisticsServiceUrl,
                middleware: [
                    {
                        pre: (context: RequestContext): Promise<void> => {
                            this.logger.info(`Getting nodes information from ${context.url}`);
                            return Promise.resolve();
                        },
                    },
                ],
            }),
        );
    }

    public async resolveRestUrlsForServices(): Promise<{ restNodes: string[]; defaultNode: string }> {
        const restNodes: string[] = [];
        this.presetData.gateways?.forEach((restService) => {
            const nodePreset = this.presetData.nodes?.find((g) => g.name == restService.apiNodeName);
            restNodes.push(`http://${restService.host || nodePreset?.host || 'localhost'}:3000`);
        });
        restNodes.push(...(await this.getRestUrls()));
        const defaultNode = restNodes[0];
        if (!defaultNode) {
            throw new Error('Rest node could not be resolved!');
        }
        return { restNodes: _.uniq(restNodes), defaultNode: defaultNode };
    }
}

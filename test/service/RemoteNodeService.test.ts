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

import { expect } from 'chai';
import 'mocha';
import { it } from 'mocha';
import { join } from 'path';
import { restore, stub } from 'sinon';
import { NodeApi } from 'symbol-statistics-service-typescript-fetch-client';
import { ConfigPreset } from '../../src';
import { BootstrapUtils, ConfigLoader, Preset, RemoteNodeService } from '../../src/service';

const list = [
    {
        peerStatus: {
            isAvailable: true,
            lastStatusCheck: 1635710986117,
        },
        apiStatus: {
            restGatewayUrl: 'https://dual-001.testnet.symbol.dev:3001',
            isAvailable: true,
            lastStatusCheck: 1635710986145,
            nodeStatus: {
                apiNode: 'up',
                db: 'up',
            },
            isHttpsEnabled: true,
            nodePublicKey: 'A2160AB911943082C88109DD8B65A0082EF547CA7C28F001F857112F7ADD9B3D',
            chainHeight: 517611,
            finalization: {
                height: 517596,
                epoch: 720,
                point: 43,
                hash: 'FD462D4133EEEC56471AAE18A6A2A3065DF69394A849D51F20286E189C46E4F5',
            },
            restVersion: '2.3.8-alpha',
        },
        _id: '617ef846196f2900128bb55c',
        version: 16777728,
        publicKey: 'E3FC28889BDE31406465167F1D9D6A16DCA1FF67A3BABFA5E5A8596478848F78',
        networkGenerationHashSeed: '3B5E1FA6445653C971A50687E75E6D09FB30481055E3990C84B25E9222DC1155',
        roles: 3,
        port: 7900,
        networkIdentifier: 152,
        host: 'dual-001.testnet.symbol.dev',
        friendlyName: 'dual-001',
        hostDetail: {
            host: 'dual-001.testnet.symbol.dev',
            coordinates: {
                latitude: 39.0438,
                longitude: -77.4874,
            },
            location: 'Ashburn, VA, United States',
            ip: '3.86.56.197',
            organization: 'AWS EC2 (us-east-1)',
            as: 'AS14618 Amazon.com, Inc.',
            continent: 'North America',
            country: 'United States',
            region: 'VA',
            city: 'Ashburn',
            district: '',
            zip: '20149',
        },
        __v: 0,
    },
    {
        peerStatus: {
            isAvailable: true,
            lastStatusCheck: 1635710986215,
        },
        apiStatus: {
            restGatewayUrl: 'https://sym-test-06.opening-line.jp:3001',
            isAvailable: true,
            lastStatusCheck: 1635710986858,
            nodeStatus: {
                apiNode: 'up',
                db: 'up',
            },
            isHttpsEnabled: true,
            nodePublicKey: '50F34D96117E020BBB48C81C719A020C40729BF3D48483751D6CA8198FFB52C9',
            chainHeight: 517611,
            finalization: {
                height: 517596,
                epoch: 720,
                point: 43,
                hash: 'FD462D4133EEEC56471AAE18A6A2A3065DF69394A849D51F20286E189C46E4F5',
            },
            restVersion: '2.3.6',
        },
        _id: '617ef846196f2900128bb55d',
        version: 16777728,
        publicKey: '4675E1626A35EF8B9537486D93BB6B488960712A653CB62D27404D35E92F53A9',
        networkGenerationHashSeed: '3B5E1FA6445653C971A50687E75E6D09FB30481055E3990C84B25E9222DC1155',
        roles: 3,
        port: 7900,
        networkIdentifier: 152,
        host: 'sym-test-06.opening-line.jp',
        friendlyName: 'sym-test-06.opening-line.jp',
        hostDetail: {
            host: 'sym-test-06.opening-line.jp',
            coordinates: {
                latitude: 54.7091,
                longitude: 25.2971,
            },
            location: 'Vilnius, VL, Lithuania',
            ip: '80.209.226.245',
            organization: 'RACKRAY',
            as: 'AS212531 Interneto vizija',
            continent: 'Europe',
            country: 'Lithuania',
            region: 'VL',
            city: 'Vilnius',
            district: '',
            zip: '08234',
        },
        __v: 0,
    },
    {
        peerStatus: {
            isAvailable: true,
            lastStatusCheck: 1635710986325,
        },
        _id: '617ef846196f2900128bb55e',
        version: 16777728,
        publicKey: '2489946E49B03D9BE040E3FD42FEBC705D001A746BD25399E2796D615B35B732',
        networkGenerationHashSeed: '3B5E1FA6445653C971A50687E75E6D09FB30481055E3990C84B25E9222DC1155',
        roles: 5,
        port: 7900,
        networkIdentifier: 152,
        host: 'peer-601.testnet.symbol.dev',
        friendlyName: 'peer-601',
        hostDetail: {
            host: 'peer-601.testnet.symbol.dev',
            coordinates: {
                latitude: 1.28009,
                longitude: 103.851,
            },
            location: 'Singapore, , Singapore',
            ip: '54.179.53.6',
            organization: 'AWS EC2 (ap-southeast-1)',
            as: 'AS16509 Amazon.com, Inc.',
            continent: 'Asia',
            country: 'Singapore',
            region: '',
            city: 'Singapore',
            district: '',
            zip: '',
        },
        __v: 0,
    },
    {
        peerStatus: {
            isAvailable: true,
            lastStatusCheck: 1635710986299,
        },
        apiStatus: {
            restGatewayUrl: 'http://AMATERASU.symbol-node.com:3000',
            isAvailable: true,
            lastStatusCheck: 1635710987216,
            nodeStatus: {
                apiNode: 'up',
                db: 'up',
            },
            isHttpsEnabled: false,
            nodePublicKey: 'B46268513DDCC2A74241E11F2A38F2FCC6CB655E7CBBD95DA6B32266B5CA88ED',
            chainHeight: 517611,
            finalization: {
                height: 517596,
                epoch: 720,
                point: 43,
                hash: 'FD462D4133EEEC56471AAE18A6A2A3065DF69394A849D51F20286E189C46E4F5',
            },
            restVersion: '2.3.6',
        },
        _id: '617ef846196f2900128bb55f',
        version: 16777728,
        publicKey: 'DB14A11E28CA1EF8BC45657BA3FF0879946A57D8F7370C585819365521C6449C',
        networkGenerationHashSeed: '3B5E1FA6445653C971A50687E75E6D09FB30481055E3990C84B25E9222DC1155',
        roles: 3,
        port: 7900,
        networkIdentifier: 152,
        host: 'AMATERASU.symbol-node.com',
        friendlyName: 'AMATERASU.symbol-node.com(TEST)',
        hostDetail: {
            host: 'AMATERASU.symbol-node.com',
            coordinates: {
                latitude: 34.6866,
                longitude: 135.8548,
            },
            location: 'Nara, 29, Japan',
            ip: '58.70.54.55',
            organization: 'OPTAGE Inc.',
            as: 'AS17511 OPTAGE Inc.',
            continent: 'Asia',
            country: 'Japan',
            region: '29',
            city: 'Nara',
            district: '',
            zip: '630-8211',
        },
        __v: 0,
    },
    {
        peerStatus: {
            isAvailable: true,
            lastStatusCheck: 1635710986193,
        },
        apiStatus: {
            restGatewayUrl: 'https://iroha-symbolnode.com:3001',
            isAvailable: true,
            lastStatusCheck: 1635710986698,
            nodeStatus: {
                apiNode: 'up',
                db: 'up',
            },
            isHttpsEnabled: true,
            nodePublicKey: '01438DDE96FD4816726F8B80CC012DC85FED6CDA45F9B932887A3512593CFA51',
            chainHeight: 517611,
            finalization: {
                height: 517596,
                epoch: 720,
                point: 43,
                hash: 'FD462D4133EEEC56471AAE18A6A2A3065DF69394A849D51F20286E189C46E4F5',
            },
            restVersion: '2.3.6',
        },
        _id: '617ef846196f2900128bb560',
        version: 16777728,
        publicKey: '26BEC23EF633936BAB5E501F03E0C374036F5FF20AC068972839357851411496',
        networkGenerationHashSeed: '3B5E1FA6445653C971A50687E75E6D09FB30481055E3990C84B25E9222DC1155',
        roles: 3,
        port: 7900,
        networkIdentifier: 152,
        host: 'iroha-symbolnode.com',
        friendlyName: '168nihoheto_VDS_S',
        hostDetail: {
            host: 'iroha-symbolnode.com',
            coordinates: {
                latitude: 47.6034,
                longitude: -122.3414,
            },
            location: 'Seattle, WA, United States',
            ip: '66.94.122.36',
            organization: 'Contabo Inc',
            as: 'AS40021 Contabo Inc.',
            continent: 'North America',
            country: 'United States',
            region: 'WA',
            city: 'Seattle',
            district: '',
            zip: '98111',
        },
        __v: 0,
    },
    {
        peerStatus: {
            isAvailable: true,
            lastStatusCheck: 1635710986174,
        },
        apiStatus: {
            restGatewayUrl: 'https://dual-101.testnet.symbol.dev:3001',
            isAvailable: true,
            lastStatusCheck: 1635710986567,
            nodeStatus: {
                apiNode: 'up',
                db: 'up',
            },
            isHttpsEnabled: true,
            nodePublicKey: 'F81F749613EF3BC10BB9670A6FAF49BFA95079898E2034255B8256FBA3FD105D',
            chainHeight: 517611,
            finalization: {
                height: 517596,
                epoch: 720,
                point: 43,
                hash: 'FD462D4133EEEC56471AAE18A6A2A3065DF69394A849D51F20286E189C46E4F5',
            },
            restVersion: '2.3.8-alpha',
        },
        _id: '617ef846196f2900128bb561',
        version: 16777728,
        publicKey: 'C4348215B4C417D3E4B52ACAA3D370D29DE3A5F482CAED3C9F1BE257DD2B4079',
        networkGenerationHashSeed: '3B5E1FA6445653C971A50687E75E6D09FB30481055E3990C84B25E9222DC1155',
        roles: 3,
        port: 7900,
        networkIdentifier: 152,
        host: 'dual-101.testnet.symbol.dev',
        friendlyName: 'dual-101',
        hostDetail: {
            host: 'dual-101.testnet.symbol.dev',
            coordinates: {
                latitude: 37.3394,
                longitude: -121.895,
            },
            location: 'San Jose, CA, United States',
            ip: '54.151.52.226',
            organization: 'AWS EC2 (us-west-1)',
            as: 'AS16509 Amazon.com, Inc.',
            continent: 'North America',
            country: 'United States',
            region: 'CA',
            city: 'San Jose',
            district: '',
            zip: '95141',
        },
        __v: 0,
    },
    {
        peerStatus: {
            isAvailable: true,
            lastStatusCheck: 1635710986181,
        },
        _id: '617ef846196f2900128bb565',
        version: 16777728,
        publicKey: 'DC7A90D0676DB3A2D963768276F606AF76541A59588B23C6C6B48D98E0AC3837',
        networkGenerationHashSeed: '3B5E1FA6445653C971A50687E75E6D09FB30481055E3990C84B25E9222DC1155',
        roles: 1,
        port: 7900,
        networkIdentifier: 152,
        host: 'peer-301.testnet.symbol.dev',
        friendlyName: 'peer-301',
        hostDetail: {
            host: 'peer-301.testnet.symbol.dev',
            coordinates: {
                latitude: 53.3498,
                longitude: -6.26031,
            },
            location: 'Dublin, L, Ireland',
            ip: '54.77.189.25',
            organization: 'AWS EC2 (eu-west-1)',
            as: 'AS16509 Amazon.com, Inc.',
            continent: 'Europe',
            country: 'Ireland',
            region: 'L',
            city: 'Dublin',
            district: '',
            zip: 'D02',
        },
        __v: 0,
    },
    {
        peerStatus: {
            isAvailable: true,
            lastStatusCheck: 1635710986140,
        },
        apiStatus: {
            restGatewayUrl: 'https://sym-test-02.opening-line.jp:3001',
            isAvailable: true,
            lastStatusCheck: 1635710986329,
            nodeStatus: {
                apiNode: 'up',
                db: 'up',
            },
            isHttpsEnabled: true,
            nodePublicKey: '81448301A61412CE24F679C67136CF56DF43216EEAB3065677AA4ECFD0441B59',
            chainHeight: 517611,
            finalization: {
                height: 517596,
                epoch: 720,
                point: 43,
                hash: 'FD462D4133EEEC56471AAE18A6A2A3065DF69394A849D51F20286E189C46E4F5',
            },
            restVersion: '2.3.6',
        },
        _id: '617ef846196f2900128bb567',
        version: 16777728,
        publicKey: '97A7D1E1889803D4A5E3F372530EB555C495B23012807E3E94EF15A2205BC3A6',
        networkGenerationHashSeed: '3B5E1FA6445653C971A50687E75E6D09FB30481055E3990C84B25E9222DC1155',
        roles: 3,
        port: 7900,
        networkIdentifier: 152,
        host: 'sym-test-02.opening-line.jp',
        friendlyName: 'sym-test-02.opening-line.jp',
        hostDetail: {
            host: 'sym-test-02.opening-line.jp',
            coordinates: {
                latitude: 38.6327,
                longitude: -90.1956,
            },
            location: 'St Louis, MO, United States',
            ip: '209.145.59.225',
            organization: 'Contabo Inc',
            as: 'AS40021 Contabo Inc.',
            continent: 'North America',
            country: 'United States',
            region: 'MO',
            city: 'St Louis',
            district: 'Downtown',
            zip: '63101',
        },
        __v: 0,
    },
];
const customPresetObject = {
    lastKnownNetworkEpoch: 1,
    nodeUseRemoteAccount: true,
    nodes: [
        {
            mainPrivateKey: 'CA82E7ADAF7AB729A5462A1BD5AA78632390634904A64EB1BB22295E2E1A1BDD',
            friendlyName: 'myFriendlyName',
        },
    ],
    knownRestGateways: ['http://staticRest1:3000', 'https://staticRest2:3001'],
    knownPeers: [
        {
            publicKey: 'AAAAE7EAEEAE61EF0C50B4D05931F4325F69081B1B074D31E094C4B21E8CFB3D',
            endpoint: { host: 'someStaticPeer', port: 7900 },
            metadata: { name: 'someStaticPeer', roles: 'Peer,Api' },
        },
    ],
};
const preset = Preset.testnet;
const root = './';
const networkPresetLocation = `${root}/presets/${preset}/network.yml`;
const sharedPresetLocation = join(root, 'presets', 'shared.yml');
const sharedPreset = BootstrapUtils.loadYaml(sharedPresetLocation, false);
const networkPreset = BootstrapUtils.loadYaml(networkPresetLocation, false);
const presetData: ConfigPreset = new ConfigLoader().mergePresets(sharedPreset, networkPreset, customPresetObject);

describe('RemoteNodeService', () => {
    afterEach(restore);
    it('getRestUrls online', async () => {
        stub(RemoteNodeService.prototype, 'createNodeApiRestClient').callsFake(() => {
            return ({
                getNodes(filter: NodeFilter, limit: number) {
                    expect(filter).eq(presetData.statisticsServiceRestFilter);
                    expect(limit).eq(presetData.statisticsServiceRestLimit);
                    return list;
                },
            } as unknown) as NodeApi;
        });

        const service = new RemoteNodeService(presetData, false);
        const urls = await service.getRestUrls();
        expect(urls).deep.eq([
            'http://staticRest1:3000',
            'https://staticRest2:3001',
            'https://dual-001.testnet.symbol.dev:3001',
            'https://sym-test-06.opening-line.jp:3001',
            'http://AMATERASU.symbol-node.com:3000',
            'https://iroha-symbolnode.com:3001',
            'https://dual-101.testnet.symbol.dev:3001',
            'https://sym-test-02.opening-line.jp:3001',
        ]);
    });
    it('getRestUrls offline', async () => {
        stub(RemoteNodeService.prototype, 'createNodeApiRestClient').callsFake(() => {
            return ({
                getNodes(filter: NodeFilter, limit: number) {
                    expect(filter).eq(presetData.statisticsServiceRestFilter);
                    expect(limit).eq(presetData.statisticsServiceRestLimit);
                    return list;
                },
            } as unknown) as NodeApi;
        });

        const service = new RemoteNodeService(presetData, true);
        const urls = await service.getRestUrls();
        expect(urls).deep.eq(['http://staticRest1:3000', 'https://staticRest2:3001']);
    });
    it('getPeerInfos online', async () => {
        stub(RemoteNodeService.prototype, 'createNodeApiRestClient').callsFake(() => {
            return ({
                getNodes(filter: NodeFilter, limit: number) {
                    expect(presetData.statisticsServicePeerFilter).eq('');
                    expect(filter).eq(undefined);
                    expect(limit).eq(presetData.statisticsServicePeerLimit);
                    return list;
                },
            } as unknown) as NodeApi;
        });

        const service = new RemoteNodeService(presetData, false);
        const peerInfos = await service.getPeerInfos();
        expect(peerInfos).deep.eq([
            {
                publicKey: 'AAAAE7EAEEAE61EF0C50B4D05931F4325F69081B1B074D31E094C4B21E8CFB3D',
                endpoint: { host: 'someStaticPeer', port: 7900 },
                metadata: { name: 'someStaticPeer', roles: 'Peer,Api' },
            },
            {
                publicKey: 'E3FC28889BDE31406465167F1D9D6A16DCA1FF67A3BABFA5E5A8596478848F78',
                endpoint: { host: 'dual-001.testnet.symbol.dev', port: 7900 },
                metadata: { name: 'dual-001', roles: 'Peer,Api' },
            },
            {
                publicKey: '4675E1626A35EF8B9537486D93BB6B488960712A653CB62D27404D35E92F53A9',
                endpoint: { host: 'sym-test-06.opening-line.jp', port: 7900 },
                metadata: { name: 'sym-test-06.opening-line.jp', roles: 'Peer,Api' },
            },
            {
                publicKey: '2489946E49B03D9BE040E3FD42FEBC705D001A746BD25399E2796D615B35B732',
                endpoint: { host: 'peer-601.testnet.symbol.dev', port: 7900 },
                metadata: { name: 'peer-601', roles: 'Peer,Voting' },
            },
            {
                publicKey: 'DB14A11E28CA1EF8BC45657BA3FF0879946A57D8F7370C585819365521C6449C',
                endpoint: { host: 'AMATERASU.symbol-node.com', port: 7900 },
                metadata: { name: 'AMATERASU.symbol-node.com(TEST)', roles: 'Peer,Api' },
            },
            {
                publicKey: '26BEC23EF633936BAB5E501F03E0C374036F5FF20AC068972839357851411496',
                endpoint: { host: 'iroha-symbolnode.com', port: 7900 },
                metadata: { name: '168nihoheto_VDS_S', roles: 'Peer,Api' },
            },
            {
                publicKey: 'C4348215B4C417D3E4B52ACAA3D370D29DE3A5F482CAED3C9F1BE257DD2B4079',
                endpoint: { host: 'dual-101.testnet.symbol.dev', port: 7900 },
                metadata: { name: 'dual-101', roles: 'Peer,Api' },
            },
            {
                publicKey: 'DC7A90D0676DB3A2D963768276F606AF76541A59588B23C6C6B48D98E0AC3837',
                endpoint: { host: 'peer-301.testnet.symbol.dev', port: 7900 },
                metadata: { name: 'peer-301', roles: 'Peer' },
            },
            {
                publicKey: '97A7D1E1889803D4A5E3F372530EB555C495B23012807E3E94EF15A2205BC3A6',
                endpoint: { host: 'sym-test-02.opening-line.jp', port: 7900 },
                metadata: { name: 'sym-test-02.opening-line.jp', roles: 'Peer,Api' },
            },
        ]);
    });
    it('getPeerInfos offline', async () => {
        stub(RemoteNodeService.prototype, 'createNodeApiRestClient').callsFake(() => {
            return ({
                getNodes(filter: NodeFilter, limit: number) {
                    expect(filter).eq(presetData.statisticsServicePeerFilter);
                    expect(limit).eq(presetData.statisticsServicePeerLimit);
                    return list;
                },
            } as unknown) as NodeApi;
        });

        const service = new RemoteNodeService(presetData, true);
        const peerInfos = await service.getPeerInfos();
        expect(peerInfos).deep.eq([
            {
                publicKey: 'AAAAE7EAEEAE61EF0C50B4D05931F4325F69081B1B074D31E094C4B21E8CFB3D',
                endpoint: { host: 'someStaticPeer', port: 7900 },
                metadata: { name: 'someStaticPeer', roles: 'Peer,Api' },
            },
        ]);
    });

    it('getPeerInfos unknown statisticsServiceUrl', async () => {
        presetData.statisticsServiceUrl = 'https://testnet.symbol.invalid';
        const service = new RemoteNodeService(presetData, false);
        const peerInfos = await service.getPeerInfos();
        // only static nodes are returned when the statistics service client fails
        expect(peerInfos).deep.eq([
            {
                publicKey: 'AAAAE7EAEEAE61EF0C50B4D05931F4325F69081B1B074D31E094C4B21E8CFB3D',
                endpoint: { host: 'someStaticPeer', port: 7900 },
                metadata: { name: 'someStaticPeer', roles: 'Peer,Api' },
            },
        ]);
    });

    it('getPeerInfos invalid statisticsServiceUrl path', async () => {
        presetData.statisticsServiceUrl = 'https://testnet.symbol.services/invalid';
        const service = new RemoteNodeService(presetData, false);
        const peerInfos = await service.getPeerInfos();
        // only static nodes are returned when the statistics service client fails
        expect(peerInfos).deep.eq([
            {
                publicKey: 'AAAAE7EAEEAE61EF0C50B4D05931F4325F69081B1B074D31E094C4B21E8CFB3D',
                endpoint: { host: 'someStaticPeer', port: 7900 },
                metadata: { name: 'someStaticPeer', roles: 'Peer,Api' },
            },
        ]);
    });
});

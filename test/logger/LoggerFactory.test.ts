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

import { expect } from 'chai';
import { it } from 'mocha';
import { LoggerFactory } from '../../src';

describe('LoggerFactory', () => {
    it('getLogger file', () => {
        const logger = LoggerFactory.getLogger('FiLe');
        const transports = (logger as any)['transports'];
        expect(transports.length).equals(1);
        expect(transports[0]._basename).equals('logs.log');
        expect(transports[0].name).equals('file');
    });

    it('getLogger console', () => {
        const logger = LoggerFactory.getLogger('console');
        const transports = (logger as any)['transports'];
        expect(transports.length).equals(1);
        expect(transports[0].name).equals('console');
    });

    it('getLogger silent', () => {
        const logger = LoggerFactory.getLogger('SILENT');
        const transports = (logger as any)['transports'];
        expect(transports.length).equals(1);
        expect(transports[0].silent).equals(true);
        expect(transports[0].name).equals('console');
    });

    it('getLogger multiple', () => {
        const logger = LoggerFactory.getLogger('console , , File,SILENT');
        const transports = (logger as any)['transports'];
        expect(transports.length).equals(3);
        expect(transports[0].name).equals('console');
        expect(transports[1].name).equals('file');
        expect(transports[1]._basename).equals('logs.log');
        expect(transports[2].name).equals('console');
        expect(transports[2].silent).equals(true);
    });

    it('getLogger invalid', () => {
        expect(() => LoggerFactory.getLogger('console , INVALID , File,SILENT')).throw('Unknown LogType INVALID');
    });
});

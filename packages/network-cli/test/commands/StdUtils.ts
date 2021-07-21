/*
 * Copyright 2021 NEM
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

import { stdin } from 'mock-stdin';

export const StdUtils = {
    keys: Object.freeze({
        up: '\u001b[A',
        down: '\u001b[B',
        left: '\u001b[D',
        right: '\u001b[C',
    }),
    in: (responses: string[]): void => {
        let k = 0;

        const s = stdin();
        function sendAnswer() {
            setTimeout(function () {
                const text = responses[k];
                console.log('');
                console.log('Response ' + k + ' ' + escape(text));
                s.send(text);
                k += 1;
                if (k < responses.length) {
                    sendAnswer();
                }
            }, 60);
        }

        sendAnswer();
    },
};

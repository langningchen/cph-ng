// Copyright (C) 2025 Langning Chen
//
// This file is part of cph-ng.
//
// cph-ng is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// cph-ng is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with cph-ng.  If not, see <https://www.gnu.org/licenses/>.

import { Problem } from '@/types';
import { Server } from './server';
import { Submitter } from './submitter';

export default class Companion {
    public static init() {
        Server.init();
    }
    public static stopServer() {
        Server.stopServer();
    }
    public static async submit(problem?: Problem) {
        return Submitter.submit(problem);
    }
}
export * from './types';

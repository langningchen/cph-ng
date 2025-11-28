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

declare const vscode: {
  postMessage<T>(msg: T): Thenable<void>;
};

declare const isDarkMode: boolean;
declare const partyUri: string;
declare const hiddenStatuses: string[];
declare const language: string;
declare const showTips: boolean;
interface Window {
  easterEgg?: boolean;
  activePath?: string;
}

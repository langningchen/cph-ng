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

import Logger from '@/helpers/logger';
import { FileWithHash } from '@/types';
import { exists } from '@/utils/process';
import { SHA256 } from 'crypto-js';
import { readFile, unlink } from 'fs/promises';

const logger = new Logger('compiler-cache');

export const checkHash = async (
    src: FileWithHash,
    outputPath: string,
    additionalHash: string,
    forceCompile: boolean | null,
): Promise<{
    skip: boolean;
    hash: string;
}> => {
    logger.trace('Checking hash for file', src, {
        src,
        outputPath,
        additionalHash,
        forceCompile,
    });
    const hash = SHA256(
        (await readFile(src.path, 'utf-8')) + additionalHash,
    ).toString();
    if (
        forceCompile === false ||
        (forceCompile !== true &&
            src.hash === hash &&
            (await exists(outputPath)))
    ) {
        logger.debug('Skipping compilation', {
            srcHash: src.hash,
            currentHash: hash,
            outputPath,
        });
        return { skip: true, hash };
    }
    try {
        await unlink(outputPath);
        logger.debug('Removed existing output file', { outputPath });
    } catch {
        logger.debug('No existing output file to remove', { outputPath });
    }
    logger.debug('Proceeding with compilation', {
        srcHash: src.hash,
        currentHash: hash,
        outputPath,
    });
    return { skip: false, hash };
};

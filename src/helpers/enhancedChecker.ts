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

import { SHA256 } from 'crypto-js';
import { mkdir, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import Settings from '../modules/settings';
import { EnhancedCompare } from '../utils/types';

const ENHANCED_CHECKER_CODE = `// fast ASCII large file (<1GB is recommended) comparison
// requires: GCC or Clang. MSVC is NOT supported.
// Windows (with MinGW or similar) might be NOT as fast as Linux.
// You can define PRECISION to enable floating-point precision comparison. But it's much slower.
// You can define CASE_INSENSITIVE to enable case-insensitive comparison. But it's slightly slower.

#include <assert.h>
#include <ctype.h>
#include <math.h>
#include <stdbool.h>
#include <stddef.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/mman.h>
#include <sys/stat.h>
#include <unistd.h>

typedef struct CompareResult {
    bool success;
    bool equal;
    size_t first_difference;
} CompareResult;

static inline bool whitespace(unsigned char c) {
    return (c - 9u < 5u) | (c == 32u); // 9: \t, 10: \n, 11: \v, 12: \f, 13: \r, 32: ' '
}

static inline bool char_equal_case_insensitive(unsigned char a, unsigned char b) {
    if(__builtin_expect(a == b, true)) return true;
    if(__builtin_expect((a ^ b) != 0x20u, false)) return false;
    return (a | 0x20u) - 97u < 26u;
}

double to_double(unsigned char *s, size_t len, bool *ok) {
    char *endpoint;
    double value = strtod((char *)s, &endpoint);
    *ok = (endpoint - s) == len;
    return value;
}

static inline bool equal(unsigned char *a, unsigned char *b, size_t lenA, size_t lenB) {
#ifdef PRECISION
    bool ok1, ok2;
    double d1 = to_double(a, lenA, &ok1), d2 = to_double(b, lenB, &ok2);
    if(ok1 != ok2) return false;
    if(ok1) return fabs(d1 - d2) <= PRECISION;
    // if !ok1, fall through
#endif
    if(lenA != lenB) return false;
#ifdef CASE_INSENSITIVE
    for(size_t i = 0; i < lenA; i++) {
        if(!char_equal_case_insensitive(a[i], b[i])) return false;
    }
    return true;
#endif
    return memcmp(a, b, lenA) == 0;
}

CompareResult compareFilePointers(FILE *f1, FILE *f2) {
    int f1_no = fileno(f1), f2_no = fileno(f2);
    struct stat f1_stat, f2_stat;
    if(fstat(f1_no, &f1_stat) == -1) return (CompareResult){false, false, 0};
    if(fstat(f2_no, &f2_stat) == -1) return (CompareResult){false, false, 0};
    size_t f1s = f1_stat.st_size, f2s = f2_stat.st_size;
    unsigned char *data1 = NULL;
    if(f1s) data1 = (unsigned char *)mmap(NULL, f1s, PROT_READ, MAP_PRIVATE, f1_no, 0);
    unsigned char *data2 = NULL;
    if(f2s) data2 = (unsigned char *)mmap(NULL, f2s, PROT_READ, MAP_PRIVATE, f2_no, 0);
    if(data1 == MAP_FAILED || data2 == MAP_FAILED) {
        if(data1 != MAP_FAILED && data1 != NULL) munmap(data1, f1s);
        if(data2 != MAP_FAILED && data2 != NULL) munmap(data2, f2s);
        return (CompareResult){false, false, 0};
    }
    CompareResult result = {true, true, 0};
    size_t posA = 0, posB = 0, tokens = 0;
    while(true) {
        while(posA < f1s && whitespace(data1[posA])) posA++;
        while(posB < f2s && whitespace(data2[posB])) posB++;
        tokens++;
        if((posA >= f1s) != (posB >= f2s)) {
            result = (CompareResult){true, false, tokens};
            break;
        }
        if(posA >= f1s) break;
        size_t lastA = posA, lastB = posB;
        while(posA < f1s && !whitespace(data1[posA])) posA++;
        while(posB < f2s && !whitespace(data2[posB])) posB++;
        size_t lenA = posA - lastA, lenB = posB - lastB;
        if(!equal(data1 + lastA, data2 + lastB, lenA, lenB)) {
            result = (CompareResult){true, false, tokens};
            break;
        }
    }
    if(data1 != NULL) munmap(data1, f1s);
    if(data2 != NULL) munmap(data2, f2s);
    return result;
}

typedef struct FinalCompareResult {
    int code;
    char *message;
} FinalCompareResult;

FinalCompareResult compareFiles(const char *output, const char *answer) {
    FILE *f1 = fopen(output, "rb");
    if(f1 == NULL) return (FinalCompareResult){-1, "Failed to open the output file."};
    FILE *f2 = fopen(answer, "rb");
    if(f2 == NULL) return (FinalCompareResult){-1, "Failed to open the answer file."};
    CompareResult result = compareFilePointers(f1, f2);
    fclose(f1), fclose(f2);
    if(!result.success) return (FinalCompareResult){-1, "Failed to compare two files."};
    if(result.equal) return (FinalCompareResult){0, "Congratulations! Your output is correct."};
    char *message = (char *)malloc(sizeof(char) * 128);
    sprintf(message, "Your output is not same as the answer, and the first difference is near token #%zu.", result.first_difference);
    return (FinalCompareResult){1, message}; // [WARN] reciever should free the message (when code = 1)
}

int main(int argc, char *argv[]) {
    assert(argc >= 4);
    const char *output = argv[2];
    const char *answer = argv[3];
    FinalCompareResult result = compareFiles(output, answer);
    printf("%s\n", result.message);
    if(result.code == 1) free(result.message);
    return result.code;
}
`;

export default class EnhancedChecker {
    public static async getCheckerSource(
        config: EnhancedCompare,
    ): Promise<{ path: string; hash: string }> {
        const defines: string[] = [];
        if (config.enableFloatComparison) {
            defines.push(`#define PRECISION ${config.floatPrecision ?? 0}`);
        }
        if (config.caseInsensitive) {
            defines.push('#define CASE_INSENSITIVE');
        }
        const source = `${defines.join('\n')}${defines.length ? '\n' : ''}${ENHANCED_CHECKER_CODE}`;
        const hash = SHA256(source).toString();
        const fileName = ['enhanced_checker'];
        if (config.enableFloatComparison) {
            fileName.push('fp');
        }
        if (config.caseInsensitive) {
            fileName.push('ci');
        }
        const path = join(Settings.cache.directory, 'spj', `${fileName.join('_')}.c`);
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, source);
        return { path, hash };
    }
}

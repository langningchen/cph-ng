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

// Fast ASCII file comparator based on algorithm by xzy
// Optimized for large file comparisons using memory-mapped files

#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <sys/stat.h>

#ifdef _WIN32
    #include <windows.h>
    #include <io.h>
    #define fstat _fstat
    #define stat _stat
    #define fileno _fileno
#else
    #include <sys/mman.h>
    #include <unistd.h>
#endif

static inline bool whitespace(unsigned char c) {
    return (c - 9 < 5) || (c == 32); // 9: \t, 10: \n, 11: \v, 12: \f, 13: \r, 32: ' '
}

#ifdef _WIN32
// Windows implementation using file mapping
bool compareFilesWindows(const char* file1, const char* file2, size_t& first_difference) {
    HANDLE hFile1 = CreateFileA(file1, GENERIC_READ, FILE_SHARE_READ, NULL, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, NULL);
    HANDLE hFile2 = CreateFileA(file2, GENERIC_READ, FILE_SHARE_READ, NULL, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, NULL);
    
    if (hFile1 == INVALID_HANDLE_VALUE || hFile2 == INVALID_HANDLE_VALUE) {
        if (hFile1 != INVALID_HANDLE_VALUE) CloseHandle(hFile1);
        if (hFile2 != INVALID_HANDLE_VALUE) CloseHandle(hFile2);
        return false;
    }
    
    DWORD f1s = GetFileSize(hFile1, NULL);
    DWORD f2s = GetFileSize(hFile2, NULL);
    
    HANDLE hMap1 = NULL, hMap2 = NULL;
    unsigned char *data1 = NULL, *data2 = NULL;
    
    if (f1s > 0) {
        hMap1 = CreateFileMappingA(hFile1, NULL, PAGE_READONLY, 0, 0, NULL);
        if (hMap1) data1 = (unsigned char*)MapViewOfFile(hMap1, FILE_MAP_READ, 0, 0, 0);
    }
    if (f2s > 0) {
        hMap2 = CreateFileMappingA(hFile2, NULL, PAGE_READONLY, 0, 0, NULL);
        if (hMap2) data2 = (unsigned char*)MapViewOfFile(hMap2, FILE_MAP_READ, 0, 0, 0);
    }
    
    bool equal = true;
    if ((f1s > 0 && !data1) || (f2s > 0 && !data2)) {
        equal = false;
        first_difference = 0;
    } else {
        size_t posA = 0, posB = 0, tokens = 0;
        while (true) {
            while (posA < f1s && whitespace(data1[posA])) posA++;
            while (posB < f2s && whitespace(data2[posB])) posB++;
            if ((posA >= f1s) != (posB >= f2s)) {
                equal = false;
                first_difference = tokens;
                break;
            }
            if (posA >= f1s) break;
            tokens++;
            size_t lastA = posA, lastB = posB;
            while (posA < f1s && !whitespace(data1[posA]) && posB < f2s && !whitespace(data2[posB])) posA++, posB++;
            size_t lenA = posA - lastA, lenB = posB - lastB;
            if (lenA != lenB || memcmp(data1 + lastA, data2 + lastB, lenA) != 0) {
                equal = false;
                first_difference = tokens;
                break;
            }
        }
    }
    
    if (data1) UnmapViewOfFile(data1);
    if (data2) UnmapViewOfFile(data2);
    if (hMap1) CloseHandle(hMap1);
    if (hMap2) CloseHandle(hMap2);
    CloseHandle(hFile1);
    CloseHandle(hFile2);
    
    return equal;
}
#else
// Unix implementation using mmap
bool compareFilesUnix(const char* file1, const char* file2, size_t& first_difference) {
    FILE* f1 = fopen(file1, "rb");
    FILE* f2 = fopen(file2, "rb");
    
    if (!f1 || !f2) {
        if (f1) fclose(f1);
        if (f2) fclose(f2);
        return false;
    }
    
    int f1_no = fileno(f1), f2_no = fileno(f2);
    struct stat f1_stat, f2_stat;
    if (fstat(f1_no, &f1_stat) == -1 || fstat(f2_no, &f2_stat) == -1) {
        fclose(f1);
        fclose(f2);
        return false;
    }
    
    size_t f1s = f1_stat.st_size, f2s = f2_stat.st_size;
    unsigned char *data1 = NULL, *data2 = NULL;
    
    if (f1s > 0) data1 = (unsigned char *)mmap(NULL, f1s, PROT_READ, MAP_PRIVATE, f1_no, 0);
    if (f2s > 0) data2 = (unsigned char *)mmap(NULL, f2s, PROT_READ, MAP_PRIVATE, f2_no, 0);
    
    bool equal = true;
    if ((f1s > 0 && data1 == MAP_FAILED) || (f2s > 0 && data2 == MAP_FAILED)) {
        equal = false;
        first_difference = 0;
    } else {
        size_t posA = 0, posB = 0, tokens = 0;
        while (true) {
            while (posA < f1s && whitespace(data1[posA])) posA++;
            while (posB < f2s && whitespace(data2[posB])) posB++;
            if ((posA >= f1s) != (posB >= f2s)) {
                equal = false;
                first_difference = tokens;
                break;
            }
            if (posA >= f1s) break;
            tokens++;
            size_t lastA = posA, lastB = posB;
            while (posA < f1s && !whitespace(data1[posA]) && posB < f2s && !whitespace(data2[posB])) posA++, posB++;
            size_t lenA = posA - lastA, lenB = posB - lastB;
            if (lenA != lenB || memcmp(data1 + lastA, data2 + lastB, lenA) != 0) {
                equal = false;
                first_difference = tokens;
                break;
            }
        }
    }
    
    if (data1 != NULL && data1 != MAP_FAILED) munmap(data1, f1s);
    if (data2 != NULL && data2 != MAP_FAILED) munmap(data2, f2s);
    fclose(f1);
    fclose(f2);
    
    return equal;
}
#endif

int main(int argc, char* argv[]) {
    if (argc != 3) {
        fprintf(stderr, "Usage: %s <output_file> <answer_file>\n", argv[0]);
        return 3;
    }
    
    const char* output_file = argv[1];
    const char* answer_file = argv[2];
    size_t first_difference = 0;
    
    bool equal;
#ifdef _WIN32
    equal = compareFilesWindows(output_file, answer_file, first_difference);
#else
    equal = compareFilesUnix(output_file, answer_file, first_difference);
#endif
    
    if (equal) {
        return 0; // AC - files are equal
    } else {
        return 1; // WA - files differ
    }
}

#include <windows.h>
#include <psapi.h>
#include <cstdint>
#include <stdio.h>
#include <csignal>
#include <iostream>
#include <thread>
#include <string>

#include "runner.h"

RunStatus sta;
STARTUPINFOA si;
PROCESS_INFORMATION pi;
SECURITY_ATTRIBUTES saAttr;
HANDLE hInputFile = INVALID_HANDLE_VALUE;
HANDLE hOutputFile = INVALID_HANDLE_VALUE;
FILETIME startTime, exitTime, kernelTime, userTime;
size_t start, end;
PROCESS_MEMORY_COUNTERS pmc;
DWORD exitCode;

void do_clean() {
    sta = finished;

    if (hInputFile != INVALID_HANDLE_VALUE)
        CloseHandle(hInputFile);
    if (hOutputFile != INVALID_HANDLE_VALUE)
        CloseHandle(hOutputFile);
    if (pi.hProcess != NULL)
        CloseHandle(pi.hProcess);
    if (pi.hThread != NULL)
        CloseHandle(pi.hThread);
}

int main(int argc, char* argv[]) {
    const char* exec = argv[1];
    const char* in_file = argv[2];
    const char* out_file = argv[3];
    const size_t time_limit = atoi(argv[4]);

    std::thread exit_listener([]() {
        std::string input;
        std::getline(std::cin, input);
        std::cout << "cleaning up...";
        if (sta == init) {
            sta = terminated;
        } else if (sta == running) {
            sta = terminated;
            TerminateProcess(pi.hProcess, 1);
            WaitForSingleObject(pi.hProcess, 1000);
        }
        do_clean();
        exit(0);
    });

    sta = init;

    ZeroMemory(&si, sizeof(si));
    si.cb = sizeof(si);
    ZeroMemory(&pi, sizeof(pi));

    saAttr.nLength = sizeof(SECURITY_ATTRIBUTES);
    saAttr.bInheritHandle = TRUE;
    saAttr.lpSecurityDescriptor = NULL;

    hInputFile = CreateFileA(in_file, GENERIC_READ, FILE_SHARE_READ, &saAttr,
                             OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, NULL);
    if (hInputFile == INVALID_HANDLE_VALUE) {
        print_error(could_not_open_input_file, GetLastError());
        goto clean;
    }
    if (sta == terminated)
        goto clean;
    hOutputFile = CreateFileA(out_file, GENERIC_WRITE, FILE_SHARE_READ, &saAttr,
                              CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, NULL);
    if (hOutputFile == INVALID_HANDLE_VALUE) {
        print_error(could_not_create_output_file, GetLastError());
        goto clean;
    }
    if (sta == terminated)
        goto clean;
    si.dwFlags = STARTF_USESTDHANDLES;
    si.hStdInput = hInputFile;
    si.hStdOutput = hOutputFile;
    si.hStdError = hOutputFile;
    if (!CreateProcessA(
            NULL, (LPSTR)exec, NULL, NULL,
            TRUE, CREATE_NO_WINDOW, NULL, NULL,
            &si, &pi)) {
        print_error(create_process_failed, GetLastError());
        goto clean;
    }

    if (sta == terminated)
        goto clean;
    sta = running;

    DWORD wait_result = WaitForSingleObject(pi.hProcess, time_limit);
    if (wait_result == WAIT_FAILED) {
        print_error(wait_for_process_failed, GetLastError());
        goto clean;
    } else if (wait_result == WAIT_TIMEOUT) {
        if (!TerminateProcess(pi.hProcess, 1)) {
            print_error(terminate_process_failed, GetLastError());
            goto clean;
        }
        WaitForSingleObject(pi.hProcess, 1000);
        if (!GetProcessMemoryInfo(pi.hProcess, &pmc, sizeof(pmc))) {
            print_error(get_process_memory_info_failed, GetLastError());
            goto clean;
        }
        print_info(true, time_limit * 10000, pmc.PeakPagefileUsage + pmc.PeakWorkingSetSize, 0);
        goto clean;
    }

    if (sta == terminated)
        goto clean;
    sta = finished;

    if (!GetProcessTimes(pi.hProcess, &startTime, &exitTime, &kernelTime, &userTime)) {
        print_error(get_process_times_failed, GetLastError());
        goto clean;
    }
    start = (uint64_t(startTime.dwHighDateTime) << 32) + startTime.dwLowDateTime;
    end = (uint64_t(exitTime.dwHighDateTime) << 32) + exitTime.dwLowDateTime;
    if (!GetProcessMemoryInfo(pi.hProcess, &pmc, sizeof(pmc))) {
        print_error(get_process_memory_info_failed, GetLastError());
        goto clean;
    }
    GetExitCodeProcess(pi.hProcess, &exitCode);
    if (sta == terminated)
        goto clean;
    print_info(false, end - start, pmc.PeakPagefileUsage + pmc.PeakWorkingSetSize, exitCode);

clean:
    do_clean();
    return 0;
}
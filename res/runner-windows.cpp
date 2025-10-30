#include <windows.h>
#include <psapi.h>
#include <iostream>
#include <cstdint>
#include <cstdlib>
#include <cstring>
#include <thread>
#include <algorithm>
#include <io.h>

#include "runner.h"

PROCESS_INFORMATION pi = {0};
bool killed = false;

void safe_close(HANDLE &h)
{
    if (h != INVALID_HANDLE_VALUE)
        CloseHandle(h), h = INVALID_HANDLE_VALUE;
}
void kill_child_win(int)
{
    killed = true;
    if (pi.hProcess != NULL)
        TerminateProcess(pi.hProcess, 1);
}

void stdin_listener()
{
    char control_char;
    int fd = _fileno(stdin);
    while (_read(fd, &control_char, 1) > 0)
        if (control_char == 'k')
        {
            kill_child_win(0);
            return;
        }
}

int main(int argc, char *argv[])
{
    if (argc < 5)
        print_error(argument_error, 0);
    const char *exec = argv[1];
    const char *in_file = argv[2];
    const char *out_file = argv[3];
    const char *err_file = argv[4];
    // Note: Stack size for Windows is set via compilation flags, not at runtime

    std::thread listener_thread(stdin_listener);
    listener_thread.detach();

    HANDLE hInputFile = INVALID_HANDLE_VALUE, hOutputFile = INVALID_HANDLE_VALUE, hErrorFile = INVALID_HANDLE_VALUE;
    STARTUPINFOA si;
    SECURITY_ATTRIBUTES saAttr;

    ZeroMemory(&si, sizeof(si));
    si.cb = sizeof(si);

    saAttr.nLength = sizeof(SECURITY_ATTRIBUTES);
    saAttr.bInheritHandle = TRUE;
    saAttr.lpSecurityDescriptor = NULL;

    if ((hInputFile = CreateFileA(in_file, GENERIC_READ, FILE_SHARE_READ, &saAttr,
                                  OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, NULL)) == INVALID_HANDLE_VALUE)
        print_error(could_not_open_input_file, GetLastError());
    if ((hOutputFile = CreateFileA(out_file, GENERIC_WRITE, FILE_SHARE_READ, &saAttr,
                                   CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, NULL)) == INVALID_HANDLE_VALUE)
        print_error(could_not_create_output_file, GetLastError());
    if ((hErrorFile = CreateFileA(err_file, GENERIC_WRITE, FILE_SHARE_READ, &saAttr,
                                  CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, NULL)) == INVALID_HANDLE_VALUE)
        print_error(could_not_create_error_file, GetLastError());

    si.dwFlags = STARTF_USESTDHANDLES;
    si.hStdInput = hInputFile;
    si.hStdOutput = hOutputFile;
    si.hStdError = hErrorFile;

    char cmdLine[2048];
    strncpy(cmdLine, exec, sizeof(cmdLine) - 1);
    cmdLine[sizeof(cmdLine) - 1] = '\0';

    if (!CreateProcessA(
            NULL,
            cmdLine,
            NULL, NULL,
            TRUE,
            CREATE_NO_WINDOW,
            NULL,
            NULL,
            &si, &pi))
        print_error(create_process_failed, GetLastError());

    safe_close(hInputFile);
    safe_close(hOutputFile);
    safe_close(hErrorFile);

    DWORD wait_result = WaitForSingleObject(pi.hProcess, INFINITE);
    if (wait_result == WAIT_FAILED)
        print_error(wait_for_process_failed, GetLastError());

    FILETIME startTime, exitTime, kernelTime, userTime;
    PROCESS_MEMORY_COUNTERS pmc;
    DWORD exitCode = 0;
    if (!GetProcessTimes(pi.hProcess, &startTime, &exitTime, &kernelTime, &userTime))
        print_error(get_process_usage_failed, GetLastError());
    if (!GetProcessMemoryInfo(pi.hProcess, &pmc, sizeof(pmc)))
        print_error(get_process_usage_failed, GetLastError());
    GetExitCodeProcess(pi.hProcess, &exitCode);
    print_info(killed,
               std::max(0.001, ((*(uint64_t *)&kernelTime) + (*(uint64_t *)&userTime)) / 10000.0),
               pmc.PeakWorkingSetSize / 1024.0 / 1024.0,
               exitCode, 0);
    return 0;
}

#include <windows.h>
#include <psapi.h>

#include <cstdint>
#include <stdio.h>

extern "C" struct RunInfo {
    bool error;
    bool timeout;
    size_t time_used;
    size_t memory_used;
    uint8_t exit_code;
};
RunInfo _run(const char* exec, const char* in_file, const char* out_file, size_t time_limit) {
    STARTUPINFOA si;
    PROCESS_INFORMATION pi;
    SECURITY_ATTRIBUTES saAttr;
    HANDLE hInputFile = INVALID_HANDLE_VALUE;
    HANDLE hOutputFile = INVALID_HANDLE_VALUE;

    ZeroMemory(&si, sizeof(si));
    si.cb = sizeof(si);
    ZeroMemory(&pi, sizeof(pi));

    // 设置句柄可继承
    saAttr.nLength = sizeof(SECURITY_ATTRIBUTES);
    saAttr.bInheritHandle = TRUE;
    saAttr.lpSecurityDescriptor = NULL;

    // 打开输入文件
    hInputFile = CreateFileA(in_file, GENERIC_READ, FILE_SHARE_READ, &saAttr,
                             OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, NULL);
    if (hInputFile == INVALID_HANDLE_VALUE) {
        printf("Could't open input file (%d).\n", GetLastError());
        return {true, false, 0, 0, 0};
    }

    // 创建/覆盖输出文件
    hOutputFile = CreateFileA(out_file, GENERIC_WRITE, FILE_SHARE_READ, &saAttr,
                              CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, NULL);
    if (hOutputFile == INVALID_HANDLE_VALUE) {
        printf("Could't create output file (%d).\n", GetLastError());
        CloseHandle(hInputFile);
        return {true, false, 0, 0, 0};
    }

    // 配置标准IO句柄
    si.dwFlags = STARTF_USESTDHANDLES;
    si.hStdInput = hInputFile;
    si.hStdOutput = hOutputFile;
    si.hStdError = hOutputFile;

    // 创建子进程
    if (!CreateProcessA(
            NULL, (LPSTR)exec, NULL, NULL,
            TRUE, CREATE_NO_WINDOW, NULL, NULL,
            &si, &pi)) {
        printf("Creat Process Failed. (%d).\n", GetLastError());
        goto error;
    }

    // Wait until child process exits.
    if (WaitForSingleObject(pi.hProcess, time_limit) == WAIT_TIMEOUT) {
        if (!TerminateProcess(pi.hProcess, 1)) {
            printf("TerminateProcess failed (%d).\n", GetLastError());
            goto error;
        }
        WaitForSingleObject(pi.hProcess, 1000);
        CloseHandle(pi.hProcess);
        CloseHandle(pi.hThread);
        CloseHandle(hInputFile);
        CloseHandle(hOutputFile);
        return {false, true, 0, 0, 0};
    }

    // Get time used
    FILETIME startTime, exitTime, kernelTime, userTime;
    if (!GetProcessTimes(pi.hProcess, &startTime, &exitTime, &kernelTime, &userTime)) {
        printf("GetProcessTimes failed (%d).\n", GetLastError());
        goto error;
    }
    size_t start, end;
    start = (uint64_t(startTime.dwHighDateTime) << 32) + startTime.dwLowDateTime;
    end = (uint64_t(exitTime.dwHighDateTime) << 32) + exitTime.dwLowDateTime;

    // Get memory usage
    PROCESS_MEMORY_COUNTERS pmc;
    if (!GetProcessMemoryInfo(pi.hProcess, &pmc, sizeof(pmc))) {
        printf("GetProcessMemoryInfo failed (%d).\n", GetLastError());
        goto error;
    }

    // Get exit code
    DWORD exitCode;
    GetExitCodeProcess(pi.hProcess, &exitCode);

    // Close process and thread handles.
    CloseHandle(pi.hProcess);
    CloseHandle(pi.hThread);
    CloseHandle(hInputFile);
    CloseHandle(hOutputFile);
    return {
        false, false,
        end - start,
        pmc.PeakPagefileUsage + pmc.PeakWorkingSetSize,
        (uint8_t)exitCode};

error:
    CloseHandle(hInputFile);
    CloseHandle(hOutputFile);
    CloseHandle(pi.hProcess);
    CloseHandle(pi.hThread);
    return {true, false, 0, 0, 0};
}

extern "C" __declspec(dllexport) RunInfo run(const char* exec, const char* in_file, const char* out_file, size_t time_limit);
RunInfo run(const char* exec, const char* in_file, const char* out_file, size_t time_limit) {
    return _run(exec, in_file, out_file, time_limit);
}

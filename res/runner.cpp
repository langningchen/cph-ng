#include <iostream>
#include <thread>
#include <cstdlib>
#include <cstring>
#include <algorithm>
#include <cerrno>

#if defined(_WIN32)

#define PLATFORM_WINDOWS
#include <windows.h>
#include <psapi.h>
#include <io.h>
#include <cstdint>
#define STDIN_FILENO 0

#elif defined(__linux__)

#define PLATFORM_LINUX
#include <sys/resource.h>
#include <sys/wait.h>
#include <fcntl.h>
#include <unistd.h>
#include <csignal>

#else

#error "Unsupported Platform! Runner only supports Windows and Linux."

#endif

enum RunError
{
    stdinIoFailed,
    stdoutIoFailed,
    stderrIoFailed,
    createProcessFailed,
    waitFailed,
    getUsageFailed,
    argumentError,
    unknown_error
};

void printError(RunError error)
{
#ifdef PLATFORM_WINDOWS
    int errorCode = GetLastError();
#else
    int errorCode = errno;
#endif
    std::cout << "{\"error\":true"
              << ",\"errorType\":" << error
              << ",\"errorCode\":" << errorCode
              << "}";
    std::exit(0);
}

void printInfo(bool killed, long double time, long double memory, unsigned long exitCode, unsigned long signal)
{
    std::cout << "{\"error\":false"
              << ",\"killed\":" << (killed ? "true" : "false")
              << ",\"time\":" << time
              << ",\"memory\":" << memory
              << ",\"exitCode\":" << exitCode
              << ",\"signal\":" << signal
              << "}";
    std::exit(0);
}

bool killed = false;

#ifdef PLATFORM_WINDOWS
PROCESS_INFORMATION child = {0};
typedef HANDLE FileHandle;
const FileHandle invalidHandle = INVALID_HANDLE_VALUE;
#else
pid_t child = -1;
typedef int FileHandle;
const FileHandle invalidHandle = -1;
#endif

void safeClose(FileHandle &handle)
{
    if (handle != invalidHandle)
    {
#ifdef PLATFORM_WINDOWS
        CloseHandle(handle);
#else
        close(handle);
#endif
        handle = invalidHandle;
    }
}

void stdinListener()
{
    char controlChar;
#ifdef PLATFORM_WINDOWS
    int fd = _fileno(stdin);
    while (_read(fd, &controlChar, 1) > 0)
#else
    while (read(STDIN_FILENO, &controlChar, 1) > 0)
#endif
        if (controlChar == 'k')
        {
            killed = true;
#ifdef PLATFORM_WINDOWS
            if (child.hProcess != NULL)
                TerminateProcess(child.hProcess, 1);
#else
            if (child != -1)
                kill(child, SIGTERM);
#endif
            return;
        }
}

int main(int argc, char *argv[])
{
    if (argc < 5)
        printError(argumentError);

    const char *exec = argv[1];
    const char *stdinPath = argv[2];
    const char *stdoutPath = argv[3];
    const char *stderrPath = argv[4];
    bool unlimitedStack = false;
    if (argc >= 6 && strcmp(argv[5], "--unlimited-stack") == 0)
        unlimitedStack = true;

    std::thread listenerThread(stdinListener);
    listenerThread.detach();

    FileHandle stdinHandle = invalidHandle, stdoutHandle = invalidHandle, stderrHandle = invalidHandle;

#ifdef PLATFORM_WINDOWS
    SECURITY_ATTRIBUTES saAttr = {sizeof(SECURITY_ATTRIBUTES), NULL, TRUE};
    stdinHandle = CreateFileA(stdinPath, GENERIC_READ, FILE_SHARE_READ, &saAttr, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, NULL);
    if (stdinHandle == invalidHandle)
        printError(stdinIoFailed);

    stdoutHandle = CreateFileA(stdoutPath, GENERIC_WRITE, FILE_SHARE_READ, &saAttr, CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, NULL);
    if (stdoutHandle == invalidHandle)
        printError(stdoutIoFailed);

    stderrHandle = CreateFileA(stderrPath, GENERIC_WRITE, FILE_SHARE_READ, &saAttr, CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, NULL);
    if (stderrHandle == invalidHandle)
        printError(stderrIoFailed);

    STARTUPINFOA si;
    ZeroMemory(&si, sizeof(si));
    si.cb = sizeof(si);
    si.dwFlags = STARTF_USESTDHANDLES;
    si.hStdInput = stdinHandle;
    si.hStdOutput = stdoutHandle;
    si.hStdError = stderrHandle;

    char cmdLine[2048];
    strncpy(cmdLine, exec, sizeof(cmdLine) - 1);
    cmdLine[sizeof(cmdLine) - 1] = '\0';

    if (!CreateProcessA(NULL, cmdLine, NULL, NULL, TRUE, CREATE_NO_WINDOW, NULL, NULL, &si, &child))
        printError(createProcessFailed);
#else
    if ((stdinHandle = open(stdinPath, O_RDONLY)) == -1)
        printError(stdinIoFailed);
    if ((stdoutHandle = open(stdoutPath, O_WRONLY | O_CREAT | O_TRUNC, 0644)) == -1)
        printError(stdoutIoFailed);
    if ((stderrHandle = open(stderrPath, O_WRONLY | O_CREAT | O_TRUNC, 0644)) == -1)
        printError(stderrIoFailed);

    child = fork();
    if (child == -1)
        printError(createProcessFailed);

    if (child == 0)
    {
        if (unlimitedStack)
        {
            struct rlimit rl;
            rl.rlim_cur = RLIM_INFINITY;
            rl.rlim_max = RLIM_INFINITY;
            setrlimit(RLIMIT_STACK, &rl);
        }
        dup2(stdinHandle, STDIN_FILENO), safeClose(stdinHandle);
        dup2(stdoutHandle, STDOUT_FILENO), safeClose(stdoutHandle);
        dup2(stderrHandle, STDERR_FILENO), safeClose(stderrHandle);
        execl(exec, exec, (char *)NULL);
        printError(createProcessFailed);
    }
#endif

    safeClose(stdinHandle);
    safeClose(stdoutHandle);
    safeClose(stderrHandle);

#ifdef PLATFORM_WINDOWS
    if (WaitForSingleObject(child.hProcess, INFINITE) == WAIT_FAILED)
        printError(waitFailed);

    FILETIME startTime, exitTime, kernelTime, userTime;
    PROCESS_MEMORY_COUNTERS pmc;
    DWORD exitCode = 0;
    if (!GetProcessTimes(child.hProcess, &startTime, &exitTime, &kernelTime, &userTime))
        printError(getUsageFailed);
    if (!GetProcessMemoryInfo(child.hProcess, &pmc, sizeof(pmc)))
        printError(getUsageFailed);
    GetExitCodeProcess(child.hProcess, &exitCode);

    printInfo(killed,
              (long double)((*(uint64_t *)&kernelTime) + (*(uint64_t *)&userTime)) / 10000.0L,
              (long double)pmc.PeakWorkingSetSize / 1024.0 / 1024.0,
              exitCode, 0);
#else
    int status = 0;
    int waitResult = 0;
    do
    {
        waitResult = waitpid(child, &status, 0);
    } while (waitResult == -1 && errno == EINTR);

    if (waitResult == -1)
        printError(waitFailed);

    close(STDIN_FILENO);
    struct rusage usage;
    if (getrusage(RUSAGE_CHILDREN, &usage) == -1)
        printError(getUsageFailed);

    printInfo(killed,
              (long double)(usage.ru_utime.tv_sec * 1e3 + usage.ru_utime.tv_usec / 1e3 +
                            usage.ru_stime.tv_sec * 1e3 + usage.ru_stime.tv_usec / 1e3),
              (long double)usage.ru_maxrss / 1024.0,
              WEXITSTATUS(status), WTERMSIG(status));
#endif
    return 0;
}

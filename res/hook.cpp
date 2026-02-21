#include <cstdio>
#include <cstring>
#include <cstdlib>

#ifdef _WIN32

#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <io.h>
#include <fcntl.h>

#define ATTR __cdecl
#define fdopen _fdopen
#define fileno _fileno
#define dup _dup
#define open _open
#define O_WRONLY _O_WRONLY
#define O_RDWR _O_RDWR
#define O_APPEND _O_APPEND

#else

#include <dlfcn.h>
#include <unistd.h>
#include <fcntl.h>

#define ATTR

#endif

typedef FILE *(ATTR *FOPEN_T)(const char *, const char *);

static FOPEN_T getRealFopen()
{
    static FOPEN_T cache = nullptr;
    if (cache)
        return cache;

#ifdef _WIN32
    HMODULE hMod = GetModuleHandleA("ucrtbase.dll");
    if (hMod)
        cache = (FOPEN_T)GetProcAddress(hMod, "fopen");
#else
    cache = (FOPEN_T)dlsym(RTLD_NEXT, "fopen");
#endif
    return cache;
}
static int isReportPath(const char *path)
{
    if (!path)
        return 0;
    const char *report_path = std::getenv("CPH_NG_REPORT_PATH");
    if (!report_path)
        return 0;
    return strcmp(path, report_path) == 0;
}

extern "C"
{
    FILE *ATTR fopen(const char *path, const char *mode)
    {
        if (isReportPath(path))
        {
            FOPEN_T real_func = getRealFopen();
            if (!real_func)
                return nullptr;
            return real_func(path, mode);
        }
        if (mode && strchr(mode, 'r'))
            return fdopen(dup(fileno(stdin)), mode);
        else
            return fdopen(dup(fileno(stdout)), mode);
    }
    FILE *ATTR freopen(const char *path, const char *mode, FILE *stream)
    {
        if (mode && strchr(mode, 'r'))
            return fdopen(dup(fileno(stdin)), mode);
        else
            return fdopen(dup(fileno(stdout)), mode);
    }
    int ATTR open(const char *pathname, int flags, ...)
    {
        if ((flags & O_WRONLY) || (flags & O_RDWR) || (flags & O_APPEND))
            return dup(fileno(stdout));
        else
            return dup(fileno(stdin));
    }
}

#include <cstdio>
#include <cstring>
#include <cstdlib>
#include <stdexcept>

#ifdef _WIN32

#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <io.h>
#include <fcntl.h>
#include <stdarg.h>

typedef FILE *(__cdecl *FOPEN_T)(const char *, const char *);
static FOPEN_T get_real_fopen()
{
    HMODULE hMod = GetModuleHandleA("ucrtbase.dll");
    if (!hMod)
        throw std::runtime_error("Can not load ucrtbase.dll");
    return (FOPEN_T)GetProcAddress(hMod, "fopen");
}

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
#include <stdarg.h>

typedef FILE *(*FOPEN_T)(const char *, const char *);
static FOPEN_T get_real_fopen() { return (FOPEN_T)dlsym(RTLD_NEXT, "fopen"); }

#define ATTR

#endif

static int is_report_path(const char *path)
{
    if (!path)
        return 0;
    const char *report_path = std::getenv("CPH_NG_REPORT_PATH");
    if (!report_path)
        return 0;
    return strcmp(path, report_path) == 0;
}

FILE *ATTR fopen(const char *path, const char *mode)
{
    if (is_report_path(path))
        return get_real_fopen()(path, mode);
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

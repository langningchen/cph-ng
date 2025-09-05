#include <stdio.h>
#include <string.h>

#ifdef _WIN32

#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <io.h>
#include <fcntl.h>
#include <stdarg.h>

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

#define ATTR

#endif

FILE *ATTR fopen(const char *path, const char *mode)
{
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

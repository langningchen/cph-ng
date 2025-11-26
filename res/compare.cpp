// Fast ASCII file compare
// Provided by @xiezheyuan, modified by @langningchen

#include "testlib.h"
#include <vector>
#include <string>
#include <cstring>
#include <cctype>
#ifdef _WIN32
#include <windows.h>
#else
#include <sys/mman.h>
#include <sys/stat.h>
#include <fcntl.h>
#include <unistd.h>
#endif
using namespace std;
struct F
{
    unsigned char *d;
    size_t s;
};
F mapf(const char *p)
{
#ifdef _WIN32
    HANDLE f = CreateFileA(p, GENERIC_READ, FILE_SHARE_READ, 0, OPEN_EXISTING, 0, 0);
    if (f == INVALID_HANDLE_VALUE)
        quitf(_fail, "Fail open %s", p);
    DWORD hi, lo = GetFileSize(f, &hi);
    size_t sz = ((size_t)hi << 32) | lo;
    if (sz == 0)
    {
        CloseHandle(f);
        return {0, 0};
    }
    HANDLE m = CreateFileMappingA(f, 0, PAGE_READONLY, 0, 0, 0);
    void *v = MapViewOfFile(m, FILE_MAP_READ, 0, 0, 0);
    CloseHandle(m);
    CloseHandle(f);
    if (!v)
        quitf(_fail, "Fail map %s", p);
    return {(unsigned char *)v, sz};
#else
    int f = open(p, O_RDONLY);
    if (f < 0)
        quitf(_fail, "Fail open %s", p);
    struct stat st;
    fstat(f, &st);
    if (st.st_size == 0)
    {
        close(f);
        return {0, 0};
    }
    void *v = mmap(0, st.st_size, PROT_READ, MAP_PRIVATE, f, 0);
    close(f);
    if (v == MAP_FAILED)
        quitf(_fail, "Fail map %s", p);
    madvise(v, st.st_size, MADV_SEQUENTIAL);
    return {(unsigned char *)v, (size_t)st.st_size};
#endif
}
inline bool ig(unsigned char c) { return c == ' ' || c == '\r' || c == '\t'; }
bool rl(const F &f, size_t &o, unsigned char *&s, size_t &l)
{
    if (o >= f.s)
        return false;
    s = f.d + o;
    size_t c = o;
    while (c < f.s && f.d[c] != '\n')
        c++;
    size_t e = c;
    o = (c < f.s) ? c + 1 : c;
    while (e > (size_t)(s - f.d))
    {
        if (ig(f.d[e - 1]))
            e--;
        else
            break;
    }
    l = e - (s - f.d);
    return true;
}
string ts(unsigned char *d, size_t l) { return string((char *)d, l > 40 ? 40 : l) + (l > 40 ? "..." : ""); }
int main(int argc, char *argv[])
{
    registerTestlibCmd(argc, argv);
    ouf.close();
    F o = mapf(argv[2]), a = mapf(argv[3]);
    size_t po = 0, pa = 0;
    int ln = 0;
    while (true)
    {
        unsigned char *lo, *la;
        size_t leo, lea;
        bool ho = rl(o, po, lo, leo), ha = rl(a, pa, la, lea);
        if (!ho && !ha)
            break;
        if (!ho || !ha)
        {
            if (ho && leo > 0)
                goto pe;
            if (ha && lea > 0)
                goto pe;
            continue;
        }
        ln++;
        if (leo != lea || memcmp(lo, la, leo) != 0)
            goto pe;
    }
    quitf(_ok, "%d lines", ln);
pe:
    size_t to = 0, ta = 0, tc = 0;
    while (true)
    {
        while (to < o.s && ig(o.d[to]))
            to++;
        while (ta < a.s && ig(a.d[ta]))
            ta++;
        bool eo = to >= o.s, ea = ta >= a.s;
        if (eo && ea)
            quitf(_pe, "Content matches format error");
        if (eo || ea)
            quitf(_wa, "Token count differs");
        tc++;
        unsigned char *so = o.d + to, *sa = a.d + ta;
        while (to < o.s && !ig(o.d[to]))
            to++;
        while (ta < a.s && !ig(a.d[ta]))
            ta++;
        size_t lo = to - (so - o.d), la = ta - (sa - a.d);
        if (lo != la || memcmp(so, sa, lo) != 0)
            quitf(_wa, "Token #%lu expected '%s' found '%s'", tc, ts(sa, la).c_str(), ts(so, lo).c_str());
    }
}

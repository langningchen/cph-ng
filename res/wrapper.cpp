#include <iostream>
#include <chrono>
#include <fstream>
#include <cstdlib>
#include <csignal>
#ifdef __linux__
#include <sys/resource.h>
#endif

extern "C" int original_main();

namespace CPHNG
{
    using clock = std::chrono::high_resolution_clock;
    using tp = std::chrono::time_point<clock>;
    tp startTime, endTime;
    std::ofstream reportFile;
    void start()
    {
        const char *reportPath = std::getenv("CPH_NG_REPORT_PATH");
        if (!reportPath)
            return;
        reportFile.open(reportPath);
        startTime = clock::now();
    }
    void exit()
    {
        endTime = clock::now();
        if (!reportFile.is_open())
            return;
        auto duration = std::chrono::duration_cast<std::chrono::microseconds>(endTime - startTime).count();
        reportFile << "{\"timeMs\":" << duration / 1000.0 << "}" << std::flush;
        reportFile.close();
    }
    void signalHandler(int signum)
    {
        exit();
        std::signal(signum, SIG_DFL);
        std::raise(signum);
    }
}

int main()
{
    std::signal(SIGTERM, CPHNG::signalHandler);
    std::signal(SIGILL, CPHNG::signalHandler);
    std::signal(SIGFPE, CPHNG::signalHandler);
    std::signal(SIGSEGV, CPHNG::signalHandler);
    std::atexit(CPHNG::exit);
#ifdef __linux__
    const char *unlimitedStack = std::getenv("CPH_NG_UNLIMITED_STACK");
    if (unlimitedStack && std::string(unlimitedStack) == "1")
    {
        struct rlimit rl;
        rl.rlim_cur = RLIM_INFINITY;
        rl.rlim_max = RLIM_INFINITY;
        if (setrlimit(RLIMIT_STACK, &rl) != 0)
            std::cerr << "Failed to set stack size limit to unlimited." << std::endl;
    }
#endif
    CPHNG::start();
    int ret = 0;
    try
    {
        ret = original_main();
    }
    catch (...)
    {
        CPHNG::exit();
        throw;
    }
    return ret;
}

#include <iostream>
#include <chrono>
#include <fstream>
#include <cstdlib>
#ifdef __linux__
#include <sys/resource.h>
#endif

extern "C" int original_main();

namespace CPHNG
{
    using clock = std::chrono::high_resolution_clock;
    using tp = std::chrono::time_point<clock>;
    tp startTime, endTime;
    void start()
    {
        startTime = clock::now();
    }
    void exit()
    {
        endTime = clock::now();
        auto duration = std::chrono::duration_cast<std::chrono::microseconds>(endTime - startTime).count();
        const char *reportPath = std::getenv("CPH_NG_REPORT_PATH");
        if (!reportPath)
            return;
        std::ofstream reportFile(reportPath);
        if (!reportFile.is_open())
            return;
        reportFile << "{\"timeMs\":" << duration / 1000.0 << "}";
        reportFile.close();
    }
}

int main()
{
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
    int ret = original_main();
    return ret;
}

#include <iostream>
#include <chrono>

extern "C" int original_main();

int main()
{
    using clock = std::chrono::high_resolution_clock;
    auto startTime = clock::now();
    int ret = original_main();
    auto endTime = clock::now();
    std::cerr << "-----CPH DATA STARTS-----{\"time\":" << std::chrono::duration_cast<std::chrono::microseconds>(endTime - startTime).count()
              << "}-----";
    return ret;
}

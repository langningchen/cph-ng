#include <chrono>
#include <iostream>
int main()
{
    using clock = std::chrono::steady_clock;
    auto target_duration = std::chrono::microseconds(300000);
    auto start = clock::now();
    while (true)
        if (clock::now() - start >= target_duration)
            break;
    auto end = clock::now();
    return 0;
}

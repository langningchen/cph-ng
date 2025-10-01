#include <iostream>

enum RunError
{
    could_not_open_input_file,
    could_not_create_output_file,
    could_not_create_error_file,
    create_process_failed,
    wait_for_process_failed,
    get_process_usage_failed,
    argument_error,
    unknown_error
};

void print_info(bool killed, long double time, long double memory, unsigned long exitCode, unsigned long signal)
{
    std::cout << "{\"error\":false"
              << ",\"killed\":" << (killed ? "true" : "false")
              << ",\"time\":" << time
              << ",\"memory\":" << memory
              << ",\"exitCode\":" << exitCode
              << ",\"signal\":" << signal
              << "}" << std::endl;
    std::exit(0);
}

void print_error(RunError error, int error_code)
{
    std::cout << "{\"error\":true"
              << ",\"error_type\":" << error
              << ",\"error_code\":" << error_code
              << "}" << std::endl;
    std::exit(0);
}

#include <iostream>

enum RunError {
    could_not_open_input_file,
    could_not_create_output_file,
    create_process_failed,
    terminate_process_failed,
    get_process_times_failed,
    get_process_memory_info_failed,
    get_exit_code_failed,
    unknown_error
};

enum RunStatus {
    init,
    running,
    finished,
    terminated
};

void print_info(bool timeout, size_t time_used, size_t memory_used, unsigned long exit_code) {
    std::cout << "{\"error\":false";
    std::cout << ",\"timeout\":" << (timeout ? "true" : "false");
    std::cout << ",\"time_used\":" << time_used;
    std::cout << ",\"memory_used\":" << memory_used;
    std::cout << ",\"exit_code\":" << exit_code;
    std::cout << "}" << std::endl;
}

void print_error(RunError error, int error_code) {
    std::cout << "{\"error\":true";
    std::cout << ",\"error_type\":" << error;
    std::cout << ",\"error_code\":" << error_code;
    std::cout << "}" << std::endl;
}
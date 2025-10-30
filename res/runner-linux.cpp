#include <sys/resource.h>
#include <sys/wait.h>
#include <fcntl.h>
#include <unistd.h>
#include <iostream>
#include <csignal>
#include <cerrno>
#include <cstdlib>
#include <cstring>
#include <thread>

#include "runner.h"

pid_t child_pid = -1;
bool killed;

void safe_close(int &fd)
{
    if (fd != -1)
        close(fd), fd = -1;
}
void kill_child(int)
{
    killed = true;
    if (child_pid != -1)
        kill(child_pid, SIGKILL);
}
void stdin_listener()
{
    char control_char;
    while (read(STDIN_FILENO, &control_char, 1) > 0)
        if (control_char == 'k')
        {
            kill_child(0);
            return;
        }
}

int main(int argc, char *argv[])
{
    if (argc < 5)
        print_error(argument_error, 0);
    const char *exec = argv[1];
    const char *in_file = argv[2];
    const char *out_file = argv[3];
    const char *err_file = argv[4];
    bool unlimited_stack = false;
    if (argc >= 6 && strcmp(argv[5], "--unlimited-stack") == 0)
        unlimited_stack = true;

    std::thread listener_thread(stdin_listener);
    listener_thread.detach();

    int hInputFile = -1, hOutputFile = -1, hErrorFile = -1;
    if ((hInputFile = open(in_file, O_RDONLY)) == -1)
        print_error(could_not_open_input_file, errno);
    if ((hOutputFile = open(out_file, O_WRONLY | O_CREAT | O_TRUNC, 0644)) == -1)
        print_error(could_not_create_output_file, errno);
    if ((hErrorFile = open(err_file, O_WRONLY | O_CREAT | O_TRUNC, 0644)) == -1)
        print_error(could_not_create_error_file, errno);

    child_pid = fork();
    if (child_pid == -1)
        print_error(create_process_failed, errno);
    if (child_pid == 0)
    {
        if (unlimited_stack)
        {
            struct rlimit rl;
            rl.rlim_cur = RLIM_INFINITY;
            rl.rlim_max = RLIM_INFINITY;
            setrlimit(RLIMIT_STACK, &rl);
        }
        dup2(hInputFile, STDIN_FILENO), safe_close(hInputFile);
        dup2(hOutputFile, STDOUT_FILENO), safe_close(hOutputFile);
        dup2(hErrorFile, STDERR_FILENO), safe_close(hErrorFile);
        execl(exec, exec, NULL);
        exit(127);
    }
    int status = 0;

    safe_close(hInputFile);
    safe_close(hOutputFile);
    safe_close(hErrorFile);

    int wait_result = 0;
    do
    {
        wait_result = waitpid(child_pid, &status, 0);
    } while (wait_result == -1 && errno == EINTR);

    if (wait_result == -1)
        print_error(wait_for_process_failed, errno);
    close(STDIN_FILENO);
    struct rusage usage;
    if (getrusage(RUSAGE_CHILDREN, &usage) == -1)
        print_error(get_process_usage_failed, errno);
    print_info(killed,
               std::max(0.001, (usage.ru_utime.tv_sec * 1e3) + (usage.ru_utime.tv_usec / 1e3) +
                                   (usage.ru_stime.tv_sec * 1e3) + (usage.ru_stime.tv_usec / 1e3)),
               usage.ru_maxrss / 1024.0,
               WEXITSTATUS(status), WTERMSIG(status));
    return 0;
}

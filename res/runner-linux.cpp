#include <sys/resource.h>
#include <sys/wait.h>
#include <sys/syscall.h>
#include <poll.h>
#include <fcntl.h>
#include <iostream>
#include <thread>

#include "runner.h"

RunStatus sta(init);
pid_t child_pid = -1;
int hInputFile = -1;
int hOutputFile = -1;

void do_clean() {
    sta = finished;

    if (hInputFile != -1)
        close(hInputFile);
    if (hOutputFile != -1)
        close(hOutputFile);

    if (child_pid != -1 && waitpid(child_pid, nullptr, WNOHANG) == 0) {
        kill(child_pid, SIGKILL);
        waitpid(child_pid, nullptr, 0);
    }
}

int main(int argc, char* argv[]) {
    const char* exec = argv[1];
    const char* in_file = argv[2];
    const char* out_file = argv[3];
    const size_t time_limit_ms = atoi(argv[4]);

    std::thread exit_listener([]() {
        std::string input;
        std::getline(std::cin, input);
        if (sta == init) {
            sta = terminated;
        } else if (sta == running) {
            sta = terminated;
            if (child_pid != -1) {
                kill(child_pid, SIGKILL);
            }
        }
        do_clean();
        exit(0);
    });

    sta = init;

    hInputFile = open(in_file, O_RDONLY);
    if (hInputFile == -1) {
        print_error(could_not_open_input_file, errno);
        goto clean;
    }

    if (sta == terminated)
        goto clean;

    hOutputFile = open(out_file, O_WRONLY | O_CREAT | O_TRUNC, 0644);
    if (hOutputFile == -1) {
        print_error(could_not_create_output_file, errno);
        goto clean;
    }

    if (sta == terminated)
        goto clean;

    child_pid = fork();
    if (child_pid == -1) {
        print_error(create_process_failed, errno);
        goto clean;
    }
    if (child_pid == 0) {
        dup2(hInputFile, STDIN_FILENO);
        dup2(hOutputFile, STDOUT_FILENO);
        dup2(hOutputFile, STDERR_FILENO);

        close(hInputFile);
        close(hOutputFile);

        execl(exec, exec, NULL);

        exit(127);
    } else {
        if (sta == terminated)
            goto clean;

        sta = running;

        if (sta == terminated)
            goto clean;

        int pid_fd = syscall(SYS_pidfd_open, child_pid, 0);
        if (pid_fd == -1) {
            print_error(wait_for_process_failed, errno);
            goto clean;
        }
        struct pollfd pfd;
        pfd.fd = pid_fd, pfd.events = POLLIN;
        int wait_result = poll(&pfd, 1, time_limit_ms), status;
        sta = finished;
        if (wait_result < 0) {
            print_error(wait_for_process_failed, errno);
            goto clean;
        } else if (wait_result == 0) {
            if (kill(child_pid, SIGKILL) == -1) {
                print_error(terminate_process_failed, errno);
                goto clean;
            }
            if (waitpid(child_pid, &status, 0) <= 0) {
                print_error(wait_for_process_failed, errno);
                goto clean;
            }
        } else {
            if (waitpid(child_pid, &status, WNOHANG) <= 0) {
                print_error(wait_for_process_failed, errno);
                goto clean;
            }
        }
        int exit_code = WIFEXITED(status) ? WEXITSTATUS(status) : 128 + WTERMSIG(status);
        struct rusage usage;
        if (getrusage(RUSAGE_CHILDREN, &usage) == -1) {
            print_error(get_process_times_failed, errno);
            return 0;
        }
        print_info(
            wait_result == 0,
            wait_result == 0
                ? time_limit_ms * 10000
                : (usage.ru_utime.tv_sec * 10000000) + (usage.ru_utime.tv_usec * 10) +
                      (usage.ru_stime.tv_sec * 10000000) + (usage.ru_stime.tv_usec * 10),
            usage.ru_maxrss * 1024,
            exit_code);
    }

clean:
    do_clean();
    return 0;
}
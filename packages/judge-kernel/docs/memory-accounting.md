# Memory accounting across platforms

## Current implementation

The executor and interactive judge sample process memory while the task runs. Linux scans the process group in `/proc`; macOS and Windows use `sysinfo` to inspect descendants. The monitor waits 10 ms between scans, in addition to the scan duration. A short-lived process can disappear before a usable sample arrives. Read failures can also leave the accumulator empty.

`memory_mb: null` means no usable sample was obtained. The CLI displays `N/A` (not available), including for old records that stored the empty accumulator as zero. A positive result is a sampled measurement, not a guarantee of the true simultaneous peak for the entire process tree. This is independent of changing the label's capitalization.

This change does not introduce a native exit-accounting backend. It preserves the existing portable implementation and makes its missing values honest. The native options below describe implementation requirements, not completed features.

## Native options

| Platform | Direct child | Process tree |
| --- | --- | --- |
| Linux | Reap the owned child with `wait4` and retain `rusage.ru_maxrss`, rather than discarding resource statistics during wait. | A dedicated cgroup v2 with `memory.peak` can track the group's peak, provided the memory controller and delegated permissions are available before launch. |
| macOS | `wait4` provides exit status and resource statistics; normalize units in the platform adapter. | Keep descendant monitoring or implement explicit descendant accounting; a child's resource record is not a portable simultaneous tree-peak counter. |
| Windows | Keep the process handle and query `GetProcessMemoryInfo`/`PeakWorkingSetSize`; validate exit-time behavior on supported Windows versions. | Create the child suspended, associate it with a Job Object, then resume it. Query job accounting while retaining the job handle through termination. |

Linux [`wait4`](https://man7.org/linux/man-pages/man2/wait3.2.html) and macOS [`wait4`](https://developer.apple.com/library/archive/documentation/System/Conceptual/ManPages_iPhoneOS/man2/wait4.2.html) supply child resource statistics. Linux [`getrusage`](https://man7.org/linux/man-pages/man2/getrusage.2.html) explicitly distinguishes the largest child's resident-set peak from a process-tree peak; adding separately observed peaks does not recover their simultaneous maximum.

Linux [`memory.peak`](https://www.kernel.org/doc/html/latest/admin-guide/cgroup-v2.html#memory-interface-files) measures the cgroup and its descendants. Cgroup accounting includes more categories than process RSS. Windows [`PROCESS_MEMORY_COUNTERS`](https://learn.microsoft.com/en-us/windows/win32/api/psapi/ns-psapi-process_memory_counters) exposes peak working set, while [Job Object accounting](https://learn.microsoft.com/en-us/windows/win32/api/winnt/ns-winnt-jobobject_extended_limit_information) exposes process/job memory peaks and commitment limits. These quantities must not be silently treated as identical across systems.

## Why not use tracing as the default?

[`ptrace`](https://man7.org/linux/man-pages/man2/ptrace.2.html) can stop a tracee at exit and expose fork/exec events. It requires a tracer state machine for threads, signals, exec and exit. Attaching after launch still races with a short-lived process; tracing can also affect the measured runtime. Windows debugging APIs require a separate implementation. For this CLI, native accounting at child exit is the better first step; tracing alone does not establish a portable memory definition.

## Requirements for a native backend

1. One component must own process reaping and the resource record. Do not race a new `wait4` consumer against Tokio's existing `Child::wait`, or replace it with process-wide `RUSAGE_CHILDREN` deltas during parallel judging.
2. Set up containment/handles before user code starts. Retain the final record through normal exit, runtime error, timeout, cancellation and interactive cleanup.
3. Keep the result's metric, scope and collection method explicit: resident working set versus committed/group memory; direct process versus descendants; native final record versus sampled fallback. Extending the JSON contract should be additive and tested with consumers.
4. Missing permissions, unavailable controllers and failed queries remain explicit failures or unavailable measurements. A future strict measurement mode could reject such a run before admitting it rather than claiming guaranteed data from an unsupported backend; no such flag is implemented now.
5. Exercise real Linux, macOS and Windows runners with short-lived programs, rapid allocation/free, simultaneous children, detached descendants, cancellation and parallel runs. Verify units and distinguish a valid native zero from an absent sample. Existing CI has native OS jobs, but a Linux-only run cannot validate Windows/macOS accounting.

The practical guarantee is conditional: with a supported backend successfully initialized, retain the native final accounting record. There is no single API that guarantees an identical, exact, process-tree memory number under every OS and permission configuration.

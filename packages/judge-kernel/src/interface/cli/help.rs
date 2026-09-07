//! Keep help and completion metadata on the same clap command tree.
use super::{
    Cli,
    output::{Preferences, terminal_width},
};
use clap::{Command, CommandFactory};
use std::io::{self, IsTerminal};

pub(super) fn command(preferences: Preferences) -> Command {
    let styles = clap::builder::Styles::styled()
        .header(clap::builder::styling::AnsiColor::Cyan.on_default().bold())
        .usage(clap::builder::styling::AnsiColor::Cyan.on_default().bold())
        .literal(clap::builder::styling::Style::new().bold())
        .placeholder(clap::builder::styling::Style::new().dimmed());
    let color = match preferences.color_choice(io::stdout().is_terminal()) {
        anstream::ColorChoice::Always | anstream::ColorChoice::AlwaysAnsi => {
            clap::ColorChoice::Always
        }
        anstream::ColorChoice::Never => clap::ColorChoice::Never,
        anstream::ColorChoice::Auto => clap::ColorChoice::Auto,
    };
    decorate(Cli::command())
        .styles(styles)
        .color(color)
        .term_width(terminal_width().min(100))
        .max_term_width(100)
}
fn decorate(mut command: Command) -> Command {
    if let Some(order) = [
        "run",
        "judge",
        "stress",
        "diff",
        "problem",
        "testcase",
        "history",
        "task",
        "import",
        "export",
        "config",
        "toolchain",
        "index",
        "completions",
        "capabilities",
        "serve",
        "router",
    ]
    .iter()
    .position(|name| *name == command.get_name())
    {
        command = command.display_order(order);
    }
    let example = match command.get_name() {
        "problem" => Some(
            "Examples:\n  cph-ng-judge problem create main.cpp\n  cph-ng-judge problem list\n  cph-ng-judge problem load main.cpp --json",
        ),
        "testcase" => Some(
            "Examples:\n  cph-ng-judge tc add main.cpp -i input.txt --answer-file answer.txt\n  cph-ng-judge tc list main.cpp --json",
        ),
        "run" | "run-all" => Some(
            "Examples:\n  cph-ng-judge run main.cpp\n  cph-ng-judge run main.cpp -i input.txt --answer-file answer.txt\n  cat input.txt | cph-ng-judge run main.cpp -i - --json",
        ),
        "task" => Some(
            "Examples:\n  cph-ng-judge task list\n  cph-ng-judge task events --task-id UUID --follow --output jsonl\n  cph-ng-judge task cancel UUID --wait",
        ),
        _ => None,
    };
    if let Some(example) = example {
        command = command.after_help(example);
    }
    if let Some(about) = command.get_about().map(ToString::to_string) {
        // clap's derive metadata supplies the same concise descriptions to completions.
        command = command.about(about.trim_end_matches('.').to_owned());
    }
    command.mut_subcommands(decorate)
}

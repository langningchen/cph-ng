use clap::{Args, ValueEnum};
use std::io::{self, IsTerminal};

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, ValueEnum)]
pub(crate) enum Color {
    #[default]
    Auto,
    Always,
    Never,
}

#[derive(Clone, Copy, Debug, Default, Args)]
pub(crate) struct Preferences {
    /// Control ANSI styles in human output
    #[arg(
        long,
        value_enum,
        default_value = "auto",
        global = true,
        help_heading = "Output"
    )]
    pub color: Color,
    /// Disable ANSI styles (equivalent to --color never)
    #[arg(long, global = true, conflicts_with = "color", help_heading = "Output")]
    pub no_color: bool,
    /// Print full, unstyled text without terminal layouts or progress
    #[arg(long, global = true, conflicts_with_all = ["json", "output"], help_heading = "Output")]
    pub plain: bool,
}

impl Preferences {
    pub fn color_choice(self, tty: bool) -> anstream::ColorChoice {
        if self.plain
            || self.no_color
            || !tty
            || self.color == Color::Never
            || std::env::var_os("TERM").is_some_and(|term| term == "dumb")
        {
            return anstream::ColorChoice::Never;
        }
        if self.color == Color::Always {
            return anstream::ColorChoice::Always;
        }
        anstream::ColorChoice::Auto
    }

    pub fn progress(self) -> bool {
        !self.plain
            && io::stdout().is_terminal()
            && io::stderr().is_terminal()
            && std::env::var_os("TERM").is_none_or(|term| term != "dumb")
            && std::env::var_os("CI").is_none_or(|ci| ci.is_empty() || ci == "0" || ci == "false")
    }
}

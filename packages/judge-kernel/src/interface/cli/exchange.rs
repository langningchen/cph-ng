use super::args::ProblemRef;
use clap::Args;
use std::path::PathBuf;
#[derive(Debug, Args)]
pub struct ImportArgs {
    /// Import file; - reads native or Companion JSON from stdin.
    #[arg(required_unless_present = "input", conflicts_with = "input")]
    pub file: Option<PathBuf>,
    #[arg(short, long)]
    pub input: Option<PathBuf>,
    /// Existing source for Companion or legacy input, overriding stored machine-local paths.
    #[arg(long)]
    pub source: Option<PathBuf>,
    /// New directory to extract a native package into; existing directories are never replaced.
    #[arg(long, short = 'd')]
    pub destination: Option<PathBuf>,
    #[arg(long, default_value="auto", value_parser=["auto","native","companion","prob","bin","legacy"])]
    pub import_format: String,
}
#[derive(Debug, Args)]
pub struct ExportArgs {
    #[command(flatten)]
    pub reference: ProblemRef,
    /// New output file. Existing files are never overwritten, including with --force.
    #[arg(long, short = 'd')]
    pub destination: PathBuf,
    #[arg(long, default_value="native", value_parser=["native","companion","prob","bin"])]
    pub export_format: String,
    /// Accept the reported data losses when exporting a compatibility format.
    #[arg(long)]
    pub force: bool,
    /// Report the conversion losses without writing a file.
    #[arg(long)]
    pub dry_run: bool,
}

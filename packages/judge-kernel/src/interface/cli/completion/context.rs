use super::super::Cli;
use clap::{ArgMatches, Command, CommandFactory};
use std::{collections::HashSet, ffi::OsString, path::PathBuf};
use uuid::Uuid;

#[derive(Debug)]
pub(super) struct Context {
    pub store: PathBuf,
    pub source: Option<PathBuf>,
    pub problem: Option<String>,
    pub code: Option<String>,
    pub selected: HashSet<String>,
    pub prefix: String,
}
impl Context {
    pub fn parse(args: &[OsString], shell: &str) -> Self {
        let current = if shell == "fish" {
            args.len().saturating_sub(1)
        } else {
            std::env::var("_CLAP_COMPLETE_INDEX")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or_else(|| args.len().saturating_sub(1))
        };
        let partial = args
            .get(current)
            .map(|v| v.to_string_lossy())
            .unwrap_or_default();
        let partial = partial.rsplit('=').next().unwrap_or_default();
        let mut fragments = partial.rsplit(',');
        let prefix = fragments.next().unwrap_or_default().to_owned();
        let mut context = Self {
            store: std::env::var_os("CPH_STORE_ROOT")
                .map_or_else(super::super::default_store_path, PathBuf::from),
            source: None,
            problem: None,
            code: None,
            selected: fragments.map(str::to_owned).collect(),
            prefix,
        };
        // The current value can be an incomplete UUID or path. Exclude it from
        // parsing; the same clap metadata handles aliases, equals and short flags.
        if let Ok(matches) = relaxed(Cli::command()).try_get_matches_from(args.iter().take(current))
        {
            context.read(&matches);
        }
        context
    }
    fn read(&mut self, matches: &ArgMatches) {
        if let Ok(Some(path)) = matches.try_get_one::<PathBuf>("store_root") {
            self.store.clone_from(path);
        }
        if let Ok(Some(path)) = matches.try_get_one::<PathBuf>("source") {
            self.source = Some(path.clone());
        }
        if let Ok(Some(id)) = matches.try_get_one::<Uuid>("problem_id") {
            self.problem = Some(id.to_string());
        }
        if let Ok(Some(id)) = matches.try_get_one::<Uuid>("code_id") {
            self.code = Some(id.to_string());
        }
        if let Ok(Some(ids)) = matches.try_get_many::<Uuid>("testcase_ids") {
            self.selected.extend(ids.map(Uuid::to_string));
        }
        if let Some((_, child)) = matches.subcommand() {
            self.read(child);
        }
    }
}
fn relaxed(command: Command) -> Command {
    command.ignore_errors(true).mut_subcommands(relaxed)
}

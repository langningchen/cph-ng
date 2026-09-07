use super::CompilerRegistry;
use crate::{
    application::{error::ErrorCode, tasks::TaskFailure},
    domain::LanguageId,
    ports::executor::CommandSpec,
};
use std::path::{Path, PathBuf};

pub(super) struct CompilationPaths<'a> {
    pub original: &'a Path,
    pub snapshot: PathBuf,
    pub artifact: PathBuf,
    pub workdir: &'a Path,
}
impl CompilerRegistry {
    pub(super) fn compilation_command(
        &self,
        language: LanguageId,
        paths: &CompilationPaths<'_>,
    ) -> CommandSpec {
        let source_arg = path_argument(&paths.snapshot);
        let artifact_arg = path_argument(&paths.artifact);
        let settings = self.config.languages.get(&language);
        let (compiler, mut args): (&str, Vec<String>) = match language {
            LanguageId::Cpp => (
                "g++",
                vec!["-std=c++17".into(), "-O2".into(), "-pipe".into()],
            ),
            LanguageId::C => ("gcc", vec!["-std=c17".into(), "-O2".into(), "-pipe".into()]),
            LanguageId::Rust => ("rustc", vec!["--edition=2021".into(), "-O".into()]),
            LanguageId::Java => ("javac", vec!["-encoding".into(), "UTF-8".into()]),
            LanguageId::Python => (
                if cfg!(windows) { "python" } else { "python3" },
                vec!["-m".into(), "py_compile".into()],
            ),
            LanguageId::Javascript => ("node", vec!["--check".into()]),
        };
        let program = if let Some(settings) =
            settings.and_then(|settings| settings.compiler_parts.as_ref())
        {
            let syntax_check = matches!(language, LanguageId::Python | LanguageId::Javascript)
                .then(|| args.clone());
            args.clone_from(&settings.compiler_args);
            if let Some(check) = syntax_check {
                args.extend(check);
            }
            settings.compiler.0.clone()
        } else if let Some(settings) = settings
            .filter(|_| matches!(language, LanguageId::Python | LanguageId::Javascript))
            .and_then(|settings| settings.interpreter_parts.as_ref())
        {
            let mut configured = settings.interpreter_args.clone();
            configured.extend(args);
            args = configured;
            settings.interpreter.0.clone()
        } else {
            PathBuf::from(compiler)
        };
        if matches!(language, LanguageId::C | LanguageId::Cpp)
            && let Some(parent) = paths.original.parent()
        {
            args.extend(["-iquote".into(), path_argument(parent)]);
        }
        args.push(source_arg.clone());
        if matches!(language, LanguageId::C | LanguageId::Cpp | LanguageId::Rust) {
            args.extend(["-o".into(), artifact_arg.clone()]);
        }
        CommandSpec {
            program,
            args,
            cwd: paths.workdir.to_path_buf(),
        }
    }
    pub(super) fn runtime_command(
        &self,
        language: LanguageId,
        paths: &CompilationPaths<'_>,
        memory_mb: u64,
    ) -> Result<CommandSpec, TaskFailure> {
        let source_arg = path_argument(&paths.snapshot);
        let settings = self.config.languages.get(&language);
        let (runtime, args) = match language {
            LanguageId::Python => (
                PathBuf::from(if cfg!(windows) { "python" } else { "python3" }),
                vec![source_arg],
            ),
            LanguageId::Javascript => (
                PathBuf::from("node"),
                vec![format!("--max-old-space-size={memory_mb}"), source_arg],
            ),
            LanguageId::Java => (
                PathBuf::from("java"),
                vec![
                    format!("-Xmx{memory_mb}m"),
                    "-cp".into(),
                    path_argument(paths.workdir),
                    paths
                        .original
                        .file_stem()
                        .and_then(|value| value.to_str())
                        .ok_or_else(|| {
                            TaskFailure::new(ErrorCode::InvalidParams, "Invalid Java class name")
                        })?
                        .to_owned(),
                ],
            ),
            _ => (paths.artifact.clone(), vec![]),
        };
        let (program, args) = if let Some(settings) =
            settings.and_then(|settings| settings.interpreter_parts.as_ref())
        {
            let mut configured = settings.interpreter_args.clone();
            configured.extend(args);
            (settings.interpreter.0.clone(), configured)
        } else {
            (runtime, args)
        };
        Ok(CommandSpec {
            program,
            args,
            cwd: paths.workdir.to_path_buf(),
        })
    }
}

// Filesystem operations keep canonical paths, but external tools such as MinGW
// do not understand Windows verbatim prefixes. Forward slashes also keep depfiles
// unambiguous without changing Unix filenames containing literal backslashes.
pub(crate) fn path_argument(path: &Path) -> String {
    let value = path.to_string_lossy();
    #[cfg(windows)]
    {
        if let Some(unc) = value.strip_prefix(r"\\?\UNC\") {
            return format!("//{}", unc.replace('\\', "/"));
        }
        value
            .strip_prefix(r"\\?\")
            .unwrap_or(&value)
            .replace('\\', "/")
    }
    #[cfg(not(windows))]
    value.into_owned()
}

#[cfg(all(test, windows))]
mod tests {
    use super::path_argument;
    use std::path::Path;

    #[test]
    fn external_tools_receive_drive_and_unc_paths_without_verbatim_prefixes() {
        assert_eq!(
            path_argument(Path::new(r"\\?\C:\source dir\main.cpp")),
            "C:/source dir/main.cpp"
        );
        assert_eq!(
            path_argument(Path::new(r"\\?\UNC\server\share\main.cpp")),
            "//server/share/main.cpp"
        );
        assert_eq!(
            path_argument(Path::new(r"C:\source dir\main.cpp")),
            "C:/source dir/main.cpp"
        );
    }
}

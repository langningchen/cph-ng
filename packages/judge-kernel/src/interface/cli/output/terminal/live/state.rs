use super::super::{
    Tone, judging, paint,
    table::{self, Cell},
};
use crate::{
    application::{
        judge::CaseResult,
        tasks::{TaskEvent, TaskEventPayload, TaskProgress},
    },
    domain::JudgeVerdict,
};
use std::{collections::BTreeMap, io};

#[derive(Debug)]
pub(super) enum CaseState {
    Queued,
    Running,
    Finished(CaseResult),
}
impl CaseState {
    pub fn row(&self, index: usize, single: bool) -> io::Result<Vec<Cell>> {
        match self {
            Self::Finished(result) => {
                let value = serde_json::to_value(result).map_err(io::Error::other)?;
                Ok(judging::case_row(&value, index, single))
            }
            Self::Queued | Self::Running => Ok(vec![
                table::cell(&format!("Case {index}"), Tone::Muted),
                match self {
                    Self::Running => table::cell("Running", Tone::Info),
                    _ => table::cell("Queued", Tone::Muted),
                },
                Cell::new("-"),
                Cell::new("-"),
                Cell::new(""),
            ]),
        }
    }
}

#[derive(Debug, Default)]
enum Phase {
    #[default]
    Queued,
    Running,
    WaitingForCpu,
    Compiling,
    Cached,
    Compiled,
    StressIteration(u32),
    IndexRebuild(usize),
}
impl Phase {
    fn label(&self) -> String {
        match self {
            Self::Queued => "Queued".into(),
            Self::Running => "Running".into(),
            Self::WaitingForCpu => "Waiting for CPU".into(),
            Self::Compiling => "Compiling".into(),
            Self::Cached => "Cached".into(),
            Self::Compiled => "Compiled".into(),
            Self::StressIteration(iteration) => format!("Stress iteration {iteration}"),
            Self::IndexRebuild(rebuilt) => format!("Rebuilding index  {rebuilt} rebuilt"),
        }
    }
}

#[derive(Debug, Default)]
pub(super) struct State {
    pub cases: BTreeMap<usize, CaseState>,
    phase: Phase,
}
impl State {
    pub fn event(&mut self, event: &TaskEvent) -> bool {
        match &event.payload {
            TaskEventPayload::Queued { .. } => self.phase = Phase::Queued,
            TaskEventPayload::Running { .. } => self.phase = Phase::Running,
            TaskEventPayload::Finished { .. } => return false,
            TaskEventPayload::Progress { result } => self.progress(result),
        }
        true
    }

    fn progress(&mut self, progress: &TaskProgress) {
        match progress {
            TaskProgress::SourceSaved | TaskProgress::Scheduled { .. } => (),
            TaskProgress::Preparing { testcases } => {
                self.phase = Phase::WaitingForCpu;
                self.cases = testcases
                    .iter()
                    .map(|case| (case.case_index, CaseState::Queued))
                    .collect();
            }
            TaskProgress::Compiling => self.phase = Phase::Compiling,
            TaskProgress::Compiled { compilation } => {
                self.phase = if compilation.builds == 0 {
                    Phase::Cached
                } else {
                    Phase::Compiled
                };
            }
            TaskProgress::Running { case_index, .. } => {
                self.phase = Phase::Running;
                self.cases.insert(*case_index, CaseState::Running);
            }
            TaskProgress::TestcaseFinished {
                case_index,
                testcase,
            } => {
                self.cases
                    .insert(*case_index, CaseState::Finished(testcase.clone()));
            }
            TaskProgress::StressIteration { iteration, .. } => {
                self.phase = Phase::StressIteration(*iteration);
            }
            TaskProgress::IndexRebuild { rebuilt } => self.phase = Phase::IndexRebuild(*rebuilt),
        }
    }

    pub fn summary(&self) -> String {
        let heading = paint(&self.phase.label(), Tone::Info);
        if self.cases.is_empty() {
            return heading;
        }
        let accepted = self.cases.values().filter(|case| matches!(case, CaseState::Finished(result) if result.verdict == JudgeVerdict::Accepted)).count();
        format!(
            "{heading}  {accepted}/{} testcases passed",
            self.cases.len()
        )
    }
}

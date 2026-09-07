use super::{Tone, paint, table};
use crate::application::tasks::TaskEvent;
mod state;
use state::{CaseState, State};
use std::{
    io::{self, Write},
    time::{Duration, Instant},
};

#[derive(Debug, Default)]
pub(crate) struct Live {
    pub color: anstream::ColorChoice,
    state: State,
    lines: usize,
    last_draw: Option<Instant>,
    dirty: bool,
}

impl Live {
    pub fn event(&mut self, event: &TaskEvent) -> io::Result<()> {
        if !self.state.event(event) {
            return Ok(());
        }
        self.dirty = true;
        self.refresh()
    }

    pub fn refresh(&mut self) -> io::Result<()> {
        if !self.dirty {
            return Ok(());
        }
        // Events remain lossless in JSONL/history; painting is throttled independently.
        if self
            .last_draw
            .is_some_and(|last| last.elapsed() < Duration::from_millis(40))
        {
            return Ok(());
        }
        self.draw()
    }

    fn draw(&mut self) -> io::Result<()> {
        self.clear()?;
        let (width, height) = crossterm::terminal::size().unwrap_or((80, 24));
        let width =
            super::layout::terminal_width().min(usize::from(if width == 0 { 80 } else { width }));
        let height = if height == 0 { 24 } else { height };
        if width < 20 {
            return Ok(());
        }
        let limit = usize::from(height.saturating_sub(3).max(3));
        // Keep running cases visible, then show the most recent completed/queued cases.
        let mut selected: Vec<_> = self.state.cases.iter().collect();
        selected.sort_by_key(|(index, case)| {
            (
                !matches!(case, CaseState::Running),
                std::cmp::Reverse(**index),
            )
        });
        selected.truncate(limit.saturating_sub(2));
        selected.sort_by_key(|(index, _)| **index);
        let columns = super::judging::case_columns(width);
        let headers: Vec<_> = ["Testcase", "Verdict", "Time", "Memory", "Details"]
            .into_iter()
            .take(columns)
            .collect();
        let rows = selected
            .iter()
            .map(|(index, case)| {
                let mut row = super::layout::scoped(Some(width), || {
                    case.row(**index, self.state.cases.len() == 1)
                })?;
                row.truncate(columns);
                Ok(row)
            })
            .collect::<io::Result<Vec<_>>>()?;
        let summary = super::layout::truncate(&self.state.summary(), width.saturating_sub(1));
        let content = if self.state.cases.is_empty() {
            summary
        } else {
            format!(
                "{summary}\n{}",
                table::render_width(&headers, rows, Some(width.saturating_sub(1)))
            )
        };
        let rendered = super::layout::wrap(&content, width.saturating_sub(1));
        let total_lines = rendered.lines().count();
        let mut lines: Vec<_> = rendered.lines().take(limit).map(str::to_owned).collect();
        if selected.len() < self.state.cases.len() || total_lines > limit {
            lines.push(paint(
                &super::layout::truncate("More cases in final results", width.saturating_sub(1)),
                Tone::Muted,
            ));
        }
        self.lines = lines.len();
        self.last_draw = Some(Instant::now());
        self.dirty = false;
        let mut out = anstream::AutoStream::new(io::stderr().lock(), self.color);
        writeln!(out, "{}", lines.join("\n"))?;
        out.flush()
    }

    pub fn clear(&mut self) -> io::Result<()> {
        if self.lines > 0 {
            // Cursor control is independent of color; NO_COLOR only disables SGR styles.
            let mut out = io::stderr().lock();
            write!(out, "\r\x1b[{}A\x1b[J", self.lines)?;
            out.flush()?;
            self.lines = 0;
        }
        Ok(())
    }
}

use super::{Tone, clean, layout, paint};

#[derive(Debug)]
pub(super) struct Cell {
    content: String,
    right: bool,
}
impl Cell {
    pub fn new(content: impl Into<String>) -> Self {
        Self {
            content: content.into(),
            right: false,
        }
    }
}

pub(super) fn inline(value: &str) -> String {
    clean(value).replace('\n', "\\n").replace('\t', "\\t")
}
pub(super) fn cell(value: &str, tone: Tone) -> Cell {
    Cell::new(paint(&inline(value), tone))
}
pub(super) fn number(value: &str) -> Cell {
    Cell {
        content: paint(&inline(value), Tone::Metric),
        right: true,
    }
}
pub(super) fn render(headers: &[&str], rows: Vec<Vec<Cell>>) -> String {
    render_width(headers, rows, layout::width())
}
pub(super) fn render_width(headers: &[&str], rows: Vec<Vec<Cell>>, width: Option<usize>) -> String {
    let widths: Vec<_> = headers
        .iter()
        .enumerate()
        .map(|(i, header)| {
            rows.iter()
                .filter_map(|row| row.get(i))
                .map(|cell| layout::measure(&cell.content))
                .chain([header.len()])
                .max()
                .unwrap_or(0)
        })
        .collect();
    let minimum: Vec<_> = headers
        .iter()
        .zip(&widths)
        .map(|(header, natural)| {
            (*natural).min(match *header {
                "Details" | "Source" | "Primary source" | "Path" | "Name" => 12,
                "ID" | "Task" | "Code ID" | "Problem ID" => 8,
                _ => header.len().max(7),
            })
        })
        .collect();
    let gap = headers.len().saturating_sub(1) * 2;
    if width.is_some_and(|width| {
        minimum.iter().sum::<usize>() + gap > width
            || (width < 60
                && headers
                    .iter()
                    .any(|h| matches!(*h, "Source" | "Primary source" | "Input" | "Task" | "Path")))
    }) {
        return stacked(headers, &rows);
    }
    let mut widths = widths;
    if let Some(width) = width {
        // Bound allocation work even for multi-megabyte diagnostics.
        for current in &mut widths {
            *current = (*current).min(width);
        }
        while widths.iter().sum::<usize>() + gap > width {
            let shrink = widths
                .iter()
                .zip(&minimum)
                .enumerate()
                .filter(|(_, (current, min))| current > min)
                .max_by_key(|(_, (current, min))| **current - **min)
                .map(|(index, _)| index);
            let Some(index) = shrink else {
                break;
            };
            if let Some(value) = widths.get_mut(index) {
                *value -= 1;
            }
        }
    }
    let mut lines = vec![heading(headers, &widths)];
    let truncated = rows.iter().any(|row| {
        row.iter()
            .zip(&widths)
            .any(|(cell, width)| layout::measure(&cell.content) > *width)
    });
    lines.extend(
        rows.into_iter()
            .map(|cells| row(&cells, &widths).trim_end().to_owned()),
    );
    if truncated {
        lines.push(paint("Full values: --json or --plain", Tone::Hint));
    }
    lines.join("\n")
}
fn heading(headers: &[&str], widths: &[usize]) -> String {
    headers
        .iter()
        .zip(widths)
        .enumerate()
        .map(|(index, (header, width))| {
            let content = layout::truncate(&inline(header), *width);
            let gap = if index + 1 < headers.len() { 2 } else { 0 };
            let padding = " ".repeat(width.saturating_sub(layout::measure(&content)) + gap);
            let padded = format!("{content}{padding}");
            // Leave the final space unstyled to separate adjacent column underlines.
            if let Some(underlined) = padded.strip_suffix(' ') {
                format!("{} ", paint(underlined, Tone::Heading))
            } else {
                paint(&padded, Tone::Heading)
            }
        })
        .collect()
}
fn row(cells: &[Cell], widths: &[usize]) -> String {
    cells
        .iter()
        .zip(widths)
        .map(|(cell, width)| {
            let content = layout::truncate(&cell.content, *width);
            let padding = " ".repeat(width.saturating_sub(layout::measure(&content)));
            if cell.right {
                format!("{padding}{content}")
            } else {
                format!("{content}{padding}")
            }
        })
        .collect::<Vec<_>>()
        .join("  ")
}
fn stacked(headers: &[&str], rows: &[Vec<Cell>]) -> String {
    rows.iter()
        .map(|row| {
            headers
                .iter()
                .zip(row)
                .map(|(header, cell)| layout::field(header, &cell.content))
                .collect::<Vec<_>>()
                .join("\n")
        })
        .collect::<Vec<_>>()
        .join("\n\n")
}

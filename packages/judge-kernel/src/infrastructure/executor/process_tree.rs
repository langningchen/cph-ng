use std::collections::{HashMap, HashSet};

pub(super) struct Sample {
    pub parent: Option<u32>,
    pub start: u64,
    pub memory: u64,
}

pub(super) fn usage(root: u32, samples: &HashMap<u32, Sample>) -> (u64, usize) {
    if !samples.contains_key(&root) {
        return (0, 0);
    }
    let mut descendants = HashSet::from([root]);
    loop {
        let before = descendants.len();
        for (id, process) in samples {
            // Windows retains a child's parent PID after that parent exits.
            // Reused PIDs must not attach older, unrelated processes to this run.
            if process.parent.is_some_and(|parent| {
                descendants.contains(&parent)
                    && samples
                        .get(&parent)
                        .is_some_and(|ancestor| process.start >= ancestor.start)
            }) {
                descendants.insert(*id);
            }
        }
        if descendants.len() == before {
            break;
        }
    }
    let memory = descendants
        .iter()
        .filter_map(|id| samples.get(id))
        .map(|process| process.memory)
        .sum::<u64>()
        .div_ceil(1024);
    (memory, descendants.len())
}

#[cfg(test)]
mod tests {
    use super::{Sample, usage};

    #[test]
    fn reused_parent_ids_do_not_count_unrelated_memory() {
        let samples = [
            (
                10,
                Sample {
                    parent: None,
                    start: 100,
                    memory: 1024,
                },
            ),
            (
                11,
                Sample {
                    parent: Some(10),
                    start: 101,
                    memory: 2048,
                },
            ),
            (
                12,
                Sample {
                    parent: Some(11),
                    start: 102,
                    memory: 4096,
                },
            ),
            (
                13,
                Sample {
                    parent: Some(10),
                    start: 50,
                    memory: 1 << 31,
                },
            ),
            (
                14,
                Sample {
                    parent: Some(13),
                    start: 103,
                    memory: 1 << 31,
                },
            ),
            (
                15,
                Sample {
                    parent: Some(99),
                    start: 104,
                    memory: 1 << 31,
                },
            ),
        ]
        .into_iter()
        .collect();
        assert_eq!(usage(10, &samples), (7, 3));
        assert_eq!(usage(99, &samples), (0, 0));
    }
}

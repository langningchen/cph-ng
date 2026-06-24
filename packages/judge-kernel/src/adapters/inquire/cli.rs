use std::{
    error::Error,
    io::{self, BufRead, Write},
};

use crate::ports::inquire::Inquire;

pub struct CliInquire;

impl Inquire for CliInquire {
    fn confirm(&self, error: &dyn Error) -> bool {
        let mut stderr = io::stderr();
        let _ = writeln!(stderr, "{error}");
        let _ = write!(stderr, "Proceed? [Y/n] ");

        let mut line = String::new();
        match io::stdin().lock().read_line(&mut line) {
            Ok(_) => {
                let trimmed = line.trim().to_lowercase();
                trimmed.get(0..1).is_some_and(|c| c == "y")
            }
            Err(_) => false,
        }
    }
}

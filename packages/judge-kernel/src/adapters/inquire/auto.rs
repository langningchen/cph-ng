use std::{
    error::Error,
    io::{self, Write},
};

use crate::ports::inquire::Inquire;

pub struct AutoInquire {
    value: bool,
}

impl AutoInquire {
    pub fn new(value: bool) -> Self {
        Self { value }
    }
}

impl Inquire for AutoInquire {
    fn confirm(&self, error: &dyn Error) -> bool {
        let mut stderr = io::stderr();
        let _ = writeln!(stderr, "{error}");
        let _ = writeln!(stderr, "Proceeding with default value: {}", self.value);
        self.value
    }
}

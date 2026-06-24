use std::{collections::HashMap, convert::TryFrom, fmt::Display, path::Path};

use thiserror::Error;
use toml_edit::DocumentMut;

use crate::{
    domain::{Problem, TestcaseId},
    ports::inquire::Inquire,
};

#[derive(Error, Debug)]
pub enum ExchangeError {
    #[error("IO Error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Serde JSON Error: {0}")]
    Json(#[from] serde_json::Error),
    /// Value overflow error when converting from `u64` to a smaller type.
    /// The error contains the field name, the original value, and the maximum allowed value.
    #[error("Overflow in field '{0}': value {1} exceeds max {2}")]
    ValueOverflow(String, u64, u64),
}

/// Try to convert a `u64` to `T`. If overflow, ask via `inquire` whether to clamp or abort.
pub fn clamp_or_abort<T>(
    field: &str,
    value: u64,
    max: T,
    inquire: &dyn Inquire,
) -> Result<T, ExchangeError>
where
    T: TryFrom<u64> + Copy + Display + Into<u64>,
{
    if let Ok(v) = T::try_from(value) {
        return Ok(v);
    }
    let max_u64: u64 = max.into();
    let error = ExchangeError::ValueOverflow(field.to_string(), value, max_u64);
    if inquire.confirm(&error) {
        Ok(max)
    } else {
        Err(error)
    }
}

pub struct ImportedData {
    pub problem: Problem,
    pub language_env: DocumentMut,
    pub testcase_payloads: HashMap<TestcaseId, (String, String)>,
}

pub trait ProblemImporter: Send + Sync {
    fn can_import(&self, path: &Path) -> bool;
    fn import(&self, path: &Path, inquire: &dyn Inquire) -> Result<ImportedData, ExchangeError>;
}

pub trait ProblemExporter: Send + Sync {
    fn export(&self, problem: &Problem, export_path: &Path) -> Result<(), ExchangeError>;
}

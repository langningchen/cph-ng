use std::{collections::HashMap, path::Path};

use thiserror::Error;
use toml_edit::DocumentMut;

use crate::domain::{Problem, TestcaseId};

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

/// Validate an imported integer without prompting or changing its value.
///
/// # Errors
/// Returns the field, rejected value and upper bound if it is out of range.
pub fn checked_import_value<T>(field: &str, value: u64, max: T) -> Result<T, ExchangeError>
where
    T: TryFrom<u64> + Into<u64>,
{
    let max = max.into();
    if value > max {
        return Err(ExchangeError::ValueOverflow(field.into(), value, max));
    }
    T::try_from(value).map_err(|_| ExchangeError::ValueOverflow(field.into(), value, max))
}

#[derive(Debug)]
pub struct ImportedData {
    pub problem: Problem,
    pub language_env: DocumentMut,
    pub testcase_payloads: HashMap<TestcaseId, (String, String)>,
}

pub trait ProblemImporter: Send + Sync {
    fn can_import(&self, path: &Path) -> bool;

    /// # Errors
    /// Returns an I/O, serialization or range-validation error without changing the imported
    /// values.
    fn import(&self, path: &Path) -> Result<ImportedData, ExchangeError>;
}

pub trait ProblemExporter: Send + Sync {
    /// # Errors
    /// Returns an I/O or serialization error if the destination cannot be written.
    fn export(&self, problem: &Problem, export_path: &Path) -> Result<(), ExchangeError>;
}

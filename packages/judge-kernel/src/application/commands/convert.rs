use crate::{
    application::error::{CommandError, ErrorCode},
    ports::{RepoError, index::IndexError},
};
use serde::{Serialize, de::DeserializeOwned};
use serde_json::{Value, json};

pub(super) fn value<T: Serialize>(value: T) -> Result<Value, CommandError> {
    serde_json::to_value(value).map_err(CommandError::internal)
}

pub(super) fn params<T: DeserializeOwned>(value: &Value) -> Result<T, CommandError> {
    serde_json::from_value(value.clone())
        .map_err(|error| CommandError::invalid(format!("Invalid parameters: {error}")))
}

#[must_use]
pub fn index_error(error: IndexError) -> CommandError {
    match error {
        IndexError::NotFound(_) => CommandError::new(
            ErrorCode::NotIndexed,
            "Source is not indexed; create a problem or reindex the file",
        ),
        IndexError::Conflict(ids) => CommandError {
            code: ErrorCode::Conflict,
            message: "Source may be a copy or has ambiguous identity; use problem link to share tests, or problem create for independent data".into(),
            data: Some(json!({"problem_ids":ids})),
        },
        IndexError::Changed => {
            CommandError::new(ErrorCode::Conflict, "Source changed while being indexed")
        }
        IndexError::Io(error) => CommandError::filesystem("Cannot read source", &error),
        IndexError::Database(error) => CommandError::internal(error),
    }
}

pub(super) fn repo_error(error: RepoError) -> CommandError {
    match error {
        RepoError::Index(error) => index_error(error),
        RepoError::NotIndexed => CommandError::new(ErrorCode::NotIndexed, "Problem is not indexed"),
        RepoError::AlreadyExists => {
            CommandError::new(ErrorCode::Conflict, "Problem already exists")
        }
        RepoError::Io(error) => CommandError::filesystem("Cannot access problem data", &error),
        RepoError::InvalidData(message) => CommandError::invalid(message),
        error => CommandError::internal(error),
    }
}

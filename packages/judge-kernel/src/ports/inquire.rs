use std::error::Error;

pub trait Inquire: Send + Sync {
    /// Present a recoverable issue and ask whether to proceed or abort.
    fn confirm(&self, error: &dyn Error) -> bool;
}

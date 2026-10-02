//! Judge kernel library.
//!
//! The binary is intentionally thin; domain, application, and infrastructure
//! code live behind this public library boundary.
pub mod application;
pub mod domain;
pub mod infrastructure;
pub mod interface;
pub mod ports;

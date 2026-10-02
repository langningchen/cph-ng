use sha2::{Digest, Sha256};
use std::{io::Read, path::Path};
use uuid::Uuid;
/// # Errors
/// Returns an I/O error if the file cannot be opened/read or the hashing worker fails.
pub async fn file_hash(path: &Path) -> Result<String, std::io::Error> {
    let path = path.to_path_buf();
    tokio::task::spawn_blocking(move || {
        let mut file = std::fs::File::open(path)?;
        let mut hash = Sha256::new();
        let mut bytes = vec![0_u8; 65536];
        loop {
            let count = file.read(&mut bytes)?;
            if count == 0 {
                break;
            }
            hash.update(
                bytes
                    .get(..count)
                    .ok_or_else(|| std::io::Error::other("invalid read size"))?,
            );
        }
        Ok(format!("{:x}", hash.finalize()))
    })
    .await
    .map_err(std::io::Error::other)?
}

#[cfg(unix)]
pub(super) fn identity(metadata: &std::fs::Metadata) -> (i64, i64) {
    use std::os::unix::fs::MetadataExt;
    (
        i64::from_ne_bytes(metadata.dev().to_ne_bytes()),
        i64::from_ne_bytes(metadata.ino().to_ne_bytes()),
    )
}
#[cfg(windows)]
pub(super) fn identity(path: &Path, _metadata: &std::fs::Metadata) -> Option<(i64, i64)> {
    let file = std::fs::File::open(path).ok()?;
    let info = winapi_util::file::information(&file).ok()?;
    Some((
        i64::from_ne_bytes(info.volume_serial_number().to_ne_bytes()),
        i64::from_ne_bytes(info.file_index().to_ne_bytes()),
    ))
}
#[cfg(not(any(unix, windows)))]
pub(super) fn identity(_path: &Path, _metadata: &std::fs::Metadata) -> Option<(i64, i64)> {
    None
}

#[cfg(unix)]
pub(super) fn read_marker(path: &Path) -> Option<String> {
    let mut bytes = [0_u8; 64];
    let size = rustix::fs::getxattr(path, marker_name(), &mut bytes[..]).ok()?;
    String::from_utf8(bytes.get(..size)?.to_vec()).ok()
}
#[cfg(unix)]
fn marker_name() -> &'static str {
    if cfg!(target_os = "macos") {
        "org.cph-ng.problem-id"
    } else {
        "user.cph-ng.problem-id"
    }
}
#[cfg(unix)]
pub(super) fn write_marker(path: &Path, id: Uuid) -> Option<String> {
    let marker = id.to_string();
    rustix::fs::setxattr(
        path,
        marker_name(),
        marker.as_bytes(),
        rustix::fs::XattrFlags::empty(),
    )
    .ok()?;
    Some(marker)
}
#[cfg(windows)]
fn marker_stream(path: &Path) -> std::path::PathBuf {
    let mut name = path.as_os_str().to_os_string();
    name.push(":cph-ng.problem-id");
    name.into()
}
#[cfg(windows)]
pub(super) fn read_marker(path: &Path) -> Option<String> {
    std::fs::read_to_string(marker_stream(path))
        .ok()
        .filter(|value| Uuid::parse_str(value).is_ok())
}
#[cfg(windows)]
pub(super) fn write_marker(path: &Path, id: Uuid) -> Option<String> {
    let marker = id.to_string();
    std::fs::write(marker_stream(path), &marker).ok()?;
    Some(marker)
}
#[cfg(not(any(unix, windows)))]
pub(super) fn read_marker(_path: &Path) -> Option<String> {
    None
}
#[cfg(not(any(unix, windows)))]
pub(super) fn write_marker(_path: &Path, _id: Uuid) -> Option<String> {
    None
}

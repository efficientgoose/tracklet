fn main() {
    // CARGO_MANIFEST_DIR is src-tauri/, so .env is one level up at the project root.
    let manifest_dir = std::env::var("CARGO_MANIFEST_DIR").unwrap_or_default();
    let env_path = std::path::Path::new(&manifest_dir).join("..").join(".env");

    if let Ok(contents) = std::fs::read_to_string(&env_path) {
        for line in contents.lines() {
            let line = line.trim();
            if line.is_empty() || line.starts_with('#') {
                continue;
            }
            if let Some((key, value)) = line.split_once('=') {
                let key = key.trim();
                let value = value.trim();
                if matches!(key, "JIRA_CLIENT_ID" | "JIRA_CLIENT_SECRET" | "JIRA_REDIRECT_URI") {
                    println!("cargo:rustc-env={key}={value}");
                }
            }
        }
    }
    tauri_build::build()
}

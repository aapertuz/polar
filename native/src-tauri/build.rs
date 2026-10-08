fn main() {
    for name in ["POLAR_ENV", "POLAR_API_BASE_URL", "POLAR_DESKTOP_CLIENT_ID"] {
        println!("cargo:rerun-if-env-changed={name}");
    }
    tauri_build::build()
}

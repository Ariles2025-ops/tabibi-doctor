// Tabibi Pro — coquille Tauri minimale (Phase 3).
// Les assets embarqués sont servis via tauri-plugin-localhost sur un
// port FIXE : origine http://localhost:17423 sur toutes les plateformes.
// Raison (mesurée) : sous l'origine par défaut `tauri://localhost` de
// macOS, le widget Cloudflare Turnstile charge mais ne termine jamais
// son challenge → login impossible (le serveur GoTrue exige le token).
// Port fixe = origine stable (localStorage/session conservés entre
// lancements + un seul hostname « localhost » à autoriser côté
// Turnstile). Trade-off assumé : les pages statiques pro sont visibles
// par les processus locaux sur ce port (aucun secret ; les jetons de
// session restent dans le localStorage de la WebView).
// `diag_log` : canal de diagnostic WebView → stderr (binaire lancé au
// terminal ; no-op sinon).
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

const PORT: u16 = 17423;

#[tauri::command]
fn diag_log(msg: String) {
    eprintln!("[TABIBI-DIAG] {msg}");
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_localhost::Builder::new(PORT).build())
        .invoke_handler(tauri::generate_handler![diag_log])
        .setup(|app| {
            let url: tauri::Url = format!("http://localhost:{PORT}/login.html").parse()?;
            tauri::WebviewWindowBuilder::new(app, "main", tauri::WebviewUrl::External(url))
                .title("Tabibi Pro — Cabinet")
                .inner_size(1440.0, 900.0)
                .min_inner_size(1024.0, 700.0)
                .center()
                .build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("échec du lancement de Tabibi Pro");
}

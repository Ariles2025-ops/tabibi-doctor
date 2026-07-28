// Tabibi Pro — coquille Tauri minimale (Phase 3, lot 1).
// Toute la logique vit dans le frontend (dist/) ; Rust ne fait que
// porter la fenêtre. Pas de commande custom tant que le MVP n'en a
// pas besoin (auth + data = Supabase côté JS, comme sur le web).
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("échec du lancement de Tabibi Pro");
}

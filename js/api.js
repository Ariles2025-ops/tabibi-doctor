// Tabibi API module
(function() {
  if (!window.tabibi || !window.tabibi.supabase) {
    console.error('[Tabibi/api] supabase-client.js non charge');
    return;
  }
  const sb = window.tabibi.supabase;

  window.tabibi.api = {
    // [C1 2026-09-09] Plus aucun SELECT direct sur la vue public_doctors :
    // recherche via la RPC chercher_praticiens (≤ 50 par page, page ≤ 100,
    // wilaya OU spécialité obligatoire — la RPC refuse sinon, on ne l'appelle pas).
    async searchDoctors({ query = '', wilayaCode = null, specialtySlug = null, entityType = null, limit = 50, offset = 0 } = {}) {
      if (!wilayaCode && !specialtySlug) return { data: [], count: 0, error: 'filtre_obligatoire' };
      const limite = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
      const page = Math.min(100, Math.floor((parseInt(offset, 10) || 0) / limite) + 1);
      const { data, error } = await sb.rpc('chercher_praticiens', {
        p_wilaya: wilayaCode ? String(wilayaCode) : null,
        p_specialite: specialtySlug || null,
        p_q: query || null,
        p_type: entityType || null,
        p_page: page,
        p_limite: limite
      });
      if (error) { console.error('[Tabibi/api] searchDoctors', error); return { data: [], count: 0, error: error.message }; }
      return { data: (data && data.lignes) || [], count: (data && data.total) || 0 };
    },

    async getDoctor(id) {
      const { data, error } = await sb.rpc('praticien', { p_id: id }).maybeSingle();
      if (error) { console.error('[Tabibi/api] getDoctor', error); return null; }
      return data || null;
    },

    async getWilayas() {
      const { data, error } = await sb.from('wilayas').select('*').order('code');
      if (error) return [];
      return data || [];
    },

    async getSpecialties() {
      const { data, error } = await sb.from('specialties').select('*').eq('is_active', true).order('name_fr');
      if (error) return [];
      return data || [];
    },

    async getMyAppointments() {
      const { data, error } = await sb.from('my_upcoming_appointments').select('*');
      if (error) { console.error('[Tabibi/api] getMyAppointments', error); return []; }
      return data || [];
    },

    async createAppointment({ doctorId, scheduledAt, durationMinutes = 30, reason = '', notesPatient = '' }) {
      const session = await window.tabibi.auth.getSession();
      if (!session) throw new Error('Non connecte');
      const { data, error } = await sb.from('appointments').insert({
        patient_id: session.user.id,
        doctor_id: doctorId,
        scheduled_at: scheduledAt,
        duration_minutes: durationMinutes,
        reason, notes_patient: notesPatient,
        status: 'pending',
      }).select().single();
      if (error) throw error;
      return data;
    },

    async cancelAppointment(appointmentId, reason = '') {
      const session = await window.tabibi.auth.getSession();
      if (!session) throw new Error('Non connecte');
      const { data, error } = await sb.from('appointments').update({
        status: 'cancelled',
        cancelled_by_user_id: session.user.id,
        cancelled_at: new Date().toISOString(),
        cancellation_reason: reason,
      }).eq('id', appointmentId).select().single();
      if (error) throw error;
      return data;
    },
  };
  /* [FIX-PROD-2026-05-19] log d'init retiré */
})();

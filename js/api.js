// Tabibi API module
(function() {
  if (!window.tabibi || !window.tabibi.supabase) {
    console.error('[Tabibi/api] supabase-client.js non charge');
    return;
  }
  const sb = window.tabibi.supabase;

  window.tabibi.api = {
    async searchDoctors({ query = '', wilayaCode = null, specialtySlug = null, entityType = null, limit = 50, offset = 0 } = {}) {
      let q = sb.from('public_doctors').select('*', { count: 'exact' });
      if (wilayaCode) q = q.eq('wilaya_code', wilayaCode);
      if (specialtySlug) q = q.eq('specialty_slug', specialtySlug);
      if (entityType) q = q.eq('entity_type', entityType);
      if (query) q = q.ilike('full_name', '%' + query + '%');
      q = q.range(offset, offset + limit - 1);
      const { data, error, count } = await q;
      if (error) { console.error('[Tabibi/api] searchDoctors', error); return { data: [], count: 0 }; }
      return { data: data || [], count: count || 0 };
    },

    async getDoctor(id) {
      const { data, error } = await sb.from('public_doctors').select('*').eq('id', id).single();
      if (error) { console.error('[Tabibi/api] getDoctor', error); return null; }
      return data;
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

// =====================================================================
// database.types.ts — GENERE, NE PAS EDITER A LA MAIN
// =====================================================================
// Source : le schema REEL du projet Supabase pudugodhiofqrctcdwfl (production).
// Regenerer apres toute migration :
//
//     supabase gen types typescript --linked > v2/src/lib/database.types.ts
//
// POURQUOI CE FICHIER EXISTE
// La premiere version de la v2 declarait ses types a la main. Confrontes au
// schema reel le 09/09/2026, ils etaient faux sur presque tout :
//
//   doctor_profiles : la v2 lisait `nom`, `prenom`, `specialite`, `wilaya`.
//                     AUCUNE de ces colonnes n'existe. Les vraies sont
//                     `full_name`, `full_name_ar`, `specialty_id`,
//                     `wilaya_code`. La requete `.select('... nom, prenom ...')`
//                     aurait echoue en production, sur 52 colonnes reelles.
//
//   appointments    : la v2 declarait `motif` (n'existe pas -> `reason`),
//                     `patient_id: string | null` (en realite NOT NULL),
//                     `status: string | null` (en realite un ENUM).
//
// Un type ecrit a la main est une hypothese. Un type genere est un contrat.
// =====================================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      admin_actions: {
        Row: {
          action_type: string
          admin_user_id: string
          created_at: string
          id: string
          metadata: Json | null
          notes: string | null
          target_id: string | null
          target_type: string
        }
        Insert: {
          action_type: string
          admin_user_id: string
          created_at?: string
          id?: string
          metadata?: Json | null
          notes?: string | null
          target_id?: string | null
          target_type: string
        }
        Update: {
          action_type?: string
          admin_user_id?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          notes?: string | null
          target_id?: string | null
          target_type?: string
        }
        Relationships: []
      }
      api_keys: {
        Row: {
          active: boolean
          created_at: string
          created_by_user_id: string | null
          environment: string
          expires_at: string | null
          id: string
          ip_whitelist: string[]
          key_id: string
          key_secret_hash: string
          last_used_at: string | null
          last_used_ip: string | null
          owner_user_id: string | null
          partner_contact_phone: string | null
          partner_email: string
          partner_name: string
          rate_limit_per_day: number
          rate_limit_per_minute: number
          revoked_at: string | null
          revoked_reason: string | null
          scopes: string[]
          total_calls: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by_user_id?: string | null
          environment?: string
          expires_at?: string | null
          id?: string
          ip_whitelist?: string[]
          key_id: string
          key_secret_hash: string
          last_used_at?: string | null
          last_used_ip?: string | null
          owner_user_id?: string | null
          partner_contact_phone?: string | null
          partner_email: string
          partner_name: string
          rate_limit_per_day?: number
          rate_limit_per_minute?: number
          revoked_at?: string | null
          revoked_reason?: string | null
          scopes?: string[]
          total_calls?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by_user_id?: string | null
          environment?: string
          expires_at?: string | null
          id?: string
          ip_whitelist?: string[]
          key_id?: string
          key_secret_hash?: string
          last_used_at?: string | null
          last_used_ip?: string | null
          owner_user_id?: string | null
          partner_contact_phone?: string | null
          partner_email?: string
          partner_name?: string
          rate_limit_per_day?: number
          rate_limit_per_minute?: number
          revoked_at?: string | null
          revoked_reason?: string | null
          scopes?: string[]
          total_calls?: number
          updated_at?: string
        }
        Relationships: []
      }
      api_usage_log: {
        Row: {
          api_key_id: string | null
          created_at: string
          endpoint: string
          error_message: string | null
          id: number
          ip: string | null
          method: string
          request_body_sha256: string | null
          response_time_ms: number | null
          status_code: number | null
          user_agent: string | null
        }
        Insert: {
          api_key_id?: string | null
          created_at?: string
          endpoint: string
          error_message?: string | null
          id?: number
          ip?: string | null
          method: string
          request_body_sha256?: string | null
          response_time_ms?: number | null
          status_code?: number | null
          user_agent?: string | null
        }
        Update: {
          api_key_id?: string | null
          created_at?: string
          endpoint?: string
          error_message?: string | null
          id?: number
          ip?: string | null
          method?: string
          request_body_sha256?: string | null
          response_time_ms?: number | null
          status_code?: number | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_usage_log_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_usage_log_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys_analytics"
            referencedColumns: ["id"]
          },
        ]
      }
      api_usage_log_20260518: {
        Row: {
          api_key_id: string | null
          created_at: string
          endpoint: string
          error_message: string | null
          id: number
          ip: string | null
          method: string
          request_body_sha256: string | null
          response_time_ms: number | null
          status_code: number | null
          user_agent: string | null
        }
        Insert: {
          api_key_id?: string | null
          created_at?: string
          endpoint: string
          error_message?: string | null
          id?: number
          ip?: string | null
          method: string
          request_body_sha256?: string | null
          response_time_ms?: number | null
          status_code?: number | null
          user_agent?: string | null
        }
        Update: {
          api_key_id?: string | null
          created_at?: string
          endpoint?: string
          error_message?: string | null
          id?: number
          ip?: string | null
          method?: string
          request_body_sha256?: string | null
          response_time_ms?: number | null
          status_code?: number | null
          user_agent?: string | null
        }
        Relationships: []
      }
      api_usage_log_20260519: {
        Row: {
          api_key_id: string | null
          created_at: string
          endpoint: string
          error_message: string | null
          id: number
          ip: string | null
          method: string
          request_body_sha256: string | null
          response_time_ms: number | null
          status_code: number | null
          user_agent: string | null
        }
        Insert: {
          api_key_id?: string | null
          created_at?: string
          endpoint: string
          error_message?: string | null
          id?: number
          ip?: string | null
          method: string
          request_body_sha256?: string | null
          response_time_ms?: number | null
          status_code?: number | null
          user_agent?: string | null
        }
        Update: {
          api_key_id?: string | null
          created_at?: string
          endpoint?: string
          error_message?: string | null
          id?: number
          ip?: string | null
          method?: string
          request_body_sha256?: string | null
          response_time_ms?: number | null
          status_code?: number | null
          user_agent?: string | null
        }
        Relationships: []
      }
      api_usage_log_20260520: {
        Row: {
          api_key_id: string | null
          created_at: string
          endpoint: string
          error_message: string | null
          id: number
          ip: string | null
          method: string
          request_body_sha256: string | null
          response_time_ms: number | null
          status_code: number | null
          user_agent: string | null
        }
        Insert: {
          api_key_id?: string | null
          created_at?: string
          endpoint: string
          error_message?: string | null
          id?: number
          ip?: string | null
          method: string
          request_body_sha256?: string | null
          response_time_ms?: number | null
          status_code?: number | null
          user_agent?: string | null
        }
        Update: {
          api_key_id?: string | null
          created_at?: string
          endpoint?: string
          error_message?: string | null
          id?: number
          ip?: string | null
          method?: string
          request_body_sha256?: string | null
          response_time_ms?: number | null
          status_code?: number | null
          user_agent?: string | null
        }
        Relationships: []
      }
      api_usage_log_20260521: {
        Row: {
          api_key_id: string | null
          created_at: string
          endpoint: string
          error_message: string | null
          id: number
          ip: string | null
          method: string
          request_body_sha256: string | null
          response_time_ms: number | null
          status_code: number | null
          user_agent: string | null
        }
        Insert: {
          api_key_id?: string | null
          created_at?: string
          endpoint: string
          error_message?: string | null
          id?: number
          ip?: string | null
          method: string
          request_body_sha256?: string | null
          response_time_ms?: number | null
          status_code?: number | null
          user_agent?: string | null
        }
        Update: {
          api_key_id?: string | null
          created_at?: string
          endpoint?: string
          error_message?: string | null
          id?: number
          ip?: string | null
          method?: string
          request_body_sha256?: string | null
          response_time_ms?: number | null
          status_code?: number | null
          user_agent?: string | null
        }
        Relationships: []
      }
      api_usage_log_20260522: {
        Row: {
          api_key_id: string | null
          created_at: string
          endpoint: string
          error_message: string | null
          id: number
          ip: string | null
          method: string
          request_body_sha256: string | null
          response_time_ms: number | null
          status_code: number | null
          user_agent: string | null
        }
        Insert: {
          api_key_id?: string | null
          created_at?: string
          endpoint: string
          error_message?: string | null
          id?: number
          ip?: string | null
          method: string
          request_body_sha256?: string | null
          response_time_ms?: number | null
          status_code?: number | null
          user_agent?: string | null
        }
        Update: {
          api_key_id?: string | null
          created_at?: string
          endpoint?: string
          error_message?: string | null
          id?: number
          ip?: string | null
          method?: string
          request_body_sha256?: string | null
          response_time_ms?: number | null
          status_code?: number | null
          user_agent?: string | null
        }
        Relationships: []
      }
      api_usage_log_20260523: {
        Row: {
          api_key_id: string | null
          created_at: string
          endpoint: string
          error_message: string | null
          id: number
          ip: string | null
          method: string
          request_body_sha256: string | null
          response_time_ms: number | null
          status_code: number | null
          user_agent: string | null
        }
        Insert: {
          api_key_id?: string | null
          created_at?: string
          endpoint: string
          error_message?: string | null
          id?: number
          ip?: string | null
          method: string
          request_body_sha256?: string | null
          response_time_ms?: number | null
          status_code?: number | null
          user_agent?: string | null
        }
        Update: {
          api_key_id?: string | null
          created_at?: string
          endpoint?: string
          error_message?: string | null
          id?: number
          ip?: string | null
          method?: string
          request_body_sha256?: string | null
          response_time_ms?: number | null
          status_code?: number | null
          user_agent?: string | null
        }
        Relationships: []
      }
      api_usage_log_20260524: {
        Row: {
          api_key_id: string | null
          created_at: string
          endpoint: string
          error_message: string | null
          id: number
          ip: string | null
          method: string
          request_body_sha256: string | null
          response_time_ms: number | null
          status_code: number | null
          user_agent: string | null
        }
        Insert: {
          api_key_id?: string | null
          created_at?: string
          endpoint: string
          error_message?: string | null
          id?: number
          ip?: string | null
          method: string
          request_body_sha256?: string | null
          response_time_ms?: number | null
          status_code?: number | null
          user_agent?: string | null
        }
        Update: {
          api_key_id?: string | null
          created_at?: string
          endpoint?: string
          error_message?: string | null
          id?: number
          ip?: string | null
          method?: string
          request_body_sha256?: string | null
          response_time_ms?: number | null
          status_code?: number | null
          user_agent?: string | null
        }
        Relationships: []
      }
      api_usage_log_20260525: {
        Row: {
          api_key_id: string | null
          created_at: string
          endpoint: string
          error_message: string | null
          id: number
          ip: string | null
          method: string
          request_body_sha256: string | null
          response_time_ms: number | null
          status_code: number | null
          user_agent: string | null
        }
        Insert: {
          api_key_id?: string | null
          created_at?: string
          endpoint: string
          error_message?: string | null
          id?: number
          ip?: string | null
          method: string
          request_body_sha256?: string | null
          response_time_ms?: number | null
          status_code?: number | null
          user_agent?: string | null
        }
        Update: {
          api_key_id?: string | null
          created_at?: string
          endpoint?: string
          error_message?: string | null
          id?: number
          ip?: string | null
          method?: string
          request_body_sha256?: string | null
          response_time_ms?: number | null
          status_code?: number | null
          user_agent?: string | null
        }
        Relationships: []
      }
      api_usage_log_20260526: {
        Row: {
          api_key_id: string | null
          created_at: string
          endpoint: string
          error_message: string | null
          id: number
          ip: string | null
          method: string
          request_body_sha256: string | null
          response_time_ms: number | null
          status_code: number | null
          user_agent: string | null
        }
        Insert: {
          api_key_id?: string | null
          created_at?: string
          endpoint: string
          error_message?: string | null
          id?: number
          ip?: string | null
          method: string
          request_body_sha256?: string | null
          response_time_ms?: number | null
          status_code?: number | null
          user_agent?: string | null
        }
        Update: {
          api_key_id?: string | null
          created_at?: string
          endpoint?: string
          error_message?: string | null
          id?: number
          ip?: string | null
          method?: string
          request_body_sha256?: string | null
          response_time_ms?: number | null
          status_code?: number | null
          user_agent?: string | null
        }
        Relationships: []
      }
      api_usage_log_20260527: {
        Row: {
          api_key_id: string | null
          created_at: string
          endpoint: string
          error_message: string | null
          id: number
          ip: string | null
          method: string
          request_body_sha256: string | null
          response_time_ms: number | null
          status_code: number | null
          user_agent: string | null
        }
        Insert: {
          api_key_id?: string | null
          created_at?: string
          endpoint: string
          error_message?: string | null
          id?: number
          ip?: string | null
          method: string
          request_body_sha256?: string | null
          response_time_ms?: number | null
          status_code?: number | null
          user_agent?: string | null
        }
        Update: {
          api_key_id?: string | null
          created_at?: string
          endpoint?: string
          error_message?: string | null
          id?: number
          ip?: string | null
          method?: string
          request_body_sha256?: string | null
          response_time_ms?: number | null
          status_code?: number | null
          user_agent?: string | null
        }
        Relationships: []
      }
      api_usage_log_20260528: {
        Row: {
          api_key_id: string | null
          created_at: string
          endpoint: string
          error_message: string | null
          id: number
          ip: string | null
          method: string
          request_body_sha256: string | null
          response_time_ms: number | null
          status_code: number | null
          user_agent: string | null
        }
        Insert: {
          api_key_id?: string | null
          created_at?: string
          endpoint: string
          error_message?: string | null
          id?: number
          ip?: string | null
          method: string
          request_body_sha256?: string | null
          response_time_ms?: number | null
          status_code?: number | null
          user_agent?: string | null
        }
        Update: {
          api_key_id?: string | null
          created_at?: string
          endpoint?: string
          error_message?: string | null
          id?: number
          ip?: string | null
          method?: string
          request_body_sha256?: string | null
          response_time_ms?: number | null
          status_code?: number | null
          user_agent?: string | null
        }
        Relationships: []
      }
      api_usage_log_20260529: {
        Row: {
          api_key_id: string | null
          created_at: string
          endpoint: string
          error_message: string | null
          id: number
          ip: string | null
          method: string
          request_body_sha256: string | null
          response_time_ms: number | null
          status_code: number | null
          user_agent: string | null
        }
        Insert: {
          api_key_id?: string | null
          created_at?: string
          endpoint: string
          error_message?: string | null
          id?: number
          ip?: string | null
          method: string
          request_body_sha256?: string | null
          response_time_ms?: number | null
          status_code?: number | null
          user_agent?: string | null
        }
        Update: {
          api_key_id?: string | null
          created_at?: string
          endpoint?: string
          error_message?: string | null
          id?: number
          ip?: string | null
          method?: string
          request_body_sha256?: string | null
          response_time_ms?: number | null
          status_code?: number | null
          user_agent?: string | null
        }
        Relationships: []
      }
      api_usage_log_20260530: {
        Row: {
          api_key_id: string | null
          created_at: string
          endpoint: string
          error_message: string | null
          id: number
          ip: string | null
          method: string
          request_body_sha256: string | null
          response_time_ms: number | null
          status_code: number | null
          user_agent: string | null
        }
        Insert: {
          api_key_id?: string | null
          created_at?: string
          endpoint: string
          error_message?: string | null
          id?: number
          ip?: string | null
          method: string
          request_body_sha256?: string | null
          response_time_ms?: number | null
          status_code?: number | null
          user_agent?: string | null
        }
        Update: {
          api_key_id?: string | null
          created_at?: string
          endpoint?: string
          error_message?: string | null
          id?: number
          ip?: string | null
          method?: string
          request_body_sha256?: string | null
          response_time_ms?: number | null
          status_code?: number | null
          user_agent?: string | null
        }
        Relationships: []
      }
      api_usage_log_20260531: {
        Row: {
          api_key_id: string | null
          created_at: string
          endpoint: string
          error_message: string | null
          id: number
          ip: string | null
          method: string
          request_body_sha256: string | null
          response_time_ms: number | null
          status_code: number | null
          user_agent: string | null
        }
        Insert: {
          api_key_id?: string | null
          created_at?: string
          endpoint: string
          error_message?: string | null
          id?: number
          ip?: string | null
          method: string
          request_body_sha256?: string | null
          response_time_ms?: number | null
          status_code?: number | null
          user_agent?: string | null
        }
        Update: {
          api_key_id?: string | null
          created_at?: string
          endpoint?: string
          error_message?: string | null
          id?: number
          ip?: string | null
          method?: string
          request_body_sha256?: string | null
          response_time_ms?: number | null
          status_code?: number | null
          user_agent?: string | null
        }
        Relationships: []
      }
      api_usage_log_20260601: {
        Row: {
          api_key_id: string | null
          created_at: string
          endpoint: string
          error_message: string | null
          id: number
          ip: string | null
          method: string
          request_body_sha256: string | null
          response_time_ms: number | null
          status_code: number | null
          user_agent: string | null
        }
        Insert: {
          api_key_id?: string | null
          created_at?: string
          endpoint: string
          error_message?: string | null
          id?: number
          ip?: string | null
          method: string
          request_body_sha256?: string | null
          response_time_ms?: number | null
          status_code?: number | null
          user_agent?: string | null
        }
        Update: {
          api_key_id?: string | null
          created_at?: string
          endpoint?: string
          error_message?: string | null
          id?: number
          ip?: string | null
          method?: string
          request_body_sha256?: string | null
          response_time_ms?: number | null
          status_code?: number | null
          user_agent?: string | null
        }
        Relationships: []
      }
      api_usage_log_20260602: {
        Row: {
          api_key_id: string | null
          created_at: string
          endpoint: string
          error_message: string | null
          id: number
          ip: string | null
          method: string
          request_body_sha256: string | null
          response_time_ms: number | null
          status_code: number | null
          user_agent: string | null
        }
        Insert: {
          api_key_id?: string | null
          created_at?: string
          endpoint: string
          error_message?: string | null
          id?: number
          ip?: string | null
          method: string
          request_body_sha256?: string | null
          response_time_ms?: number | null
          status_code?: number | null
          user_agent?: string | null
        }
        Update: {
          api_key_id?: string | null
          created_at?: string
          endpoint?: string
          error_message?: string | null
          id?: number
          ip?: string | null
          method?: string
          request_body_sha256?: string | null
          response_time_ms?: number | null
          status_code?: number | null
          user_agent?: string | null
        }
        Relationships: []
      }
      appointment_notifications: {
        Row: {
          appointment_id: string
          channel: string
          cost: string | null
          created_at: string
          error: string | null
          id: string
          kind: string
          provider_msg_id: string | null
          sent_at: string | null
          status: string
          to_phone: string | null
        }
        Insert: {
          appointment_id: string
          channel?: string
          cost?: string | null
          created_at?: string
          error?: string | null
          id?: string
          kind: string
          provider_msg_id?: string | null
          sent_at?: string | null
          status?: string
          to_phone?: string | null
        }
        Update: {
          appointment_id?: string
          channel?: string
          cost?: string | null
          created_at?: string
          error?: string | null
          id?: string
          kind?: string
          provider_msg_id?: string | null
          sent_at?: string | null
          status?: string
          to_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointment_notifications_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_notifications_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "cabinet_calendar_view"
            referencedColumns: ["appointment_id"]
          },
          {
            foreignKeyName: "appointment_notifications_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "my_reviewable_appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_notifications_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "my_upcoming_appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          cabinet_id: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by_user_id: string | null
          confirmation_sent_at: string | null
          consult_type: string | null
          created_at: string
          diagnostic_enc: string | null
          doctor_id: string
          duration_minutes: number
          ends_at: string | null
          id: string
          notes_doctor: string | null
          notes_medecin_enc: string | null
          notes_patient: string | null
          patient_id: string
          pay_method: string | null
          prix: number | null
          reason: string | null
          reminder_h1_sent_at: string | null
          reminder_j1_sent_at: string | null
          scheduled_at: string
          short_id: string
          starts_at: string | null
          status: Database["public"]["Enums"]["appointment_status"]
          updated_at: string
        }
        Insert: {
          cabinet_id?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by_user_id?: string | null
          confirmation_sent_at?: string | null
          consult_type?: string | null
          created_at?: string
          diagnostic_enc?: string | null
          doctor_id: string
          duration_minutes?: number
          ends_at?: string | null
          id?: string
          notes_doctor?: string | null
          notes_medecin_enc?: string | null
          notes_patient?: string | null
          patient_id: string
          pay_method?: string | null
          prix?: number | null
          reason?: string | null
          reminder_h1_sent_at?: string | null
          reminder_j1_sent_at?: string | null
          scheduled_at: string
          short_id?: string
          starts_at?: string | null
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Update: {
          cabinet_id?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by_user_id?: string | null
          confirmation_sent_at?: string | null
          consult_type?: string | null
          created_at?: string
          diagnostic_enc?: string | null
          doctor_id?: string
          duration_minutes?: number
          ends_at?: string | null
          id?: string
          notes_doctor?: string | null
          notes_medecin_enc?: string | null
          notes_patient?: string | null
          patient_id?: string
          pay_method?: string | null
          prix?: number | null
          reason?: string | null
          reminder_h1_sent_at?: string | null
          reminder_j1_sent_at?: string | null
          scheduled_at?: string
          short_id?: string
          starts_at?: string | null
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "cabinet_stats_view"
            referencedColumns: ["cabinet_id"]
          },
          {
            foreignKeyName: "appointments_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "cabinets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_cancelled_by_user_id_fkey"
            columns: ["cancelled_by_user_id"]
            isOneToOne: false
            referencedRelation: "doctor_patients_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_cancelled_by_user_id_fkey"
            columns: ["cancelled_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "my_reviewable_appointments"
            referencedColumns: ["doctor_id"]
          },
          {
            foreignKeyName: "appointments_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "my_upcoming_appointments"
            referencedColumns: ["doctor_id"]
          },
          {
            foreignKeyName: "appointments_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "public_doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "public_doctors_listed"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "doctor_patients_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          after_data: Json | null
          before_data: Json | null
          created_at: string | null
          error_msg: string | null
          id: number
          ip_address: string | null
          record_id: string | null
          success: boolean | null
          table_name: string | null
          user_agent: string | null
          user_email: string | null
          user_id: string | null
          user_role: string | null
        }
        Insert: {
          action: string
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string | null
          error_msg?: string | null
          id?: number
          ip_address?: string | null
          record_id?: string | null
          success?: boolean | null
          table_name?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Update: {
          action?: string
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string | null
          error_msg?: string | null
          id?: number
          ip_address?: string | null
          record_id?: string | null
          success?: boolean | null
          table_name?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Relationships: []
      }
      cabinet_members: {
        Row: {
          accepted_at: string | null
          active: boolean
          cabinet_id: string
          created_at: string
          id: string
          invited_at: string | null
          invited_by_user_id: string | null
          permissions: Json
          role: string
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          active?: boolean
          cabinet_id: string
          created_at?: string
          id?: string
          invited_at?: string | null
          invited_by_user_id?: string | null
          permissions?: Json
          role: string
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          active?: boolean
          cabinet_id?: string
          created_at?: string
          id?: string
          invited_at?: string | null
          invited_by_user_id?: string | null
          permissions?: Json
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cabinet_members_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "cabinet_stats_view"
            referencedColumns: ["cabinet_id"]
          },
          {
            foreignKeyName: "cabinet_members_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "cabinets"
            referencedColumns: ["id"]
          },
        ]
      }
      cabinets: {
        Row: {
          address: string | null
          commune: string | null
          created_at: string
          email: string | null
          id: string
          legal_form: string | null
          mrr_da: number
          name: string
          nif: string | null
          owner_user_id: string
          phone: string | null
          rc_number: string | null
          subscription_active: boolean
          subscription_expires_at: string | null
          subscription_tier: string
          updated_at: string
          wilaya: string | null
        }
        Insert: {
          address?: string | null
          commune?: string | null
          created_at?: string
          email?: string | null
          id?: string
          legal_form?: string | null
          mrr_da?: number
          name: string
          nif?: string | null
          owner_user_id: string
          phone?: string | null
          rc_number?: string | null
          subscription_active?: boolean
          subscription_expires_at?: string | null
          subscription_tier?: string
          updated_at?: string
          wilaya?: string | null
        }
        Update: {
          address?: string | null
          commune?: string | null
          created_at?: string
          email?: string | null
          id?: string
          legal_form?: string | null
          mrr_da?: number
          name?: string
          nif?: string | null
          owner_user_id?: string
          phone?: string | null
          rc_number?: string | null
          subscription_active?: boolean
          subscription_expires_at?: string | null
          subscription_tier?: string
          updated_at?: string
          wilaya?: string | null
        }
        Relationships: []
      }
      claim_requests: {
        Row: {
          contact_method: string | null
          created_at: string | null
          doctor_profile_id: string | null
          id: string
          legacy_id: number
          notes: string | null
          requester_email: string | null
          requester_name: string | null
          requester_phone: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
        }
        Insert: {
          contact_method?: string | null
          created_at?: string | null
          doctor_profile_id?: string | null
          id?: string
          legacy_id: number
          notes?: string | null
          requester_email?: string | null
          requester_name?: string | null
          requester_phone?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Update: {
          contact_method?: string | null
          created_at?: string | null
          doctor_profile_id?: string | null
          id?: string
          legacy_id?: number
          notes?: string | null
          requester_email?: string | null
          requester_name?: string | null
          requester_phone?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "claim_requests_doctor_profile_id_fkey"
            columns: ["doctor_profile_id"]
            isOneToOne: false
            referencedRelation: "doctor_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_requests_doctor_profile_id_fkey"
            columns: ["doctor_profile_id"]
            isOneToOne: false
            referencedRelation: "my_reviewable_appointments"
            referencedColumns: ["doctor_id"]
          },
          {
            foreignKeyName: "claim_requests_doctor_profile_id_fkey"
            columns: ["doctor_profile_id"]
            isOneToOne: false
            referencedRelation: "my_upcoming_appointments"
            referencedColumns: ["doctor_id"]
          },
          {
            foreignKeyName: "claim_requests_doctor_profile_id_fkey"
            columns: ["doctor_profile_id"]
            isOneToOne: false
            referencedRelation: "public_doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_requests_doctor_profile_id_fkey"
            columns: ["doctor_profile_id"]
            isOneToOne: false
            referencedRelation: "public_doctors_listed"
            referencedColumns: ["id"]
          },
        ]
      }
      consents_log: {
        Row: {
          consent_scope: string
          consent_version: string
          evidence: Json | null
          granted: boolean
          granted_at: string
          id: number
          ip_hash: string | null
          locale: string | null
          revoked_at: string | null
          source: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          consent_scope: string
          consent_version: string
          evidence?: Json | null
          granted: boolean
          granted_at?: string
          id?: number
          ip_hash?: string | null
          locale?: string | null
          revoked_at?: string | null
          source?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          consent_scope?: string
          consent_version?: string
          evidence?: Json | null
          granted?: boolean
          granted_at?: string
          id?: number
          ip_hash?: string | null
          locale?: string | null
          revoked_at?: string | null
          source?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          created_at: string
          doctor_id: string
          doctor_user_id: string
          id: string
          last_message_at: string
          patient_id: string
        }
        Insert: {
          created_at?: string
          doctor_id: string
          doctor_user_id: string
          id?: string
          last_message_at?: string
          patient_id: string
        }
        Update: {
          created_at?: string
          doctor_id?: string
          doctor_user_id?: string
          id?: string
          last_message_at?: string
          patient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "my_reviewable_appointments"
            referencedColumns: ["doctor_id"]
          },
          {
            foreignKeyName: "conversations_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "my_upcoming_appointments"
            referencedColumns: ["doctor_id"]
          },
          {
            foreignKeyName: "conversations_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "public_doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "public_doctors_listed"
            referencedColumns: ["id"]
          },
        ]
      }
      dawini_requests: {
        Row: {
          consent_at: string
          created_at: string
          expires_at: string
          id: string
          image_path: string | null
          latitude: number | null
          longitude: number | null
          medicaments: string[]
          medicaments_normalized: string[] | null
          note: string | null
          patient_id: string
          status: Database["public"]["Enums"]["dawini_request_status"]
          wilaya_code: number
        }
        Insert: {
          consent_at: string
          created_at?: string
          expires_at?: string
          id?: string
          image_path?: string | null
          latitude?: number | null
          longitude?: number | null
          medicaments: string[]
          medicaments_normalized?: string[] | null
          note?: string | null
          patient_id: string
          status?: Database["public"]["Enums"]["dawini_request_status"]
          wilaya_code: number
        }
        Update: {
          consent_at?: string
          created_at?: string
          expires_at?: string
          id?: string
          image_path?: string | null
          latitude?: number | null
          longitude?: number | null
          medicaments?: string[]
          medicaments_normalized?: string[] | null
          note?: string | null
          patient_id?: string
          status?: Database["public"]["Enums"]["dawini_request_status"]
          wilaya_code?: number
        }
        Relationships: []
      }
      dawini_responses: {
        Row: {
          commentaire: string | null
          created_at: string
          disponible: boolean
          generique: boolean
          id: string
          medicaments_dispo: string[] | null
          pharmacie_id: string
          request_id: string
          status: Database["public"]["Enums"]["dawini_response_status"]
        }
        Insert: {
          commentaire?: string | null
          created_at?: string
          disponible?: boolean
          generique?: boolean
          id?: string
          medicaments_dispo?: string[] | null
          pharmacie_id: string
          request_id: string
          status: Database["public"]["Enums"]["dawini_response_status"]
        }
        Update: {
          commentaire?: string | null
          created_at?: string
          disponible?: boolean
          generique?: boolean
          id?: string
          medicaments_dispo?: string[] | null
          pharmacie_id?: string
          request_id?: string
          status?: Database["public"]["Enums"]["dawini_response_status"]
        }
        Relationships: [
          {
            foreignKeyName: "dawini_responses_pharmacie_id_fkey"
            columns: ["pharmacie_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dawini_responses_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "dawini_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      dawini_zones: {
        Row: {
          active: boolean
          updated_at: string
          wilaya_code: number
        }
        Insert: {
          active?: boolean
          updated_at?: string
          wilaya_code: number
        }
        Update: {
          active?: boolean
          updated_at?: string
          wilaya_code?: number
        }
        Relationships: []
      }
      device_tokens: {
        Row: {
          created_at: string
          id: string
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          platform: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      doctor_profiles: {
        Row: {
          accepts_card: boolean
          accepts_cash: boolean | null
          accepts_chifa: boolean
          address: string | null
          bio: string | null
          booking_buffer_minutes: number
          city: string | null
          claimed_at: string | null
          consultation_fee_dzd: number | null
          created_at: string
          email: string | null
          entity_type: Database["public"]["Enums"]["entity_type"]
          full_name: string
          full_name_ar: string | null
          id: string
          id_card_path: string | null
          is_active: boolean
          is_claimed: boolean
          is_verified: boolean
          languages: string[]
          latitude: number | null
          legacy_id: number | null
          longitude: number | null
          name_sort_key: string | null
          ordre_card_path: string | null
          ordre_number: string | null
          ordre_submitted_at: string | null
          phone: string | null
          phone_raw: string | null
          phone_type: Database["public"]["Enums"]["phone_type"]
          photo_url: string | null
          rating: number | null
          review_count: number
          search_vector: unknown
          source: string
          specialty_id: number | null
          specialty_raw: string | null
          telehealth_enabled: boolean | null
          telehealth_fee_dzd: number | null
          updated_at: string
          user_id: string | null
          validation_approved_at: string | null
          validation_approved_by_id: string | null
          validation_docs_uploaded_at: string | null
          validation_pending_since: string | null
          validation_rejected_at: string | null
          validation_rejected_by_id: string | null
          validation_rejected_reason: string | null
          validation_status: Database["public"]["Enums"]["doctor_validation_status"]
          website: string | null
          wilaya_code: number
          working_hours: Json | null
        }
        Insert: {
          accepts_card?: boolean
          accepts_cash?: boolean | null
          accepts_chifa?: boolean
          address?: string | null
          bio?: string | null
          booking_buffer_minutes?: number
          city?: string | null
          claimed_at?: string | null
          consultation_fee_dzd?: number | null
          created_at?: string
          email?: string | null
          entity_type?: Database["public"]["Enums"]["entity_type"]
          full_name: string
          full_name_ar?: string | null
          id?: string
          id_card_path?: string | null
          is_active?: boolean
          is_claimed?: boolean
          is_verified?: boolean
          languages?: string[]
          latitude?: number | null
          legacy_id?: number | null
          longitude?: number | null
          name_sort_key?: string | null
          ordre_card_path?: string | null
          ordre_number?: string | null
          ordre_submitted_at?: string | null
          phone?: string | null
          phone_raw?: string | null
          phone_type?: Database["public"]["Enums"]["phone_type"]
          photo_url?: string | null
          rating?: number | null
          review_count?: number
          search_vector?: unknown
          source?: string
          specialty_id?: number | null
          specialty_raw?: string | null
          telehealth_enabled?: boolean | null
          telehealth_fee_dzd?: number | null
          updated_at?: string
          user_id?: string | null
          validation_approved_at?: string | null
          validation_approved_by_id?: string | null
          validation_docs_uploaded_at?: string | null
          validation_pending_since?: string | null
          validation_rejected_at?: string | null
          validation_rejected_by_id?: string | null
          validation_rejected_reason?: string | null
          validation_status?: Database["public"]["Enums"]["doctor_validation_status"]
          website?: string | null
          wilaya_code: number
          working_hours?: Json | null
        }
        Update: {
          accepts_card?: boolean
          accepts_cash?: boolean | null
          accepts_chifa?: boolean
          address?: string | null
          bio?: string | null
          booking_buffer_minutes?: number
          city?: string | null
          claimed_at?: string | null
          consultation_fee_dzd?: number | null
          created_at?: string
          email?: string | null
          entity_type?: Database["public"]["Enums"]["entity_type"]
          full_name?: string
          full_name_ar?: string | null
          id?: string
          id_card_path?: string | null
          is_active?: boolean
          is_claimed?: boolean
          is_verified?: boolean
          languages?: string[]
          latitude?: number | null
          legacy_id?: number | null
          longitude?: number | null
          name_sort_key?: string | null
          ordre_card_path?: string | null
          ordre_number?: string | null
          ordre_submitted_at?: string | null
          phone?: string | null
          phone_raw?: string | null
          phone_type?: Database["public"]["Enums"]["phone_type"]
          photo_url?: string | null
          rating?: number | null
          review_count?: number
          search_vector?: unknown
          source?: string
          specialty_id?: number | null
          specialty_raw?: string | null
          telehealth_enabled?: boolean | null
          telehealth_fee_dzd?: number | null
          updated_at?: string
          user_id?: string | null
          validation_approved_at?: string | null
          validation_approved_by_id?: string | null
          validation_docs_uploaded_at?: string | null
          validation_pending_since?: string | null
          validation_rejected_at?: string | null
          validation_rejected_by_id?: string | null
          validation_rejected_reason?: string | null
          validation_status?: Database["public"]["Enums"]["doctor_validation_status"]
          website?: string | null
          wilaya_code?: number
          working_hours?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "doctor_profiles_specialty_id_fkey"
            columns: ["specialty_id"]
            isOneToOne: false
            referencedRelation: "specialties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctor_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "doctor_patients_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctor_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctor_profiles_wilaya_code_fkey"
            columns: ["wilaya_code"]
            isOneToOne: false
            referencedRelation: "wilayas"
            referencedColumns: ["code"]
          },
        ]
      }
      doctor_schedule: {
        Row: {
          consult_type: string | null
          created_at: string
          doctor_id: string
          id: string
          notes: string | null
          slot_end: string
          slot_start: string
          status: string
          updated_at: string
        }
        Insert: {
          consult_type?: string | null
          created_at?: string
          doctor_id: string
          id?: string
          notes?: string | null
          slot_end: string
          slot_start: string
          status?: string
          updated_at?: string
        }
        Update: {
          consult_type?: string | null
          created_at?: string
          doctor_id?: string
          id?: string
          notes?: string | null
          slot_end?: string
          slot_start?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      doctor_unavailable_slots: {
        Row: {
          all_day: boolean
          created_at: string
          created_by: string | null
          doctor_id: string
          ends_at: string
          id: string
          reason: string | null
          starts_at: string
        }
        Insert: {
          all_day?: boolean
          created_at?: string
          created_by?: string | null
          doctor_id: string
          ends_at: string
          id?: string
          reason?: string | null
          starts_at: string
        }
        Update: {
          all_day?: boolean
          created_at?: string
          created_by?: string | null
          doctor_id?: string
          ends_at?: string
          id?: string
          reason?: string | null
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "doctor_unavailable_slots_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctor_unavailable_slots_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "my_reviewable_appointments"
            referencedColumns: ["doctor_id"]
          },
          {
            foreignKeyName: "doctor_unavailable_slots_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "my_upcoming_appointments"
            referencedColumns: ["doctor_id"]
          },
          {
            foreignKeyName: "doctor_unavailable_slots_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "public_doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctor_unavailable_slots_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "public_doctors_listed"
            referencedColumns: ["id"]
          },
        ]
      }
      email_log: {
        Row: {
          error_code: string | null
          error_message: string | null
          from_email: string | null
          id: number
          ip_hash: string | null
          occurred_at: string
          provider: string | null
          provider_msg_id: string | null
          status: string
          subject: string | null
          template: string | null
          to_email: string
          user_id: string | null
        }
        Insert: {
          error_code?: string | null
          error_message?: string | null
          from_email?: string | null
          id?: number
          ip_hash?: string | null
          occurred_at?: string
          provider?: string | null
          provider_msg_id?: string | null
          status?: string
          subject?: string | null
          template?: string | null
          to_email: string
          user_id?: string | null
        }
        Update: {
          error_code?: string | null
          error_message?: string | null
          from_email?: string | null
          id?: number
          ip_hash?: string | null
          occurred_at?: string
          provider?: string | null
          provider_msg_id?: string | null
          status?: string
          subject?: string | null
          template?: string | null
          to_email?: string
          user_id?: string | null
        }
        Relationships: []
      }
      favorites: {
        Row: {
          created_at: string
          doctor_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          doctor_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          doctor_id?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      medical_records: {
        Row: {
          appointment_id: string | null
          content: string | null
          created_at: string
          doctor_id: string | null
          file_mime: string | null
          file_size_bytes: number | null
          file_url: string | null
          id: string
          is_shared_with_patient: boolean
          metadata: Json | null
          occurred_at: string | null
          patient_id: string
          record_type: Database["public"]["Enums"]["record_type"]
          title: string
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          content?: string | null
          created_at?: string
          doctor_id?: string | null
          file_mime?: string | null
          file_size_bytes?: number | null
          file_url?: string | null
          id?: string
          is_shared_with_patient?: boolean
          metadata?: Json | null
          occurred_at?: string | null
          patient_id: string
          record_type: Database["public"]["Enums"]["record_type"]
          title: string
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          content?: string | null
          created_at?: string
          doctor_id?: string | null
          file_mime?: string | null
          file_size_bytes?: number | null
          file_url?: string | null
          id?: string
          is_shared_with_patient?: boolean
          metadata?: Json | null
          occurred_at?: string | null
          patient_id?: string
          record_type?: Database["public"]["Enums"]["record_type"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "medical_records_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_records_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "cabinet_calendar_view"
            referencedColumns: ["appointment_id"]
          },
          {
            foreignKeyName: "medical_records_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "my_reviewable_appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_records_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "my_upcoming_appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_records_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_records_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "my_reviewable_appointments"
            referencedColumns: ["doctor_id"]
          },
          {
            foreignKeyName: "medical_records_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "my_upcoming_appointments"
            referencedColumns: ["doctor_id"]
          },
          {
            foreignKeyName: "medical_records_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "public_doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_records_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "public_doctors_listed"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_records_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "doctor_patients_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_records_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      medication_alerts: {
        Row: {
          created_at: string
          id: string
          medication: string
          medication_normalized: string
          notified_at: string | null
          patient_id: string
          status: string
          wilaya_code: number
        }
        Insert: {
          created_at?: string
          id?: string
          medication: string
          medication_normalized: string
          notified_at?: string | null
          patient_id: string
          status?: string
          wilaya_code: number
        }
        Update: {
          created_at?: string
          id?: string
          medication?: string
          medication_normalized?: string
          notified_at?: string | null
          patient_id?: string
          status?: string
          wilaya_code?: number
        }
        Relationships: []
      }
      messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          id: string
          read_at: string | null
          sender_id: string
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id: string
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          data: Json | null
          id: string
          message: string | null
          read_at: string | null
          title: string | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: Json | null
          id?: string
          message?: string | null
          read_at?: string | null
          title?: string | null
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json | null
          id?: string
          message?: string | null
          read_at?: string | null
          title?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      patient_medical_data: {
        Row: {
          allergies: string | null
          blood_type: string | null
          chifa_card_enc: string | null
          created_at: string
          current_medications: string | null
          drinker: boolean | null
          emergency_name: string | null
          emergency_phone: string | null
          emergency_relation: string | null
          family_history: string | null
          height_cm: number | null
          insurance: string | null
          matricule_enc: string | null
          medical_history: string | null
          mutual: string | null
          patient_id: string
          smoker: boolean | null
          updated_at: string
          vaccinations: string | null
          weight_kg: number | null
        }
        Insert: {
          allergies?: string | null
          blood_type?: string | null
          chifa_card_enc?: string | null
          created_at?: string
          current_medications?: string | null
          drinker?: boolean | null
          emergency_name?: string | null
          emergency_phone?: string | null
          emergency_relation?: string | null
          family_history?: string | null
          height_cm?: number | null
          insurance?: string | null
          matricule_enc?: string | null
          medical_history?: string | null
          mutual?: string | null
          patient_id: string
          smoker?: boolean | null
          updated_at?: string
          vaccinations?: string | null
          weight_kg?: number | null
        }
        Update: {
          allergies?: string | null
          blood_type?: string | null
          chifa_card_enc?: string | null
          created_at?: string
          current_medications?: string | null
          drinker?: boolean | null
          emergency_name?: string | null
          emergency_phone?: string | null
          emergency_relation?: string | null
          family_history?: string | null
          height_cm?: number | null
          insurance?: string | null
          matricule_enc?: string | null
          medical_history?: string | null
          mutual?: string | null
          patient_id?: string
          smoker?: boolean | null
          updated_at?: string
          vaccinations?: string | null
          weight_kg?: number | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount_dzd: number
          appointment_id: string | null
          created_at: string
          doctor_id: string
          id: string
          metadata: Json | null
          method: Database["public"]["Enums"]["payment_method"]
          paid_at: string | null
          patient_id: string
          refund_amount_dzd: number | null
          refunded_at: string | null
          status: Database["public"]["Enums"]["payment_status"]
          transaction_ref: string | null
          updated_at: string
        }
        Insert: {
          amount_dzd: number
          appointment_id?: string | null
          created_at?: string
          doctor_id: string
          id?: string
          metadata?: Json | null
          method: Database["public"]["Enums"]["payment_method"]
          paid_at?: string | null
          patient_id: string
          refund_amount_dzd?: number | null
          refunded_at?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          transaction_ref?: string | null
          updated_at?: string
        }
        Update: {
          amount_dzd?: number
          appointment_id?: string | null
          created_at?: string
          doctor_id?: string
          id?: string
          metadata?: Json | null
          method?: Database["public"]["Enums"]["payment_method"]
          paid_at?: string | null
          patient_id?: string
          refund_amount_dzd?: number | null
          refunded_at?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          transaction_ref?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "cabinet_calendar_view"
            referencedColumns: ["appointment_id"]
          },
          {
            foreignKeyName: "payments_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "my_reviewable_appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "my_upcoming_appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "my_reviewable_appointments"
            referencedColumns: ["doctor_id"]
          },
          {
            foreignKeyName: "payments_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "my_upcoming_appointments"
            referencedColumns: ["doctor_id"]
          },
          {
            foreignKeyName: "payments_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "public_doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "public_doctors_listed"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "doctor_patients_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      pharmacies: {
        Row: {
          adresse: string | null
          commune: string | null
          created_at: string
          horaires: Json | null
          id: string
          is_active: boolean
          is_partner: boolean
          latitude: number | null
          longitude: number | null
          nom: string
          telephone: string | null
          updated_at: string
          user_id: string | null
          wilaya_code: number
        }
        Insert: {
          adresse?: string | null
          commune?: string | null
          created_at?: string
          horaires?: Json | null
          id?: string
          is_active?: boolean
          is_partner?: boolean
          latitude?: number | null
          longitude?: number | null
          nom: string
          telephone?: string | null
          updated_at?: string
          user_id?: string | null
          wilaya_code: number
        }
        Update: {
          adresse?: string | null
          commune?: string | null
          created_at?: string
          horaires?: Json | null
          id?: string
          is_active?: boolean
          is_partner?: boolean
          latitude?: number | null
          longitude?: number | null
          nom?: string
          telephone?: string | null
          updated_at?: string
          user_id?: string | null
          wilaya_code?: number
        }
        Relationships: []
      }
      prescription_seq_year: {
        Row: {
          id: number
          year: number
        }
        Insert: {
          id?: number
          year: number
        }
        Update: {
          id?: number
          year?: number
        }
        Relationships: []
      }
      prescriptions: {
        Row: {
          appointment_id: string | null
          cabinet_id: string | null
          cancelled_at: string | null
          cancelled_by_user_id: string | null
          cancelled_reason: string | null
          clinical_notes: string | null
          created_at: string
          delivered_at: string | null
          delivery_channels: string[]
          diagnosis: string | null
          doctor_id: string
          doctor_signature_hmac: string | null
          expiry_date: string | null
          id: string
          issue_date: string
          medications: Json
          patient_id: string
          pdf_sha256: string | null
          pdf_size_bytes: number | null
          pdf_storage_path: string | null
          prescription_number: string
          status: string
          updated_at: string
          validity_days: number
        }
        Insert: {
          appointment_id?: string | null
          cabinet_id?: string | null
          cancelled_at?: string | null
          cancelled_by_user_id?: string | null
          cancelled_reason?: string | null
          clinical_notes?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_channels?: string[]
          diagnosis?: string | null
          doctor_id: string
          doctor_signature_hmac?: string | null
          expiry_date?: string | null
          id?: string
          issue_date?: string
          medications?: Json
          patient_id: string
          pdf_sha256?: string | null
          pdf_size_bytes?: number | null
          pdf_storage_path?: string | null
          prescription_number: string
          status?: string
          updated_at?: string
          validity_days?: number
        }
        Update: {
          appointment_id?: string | null
          cabinet_id?: string | null
          cancelled_at?: string | null
          cancelled_by_user_id?: string | null
          cancelled_reason?: string | null
          clinical_notes?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_channels?: string[]
          diagnosis?: string | null
          doctor_id?: string
          doctor_signature_hmac?: string | null
          expiry_date?: string | null
          id?: string
          issue_date?: string
          medications?: Json
          patient_id?: string
          pdf_sha256?: string | null
          pdf_size_bytes?: number | null
          pdf_storage_path?: string | null
          prescription_number?: string
          status?: string
          updated_at?: string
          validity_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "prescriptions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "cabinet_calendar_view"
            referencedColumns: ["appointment_id"]
          },
          {
            foreignKeyName: "prescriptions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "my_reviewable_appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "my_upcoming_appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          attempts: number
          blocked_until: string | null
          key: string
          updated_at: string
          window_start: string
        }
        Insert: {
          attempts?: number
          blocked_until?: string | null
          key: string
          updated_at?: string
          window_start?: string
        }
        Update: {
          attempts?: number
          blocked_until?: string | null
          key?: string
          updated_at?: string
          window_start?: string
        }
        Relationships: []
      }
      review_reports: {
        Row: {
          created_at: string
          details: string | null
          id: string
          reason: string
          reporter_id: string
          review_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          reason: string
          reporter_id: string
          review_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          reason?: string
          reporter_id?: string
          review_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_reports_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "doctor_reviews_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_reports_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          appointment_id: string | null
          comment: string | null
          created_at: string
          doctor_id: string
          id: string
          is_verified: boolean
          language: string
          last_reported_at: string | null
          moderated_at: string | null
          moderated_by: string | null
          patient_id: string
          rating_expertise: number | null
          rating_listening: number | null
          rating_overall: number
          rating_punctuality: number | null
          rejection_reason: string | null
          report_count: number
          status: string
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          comment?: string | null
          created_at?: string
          doctor_id: string
          id?: string
          is_verified?: boolean
          language?: string
          last_reported_at?: string | null
          moderated_at?: string | null
          moderated_by?: string | null
          patient_id: string
          rating_expertise?: number | null
          rating_listening?: number | null
          rating_overall: number
          rating_punctuality?: number | null
          rejection_reason?: string | null
          report_count?: number
          status?: string
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          comment?: string | null
          created_at?: string
          doctor_id?: string
          id?: string
          is_verified?: boolean
          language?: string
          last_reported_at?: string | null
          moderated_at?: string | null
          moderated_by?: string | null
          patient_id?: string
          rating_expertise?: number | null
          rating_listening?: number | null
          rating_overall?: number
          rating_punctuality?: number | null
          rejection_reason?: string | null
          report_count?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      sms_log: {
        Row: {
          body: string
          cost_micros: number | null
          error_code: string | null
          error_message: string | null
          id: number
          ip_hash: string | null
          occurred_at: string
          phone_e164: string
          provider: string | null
          provider_msg_id: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          body: string
          cost_micros?: number | null
          error_code?: string | null
          error_message?: string | null
          id?: number
          ip_hash?: string | null
          occurred_at?: string
          phone_e164: string
          provider?: string | null
          provider_msg_id?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          body?: string
          cost_micros?: number | null
          error_code?: string | null
          error_message?: string | null
          id?: number
          ip_hash?: string | null
          occurred_at?: string
          phone_e164?: string
          provider?: string | null
          provider_msg_id?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      specialties: {
        Row: {
          created_at: string | null
          display_order: number | null
          id: number
          is_active: boolean
          name_ar: string
          name_en: string | null
          name_fr: string
          slug: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          display_order?: number | null
          id?: number
          is_active?: boolean
          name_ar: string
          name_en?: string | null
          name_fr: string
          slug: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          display_order?: number | null
          id?: number
          is_active?: boolean
          name_ar?: string
          name_en?: string | null
          name_fr?: string
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      two_factor_secrets: {
        Row: {
          algo: string
          created_at: string
          disabled_at: string | null
          enabled: boolean
          enabled_at: string | null
          failed_attempts: number
          last_used_at: string | null
          locked_until: string | null
          recovery_codes_hashes: string[] | null
          secret_hash: string
          updated_at: string
          user_id: string
        }
        Insert: {
          algo?: string
          created_at?: string
          disabled_at?: string | null
          enabled?: boolean
          enabled_at?: string | null
          failed_attempts?: number
          last_used_at?: string | null
          locked_until?: string | null
          recovery_codes_hashes?: string[] | null
          secret_hash: string
          updated_at?: string
          user_id: string
        }
        Update: {
          algo?: string
          created_at?: string
          disabled_at?: string | null
          enabled?: boolean
          enabled_at?: string | null
          failed_attempts?: number
          last_used_at?: string | null
          locked_until?: string | null
          recovery_codes_hashes?: string[] | null
          secret_hash?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          address: string | null
          allergies_enc: string | null
          antecedents_enc: string | null
          claimed_at: string | null
          consent_health_data_at: string | null
          consent_marketing_at: string | null
          consent_privacy_at: string | null
          consent_terms_at: string | null
          created_at: string
          current_cabinet_id: string | null
          date_of_birth: string | null
          deleted_at: string | null
          email: string | null
          first_name: string | null
          full_name: string | null
          id: string
          is_active: boolean | null
          is_claimed: boolean
          is_super_admin: boolean
          is_test: boolean | null
          is_verified: boolean | null
          last_app_open_at: string | null
          last_name: string | null
          legacy_id: number | null
          locale: Database["public"]["Enums"]["user_locale"]
          notifications_marketing: boolean
          notifications_push: boolean
          notifications_whatsapp: boolean
          phone: string | null
          photo_url: string | null
          push_tokens: Json
          role: Database["public"]["Enums"]["user_role"]
          sex: Database["public"]["Enums"]["user_sex"] | null
          specialty_ar: string | null
          specialty_en: string | null
          specialty_fr: string | null
          specialty_slug: string | null
          status: string | null
          totp_backup_codes: string[] | null
          totp_enabled: boolean | null
          totp_enabled_at: string | null
          totp_secret: string | null
          updated_at: string
          verified_at: string | null
          wilaya_code: number | null
          wilaya_fr: string | null
        }
        Insert: {
          address?: string | null
          allergies_enc?: string | null
          antecedents_enc?: string | null
          claimed_at?: string | null
          consent_health_data_at?: string | null
          consent_marketing_at?: string | null
          consent_privacy_at?: string | null
          consent_terms_at?: string | null
          created_at?: string
          current_cabinet_id?: string | null
          date_of_birth?: string | null
          deleted_at?: string | null
          email?: string | null
          first_name?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean | null
          is_claimed?: boolean
          is_super_admin?: boolean
          is_test?: boolean | null
          is_verified?: boolean | null
          last_app_open_at?: string | null
          last_name?: string | null
          legacy_id?: number | null
          locale?: Database["public"]["Enums"]["user_locale"]
          notifications_marketing?: boolean
          notifications_push?: boolean
          notifications_whatsapp?: boolean
          phone?: string | null
          photo_url?: string | null
          push_tokens?: Json
          role?: Database["public"]["Enums"]["user_role"]
          sex?: Database["public"]["Enums"]["user_sex"] | null
          specialty_ar?: string | null
          specialty_en?: string | null
          specialty_fr?: string | null
          specialty_slug?: string | null
          status?: string | null
          totp_backup_codes?: string[] | null
          totp_enabled?: boolean | null
          totp_enabled_at?: string | null
          totp_secret?: string | null
          updated_at?: string
          verified_at?: string | null
          wilaya_code?: number | null
          wilaya_fr?: string | null
        }
        Update: {
          address?: string | null
          allergies_enc?: string | null
          antecedents_enc?: string | null
          claimed_at?: string | null
          consent_health_data_at?: string | null
          consent_marketing_at?: string | null
          consent_privacy_at?: string | null
          consent_terms_at?: string | null
          created_at?: string
          current_cabinet_id?: string | null
          date_of_birth?: string | null
          deleted_at?: string | null
          email?: string | null
          first_name?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean | null
          is_claimed?: boolean
          is_super_admin?: boolean
          is_test?: boolean | null
          is_verified?: boolean | null
          last_app_open_at?: string | null
          last_name?: string | null
          legacy_id?: number | null
          locale?: Database["public"]["Enums"]["user_locale"]
          notifications_marketing?: boolean
          notifications_push?: boolean
          notifications_whatsapp?: boolean
          phone?: string | null
          photo_url?: string | null
          push_tokens?: Json
          role?: Database["public"]["Enums"]["user_role"]
          sex?: Database["public"]["Enums"]["user_sex"] | null
          specialty_ar?: string | null
          specialty_en?: string | null
          specialty_fr?: string | null
          specialty_slug?: string | null
          status?: string | null
          totp_backup_codes?: string[] | null
          totp_enabled?: boolean | null
          totp_enabled_at?: string | null
          totp_secret?: string | null
          updated_at?: string
          verified_at?: string | null
          wilaya_code?: number | null
          wilaya_fr?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_current_cabinet_id_fkey"
            columns: ["current_cabinet_id"]
            isOneToOne: false
            referencedRelation: "cabinet_stats_view"
            referencedColumns: ["cabinet_id"]
          },
          {
            foreignKeyName: "users_current_cabinet_id_fkey"
            columns: ["current_cabinet_id"]
            isOneToOne: false
            referencedRelation: "cabinets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_wilaya_code_fkey"
            columns: ["wilaya_code"]
            isOneToOne: false
            referencedRelation: "wilayas"
            referencedColumns: ["code"]
          },
        ]
      }
      video_sessions: {
        Row: {
          appointment_id: string
          consent_patient_recording: boolean
          consent_patient_recording_at: string | null
          created_at: string
          daily_room_name: string
          daily_room_url: string
          doctor_joined: boolean
          doctor_token: string | null
          duration_seconds: number | null
          ended_at: string | null
          id: string
          patient_joined: boolean
          patient_token: string | null
          recording_enabled: boolean
          recording_url: string | null
          scheduled_at: string
          started_at: string | null
          status: string
          tokens_expire_at: string | null
          updated_at: string
        }
        Insert: {
          appointment_id: string
          consent_patient_recording?: boolean
          consent_patient_recording_at?: string | null
          created_at?: string
          daily_room_name: string
          daily_room_url: string
          doctor_joined?: boolean
          doctor_token?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          patient_joined?: boolean
          patient_token?: string | null
          recording_enabled?: boolean
          recording_url?: string | null
          scheduled_at: string
          started_at?: string | null
          status?: string
          tokens_expire_at?: string | null
          updated_at?: string
        }
        Update: {
          appointment_id?: string
          consent_patient_recording?: boolean
          consent_patient_recording_at?: string | null
          created_at?: string
          daily_room_name?: string
          daily_room_url?: string
          doctor_joined?: boolean
          doctor_token?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          patient_joined?: boolean
          patient_token?: string | null
          recording_enabled?: boolean
          recording_url?: string | null
          scheduled_at?: string
          started_at?: string | null
          status?: string
          tokens_expire_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_sessions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: true
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_sessions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: true
            referencedRelation: "cabinet_calendar_view"
            referencedColumns: ["appointment_id"]
          },
          {
            foreignKeyName: "video_sessions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: true
            referencedRelation: "my_reviewable_appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_sessions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: true
            referencedRelation: "my_upcoming_appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      waiting_list: {
        Row: {
          consent_marketing: boolean
          converted_at: string | null
          created_at: string
          email: string
          id: string
          ip_hash: string | null
          lang: string | null
          notified_at: string | null
          phone: string | null
          role: string
          source: string
          specialite: string | null
          user_agent: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
          wilaya: string | null
        }
        Insert: {
          consent_marketing?: boolean
          converted_at?: string | null
          created_at?: string
          email: string
          id?: string
          ip_hash?: string | null
          lang?: string | null
          notified_at?: string | null
          phone?: string | null
          role: string
          source?: string
          specialite?: string | null
          user_agent?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          wilaya?: string | null
        }
        Update: {
          consent_marketing?: boolean
          converted_at?: string | null
          created_at?: string
          email?: string
          id?: string
          ip_hash?: string | null
          lang?: string | null
          notified_at?: string | null
          phone?: string | null
          role?: string
          source?: string
          specialite?: string | null
          user_agent?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          wilaya?: string | null
        }
        Relationships: []
      }
      wilayas: {
        Row: {
          code: number
          created_at: string | null
          is_active: boolean | null
          name_ar: string
          name_en: string | null
          name_fr: string
          slug: string | null
          updated_at: string | null
        }
        Insert: {
          code: number
          created_at?: string | null
          is_active?: boolean | null
          name_ar: string
          name_en?: string | null
          name_fr: string
          slug?: string | null
          updated_at?: string | null
        }
        Update: {
          code?: number
          created_at?: string | null
          is_active?: boolean | null
          name_ar?: string
          name_en?: string | null
          name_fr?: string
          slug?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      api_keys_analytics: {
        Row: {
          active: boolean | null
          avg_latency_ms_24h: number | null
          calls_last_24h: number | null
          calls_last_7d: number | null
          environment: string | null
          errors_last_24h: number | null
          expires_at: string | null
          id: string | null
          key_id: string | null
          last_used_at: string | null
          partner_email: string | null
          partner_name: string | null
          rate_limit_per_day: number | null
          rate_limit_per_minute: number | null
          scopes: string[] | null
          top_endpoint: string | null
          total_calls: number | null
        }
        Relationships: []
      }
      cabinet_calendar_view: {
        Row: {
          appointment_id: string | null
          cabinet_id: string | null
          consult_type: string | null
          created_at: string | null
          doctor_first_name: string | null
          doctor_id: string | null
          doctor_last_name: string | null
          doctor_specialty: string | null
          duration_minutes: number | null
          patient_first_name: string | null
          patient_id: string | null
          patient_last_name: string | null
          patient_phone: string | null
          reason_short: string | null
          scheduled_at: string | null
          status: Database["public"]["Enums"]["appointment_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "cabinet_stats_view"
            referencedColumns: ["cabinet_id"]
          },
          {
            foreignKeyName: "appointments_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "cabinets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "my_reviewable_appointments"
            referencedColumns: ["doctor_id"]
          },
          {
            foreignKeyName: "appointments_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "my_upcoming_appointments"
            referencedColumns: ["doctor_id"]
          },
          {
            foreignKeyName: "appointments_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "public_doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "public_doctors_listed"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "doctor_patients_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      cabinet_members_directory_view: {
        Row: {
          accepted: boolean | null
          active: boolean | null
          cabinet_id: string | null
          created_at: string | null
          first_name: string | null
          full_name: string | null
          last_name: string | null
          membership_id: string | null
          role: string | null
          specialty_fr: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cabinet_members_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "cabinet_stats_view"
            referencedColumns: ["cabinet_id"]
          },
          {
            foreignKeyName: "cabinet_members_cabinet_id_fkey"
            columns: ["cabinet_id"]
            isOneToOne: false
            referencedRelation: "cabinets"
            referencedColumns: ["id"]
          },
        ]
      }
      cabinet_stats_view: {
        Row: {
          appointments_this_month: number | null
          cabinet_id: string | null
          cabinet_name: string | null
          completed_this_month: number | null
          doctors_count: number | null
          members_count: number | null
          mrr_da: number | null
          no_show_this_month: number | null
          revenue_this_month_da: number | null
          secretaires_count: number | null
          subscription_active: boolean | null
          subscription_expires_at: string | null
          subscription_tier: string | null
        }
        Insert: {
          appointments_this_month?: never
          cabinet_id?: string | null
          cabinet_name?: string | null
          completed_this_month?: never
          doctors_count?: never
          members_count?: never
          mrr_da?: number | null
          no_show_this_month?: never
          revenue_this_month_da?: never
          secretaires_count?: never
          subscription_active?: boolean | null
          subscription_expires_at?: string | null
          subscription_tier?: string | null
        }
        Update: {
          appointments_this_month?: never
          cabinet_id?: string | null
          cabinet_name?: string | null
          completed_this_month?: never
          doctors_count?: never
          members_count?: never
          mrr_da?: number | null
          no_show_this_month?: never
          revenue_this_month_da?: never
          secretaires_count?: never
          subscription_active?: boolean | null
          subscription_expires_at?: string | null
          subscription_tier?: string | null
        }
        Relationships: []
      }
      doctor_patients_directory: {
        Row: {
          first_name: string | null
          id: string | null
          last_name: string | null
          phone: string | null
        }
        Relationships: []
      }
      doctor_ratings_summary: {
        Row: {
          avg_expertise: number | null
          avg_listening: number | null
          avg_overall: number | null
          avg_punctuality: number | null
          count_1: number | null
          count_2: number | null
          count_3: number | null
          count_4: number | null
          count_5: number | null
          doctor_id: string | null
          total_reviews: number | null
        }
        Relationships: []
      }
      doctor_reviews_public: {
        Row: {
          comment: string | null
          created_at: string | null
          doctor_id: string | null
          id: string | null
          is_verified: boolean | null
          language: string | null
          patient_display_name: string | null
          rating_expertise: number | null
          rating_listening: number | null
          rating_overall: number | null
          rating_punctuality: number | null
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          doctor_id?: string | null
          id?: string | null
          is_verified?: boolean | null
          language?: string | null
          patient_display_name?: never
          rating_expertise?: number | null
          rating_listening?: number | null
          rating_overall?: number | null
          rating_punctuality?: number | null
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          doctor_id?: string | null
          id?: string | null
          is_verified?: boolean | null
          language?: string | null
          patient_display_name?: never
          rating_expertise?: number | null
          rating_listening?: number | null
          rating_overall?: number | null
          rating_punctuality?: number | null
        }
        Relationships: []
      }
      my_reviewable_appointments: {
        Row: {
          doctor_id: string | null
          doctor_name: string | null
          id: string | null
          scheduled_at: string | null
          short_id: string | null
          specialty_fr: string | null
          status: Database["public"]["Enums"]["appointment_status"] | null
          wilaya_fr: string | null
        }
        Relationships: []
      }
      my_two_factor_status: {
        Row: {
          algo: string | null
          created_at: string | null
          disabled_at: string | null
          enabled: boolean | null
          enabled_at: string | null
          is_locked: boolean | null
          last_used_at: string | null
          recovery_codes_remaining: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          algo?: string | null
          created_at?: string | null
          disabled_at?: string | null
          enabled?: boolean | null
          enabled_at?: string | null
          is_locked?: never
          last_used_at?: string | null
          recovery_codes_remaining?: never
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          algo?: string | null
          created_at?: string | null
          disabled_at?: string | null
          enabled?: boolean | null
          enabled_at?: string | null
          is_locked?: never
          last_used_at?: string | null
          recovery_codes_remaining?: never
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      my_upcoming_appointments: {
        Row: {
          doctor_address: string | null
          doctor_id: string | null
          doctor_name: string | null
          doctor_phone: string | null
          duration_minutes: number | null
          id: string | null
          reason: string | null
          scheduled_at: string | null
          short_id: string | null
          specialty_fr: string | null
          status: Database["public"]["Enums"]["appointment_status"] | null
          wilaya_fr: string | null
        }
        Relationships: []
      }
      my_video_sessions: {
        Row: {
          appointment_id: string | null
          consent_patient_recording: boolean | null
          doctor_id: string | null
          doctor_joined: boolean | null
          doctor_specialty_fr: string | null
          duration_minutes: number | null
          duration_seconds: number | null
          ended_at: string | null
          my_role: string | null
          other_first_name: string | null
          other_last_name: string | null
          patient_id: string | null
          patient_joined: boolean | null
          reason: string | null
          recording_enabled: boolean | null
          scheduled_at: string | null
          session_id: string | null
          started_at: string | null
          status: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "my_reviewable_appointments"
            referencedColumns: ["doctor_id"]
          },
          {
            foreignKeyName: "appointments_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "my_upcoming_appointments"
            referencedColumns: ["doctor_id"]
          },
          {
            foreignKeyName: "appointments_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "public_doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "public_doctors_listed"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "doctor_patients_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_sessions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: true
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_sessions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: true
            referencedRelation: "cabinet_calendar_view"
            referencedColumns: ["appointment_id"]
          },
          {
            foreignKeyName: "video_sessions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: true
            referencedRelation: "my_reviewable_appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_sessions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: true
            referencedRelation: "my_upcoming_appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      public_doctors: {
        Row: {
          accepts_card: boolean | null
          accepts_cash: boolean | null
          accepts_chifa: boolean | null
          address: string | null
          bio: string | null
          city: string | null
          claimed_at: string | null
          consultation_fee_dzd: number | null
          created_at: string | null
          entity_type: string | null
          full_name: string | null
          full_name_ar: string | null
          id: string | null
          is_claimed: boolean | null
          is_verified: boolean | null
          languages: string[] | null
          latitude: number | null
          legacy_id: number | null
          longitude: number | null
          name_sort_key: string | null
          photo_url: string | null
          rating: number | null
          review_count: number | null
          show_claim_badge: boolean | null
          specialty_ar: string | null
          specialty_en: string | null
          specialty_fr: string | null
          specialty_slug: string | null
          status: string | null
          telehealth_enabled: boolean | null
          telehealth_fee_dzd: number | null
          validation_status:
            | Database["public"]["Enums"]["doctor_validation_status"]
            | null
          wilaya_code: number | null
          wilaya_fr: string | null
          working_hours: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "doctor_profiles_wilaya_code_fkey"
            columns: ["wilaya_code"]
            isOneToOne: false
            referencedRelation: "wilayas"
            referencedColumns: ["code"]
          },
        ]
      }
      public_doctors_listed: {
        Row: {
          accepts_card: boolean | null
          accepts_cash: boolean | null
          accepts_chifa: boolean | null
          address: string | null
          bio: string | null
          city: string | null
          claimed_at: string | null
          consultation_fee_dzd: number | null
          created_at: string | null
          entity_type: string | null
          full_name: string | null
          full_name_ar: string | null
          id: string | null
          is_claimed: boolean | null
          is_verified: boolean | null
          languages: string[] | null
          latitude: number | null
          legacy_id: number | null
          longitude: number | null
          photo_url: string | null
          rating: number | null
          review_count: number | null
          show_claim_badge: boolean | null
          specialty_ar: string | null
          specialty_en: string | null
          specialty_fr: string | null
          specialty_slug: string | null
          status: string | null
          telehealth_enabled: boolean | null
          telehealth_fee_dzd: number | null
          validation_status:
            | Database["public"]["Enums"]["doctor_validation_status"]
            | null
          wilaya_code: number | null
          wilaya_fr: string | null
          working_hours: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "doctor_profiles_wilaya_code_fkey"
            columns: ["wilaya_code"]
            isOneToOne: false
            referencedRelation: "wilayas"
            referencedColumns: ["code"]
          },
        ]
      }
      waiting_list_stats: {
        Row: {
          consented_marketing: number | null
          last_24h: number | null
          last_7d: number | null
          role: string | null
          total: number | null
          wilaya: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _api_is_admin_safe: { Args: never; Returns: boolean }
      _api_valid_scopes: { Args: never; Returns: string[] }
      accept_cabinet_invitation: {
        Args: { p_cabinet_id: string }
        Returns: Json
      }
      admin_doctor_doc_paths: {
        Args: { p_doctor_id: string }
        Returns: {
          id_card_path: string
          ordre_card_path: string
        }[]
      }
      admin_validate_doctor: {
        Args: { p_action: string; p_doctor_id: string; p_notes?: string }
        Returns: Json
      }
      admin_validation_counts: {
        Args: never
        Returns: {
          approved: number
          pending: number
          rejected: number
        }[]
      }
      admin_validation_list: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_search?: string
          p_tab?: string
          p_wilaya?: string
        }
        Returns: {
          accepts_card: boolean
          accepts_cash: boolean | null
          accepts_chifa: boolean
          address: string | null
          bio: string | null
          booking_buffer_minutes: number
          city: string | null
          claimed_at: string | null
          consultation_fee_dzd: number | null
          created_at: string
          email: string | null
          entity_type: Database["public"]["Enums"]["entity_type"]
          full_name: string
          full_name_ar: string | null
          id: string
          id_card_path: string | null
          is_active: boolean
          is_claimed: boolean
          is_verified: boolean
          languages: string[]
          latitude: number | null
          legacy_id: number | null
          longitude: number | null
          name_sort_key: string | null
          ordre_card_path: string | null
          ordre_number: string | null
          ordre_submitted_at: string | null
          phone: string | null
          phone_raw: string | null
          phone_type: Database["public"]["Enums"]["phone_type"]
          photo_url: string | null
          rating: number | null
          review_count: number
          search_vector: unknown
          source: string
          specialty_id: number | null
          specialty_raw: string | null
          telehealth_enabled: boolean | null
          telehealth_fee_dzd: number | null
          updated_at: string
          user_id: string | null
          validation_approved_at: string | null
          validation_approved_by_id: string | null
          validation_docs_uploaded_at: string | null
          validation_pending_since: string | null
          validation_rejected_at: string | null
          validation_rejected_by_id: string | null
          validation_rejected_reason: string | null
          validation_status: Database["public"]["Enums"]["doctor_validation_status"]
          website: string | null
          wilaya_code: number
          working_hours: Json | null
        }[]
        SetofOptions: {
          from: "*"
          to: "doctor_profiles"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_validation_total: {
        Args: { p_search?: string; p_tab?: string; p_wilaya?: string }
        Returns: number
      }
      api_usage_log_ensure_partition: {
        Args: { p_day: string }
        Returns: undefined
      }
      can_review_doctor: { Args: { p_doctor_id: string }; Returns: Json }
      check_api_rate_limit: {
        Args: { p_api_key_id: string; p_window?: string }
        Returns: Json
      }
      check_doctor_account_exists: {
        Args: { p_legacy_id: number }
        Returns: boolean
      }
      claim_my_doctor_profile:
        | { Args: never; Returns: boolean }
        | { Args: { legacy_id_input: number }; Returns: Json }
      create_cabinet: {
        Args: {
          p_address?: string
          p_commune?: string
          p_email?: string
          p_legal_form?: string
          p_name: string
          p_nif?: string
          p_phone?: string
          p_rc_number?: string
          p_subscription_tier?: string
          p_wilaya?: string
        }
        Returns: Json
      }
      create_video_session: {
        Args: { p_appointment_id: string }
        Returns: Json
      }
      current_doctor_profile_id: { Args: never; Returns: string }
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      dawini_can_view_object: { Args: { p_name: string }; Returns: boolean }
      dawini_cancel_alert: { Args: { p_alert_id: string }; Returns: boolean }
      dawini_create_alert: {
        Args: { p_medication: string; p_wilaya: number }
        Returns: string
      }
      dawini_create_request: {
        Args: {
          p_image_path?: string
          p_lat?: number
          p_lng?: number
          p_medicaments: string[]
          p_note?: string
          p_wilaya: number
        }
        Returns: string
      }
      dawini_expire_old: { Args: never; Returns: undefined }
      dawini_get_patient_contact: {
        Args: { p_request_id: string }
        Returns: {
          patient_nom: string
          patient_tel: string
        }[]
      }
      dawini_my_pharmacy_id: { Args: never; Returns: string }
      dawini_my_pharmacy_wilaya: { Args: never; Returns: number }
      dawini_norm_arr: { Args: { a: string[] }; Returns: string[] }
      dawini_norm_text: { Args: { t: string }; Returns: string }
      dawini_pharmacy_stats: {
        Args: never
        Returns: {
          mine_accepted: number
          mine_refused: number
          zone_total: number
        }[]
      }
      dawini_respond: {
        Args: {
          p_commentaire?: string
          p_disponible?: boolean
          p_generique?: boolean
          p_meds_dispo?: string[]
          p_request_id: string
          p_status: string
        }
        Returns: string
      }
      dawini_shortage_by_wilaya: {
        Args: { p_days?: number }
        Returns: {
          demandes: number
          sans_dispo: number
          taux: number
          wilaya_code: number
        }[]
      }
      dawini_top_missing: {
        Args: { p_days?: number; p_wilaya?: number }
        Returns: {
          demandes: number
          medication: string
          wilayas_touchees: number
        }[]
      }
      dawini_zone_active: { Args: { p_wilaya: number }; Returns: boolean }
      disable_two_factor: { Args: never; Returns: Json }
      doctor_set_ordre_number: { Args: { p_ordre: string }; Returns: string }
      enroll_two_factor: {
        Args: { p_recovery_codes: string[]; p_secret_b32: string }
        Returns: Json
      }
      ensure_conversation: { Args: { p_doctor_id: string }; Returns: string }
      fn_check_rate_limit: {
        Args: {
          p_key: string
          p_max_attempts: number
          p_window_seconds: number
        }
        Returns: Json
      }
      fn_cleanup_old_logs: { Args: never; Returns: undefined }
      generate_api_key_pair: {
        Args: { p_environment?: string }
        Returns: {
          key_id: string
          secret_hash: string
          secret_plain: string
        }[]
      }
      get_available_slots: {
        Args: {
          p_date: string
          p_doctor_id: string
          p_slot_duration_min?: number
        }
        Returns: {
          slot_end: string
          slot_start: string
        }[]
      }
      get_my_cabinets: {
        Args: never
        Returns: {
          cabinet_id: string
          is_active: boolean
          joined_at: string
          member_count: number
          name: string
          role: string
          subscription_tier: string
        }[]
      }
      get_my_doctor_profile: {
        Args: never
        Returns: {
          accepts_card: boolean
          accepts_cash: boolean | null
          accepts_chifa: boolean
          address: string | null
          bio: string | null
          booking_buffer_minutes: number
          city: string | null
          claimed_at: string | null
          consultation_fee_dzd: number | null
          created_at: string
          email: string | null
          entity_type: Database["public"]["Enums"]["entity_type"]
          full_name: string
          full_name_ar: string | null
          id: string
          id_card_path: string | null
          is_active: boolean
          is_claimed: boolean
          is_verified: boolean
          languages: string[]
          latitude: number | null
          legacy_id: number | null
          longitude: number | null
          name_sort_key: string | null
          ordre_card_path: string | null
          ordre_number: string | null
          ordre_submitted_at: string | null
          phone: string | null
          phone_raw: string | null
          phone_type: Database["public"]["Enums"]["phone_type"]
          photo_url: string | null
          rating: number | null
          review_count: number
          search_vector: unknown
          source: string
          specialty_id: number | null
          specialty_raw: string | null
          telehealth_enabled: boolean | null
          telehealth_fee_dzd: number | null
          updated_at: string
          user_id: string | null
          validation_approved_at: string | null
          validation_approved_by_id: string | null
          validation_docs_uploaded_at: string | null
          validation_pending_since: string | null
          validation_rejected_at: string | null
          validation_rejected_by_id: string | null
          validation_rejected_reason: string | null
          validation_status: Database["public"]["Enums"]["doctor_validation_status"]
          website: string | null
          wilaya_code: number
          working_hours: Json | null
        }
        SetofOptions: {
          from: "*"
          to: "doctor_profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_patient_medical_data: {
        Args: never
        Returns: {
          allergies: string
          blood_type: string
          chifa_card: string
          current_medications: string
          drinker: boolean
          emergency_name: string
          emergency_phone: string
          emergency_relation: string
          family_history: string
          height_cm: number
          insurance: string
          matricule: string
          medical_history: string
          mutual: string
          smoker: boolean
          updated_at: string
          vaccinations: string
          weight_kg: number
        }[]
      }
      get_video_session: { Args: { p_session_id: string }; Returns: Json }
      invite_cabinet_member: {
        Args: {
          p_cabinet_id: string
          p_permissions?: Json
          p_role: string
          p_target_user_id: string
        }
        Returns: Json
      }
      is_admin: { Args: never; Returns: boolean }
      is_cabinet_admin: { Args: { p_cabinet_id: string }; Returns: boolean }
      is_cabinet_doctor: { Args: { p_cabinet_id: string }; Returns: boolean }
      is_cabinet_owner: { Args: { p_cabinet_id: string }; Returns: boolean }
      is_cabinet_secretaire: {
        Args: { p_cabinet_id: string }
        Returns: boolean
      }
      is_doctor_bookable: { Args: { p_doctor_id: string }; Returns: boolean }
      is_member_of_cabinet: { Args: { p_cabinet_id: string }; Returns: boolean }
      log_api_call: {
        Args: {
          p_api_key_id: string
          p_endpoint: string
          p_error_message?: string
          p_ip?: string
          p_method: string
          p_request_body_sha256?: string
          p_response_time_ms?: number
          p_status_code: number
          p_user_agent?: string
        }
        Returns: undefined
      }
      mark_video_session_ended: {
        Args: { p_duration?: number; p_session_id: string }
        Returns: Json
      }
      mark_video_session_started: {
        Args: { p_session_id: string }
        Returns: Json
      }
      next_prescription_number: { Args: never; Returns: string }
      record_consent: {
        Args: {
          p_evidence?: Json
          p_granted: boolean
          p_ip?: string
          p_locale?: string
          p_scope: string
          p_source?: string
          p_user_agent?: string
          p_version: string
        }
        Returns: Json
      }
      remove_cabinet_member: {
        Args: { p_cabinet_id: string; p_user_id: string }
        Returns: Json
      }
      revoke_api_key: {
        Args: { p_key_id: string; p_reason?: string }
        Returns: undefined
      }
      rotate_api_key: {
        Args: { p_key_id: string }
        Returns: {
          expires_old_at: string
          new_secret: string
        }[]
      }
      set_video_recording_consent: {
        Args: { p_consent: boolean; p_session_id: string }
        Returns: Json
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      tabibi_pii_decrypt: { Args: { cipher: string }; Returns: string }
      tabibi_pii_encrypt: { Args: { plain: string }; Returns: string }
      tabibi_pii_key: { Args: never; Returns: string }
      transfer_cabinet_ownership: {
        Args: {
          p_cabinet_id: string
          p_confirm: string
          p_new_owner_id: string
        }
        Returns: Json
      }
      unaccent: { Args: { "": string }; Returns: string }
      update_my_doctor_profile: {
        Args: {
          p_accepts_card?: boolean
          p_accepts_cash?: boolean
          p_accepts_chifa?: boolean
          p_address?: string
          p_bio?: string
          p_consultation_fee?: number
          p_languages?: string[]
          p_phone?: string
          p_photo_url?: string
          p_telehealth_enabled?: boolean
          p_telehealth_fee?: number
          p_working_hours?: Json
        }
        Returns: {
          accepts_card: boolean
          accepts_cash: boolean | null
          accepts_chifa: boolean
          address: string | null
          bio: string | null
          booking_buffer_minutes: number
          city: string | null
          claimed_at: string | null
          consultation_fee_dzd: number | null
          created_at: string
          email: string | null
          entity_type: Database["public"]["Enums"]["entity_type"]
          full_name: string
          full_name_ar: string | null
          id: string
          id_card_path: string | null
          is_active: boolean
          is_claimed: boolean
          is_verified: boolean
          languages: string[]
          latitude: number | null
          legacy_id: number | null
          longitude: number | null
          name_sort_key: string | null
          ordre_card_path: string | null
          ordre_number: string | null
          ordre_submitted_at: string | null
          phone: string | null
          phone_raw: string | null
          phone_type: Database["public"]["Enums"]["phone_type"]
          photo_url: string | null
          rating: number | null
          review_count: number
          search_vector: unknown
          source: string
          specialty_id: number | null
          specialty_raw: string | null
          telehealth_enabled: boolean | null
          telehealth_fee_dzd: number | null
          updated_at: string
          user_id: string | null
          validation_approved_at: string | null
          validation_approved_by_id: string | null
          validation_docs_uploaded_at: string | null
          validation_pending_since: string | null
          validation_rejected_at: string | null
          validation_rejected_by_id: string | null
          validation_rejected_reason: string | null
          validation_status: Database["public"]["Enums"]["doctor_validation_status"]
          website: string | null
          wilaya_code: number
          working_hours: Json | null
        }
        SetofOptions: {
          from: "*"
          to: "doctor_profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      upsert_patient_medical_data: {
        Args: {
          p_allergies?: string
          p_blood_type?: string
          p_chifa_card?: string
          p_current_medications?: string
          p_drinker?: boolean
          p_emergency_name?: string
          p_emergency_phone?: string
          p_emergency_relation?: string
          p_family_history?: string
          p_height_cm?: number
          p_insurance?: string
          p_matricule?: string
          p_medical_history?: string
          p_mutual?: string
          p_smoker?: boolean
          p_vaccinations?: string
          p_weight_kg?: number
        }
        Returns: undefined
      }
      verify_api_key: {
        Args: { p_client_ip?: string; p_key_id: string; p_key_secret: string }
        Returns: {
          active: boolean
          created_at: string
          created_by_user_id: string | null
          environment: string
          expires_at: string | null
          id: string
          ip_whitelist: string[]
          key_id: string
          key_secret_hash: string
          last_used_at: string | null
          last_used_ip: string | null
          owner_user_id: string | null
          partner_contact_phone: string | null
          partner_email: string
          partner_name: string
          rate_limit_per_day: number
          rate_limit_per_minute: number
          revoked_at: string | null
          revoked_reason: string | null
          scopes: string[]
          total_calls: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "api_keys"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      appointment_status:
        | "pending"
        | "confirmed"
        | "completed"
        | "cancelled"
        | "no_show"
      dawini_request_status: "pending" | "answered" | "closed" | "expired"
      dawini_response_status: "accepted" | "refused"
      doctor_validation_status: "pending" | "approved" | "rejected"
      entity_type:
        | "doctor"
        | "dentist"
        | "paramedical"
        | "pharmacy"
        | "optician"
        | "lab"
        | "health_center"
        | "clinic"
        | "hospital"
      payment_method: "cash" | "card" | "bank_transfer" | "ccp" | "baridimob"
      payment_status: "pending" | "completed" | "refunded" | "failed"
      phone_type: "mobile" | "landline" | "unknown"
      record_type:
        | "consultation_note"
        | "lab_result"
        | "imaging"
        | "prescription_doc"
        | "vaccination"
        | "allergy"
        | "other"
      user_locale: "fr" | "ar"
      user_role: "patient" | "doctor" | "admin" | "medecin"
      user_sex: "M" | "F" | "other"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      appointment_status: [
        "pending",
        "confirmed",
        "completed",
        "cancelled",
        "no_show",
      ],
      dawini_request_status: ["pending", "answered", "closed", "expired"],
      dawini_response_status: ["accepted", "refused"],
      doctor_validation_status: ["pending", "approved", "rejected"],
      entity_type: [
        "doctor",
        "dentist",
        "paramedical",
        "pharmacy",
        "optician",
        "lab",
        "health_center",
        "clinic",
        "hospital",
      ],
      payment_method: ["cash", "card", "bank_transfer", "ccp", "baridimob"],
      payment_status: ["pending", "completed", "refunded", "failed"],
      phone_type: ["mobile", "landline", "unknown"],
      record_type: [
        "consultation_note",
        "lab_result",
        "imaging",
        "prescription_doc",
        "vaccination",
        "allergy",
        "other",
      ],
      user_locale: ["fr", "ar"],
      user_role: ["patient", "doctor", "admin", "medecin"],
      user_sex: ["M", "F", "other"],
    },
  },
} as const

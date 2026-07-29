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
  public: {
    Tables: {
      booking_reschedule_history: {
        Row: {
          booking_id: string
          changed_by: string | null
          company_id: string
          created_at: string
          id: string
          new_end_at: string
          new_start_at: string
          previous_end_at: string
          previous_start_at: string
          reason: string | null
          source: string
        }
        Insert: {
          booking_id: string
          changed_by?: string | null
          company_id: string
          created_at?: string
          id?: string
          new_end_at: string
          new_start_at: string
          previous_end_at: string
          previous_start_at: string
          reason?: string | null
          source?: string
        }
        Update: {
          booking_id?: string
          changed_by?: string | null
          company_id?: string
          created_at?: string
          id?: string
          new_end_at?: string
          new_start_at?: string
          previous_end_at?: string
          previous_start_at?: string
          reason?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_reschedule_history_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_reschedule_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          cancellation_reason: string | null
          company_id: string
          created_at: string
          customer_email: string | null
          customer_name: string
          customer_phone: string
          end_at: string
          id: string
          manage_token: string
          notes: string | null
          payment_method:
            | Database["public"]["Enums"]["payment_method_kind"]
            | null
          professional_id: string
          reminder_1h_sent_at: string | null
          reminder_24h_sent_at: string | null
          service_id: string
          start_at: string
          status: string
          time_range: unknown
          updated_at: string
        }
        Insert: {
          cancellation_reason?: string | null
          company_id: string
          created_at?: string
          customer_email?: string | null
          customer_name: string
          customer_phone: string
          end_at: string
          id?: string
          manage_token?: string
          notes?: string | null
          payment_method?:
            | Database["public"]["Enums"]["payment_method_kind"]
            | null
          professional_id: string
          reminder_1h_sent_at?: string | null
          reminder_24h_sent_at?: string | null
          service_id: string
          start_at: string
          status?: string
          time_range?: unknown
          updated_at?: string
        }
        Update: {
          cancellation_reason?: string | null
          company_id?: string
          created_at?: string
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string
          end_at?: string
          id?: string
          manage_token?: string
          notes?: string | null
          payment_method?:
            | Database["public"]["Enums"]["payment_method_kind"]
            | null
          professional_id?: string
          reminder_1h_sent_at?: string | null
          reminder_24h_sent_at?: string | null
          service_id?: string
          start_at?: string
          status?: string
          time_range?: unknown
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          accepted_payment_methods: Database["public"]["Enums"]["payment_method_kind"][]
          address: string | null
          business_hours: Json
          city: string | null
          cover_url: string | null
          created_at: string
          description: string | null
          facebook_url: string | null
          gallery: Json
          id: string
          instagram_url: string | null
          latitude: number | null
          logo_url: string | null
          longitude: number | null
          name: string
          owner_id: string
          phone: string | null
          postal_code: string | null
          reviews_avg: number
          reviews_count: number
          segment: string
          slug: string
          state: string | null
          tagline: string | null
          timezone: string
          updated_at: string
          website_url: string | null
          whatsapp_phone: string | null
        }
        Insert: {
          accepted_payment_methods?: Database["public"]["Enums"]["payment_method_kind"][]
          address?: string | null
          business_hours?: Json
          city?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          facebook_url?: string | null
          gallery?: Json
          id?: string
          instagram_url?: string | null
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          name: string
          owner_id: string
          phone?: string | null
          postal_code?: string | null
          reviews_avg?: number
          reviews_count?: number
          segment: string
          slug: string
          state?: string | null
          tagline?: string | null
          timezone?: string
          updated_at?: string
          website_url?: string | null
          whatsapp_phone?: string | null
        }
        Update: {
          accepted_payment_methods?: Database["public"]["Enums"]["payment_method_kind"][]
          address?: string | null
          business_hours?: Json
          city?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          facebook_url?: string | null
          gallery?: Json
          id?: string
          instagram_url?: string | null
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          name?: string
          owner_id?: string
          phone?: string | null
          postal_code?: string | null
          reviews_avg?: number
          reviews_count?: number
          segment?: string
          slug?: string
          state?: string | null
          tagline?: string | null
          timezone?: string
          updated_at?: string
          website_url?: string | null
          whatsapp_phone?: string | null
        }
        Relationships: []
      }
      company_reviews: {
        Row: {
          booking_id: string
          comment: string | null
          company_id: string
          created_at: string
          customer_name: string
          id: string
          is_published: boolean
          professional_id: string | null
          rating: number
          updated_at: string
        }
        Insert: {
          booking_id: string
          comment?: string | null
          company_id: string
          created_at?: string
          customer_name: string
          id?: string
          is_published?: boolean
          professional_id?: string | null
          rating: number
          updated_at?: string
        }
        Update: {
          booking_id?: string
          comment?: string | null
          company_id?: string
          created_at?: string
          customer_name?: string
          id?: string
          is_published?: boolean
          professional_id?: string | null
          rating?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_reviews_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_reviews_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_reviews_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      company_theme_settings: {
        Row: {
          accent_color: string
          banner_url: string | null
          company_id: string
          created_at: string
          display_name: string | null
          favicon_url: string | null
          font_family: string
          logo_url: string | null
          primary_color: string
          secondary_color: string
          tagline: string | null
          template_id: string
          theme_mode: string
          updated_at: string
        }
        Insert: {
          accent_color?: string
          banner_url?: string | null
          company_id: string
          created_at?: string
          display_name?: string | null
          favicon_url?: string | null
          font_family?: string
          logo_url?: string | null
          primary_color?: string
          secondary_color?: string
          tagline?: string | null
          template_id?: string
          theme_mode?: string
          updated_at?: string
        }
        Update: {
          accent_color?: string
          banner_url?: string | null
          company_id?: string
          created_at?: string
          display_name?: string | null
          favicon_url?: string | null
          font_family?: string
          logo_url?: string | null
          primary_color?: string
          secondary_color?: string
          tagline?: string | null
          template_id?: string
          theme_mode?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_theme_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          body: string
          company_id: string
          created_at: string
          enabled: boolean
          id: string
          kind: Database["public"]["Enums"]["message_kind"]
          updated_at: string
        }
        Insert: {
          body: string
          company_id: string
          created_at?: string
          enabled?: boolean
          id?: string
          kind: Database["public"]["Enums"]["message_kind"]
          updated_at?: string
        }
        Update: {
          body?: string
          company_id?: string
          created_at?: string
          enabled?: boolean
          id?: string
          kind?: Database["public"]["Enums"]["message_kind"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_intents: {
        Row: {
          amount_cents: number
          booking_id: string
          checkout_url: string | null
          company_id: string
          created_at: string
          currency: string
          expires_at: string | null
          failure_reason: string | null
          id: string
          paid_at: string | null
          provider: string
          provider_intent_id: string | null
          raw_payload: Json
          refunded_at: string | null
          status: Database["public"]["Enums"]["payment_intent_status"]
          updated_at: string
        }
        Insert: {
          amount_cents: number
          booking_id: string
          checkout_url?: string | null
          company_id: string
          created_at?: string
          currency?: string
          expires_at?: string | null
          failure_reason?: string | null
          id?: string
          paid_at?: string | null
          provider: string
          provider_intent_id?: string | null
          raw_payload?: Json
          refunded_at?: string | null
          status?: Database["public"]["Enums"]["payment_intent_status"]
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          booking_id?: string
          checkout_url?: string | null
          company_id?: string
          created_at?: string
          currency?: string
          expires_at?: string | null
          failure_reason?: string | null
          id?: string
          paid_at?: string | null
          provider?: string
          provider_intent_id?: string | null
          raw_payload?: Json
          refunded_at?: string | null
          status?: Database["public"]["Enums"]["payment_intent_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_intents_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_intents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_settings: {
        Row: {
          cancellation_policy: string | null
          company_id: string
          created_at: string
          currency: string
          enabled: boolean
          expires_after_minutes: number
          fixed_amount_cents: number
          mode: Database["public"]["Enums"]["payment_mode"]
          percentage: number
          provider: string | null
          provider_config: Json
          refund_policy: string | null
          require_per_service: boolean
          updated_at: string
        }
        Insert: {
          cancellation_policy?: string | null
          company_id: string
          created_at?: string
          currency?: string
          enabled?: boolean
          expires_after_minutes?: number
          fixed_amount_cents?: number
          mode?: Database["public"]["Enums"]["payment_mode"]
          percentage?: number
          provider?: string | null
          provider_config?: Json
          refund_policy?: string | null
          require_per_service?: boolean
          updated_at?: string
        }
        Update: {
          cancellation_policy?: string | null
          company_id?: string
          created_at?: string
          currency?: string
          enabled?: boolean
          expires_after_minutes?: number
          fixed_amount_cents?: number
          mode?: Database["public"]["Enums"]["payment_mode"]
          percentage?: number
          provider?: string | null
          provider_config?: Json
          refund_policy?: string | null
          require_per_service?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_availability: {
        Row: {
          company_id: string
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          professional_id: string
          start_time: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          professional_id: string
          start_time: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          professional_id?: string
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "professional_availability_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_availability_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_breaks: {
        Row: {
          company_id: string
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          label: string | null
          professional_id: string
          start_time: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          label?: string | null
          professional_id: string
          start_time: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          label?: string | null
          professional_id?: string
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "professional_breaks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_breaks_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      professionals: {
        Row: {
          bio: string | null
          company_id: string
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          name: string
          photo_url: string | null
          skill_level: string
          specialties: string[]
          status: string
          updated_at: string
        }
        Insert: {
          bio?: string | null
          company_id: string
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          photo_url?: string | null
          skill_level?: string
          specialties?: string[]
          status?: string
          updated_at?: string
        }
        Update: {
          bio?: string | null
          company_id?: string
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          photo_url?: string | null
          skill_level?: string
          specialties?: string[]
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "professionals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      quote_items: {
        Row: {
          created_at: string
          description: string
          id: string
          position: number
          quantity: number
          quote_id: string
          total_cents: number
          unit_price_cents: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          position?: number
          quantity?: number
          quote_id: string
          total_cents?: number
          unit_price_cents?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          position?: number
          quantity?: number
          quote_id?: string
          total_cents?: number
          unit_price_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          company_id: string
          created_at: string
          customer_email: string | null
          customer_name: string
          customer_phone: string | null
          id: string
          notes: string | null
          public_token: string
          quote_number: number
          status: Database["public"]["Enums"]["quote_status"]
          total_cents: number
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          customer_email?: string | null
          customer_name: string
          customer_phone?: string | null
          id?: string
          notes?: string | null
          public_token?: string
          quote_number: number
          status?: Database["public"]["Enums"]["quote_status"]
          total_cents?: number
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string | null
          id?: string
          notes?: string | null
          public_token?: string
          quote_number?: number
          status?: Database["public"]["Enums"]["quote_status"]
          total_cents?: number
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          display_order: number
          duration_minutes: number
          id: string
          is_active: boolean
          name: string
          photo_url: string | null
          price_cents: number
          requires_payment: boolean
          status: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          display_order?: number
          duration_minutes: number
          id?: string
          is_active?: boolean
          name: string
          photo_url?: string | null
          price_cents?: number
          requires_payment?: boolean
          status?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          display_order?: number
          duration_minutes?: number
          id?: string
          is_active?: boolean
          name?: string
          photo_url?: string | null
          price_cents?: number
          requires_payment?: boolean
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cancel_booking_by_token: {
        Args: { _reason?: string; _token: string }
        Returns: undefined
      }
      default_message_body: {
        Args: { _kind: Database["public"]["Enums"]["message_kind"] }
        Returns: string
      }
      get_booking_by_token: {
        Args: { _token: string }
        Returns: {
          cancellation_reason: string
          company_id: string
          company_name: string
          company_phone: string
          company_segment: string
          company_slug: string
          company_timezone: string
          customer_email: string
          customer_name: string
          customer_phone: string
          duration_minutes: number
          end_at: string
          id: string
          notes: string
          price_cents: number
          professional_id: string
          professional_name: string
          service_id: string
          service_name: string
          start_at: string
          status: string
        }[]
      }
      get_busy_slots:
        | {
            Args: { _date: string; _professional_id: string }
            Returns: {
              end_at: string
              start_at: string
            }[]
          }
        | {
            Args: {
              _date: string
              _professional_id: string
              _timezone?: string
            }
            Returns: {
              end_at: string
              start_at: string
            }[]
          }
      get_company_theme_by_slug: {
        Args: { _slug: string }
        Returns: {
          accent_color: string
          banner_url: string | null
          company_id: string
          created_at: string
          display_name: string | null
          favicon_url: string | null
          font_family: string
          logo_url: string | null
          primary_color: string
          secondary_color: string
          tagline: string | null
          template_id: string
          theme_mode: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "company_theme_settings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_payment_intent_by_token: {
        Args: { _token: string }
        Returns: {
          amount_cents: number
          booking_id: string
          checkout_url: string
          currency: string
          expires_at: string
          id: string
          provider: string
          status: Database["public"]["Enums"]["payment_intent_status"]
        }[]
      }
      get_public_company_by_slug: { Args: { _slug: string }; Returns: Json }
      get_quote_by_token: { Args: { _token: string }; Returns: Json }
      recompute_company_reviews_stats: {
        Args: { _company_id: string }
        Returns: undefined
      }
      release_expired_payment_intents: { Args: never; Returns: number }
      reschedule_booking_by_token: {
        Args: { _new_end: string; _new_start: string; _token: string }
        Returns: undefined
      }
      submit_review_by_token: {
        Args: { _comment?: string; _rating: number; _token: string }
        Returns: string
      }
    }
    Enums: {
      message_kind:
        | "confirmation"
        | "reschedule"
        | "cancellation"
        | "reminder_24h"
        | "reminder_1h"
      payment_intent_status:
        | "pending"
        | "paid"
        | "expired"
        | "cancelled"
        | "refunded"
        | "failed"
      payment_method_kind: "cash" | "pix" | "debit_card" | "credit_card"
      payment_mode: "none" | "fixed" | "percentage" | "full"
      quote_status: "draft" | "sent" | "accepted" | "rejected" | "expired"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      message_kind: [
        "confirmation",
        "reschedule",
        "cancellation",
        "reminder_24h",
        "reminder_1h",
      ],
      payment_intent_status: [
        "pending",
        "paid",
        "expired",
        "cancelled",
        "refunded",
        "failed",
      ],
      payment_method_kind: ["cash", "pix", "debit_card", "credit_card"],
      payment_mode: ["none", "fixed", "percentage", "full"],
      quote_status: ["draft", "sent", "accepted", "rejected", "expired"],
    },
  },
} as const

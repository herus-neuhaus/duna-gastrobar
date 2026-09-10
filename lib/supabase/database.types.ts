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
      blacklist: {
        Row: {
          blocked_by: string | null
          cpf: string
          created_at: string | null
          end_date: string
          id: string
          name: string
          reason: string | null
          start_date: string | null
        }
        Insert: {
          blocked_by?: string | null
          cpf: string
          created_at?: string | null
          end_date: string
          id?: string
          name: string
          reason?: string | null
          start_date?: string | null
        }
        Update: {
          blocked_by?: string | null
          cpf?: string
          created_at?: string | null
          end_date?: string
          id?: string
          name?: string
          reason?: string | null
          start_date?: string | null
        }
        Relationships: []
      }
      employee_roles: {
        Row: {
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          job_role_id: string | null
          role: string | null
          updated_at: string
          whatsapp: string | null
          force_password_change?: boolean
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          job_role_id?: string | null
          role?: string | null
          updated_at?: string
          whatsapp?: string | null
          force_password_change?: boolean
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          job_role_id?: string | null
          role?: string | null
          updated_at?: string
          whatsapp?: string | null
          force_password_change?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "profiles_job_role_id_fkey"
            columns: ["job_role_id"]
            isOneToOne: false
            referencedRelation: "employee_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      reservations: {
        Row: {
          birth_date: string | null
          check_in_status: string | null
          cpf: string | null
          created_at: string
          customer_id: string | null
          decoration_id: string | null
          decoration_service_starts_at: string | null
          email: string
          expires_at: string | null
          id: string
          location_id: string | null
          name: string
          notes: string | null
          num_guests: number
          payment_amount: number | null
          payment_status: string | null
          reservation_date: string
          reservation_access_token_hash: string | null
          reservation_time: string
          special_date_id: string | null
          status: string | null
          type: string | null
          updated_at: string
          whatsapp: string
        }
        Insert: {
          birth_date?: string | null
          check_in_status?: string | null
          cpf?: string | null
          created_at?: string
          customer_id?: string | null
          decoration_id?: string | null
          decoration_service_starts_at?: string | null
          email: string
          expires_at?: string | null
          id?: string
          location_id?: string | null
          name: string
          notes?: string | null
          num_guests: number
          payment_amount?: number | null
          payment_status?: string | null
          reservation_date: string
          reservation_access_token_hash?: string | null
          reservation_time: string
          special_date_id?: string | null
          status?: string | null
          type?: string | null
          updated_at?: string
          whatsapp: string
        }
        Update: {
          birth_date?: string | null
          check_in_status?: string | null
          cpf?: string | null
          created_at?: string
          customer_id?: string | null
          decoration_id?: string | null
          decoration_service_starts_at?: string | null
          email?: string
          expires_at?: string | null
          id?: string
          location_id?: string | null
          name?: string
          notes?: string | null
          num_guests?: number
          payment_amount?: number | null
          payment_status?: string | null
          reservation_date?: string
          reservation_access_token_hash?: string | null
          reservation_time?: string
          special_date_id?: string | null
          status?: string | null
          type?: string | null
          updated_at?: string
          whatsapp?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservations_special_date_id_fkey"
            columns: ["special_date_id"]
            isOneToOne: false
            referencedRelation: "special_dates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_decoration_id_fkey"
            columns: ["decoration_id"]
            isOneToOne: false
            referencedRelation: "decorations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      decorations: {
        Row: {
          active: boolean
          created_at: string
          id: string
          image_path: string
          image_url: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          image_path: string
          image_url: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          image_path?: string
          image_url?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      special_dates: {
        Row: {
          created_at: string | null
          date: string
          description: string | null
          fee_amount: number | null
          id: string
          requires_fee: boolean | null
          updated_at: string | null
          included_guests: number | null
        }
        Insert: {
          created_at?: string | null
          date: string
          description?: string | null
          fee_amount?: number | null
          id?: string
          requires_fee?: boolean | null
          updated_at?: string | null
          included_guests?: number | null
        }
        Update: {
          created_at?: string | null
          date?: string
          description?: string | null
          fee_amount?: number | null
          id?: string
          requires_fee?: boolean | null
          updated_at?: string | null
          included_guests?: number | null
        }
        Relationships: []
      }
      task_categories: {
        Row: {
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      task_completions: {
        Row: {
          completed_at: string | null
          employee_id: string | null
          execution_date: string
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          started_at: string | null
          status: string
          task_id: string | null
        }
        Insert: {
          completed_at?: string | null
          employee_id?: string | null
          execution_date: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          started_at?: string | null
          status: string
          task_id?: string | null
        }
        Update: {
          completed_at?: string | null
          employee_id?: string | null
          execution_date?: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          started_at?: string | null
          status?: string
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_completions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_completions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_completions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_employee_id: string | null
          assigned_role_id: string | null
          category_id: string | null
          created_at: string | null
          description: string | null
          id: string
          is_daily: boolean | null
          scheduled_time: string | null
          target_date: string | null
          time_estimate_minutes: number
          title: string
        }
        Insert: {
          assigned_employee_id?: string | null
          assigned_role_id?: string | null
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_daily?: boolean | null
          scheduled_time?: string | null
          target_date?: string | null
          time_estimate_minutes: number
          title: string
        }
        Update: {
          assigned_employee_id?: string | null
          assigned_role_id?: string | null
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_daily?: boolean | null
          scheduled_time?: string | null
          target_date?: string | null
          time_estimate_minutes?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_employee_id_fkey"
            columns: ["assigned_employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_assigned_role_id_fkey"
            columns: ["assigned_role_id"]
            isOneToOne: false
            referencedRelation: "employee_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "task_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_templates: {
        Row: {
          content: string
          created_at: string | null
          id: string
          title: string
          updated_at: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          title: string
          updated_at?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_customer_reservations: {
        Args: { phone_param: string }
        Returns: {
          birth_date: string | null
          check_in_status: string | null
          cpf: string | null
          created_at: string
          customer_id: string | null
          email: string
          expires_at: string | null
          id: string
          location_id: string | null
          name: string
          notes: string | null
          num_guests: number
          payment_amount: number | null
          payment_status: string | null
          reservation_date: string
          reservation_time: string
          status: string | null
          type: string | null
          updated_at: string
          whatsapp: string
        }[]
        SetofOptions: {
          from: "*"
          to: "reservations"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      cancel_reservation_with_access_token: {
        Args: { p_access_token_hash: string; p_reservation_id: string }
        Returns: { id: string; status: string }[]
      }
      complete_reservation_payment: {
        Args: { p_payment_amount: number; p_reservation_id: string }
        Returns: { id: string; payment_status: string; status: string }[]
      }
      complete_reservation_access_recovery: {
        Args: { p_access_tokens: Json; p_challenge_id: string; p_code_hash: string; p_email_hash: string }
        Returns: { id: string }[]
      }
      create_reservation_recovery_challenge: {
        Args: { p_code_hash: string; p_email_hash: string; p_reservation_ids: string[] }
        Returns: string
      }
      get_reservation_available_times: {
        Args: { p_from: string; p_to: string }
        Returns: { reservation_date: string; reservation_time: string }[]
      }
      get_reservation_decoration_availability: {
        Args: { p_reservation_date: string; p_reservation_time: string }
        Returns: { available: boolean; decoration_id: string }[]
      }
      get_reservation_service_starts_at: {
        Args: { p_reservation_date: string; p_reservation_time: string }
        Returns: string
      }
      get_reservation_with_access_token: {
        Args: { p_access_token_hash: string; p_reservation_id: string }
        Returns: {
          id: string
          num_guests: number
          payment_amount: number
          payment_status: string
          reservation_date: string
          reservation_time: string
          status: string
        }[]
      }
      release_expired_reservations: { Args: never; Returns: undefined }
      transition_reservation_status: {
        Args: { p_expected_statuses: string[]; p_next_status: string; p_reservation_id: string }
        Returns: { id: string; status: string }[]
      }
      reservation_time_is_available: {
        Args: { p_reservation_date: string; p_reservation_time: string }
        Returns: boolean
      }
      update_reservation_with_access_token: {
        Args: { p_access_token_hash: string; p_num_guests: number; p_reservation_date: string; p_reservation_id: string; p_reservation_time: string }
        Returns: { id: string; num_guests: number; reservation_date: string; reservation_time: string; status: string }[]
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const

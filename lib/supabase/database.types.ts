export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          role: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          role?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          role?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      reservations: {
        Row: {
          created_at: string
          customer_id: string | null
          email: string
          id: string
          name: string
          notes: string | null
          num_guests: number
          payment_amount: number | null
          payment_status: string | null
          reservation_date: string
          reservation_time: string
          status: string | null
          updated_at: string
          whatsapp: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          email: string
          id?: string
          name: string
          notes?: string | null
          num_guests: number
          payment_amount?: number | null
          payment_status?: string | null
          reservation_date: string
          reservation_time: string
          status?: string | null
          updated_at?: string
          whatsapp: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          email?: string
          id?: string
          name?: string
          notes?: string | null
          num_guests?: number
          payment_amount?: number | null
          payment_status?: string | null
          reservation_date?: string
          reservation_time?: string
          status?: string | null
          updated_at?: string
          whatsapp?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

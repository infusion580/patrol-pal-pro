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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      chat_messages: {
        Row: {
          created_at: string
          id: string
          message: string
          read: boolean
          receiver_id: string
          sender_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          read?: boolean
          receiver_id: string
          sender_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          receiver_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      chat_rh: {
        Row: {
          confidential: boolean
          created_at: string
          folio: string
          id: string
          message: string
          sender: string
          topic: string
          user_id: string
        }
        Insert: {
          confidential?: boolean
          created_at?: string
          folio: string
          id?: string
          message: string
          sender: string
          topic: string
          user_id: string
        }
        Update: {
          confidential?: boolean
          created_at?: string
          folio?: string
          id?: string
          message?: string
          sender?: string
          topic?: string
          user_id?: string
        }
        Relationships: []
      }
      checkpoints: {
        Row: {
          created_at: string
          id: string
          nombre: string
          servicio_id: string
          ubicacion: string
        }
        Insert: {
          created_at?: string
          id?: string
          nombre: string
          servicio_id: string
          ubicacion?: string
        }
        Update: {
          created_at?: string
          id?: string
          nombre?: string
          servicio_id?: string
          ubicacion?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkpoints_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "servicios"
            referencedColumns: ["id"]
          },
        ]
      }
      emergencias: {
        Row: {
          atendida: boolean
          created_at: string
          guardia_id: string
          id: string
          lat: number | null
          lng: number | null
          tipo: string
        }
        Insert: {
          atendida?: boolean
          created_at?: string
          guardia_id: string
          id?: string
          lat?: number | null
          lng?: number | null
          tipo?: string
        }
        Update: {
          atendida?: boolean
          created_at?: string
          guardia_id?: string
          id?: string
          lat?: number | null
          lng?: number | null
          tipo?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          apellido: string
          created_at: string
          email: string
          id: string
          nombre: string
          numero_empleado: string
          updated_at: string
          user_id: string
        }
        Insert: {
          apellido?: string
          created_at?: string
          email?: string
          id?: string
          nombre?: string
          numero_empleado?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          apellido?: string
          created_at?: string
          email?: string
          id?: string
          nombre?: string
          numero_empleado?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reportes_turno: {
        Row: {
          actividades: string
          created_at: string
          firmado: boolean
          guardia_id: string
          id: string
          incidencias: string
          observaciones: string
          retroalimentacion: string | null
          revisado_por: string | null
          status: string
          updated_at: string
        }
        Insert: {
          actividades?: string
          created_at?: string
          firmado?: boolean
          guardia_id: string
          id?: string
          incidencias?: string
          observaciones?: string
          retroalimentacion?: string | null
          revisado_por?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          actividades?: string
          created_at?: string
          firmado?: boolean
          guardia_id?: string
          id?: string
          incidencias?: string
          observaciones?: string
          retroalimentacion?: string | null
          revisado_por?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      rondin_scans: {
        Row: {
          checkpoint_id: string
          id: string
          lat: number | null
          lng: number | null
          rondin_id: string
          scanned_at: string
        }
        Insert: {
          checkpoint_id: string
          id?: string
          lat?: number | null
          lng?: number | null
          rondin_id: string
          scanned_at?: string
        }
        Update: {
          checkpoint_id?: string
          id?: string
          lat?: number | null
          lng?: number | null
          rondin_id?: string
          scanned_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rondin_scans_checkpoint_id_fkey"
            columns: ["checkpoint_id"]
            isOneToOne: false
            referencedRelation: "checkpoints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rondin_scans_rondin_id_fkey"
            columns: ["rondin_id"]
            isOneToOne: false
            referencedRelation: "rondines"
            referencedColumns: ["id"]
          },
        ]
      }
      rondines: {
        Row: {
          checkin_at: string | null
          checkin_lat: number | null
          checkin_lng: number | null
          checkout_at: string | null
          created_at: string
          guardia_id: string
          id: string
          servicio_id: string | null
          status: string
        }
        Insert: {
          checkin_at?: string | null
          checkin_lat?: number | null
          checkin_lng?: number | null
          checkout_at?: string | null
          created_at?: string
          guardia_id: string
          id?: string
          servicio_id?: string | null
          status?: string
        }
        Update: {
          checkin_at?: string | null
          checkin_lat?: number | null
          checkin_lng?: number | null
          checkout_at?: string | null
          created_at?: string
          guardia_id?: string
          id?: string
          servicio_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "rondines_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "servicios"
            referencedColumns: ["id"]
          },
        ]
      }
      servicios: {
        Row: {
          cliente: string
          created_at: string
          created_by: string | null
          direccion: string
          id: string
          nombre: string
          updated_at: string
        }
        Insert: {
          cliente?: string
          created_at?: string
          created_by?: string | null
          direccion?: string
          id?: string
          nombre: string
          updated_at?: string
        }
        Update: {
          cliente?: string
          created_at?: string
          created_by?: string | null
          direccion?: string
          id?: string
          nombre?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      promote_user: {
        Args: {
          _new_role: Database["public"]["Enums"]["app_role"]
          _target_user_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "guardia" | "supervisor" | "admin"
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
      app_role: ["guardia", "supervisor", "admin"],
    },
  },
} as const

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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      tag: {
        Row: {
          deleted: boolean
          id: number
          tag: string
          user_id: string | null
        }
        Insert: {
          deleted?: boolean
          id?: number
          tag: string
          user_id?: string | null
        }
        Update: {
          deleted?: boolean
          id?: number
          tag?: string
          user_id?: string | null
        }
        Relationships: []
      }
      time_split: {
        Row: {
          deleted: boolean
          description: string | null
          id: number
          name: string
        }
        Insert: {
          deleted?: boolean
          description?: string | null
          id?: number
          name: string
        }
        Update: {
          deleted?: boolean
          description?: string | null
          id?: number
          name?: string
        }
        Relationships: []
      }
      time_split_timer: {
        Row: {
          len: string
          name: string
          time_split_id: number
          work: boolean
        }
        Insert: {
          len: string
          name: string
          time_split_id: number
          work: boolean
        }
        Update: {
          len?: string
          name?: string
          time_split_id?: number
          work?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "time_split_timer_time_split_id_fkey"
            columns: ["time_split_id"]
            isOneToOne: false
            referencedRelation: "time_split"
            referencedColumns: ["id"]
          },
        ]
      }
      timesheet: {
        Row: {
          end_time: string
          start_time: string
          timesheet_group: number
          user_id: string
          work: boolean
        }
        Insert: {
          end_time: string
          start_time: string
          timesheet_group: number
          user_id: string
          work: boolean
        }
        Update: {
          end_time?: string
          start_time?: string
          timesheet_group?: number
          user_id?: string
          work?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "timesheet_timesheet_group_fkey"
            columns: ["timesheet_group"]
            isOneToOne: false
            referencedRelation: "timesheet_group"
            referencedColumns: ["timesheet_group"]
          },
        ]
      }
      timesheet_group: {
        Row: {
          time_split_id: number
          timesheet_group: number
          user_id: string
        }
        Insert: {
          time_split_id: number
          timesheet_group?: number
          user_id: string
        }
        Update: {
          time_split_id?: number
          timesheet_group?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "timesheet_group_time_split_id_fkey"
            columns: ["time_split_id"]
            isOneToOne: false
            referencedRelation: "time_split"
            referencedColumns: ["id"]
          },
        ]
      }
      timesheet_tag: {
        Row: {
          tag_id: number
          timesheet_group: number
          user_id: string | null
        }
        Insert: {
          tag_id: number
          timesheet_group: number
          user_id?: string | null
        }
        Update: {
          tag_id?: number
          timesheet_group?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "timesheet_tag_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tag"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheet_tag_timesheet_group_fkey"
            columns: ["timesheet_group"]
            isOneToOne: false
            referencedRelation: "timesheet_group"
            referencedColumns: ["timesheet_group"]
          },
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

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
    PostgrestVersion: "14.18"
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
      bowel_movements: {
        Row: {
          blood: boolean
          bristol: number
          created_at: string
          id: string
          incomplete: boolean
          mucus: boolean
          note: string | null
          occurred_at: string
          pain: boolean
          phase: string | null
          place: string | null
          urgency: number
          user_id: string
        }
        Insert: {
          blood?: boolean
          bristol: number
          created_at?: string
          id?: string
          incomplete?: boolean
          mucus?: boolean
          note?: string | null
          occurred_at?: string
          pain?: boolean
          phase?: string | null
          place?: string | null
          urgency?: number
          user_id?: string
        }
        Update: {
          blood?: boolean
          bristol?: number
          created_at?: string
          id?: string
          incomplete?: boolean
          mucus?: boolean
          note?: string | null
          occurred_at?: string
          pain?: boolean
          phase?: string | null
          place?: string | null
          urgency?: number
          user_id?: string
        }
        Relationships: []
      }
      contexts: {
        Row: {
          created_at: string
          end_date: string | null
          id: string
          phase: string
          place: string
          start_date: string
          user_id: string
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          id?: string
          phase: string
          place: string
          start_date: string
          user_id: string
        }
        Update: {
          created_at?: string
          end_date?: string | null
          id?: string
          phase?: string
          place?: string
          start_date?: string
          user_id?: string
        }
        Relationships: []
      }
      day_closings: {
        Row: {
          bedtime: string | null
          created_at: string
          date: string
          id: string
          note: string | null
          sleep: number | null
          stress: number
          tags: string[]
          user_id: string
          wake_time: string | null
        }
        Insert: {
          bedtime?: string | null
          created_at?: string
          date: string
          id?: string
          note?: string | null
          sleep?: number | null
          stress: number
          tags?: string[]
          user_id: string
          wake_time?: string | null
        }
        Update: {
          bedtime?: string | null
          created_at?: string
          date?: string
          id?: string
          note?: string | null
          sleep?: number | null
          stress?: number
          tags?: string[]
          user_id?: string
          wake_time?: string | null
        }
        Relationships: []
      }
      doctor_questions: {
        Row: {
          created_at: string
          document_id: string | null
          id: string
          saved: boolean
          text: string
          user_id: string
        }
        Insert: {
          created_at?: string
          document_id?: string | null
          id?: string
          saved?: boolean
          text: string
          user_id: string
        }
        Update: {
          created_at?: string
          document_id?: string | null
          id?: string
          saved?: boolean
          text?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "doctor_questions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_chats: {
        Row: {
          content: string
          created_at: string
          document_id: string
          id: string
          role: string
        }
        Insert: {
          content: string
          created_at?: string
          document_id: string
          id?: string
          role: string
        }
        Update: {
          content?: string
          created_at?: string
          document_id?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_chats_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          analysis: Json | null
          created_at: string
          doc_date: string | null
          examination_id: string | null
          file_path: string
          file_paths: string[]
          id: string
          source: string | null
          title: string
          user_id: string
        }
        Insert: {
          analysis?: Json | null
          created_at?: string
          doc_date?: string | null
          examination_id?: string | null
          file_path: string
          file_paths?: string[]
          id?: string
          source?: string | null
          title: string
          user_id: string
        }
        Update: {
          analysis?: Json | null
          created_at?: string
          doc_date?: string | null
          examination_id?: string | null
          file_path?: string
          file_paths?: string[]
          id?: string
          source?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_examination_id_fkey"
            columns: ["examination_id"]
            isOneToOne: false
            referencedRelation: "examinations"
            referencedColumns: ["id"]
          },
        ]
      }
      examinations: {
        Row: {
          created_at: string
          id: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      ingredient_profiles: {
        Row: {
          created_at: string
          fodmap_types: string[]
          good_markers: string[]
          id: string
          markers: string[]
          name: string
          note: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          fodmap_types?: string[]
          good_markers?: string[]
          id?: string
          markers?: string[]
          name: string
          note?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          fodmap_types?: string[]
          good_markers?: string[]
          id?: string
          markers?: string[]
          name?: string
          note?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      meal_analysis_cache: {
        Row: {
          created_at: string
          id: string
          raw_text: string
          result: Json
          text_hash: string
        }
        Insert: {
          created_at?: string
          id?: string
          raw_text: string
          result: Json
          text_hash: string
        }
        Update: {
          created_at?: string
          id?: string
          raw_text?: string
          result?: Json
          text_hash?: string
        }
        Relationships: []
      }
      meals: {
        Row: {
          created_at: string
          eaten_at: string
          eaten_quickly: boolean
          fodmap_sources: string[]
          good_foods: string[]
          good_markers: string[]
          id: string
          ingredient_details: Json
          ingredients: string[]
          main_foods: string[]
          markers: string[]
          meal_type: string
          phase: string | null
          place: string | null
          portion: string | null
          prep_markers: string[]
          raw_text: string
          summary: string
          user_id: string
        }
        Insert: {
          created_at?: string
          eaten_at: string
          eaten_quickly?: boolean
          fodmap_sources?: string[]
          good_foods?: string[]
          good_markers?: string[]
          id?: string
          ingredient_details?: Json
          ingredients?: string[]
          main_foods?: string[]
          markers?: string[]
          meal_type: string
          phase?: string | null
          place?: string | null
          portion?: string | null
          prep_markers?: string[]
          raw_text: string
          summary: string
          user_id: string
        }
        Update: {
          created_at?: string
          eaten_at?: string
          eaten_quickly?: boolean
          fodmap_sources?: string[]
          good_foods?: string[]
          good_markers?: string[]
          id?: string
          ingredient_details?: Json
          ingredients?: string[]
          main_foods?: string[]
          markers?: string[]
          meal_type?: string
          phase?: string | null
          place?: string | null
          portion?: string | null
          prep_markers?: string[]
          raw_text?: string
          summary?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          medications: string | null
          name: string | null
          sleep_offset_minutes: number
          symptoms_since: string | null
          theme_preference: string | null
        }
        Insert: {
          created_at?: string
          id: string
          medications?: string | null
          name?: string | null
          sleep_offset_minutes?: number
          symptoms_since?: string | null
          theme_preference?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          medications?: string | null
          name?: string | null
          sleep_offset_minutes?: number
          symptoms_since?: string | null
          theme_preference?: string | null
        }
        Relationships: []
      }
      saved_meals: {
        Row: {
          created_at: string
          fodmap_sources: string[]
          good_foods: string[]
          good_markers: string[]
          id: string
          main_foods: string[]
          markers: string[]
          meal_type: string
          name: string
          summary: string
          user_id: string
        }
        Insert: {
          created_at?: string
          fodmap_sources?: string[]
          good_foods?: string[]
          good_markers?: string[]
          id?: string
          main_foods?: string[]
          markers?: string[]
          meal_type?: string
          name: string
          summary: string
          user_id?: string
        }
        Update: {
          created_at?: string
          fodmap_sources?: string[]
          good_foods?: string[]
          good_markers?: string[]
          id?: string
          main_foods?: string[]
          markers?: string[]
          meal_type?: string
          name?: string
          summary?: string
          user_id?: string
        }
        Relationships: []
      }
      sleep_logs: {
        Row: {
          bed_at: string | null
          created_at: string
          fell_asleep_at: string | null
          id: string
          night_of: string
          note: string | null
          quality: number | null
          user_id: string
          woke_at: string | null
        }
        Insert: {
          bed_at?: string | null
          created_at?: string
          fell_asleep_at?: string | null
          id?: string
          night_of: string
          note?: string | null
          quality?: number | null
          user_id?: string
          woke_at?: string | null
        }
        Update: {
          bed_at?: string | null
          created_at?: string
          fell_asleep_at?: string | null
          id?: string
          night_of?: string
          note?: string | null
          quality?: number | null
          user_id?: string
          woke_at?: string | null
        }
        Relationships: []
      }
      steps: {
        Row: {
          created_at: string
          date: string | null
          id: string
          result_short: string | null
          sort_order: number
          status: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date?: string | null
          id?: string
          result_short?: string | null
          sort_order?: number
          status: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string | null
          id?: string
          result_short?: string | null
          sort_order?: number
          status?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      water_logs: {
        Row: {
          amount_ml: number
          created_at: string
          drunk_at: string
          id: string
          user_id: string
        }
        Insert: {
          amount_ml?: number
          created_at?: string
          drunk_at?: string
          id?: string
          user_id?: string
        }
        Update: {
          amount_ml?: number
          created_at?: string
          drunk_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      wellbeing: {
        Row: {
          abdominal_pain: number
          bloating: number
          created_at: string
          fullness: number
          heartburn: number
          id: string
          mood: number
          nausea: number
          note: string | null
          occurred_at: string
          phase: string | null
          place: string | null
          rumbling: number
          situation: string | null
          stress: number
          toilet_reachable: boolean | null
          urgency: number
          user_id: string
        }
        Insert: {
          abdominal_pain?: number
          bloating?: number
          created_at?: string
          fullness?: number
          heartburn?: number
          id?: string
          mood: number
          nausea?: number
          note?: string | null
          occurred_at?: string
          phase?: string | null
          place?: string | null
          rumbling?: number
          situation?: string | null
          stress?: number
          toilet_reachable?: boolean | null
          urgency?: number
          user_id?: string
        }
        Update: {
          abdominal_pain?: number
          bloating?: number
          created_at?: string
          fullness?: number
          heartburn?: number
          id?: string
          mood?: number
          nausea?: number
          note?: string | null
          occurred_at?: string
          phase?: string | null
          place?: string | null
          rumbling?: number
          situation?: string | null
          stress?: number
          toilet_reachable?: boolean | null
          urgency?: number
          user_id?: string
        }
        Relationships: []
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
    Enums: {},
  },
} as const

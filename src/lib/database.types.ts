export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      academic_terms: {
        Row: {
          academic_year: number;
          active: boolean;
          archived: boolean;
          created_at: string;
          id: string;
          name: string;
          updated_at: string;
        };
        Insert: {
          academic_year: number;
          active?: boolean;
          archived?: boolean;
          created_at?: string;
          id?: string;
          name: string;
          updated_at?: string;
        };
        Update: {
          academic_year?: number;
          active?: boolean;
          archived?: boolean;
          created_at?: string;
          id?: string;
          name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          action: string;
          actor: string | null;
          after_data: Json | null;
          before_data: Json | null;
          created_at: string;
          entity: string;
          entity_id: string | null;
          id: number;
        };
        Insert: {
          action: string;
          actor?: string | null;
          after_data?: Json | null;
          before_data?: Json | null;
          created_at?: string;
          entity: string;
          entity_id?: string | null;
          id?: never;
        };
        Update: {
          action?: string;
          actor?: string | null;
          after_data?: Json | null;
          before_data?: Json | null;
          created_at?: string;
          entity?: string;
          entity_id?: string | null;
          id?: never;
        };
        Relationships: [];
      };
      classes: {
        Row: {
          active: boolean;
          archived: boolean;
          created_at: string;
          id: string;
          name: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          archived?: boolean;
          created_at?: string;
          id?: string;
          name: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          archived?: boolean;
          created_at?: string;
          id?: string;
          name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      enrollments: {
        Row: {
          class_id: string;
          created_at: string;
          id: string;
          roll_number: number | null;
          student_id: string;
          term_id: string;
          updated_at: string;
        };
        Insert: {
          class_id: string;
          created_at?: string;
          id?: string;
          roll_number?: number | null;
          student_id: string;
          term_id: string;
          updated_at?: string;
        };
        Update: {
          class_id?: string;
          created_at?: string;
          id?: string;
          roll_number?: number | null;
          student_id?: string;
          term_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "enrollments_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "enrollments_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "enrollments_term_id_fkey";
            columns: ["term_id"];
            isOneToOne: false;
            referencedRelation: "academic_terms";
            referencedColumns: ["id"];
          },
        ];
      };
      feedback: {
        Row: {
          author: string;
          contact: string;
          created_at: string;
          id: string;
          message: string;
          page: string;
          status: string;
          type: string;
        };
        Insert: {
          author: string;
          contact?: string;
          created_at?: string;
          id?: string;
          message: string;
          page?: string;
          status?: string;
          type: string;
        };
        Update: {
          author?: string;
          contact?: string;
          created_at?: string;
          id?: string;
          message?: string;
          page?: string;
          status?: string;
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "feedback_author_fkey";
            columns: ["author"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      grade_scheme_rules: {
        Row: {
          id: string;
          minimum: number;
          points: number;
          scheme_id: string;
        };
        Insert: {
          id?: string;
          minimum: number;
          points: number;
          scheme_id: string;
        };
        Update: {
          id?: string;
          minimum?: number;
          points?: number;
          scheme_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "grade_scheme_rules_scheme_id_fkey";
            columns: ["scheme_id"];
            isOneToOne: false;
            referencedRelation: "grade_schemes";
            referencedColumns: ["id"];
          },
        ];
      };
      grade_schemes: {
        Row: {
          archived: boolean;
          created_at: string;
          id: string;
          name: string;
          updated_at: string;
        };
        Insert: {
          archived?: boolean;
          created_at?: string;
          id?: string;
          name: string;
          updated_at?: string;
        };
        Update: {
          archived?: boolean;
          created_at?: string;
          id?: string;
          name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      homeroom_assignments: {
        Row: {
          class_id: string;
          teacher_id: string;
          term_id: string;
        };
        Insert: {
          class_id: string;
          teacher_id: string;
          term_id: string;
        };
        Update: {
          class_id?: string;
          teacher_id?: string;
          term_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "homeroom_assignments_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "homeroom_assignments_teacher_id_fkey";
            columns: ["teacher_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "homeroom_assignments_term_id_fkey";
            columns: ["term_id"];
            isOneToOne: false;
            referencedRelation: "academic_terms";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          active: boolean;
          avatar: string;
          avatar_path: string | null;
          bio: string;
          contact_email: string;
          contact_phone: string;
          created_at: string;
          display_name: string;
          id: string;
          nickname: string;
          official_first_name: string;
          official_first_name_th: string;
          official_last_name: string;
          official_last_name_th: string;
          onboarding_complete: boolean;
          role: string;
          school_username: string | null;
          teaching_request: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          avatar?: string;
          avatar_path?: string | null;
          bio?: string;
          contact_email?: string;
          contact_phone?: string;
          created_at?: string;
          display_name: string;
          id: string;
          nickname?: string;
          official_first_name?: string;
          official_first_name_th?: string;
          official_last_name?: string;
          official_last_name_th?: string;
          onboarding_complete?: boolean;
          role: string;
          school_username?: string | null;
          teaching_request?: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          avatar?: string;
          avatar_path?: string | null;
          bio?: string;
          contact_email?: string;
          contact_phone?: string;
          created_at?: string;
          display_name?: string;
          id?: string;
          nickname?: string;
          official_first_name?: string;
          official_first_name_th?: string;
          official_last_name?: string;
          official_last_name_th?: string;
          onboarding_complete?: boolean;
          role?: string;
          school_username?: string | null;
          teaching_request?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      school_settings: {
        Row: {
          background_color: string;
          background_color_dark: string;
          default_language: string;
          default_scheme_id: string | null;
          id: boolean;
          login_domain: string;
          logo_url: string;
          name: string;
          primary_color: string;
          secondary_color: string;
          short_name: string;
          support_info: string;
        };
        Insert: {
          background_color?: string;
          background_color_dark?: string;
          default_language?: string;
          default_scheme_id?: string | null;
          id?: boolean;
          login_domain?: string;
          logo_url?: string;
          name?: string;
          primary_color?: string;
          secondary_color?: string;
          short_name?: string;
          support_info?: string;
        };
        Update: {
          background_color?: string;
          background_color_dark?: string;
          default_language?: string;
          default_scheme_id?: string | null;
          id?: boolean;
          login_domain?: string;
          logo_url?: string;
          name?: string;
          primary_color?: string;
          secondary_color?: string;
          short_name?: string;
          support_info?: string;
        };
        Relationships: [
          {
            foreignKeyName: "school_settings_default_scheme_id_fkey";
            columns: ["default_scheme_id"];
            isOneToOne: false;
            referencedRelation: "grade_schemes";
            referencedColumns: ["id"];
          },
        ];
      };
      student_grades: {
        Row: {
          created_at: string;
          grade_points: number | null;
          id: string;
          offering_id: string;
          published_at: string | null;
          result: string | null;
          score: number | null;
          state: string;
          student_id: string;
          updated_at: string;
          updated_by: string | null;
          version: number;
        };
        Insert: {
          created_at?: string;
          grade_points?: number | null;
          id?: string;
          offering_id: string;
          published_at?: string | null;
          result?: string | null;
          score?: number | null;
          state?: string;
          student_id: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Update: {
          created_at?: string;
          grade_points?: number | null;
          id?: string;
          offering_id?: string;
          published_at?: string | null;
          result?: string | null;
          score?: number | null;
          state?: string;
          student_id?: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "student_grades_offering_id_fkey";
            columns: ["offering_id"];
            isOneToOne: false;
            referencedRelation: "subject_offerings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_grades_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_grades_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      students: {
        Row: {
          active: boolean;
          created_at: string;
          first_name: string;
          id: string;
          last_name: string;
          student_number: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          first_name: string;
          id?: string;
          last_name: string;
          student_number: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          first_name?: string;
          id?: string;
          last_name?: string;
          student_number?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      subject_offerings: {
        Row: {
          archived: boolean;
          class_id: string;
          created_at: string;
          credits: number;
          grading_type: string;
          id: string;
          include_in_gpa: boolean;
          max_score: number;
          pass_mode: string;
          pass_threshold: number;
          scheme_id: string | null;
          subject_id: string;
          term_id: string;
          updated_at: string;
        };
        Insert: {
          archived?: boolean;
          class_id: string;
          created_at?: string;
          credits?: number;
          grading_type: string;
          id?: string;
          include_in_gpa?: boolean;
          max_score?: number;
          pass_mode?: string;
          pass_threshold?: number;
          scheme_id?: string | null;
          subject_id: string;
          term_id: string;
          updated_at?: string;
        };
        Update: {
          archived?: boolean;
          class_id?: string;
          created_at?: string;
          credits?: number;
          grading_type?: string;
          id?: string;
          include_in_gpa?: boolean;
          max_score?: number;
          pass_mode?: string;
          pass_threshold?: number;
          scheme_id?: string | null;
          subject_id?: string;
          term_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subject_offerings_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subject_offerings_scheme_id_fkey";
            columns: ["scheme_id"];
            isOneToOne: false;
            referencedRelation: "grade_schemes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subject_offerings_subject_id_fkey";
            columns: ["subject_id"];
            isOneToOne: false;
            referencedRelation: "subjects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subject_offerings_term_id_fkey";
            columns: ["term_id"];
            isOneToOne: false;
            referencedRelation: "academic_terms";
            referencedColumns: ["id"];
          },
        ];
      };
      subjects: {
        Row: {
          active: boolean;
          archived: boolean;
          code: string;
          created_at: string;
          default_credits: number | null;
          id: string;
          name_en: string;
          name_th: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          archived?: boolean;
          code: string;
          created_at?: string;
          default_credits?: number | null;
          id?: string;
          name_en: string;
          name_th: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          archived?: boolean;
          code?: string;
          created_at?: string;
          default_credits?: number | null;
          id?: string;
          name_en?: string;
          name_th?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      teacher_assignments: {
        Row: {
          created_at: string;
          offering_id: string;
          teacher_id: string;
        };
        Insert: {
          created_at?: string;
          offering_id: string;
          teacher_id: string;
        };
        Update: {
          created_at?: string;
          offering_id?: string;
          teacher_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "teacher_assignments_offering_id_fkey";
            columns: ["offering_id"];
            isOneToOne: false;
            referencedRelation: "subject_offerings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "teacher_assignments_teacher_id_fkey";
            columns: ["teacher_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      admin_update_teacher: {
        Args: { expected_updated_at: string; payload: Json; teacher: string };
        Returns: undefined;
      };
      archive_record: {
        Args: { kind: string; record_id: string };
        Returns: undefined;
      };
      assign_homeroom: {
        Args: {
          assigned: boolean;
          classroom: string;
          teacher: string;
          term: string;
        };
        Returns: undefined;
      };
      assign_teacher: {
        Args: { assigned: boolean; offering: string; teacher: string };
        Returns: undefined;
      };
      authorize_grade_reset: {
        Args: { actor: string; proof_hash: string; term: string };
        Returns: Json;
      };
      can_access_class: {
        Args: { classroom: string; term: string };
        Returns: boolean;
      };
      can_access_offering: { Args: { target: string }; Returns: boolean };
      can_access_student: { Args: { learner: string }; Returns: boolean };
      cancel_teacher_registration: {
        Args: { reservation: string };
        Returns: undefined;
      };
      clear_course_grades: {
        Args: {
          confirmation?: string;
          expected_rows?: Json;
          expected_version?: number;
          learner?: string;
          offering: string;
        };
        Returns: number;
      };
      close_teacher_registration: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      consume_limit: {
        Args: { bucket_key: string; max_attempts: number };
        Returns: boolean;
      };
      create_course: {
        Args: { class_ids: string[]; payload: Json; subject?: Json };
        Returns: number;
      };
      create_offerings: {
        Args: { class_ids: string[]; payload: Json };
        Returns: number;
      };
      delete_record: {
        Args: { kind: string; record_id: string };
        Returns: undefined;
      };
      import_students: { Args: { rows: Json; term: string }; Returns: number };
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_homeroom: {
        Args: { classroom: string; term: string };
        Returns: boolean;
      };
      can_edit_offering: { Args: { target: string }; Returns: boolean };
      class_homeroom_teachers: {
        Args: { classroom: string; term: string };
        Returns: Json;
      };
      is_staff: { Args: Record<PropertyKey, never>; Returns: boolean };
      issue_teacher_invite: {
        Args: { code_hash: string; days: number; max_uses: number };
        Returns: undefined;
      };
      list_students: { Args: { filters: Json }; Returns: Json };
      manage_record: { Args: { kind: string; payload: Json }; Returns: string };
      manage_record_v1: {
        Args: { kind: string; payload: Json };
        Returns: string;
      };
      manage_record_v2: {
        Args: { kind: string; payload: Json };
        Returns: string;
      };
      prepare_teacher_delete: {
        Args: { confirmation: string; teacher: string };
        Returns: undefined;
      };
      publish_grades: {
        Args: { offering: string; publish: boolean; rows: Json };
        Returns: number;
      };
      purge_record: {
        Args: { confirmation: string; kind: string; record_id: string };
        Returns: undefined;
      };
      remove_record: {
        Args: { kind: string; record_id: string };
        Returns: string;
      };
      remove_record_v2: {
        Args: { kind: string; record_id: string };
        Returns: string;
      };
      reserve_teacher_registration: {
        Args: {
          base_name: string;
          code_hash: string;
          first_name: string;
          first_name_th?: string;
          last_name: string;
          last_name_th?: string;
        };
        Returns: Json;
      };
      reserve_teacher_registration_v2: {
        Args: {
          base_name: string;
          code_hash: string;
          first_name: string;
          last_name: string;
        };
        Returns: Json;
      };
      reset_term_grades: {
        Args: { phrase: string; proof_hash: string; term: string };
        Returns: number;
      };
      restore_record: {
        Args: { kind: string; record_id: string };
        Returns: undefined;
      };
      review_feedback: {
        Args: { feedback_id: string; new_status: string };
        Returns: undefined;
      };
      save_grades: { Args: { offering: string; rows: Json }; Returns: number };
      save_grades_v1: {
        Args: { offering: string; rows: Json };
        Returns: number;
      };
      school_branding: { Args: Record<PropertyKey, never>; Returns: Json };
      set_teacher_photo: { Args: { path: string }; Returns: undefined };
      student_login: {
        Args: {
          account_bucket: string;
          ip_bucket: string;
          number: string;
          pin: string;
          token_hash: string;
        };
        Returns: boolean;
      };
      reset_student_pin: {
        Args: { learner: string; term: string; pin: string };
        Returns: undefined;
      };
      student_logout: { Args: { session_hash: string }; Returns: undefined };
      student_neighbors: {
        Args: { learner: string; term: string };
        Returns: Json;
      };
      student_portal: { Args: { session_hash: string }; Returns: Json };
      submit_feedback: { Args: { payload: Json }; Returns: string };
      teacher_invite_status: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      teacher_work: { Args: { term: string }; Returns: Json };
      update_assigned_student: { Args: { payload: Json }; Returns: string };
      update_school_settings: { Args: { payload: Json }; Returns: undefined };
      update_teacher_profile: { Args: { payload: Json }; Returns: undefined };
      write_student_grades: {
        Args: { learner: string; publish?: boolean; rows: Json; term: string };
        Returns: number;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;

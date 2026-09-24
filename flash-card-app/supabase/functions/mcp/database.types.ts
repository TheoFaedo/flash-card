export type Database = {
  public: {
    Tables: {
      cards: {
        Row: {
          id: string;
          question: string;
          answer: string;
          subject_id: string | null;
          column: number;
          review_interval_started_on: string;
          created_at: string;
          user_id: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      subjects: {
        Row: { id: string; name: string; user_id: string; created_at: string };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

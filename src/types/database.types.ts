/**
 * Tipos do banco de dados, espelhando o schema definido em `supabase/schema.sql`.
 *
 * Em produção você pode gerar este arquivo automaticamente com:
 *   npx supabase gen types typescript --project-id SEU_ID > src/types/database.types.ts
 *
 * Mantemos uma versão escrita à mão aqui para o projeto compilar sem o CLI.
 */

export type EventStatus = 'voting' | 'collecting' | 'finished';
export type TreasurerMode = 'vote' | 'direct';
export type PaymentStatus = 'pending' | 'paid_unconfirmed' | 'confirmed';

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          full_name: string;
          default_pix_key: string | null;
          avatar_url: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          full_name: string;
          default_pix_key?: string | null;
          avatar_url?: string | null;
          created_at?: string;
        };
        Update: {
          full_name?: string;
          default_pix_key?: string | null;
          avatar_url?: string | null;
        };
        Relationships: [];
      };
      events: {
        Row: {
          id: string;
          title: string;
          created_by: string;
          total_amount: number;
          treasurer_id: string | null;
          treasurer_pix_key: string | null;
          status: EventStatus;
          treasurer_mode: TreasurerMode;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          created_by: string;
          total_amount?: number;
          treasurer_id?: string | null;
          treasurer_pix_key?: string | null;
          status?: EventStatus;
          treasurer_mode?: TreasurerMode;
          created_at?: string;
        };
        Update: {
          title?: string;
          total_amount?: number;
          treasurer_id?: string | null;
          treasurer_pix_key?: string | null;
          status?: EventStatus;
          treasurer_mode?: TreasurerMode;
        };
        Relationships: [];
      };
      items: {
        Row: {
          id: string;
          event_id: string;
          name: string;
          price: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          name: string;
          price: number;
          created_at?: string;
        };
        Update: {
          name?: string;
          price?: number;
        };
        Relationships: [];
      };
      participants: {
        Row: {
          id: string;
          event_id: string;
          user_id: string;
          voted_for_id: string | null;
          payment_status: PaymentStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          user_id: string;
          voted_for_id?: string | null;
          payment_status?: PaymentStatus;
          created_at?: string;
        };
        Update: {
          voted_for_id?: string | null;
          payment_status?: PaymentStatus;
        };
        Relationships: [];
      };
      messages: {
        Row: {
          id: string;
          event_id: string;
          user_id: string;
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          user_id: string;
          content: string;
          created_at?: string;
        };
        Update: {
          content?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_event_participant: {
        Args: { p_event_id: string };
        Returns: boolean;
      };
      is_event_treasurer: {
        Args: { p_event_id: string };
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
  };
}

/* ----------------------------------------------------------------------------
 * Atalhos de tipos usados pela aplicação
 * ------------------------------------------------------------------------- */
export type UserProfile = Database['public']['Tables']['users']['Row'];
export type EventRow = Database['public']['Tables']['events']['Row'];
export type ItemRow = Database['public']['Tables']['items']['Row'];
export type ParticipantRow = Database['public']['Tables']['participants']['Row'];
export type MessageRow = Database['public']['Tables']['messages']['Row'];

/** Perfil resumido usado em listas, votação e chat. */
export type PublicProfile = Pick<UserProfile, 'id' | 'full_name' | 'avatar_url'>;

/** Participante já com o perfil do usuário embutido (join). */
export interface ParticipantWithProfile extends ParticipantRow {
  user: PublicProfile;
}

// Auto-generated types for ASU-Connect database
// Update these if you modify the schema

export interface Database {
  public: {
    Tables: {
      clubs: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      events: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          event_date: string;
          location: string | null;
          club_id: string;
          created_by: string;
          created_at: string;
          updated_at: string;
          category: EventCategory | null;
          is_free: boolean;
          price: number | null;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          event_date: string;
          location?: string | null;
          club_id: string;
          created_by: string;
          created_at?: string;
          updated_at?: string;
          category?: EventCategory | null;
          is_free?: boolean;
          price?: number | null;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string | null;
          event_date?: string;
          location?: string | null;
          club_id?: string;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
          category?: EventCategory | null;
          is_free?: boolean;
          price?: number | null;
        };
      };
      club_members: {
        Row: {
          id: string;
          club_id: string;
          user_id: string;
          role: 'admin' | 'member';
          status: 'pending' | 'approved' | 'rejected';
          joined_at: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          user_id: string;
          role?: 'admin' | 'member';
          status?: 'pending' | 'approved' | 'rejected';
          joined_at?: string;
        };
        Update: {
          id?: string;
          club_id?: string;
          user_id?: string;
          role?: 'admin' | 'member';
          status?: 'pending' | 'approved' | 'rejected';
          joined_at?: string;
        };
      };
      event_registrations: {
        Row: {
          id: string;
          event_id: string;
          user_id: string;
          registered_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          user_id: string;
          registered_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          user_id?: string;
          registered_at?: string;
        };
      };
      event_flags: {
        Row: {
          id: string;
          event_id: string;
          user_id: string;
          reason: string;
          details: string | null;
          status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          user_id: string;
          reason: string;
          details?: string | null;
          status?: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          user_id?: string;
          reason?: string;
          details?: string | null;
          status?: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      club_flags: {
        Row: {
          id: string;
          club_id: string;
          user_id: string;
          reason: string;
          details: string | null;
          status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          user_id: string;
          reason: string;
          details?: string | null;
          status?: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          club_id?: string;
          user_id?: string;
          reason?: string;
          details?: string | null;
          status?: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      club_announcements: {
        Row: {
          id: string;
          club_id: string;
          created_by: string;
          title: string;
          content: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          created_by: string;
          title: string;
          content: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          club_id?: string;
          created_by?: string;
          title?: string;
          content?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
}

// Helper types
export type Club = Database['public']['Tables']['clubs']['Row'];
export type Event = Database['public']['Tables']['events']['Row'];
export type ClubMember = Database['public']['Tables']['club_members']['Row'];
export type EventRegistration = Database['public']['Tables']['event_registrations']['Row'];
export type EventFlag = Database['public']['Tables']['event_flags']['Row'];
export type ClubFlag = Database['public']['Tables']['club_flags']['Row'];
export type ClubAnnouncement = Database['public']['Tables']['club_announcements']['Row'];

export type ClubInsert = Database['public']['Tables']['clubs']['Insert'];
export type EventInsert = Database['public']['Tables']['events']['Insert'];
export type ClubMemberInsert = Database['public']['Tables']['club_members']['Insert'];
export type EventRegistrationInsert = Database['public']['Tables']['event_registrations']['Insert'];
export type EventFlagInsert = Database['public']['Tables']['event_flags']['Insert'];
export type ClubFlagInsert = Database['public']['Tables']['club_flags']['Insert'];
export type ClubAnnouncementInsert = Database['public']['Tables']['club_announcements']['Insert'];

export type ClubUpdate = Database['public']['Tables']['clubs']['Update'];
export type EventUpdate = Database['public']['Tables']['events']['Update'];
export type ClubMemberUpdate = Database['public']['Tables']['club_members']['Update'];
export type EventRegistrationUpdate = Database['public']['Tables']['event_registrations']['Update'];
export type EventFlagUpdate = Database['public']['Tables']['event_flags']['Update'];
export type ClubFlagUpdate = Database['public']['Tables']['club_flags']['Update'];
export type ClubAnnouncementUpdate = Database['public']['Tables']['club_announcements']['Update'];

// Role types
export type MemberRole = 'admin' | 'member';
export type MembershipStatus = 'pending' | 'approved' | 'rejected';

// Event category types
export type EventCategory = 'Academic' | 'Social' | 'Sports' | 'Arts' | 'Career' | 'Community Service' | 'Other';

// Event flag types
export type FlagStatus = 'pending' | 'reviewed' | 'resolved' | 'dismissed';
export type FlagReason = 'Inappropriate Content' | 'Spam' | 'Misinformation' | 'Other';

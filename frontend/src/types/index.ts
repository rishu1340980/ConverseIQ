export type Role = 'Faculty' | 'HOD' | 'Admin';

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  department_id?: number | null;
  department_name?: string;
  is_active: boolean;
  created_at: string;
  meeting_count?: number;
}

export interface Participant {
  id?: number;
  name: string;
  email?: string;
  speaker_label?: string;
}

export interface ActionItem {
  id: number;
  meeting_id: number;
  task: string;
  owner_name: string;
  owner_id?: number | null;
  priority: 'High' | 'Medium' | 'Low';
  status: 'Pending' | 'Completed';
  due_date?: string | null;
  created_at?: string;
}

export interface Utterance {
  speaker: string;
  raw_speaker?: string;
  text: string;
  translation?: string;
  language?: 'Hindi' | 'English' | 'Hinglish' | string;
  timestamp?: string;
  start?: number;
  end?: number;
}

export interface MinutesOfMeeting {
  id?: number;
  meeting_id: number;
  summary: string;
  decisions: string[];
  topics_discussed: Array<{ topic: string; points: string[] }>;
  raw_transcript?: string | null;
  utterances?: Utterance[];
  is_finalized: boolean;
  updated_at?: string;
}

export interface Meeting {
  id: number;
  title: string;
  date: string;
  duration_minutes: number;
  status: 'Scheduled' | 'In Progress' | 'Processing' | 'Completed' | 'Failed';
  created_by_id: number;
  department_id?: number | null;
  participant_count?: number;
  participants: Participant[];
  audio_file_path?: string | null;
  mom?: MinutesOfMeeting | null;
  action_items?: ActionItem[];
}

export interface DashboardMetrics {
  total_meetings: number;
  pending_action_items: number;
  upcoming_deadlines_count: number;
  upcoming_sessions_count: number;
}

export interface FacultyDashboardData {
  greeting: string;
  user_name: string;
  role: Role;
  metrics: DashboardMetrics;
  recent_meetings: Meeting[];
  upcoming_this_week: Meeting[];
  priority_action_items: ActionItem[];
}

export interface AdminDashboardData {
  total_faculty: number;
  total_meetings: number;
  action_items_tracked: number;
  active_departments: number;
  completion_percentage: number;
  department_activity: Array<{
    department_id: number;
    department_name: string;
    faculty_count: number;
    meeting_count: number;
  }>;
  system_alerts: Array<{
    id: number;
    action: string;
    details: string;
    severity: 'Info' | 'OK' | 'Warn' | 'Alert';
    timestamp: string;
  }>;
}

export interface AuditLog {
  id: number;
  action: string;
  details: string;
  severity: 'Info' | 'OK' | 'Warn' | 'Alert';
  user_id?: number | null;
  ip_address?: string | null;
  resource_type?: string | null;
  resource_id?: number | null;
  timestamp: string;
}

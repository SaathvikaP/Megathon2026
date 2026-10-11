// Hand-written row types for the tables the app reads. Regenerate full types
// with `npm run db:types` once the Supabase CLI is linked.
import type { LessonBlock, SourceReference } from '@/lib/content/blocks';

export type Profile = {
  id: string;
  display_name: string;
  student_identifier: string | null;
  grade_level: number | null;
  account_status: 'active' | 'suspended';
  created_at: string;
};

export type OrgRole = 'student' | 'teacher' | 'organization_admin';
export type MembershipStatus = 'pending' | 'approved' | 'rejected' | 'revoked';

export type Organization = {
  id: string;
  name: string;
  org_type: 'school' | 'ngo';
  description: string | null;
  city: string | null;
  contact_email: string | null;
  approval_status: 'pending' | 'approved' | 'rejected' | 'suspended';
  review_note: string | null;
  created_by: string | null;
  created_at: string;
};

export type Membership = {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrgRole;
  status: MembershipStatus;
  created_at: string;
};

export type Pillar = {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  description: string;
  icon: string;
  sort_order: number;
};

export type Lesson = {
  id: string;
  pillar_id: string;
  slug: string;
  title: string;
  summary: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  learning_objectives: string[];
  content: LessonBlock[];
  estimated_minutes: number;
  is_published: boolean;
  sort_order: number;
  source_references: SourceReference[];
};

export type LessonProgress = {
  user_id: string;
  lesson_id: string;
  status: 'in_progress' | 'completed';
  started_at: string;
  completed_at: string | null;
};

export type QuestOverviewRow = {
  quiz_id: string;
  slug: string;
  title: string;
  level: number;
  description: string;
  question_count: number;
  pass_correct_threshold: number;
  unlocked: boolean;
  passed: boolean;
  attempts_completed: number;
  best_points: number;
  best_correct: number;
  latest_points: number | null;
  latest_correct: number | null;
  in_progress_attempt_id: string | null;
};

export type QuizAttempt = {
  id: string;
  user_id: string;
  quiz_id: string;
  attempt_number: number;
  status: 'in_progress' | 'completed';
  question_count: number;
  correct_count: number;
  incorrect_count: number;
  base_points: number;
  bonus_points: number;
  total_points: number;
  passed: boolean;
  started_at: string;
  completed_at: string | null;
};

export type ComicPanel = {
  stage: 'situation' | 'misconception' | 'discovery' | 'explanation' | 'takeaway';
  setting: string;
  visual: string;
  dialogue: { speaker: string; line: string }[];
  caption?: string;
};

export type ComicScript = { characters: string[]; panels: ComicPanel[] };

export type RemediationComic = {
  id: string;
  question_id: string | null;
  lesson_id: string | null;
  slug: string | null;
  title: string;
  description: string;
  topic: string;
  concept: string;
  misconception: string;
  script: ComicScript;
  takeaway: string;
  alt_text: string;
  source_references: SourceReference[];
  asset_path: string | null;
  asset_mime_type: string | null;
  asset_size_bytes: number | null;
  provider: 'comicsmaker_manual' | 'comicsmaker_api' | 'other_manual' | 'openai_images';
  provider_generation_id: string | null;
  generation_status: 'script_draft' | 'script_ready' | 'awaiting_asset' | 'generating' | 'asset_uploaded' | 'generation_failed';
  generation_error: string | null;
  review_status: 'draft' | 'in_review' | 'approved' | 'rejected';
  review_note: string | null;
  is_published: boolean;
  published_at: string | null;
  updated_at: string;
};

export type FeedbackComic = {
  id: string;
  title: string;
  takeaway: string;
  panels: ComicPanel[] | null;
  asset_path: string | null;
  alt_text: string;
  image_url?: string | null;
};

export type AttemptSummary = {
  attempt_id: string;
  quiz_id: string;
  level: number;
  correct_count: number;
  incorrect_count: number;
  question_count: number;
  base_points: number;
  bonus_points: number;
  total_points: number;
  passed: boolean;
  pass_correct_threshold: number;
  next_level: { quiz_id: string; level: number; title: string } | null;
};

export type AnswerFeedback = {
  answer_id: string;
  question_id: string;
  selected_option_id: string;
  is_correct: boolean;
  correct_option_id: string;
  explanation: string;
  teaching_point: string;
  base_points: number;
  bonus_points: number;
  comic: FeedbackComic | null;
  practice_question_id: string | null;
  replayed?: boolean;
  answered_count?: number;
  question_count?: number;
  attempt_summary?: AttemptSummary | null;
};

export type ExternalActivity = {
  id: string;
  title: string;
  description: string;
  url: string;
  provider_name: string;
  pillar_id: string | null;
  is_published: boolean;
  sort_order: number;
};

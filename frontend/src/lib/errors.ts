// Maps database error codes raised by our SQL functions (errcode P0001) and common
// PostgREST errors to friendly messages. Never forwards raw database errors to users.

const MESSAGES: Record<string, string> = {
  not_authenticated: 'Please sign in to continue.',
  account_suspended: 'Your account is suspended. Please contact your organisation or the platform team.',
  forbidden: 'You do not have permission to do that.',
  not_found: 'We could not find that item.',
  level_locked: 'This level is still locked. Get at least 4 out of 5 right in the previous level to unlock it.',
  quiz_not_ready: 'This quiz is not ready yet. Please try again later.',
  attempt_closed: 'This attempt is already finished. Start a new attempt to try again.',
  invalid_question: 'That question is not part of this attempt.',
  invalid_option: 'Please choose one of the listed answers.',
  invalid_join_code: 'That join code is not valid. Check it with your teacher or organisation.',
  too_many_attempts: 'Too many incorrect codes. Please wait 15 minutes and try again.',
  too_many_pending_requests: 'You already have several organisation requests waiting for review.',
  invalid_decision: 'That action is not allowed.',
  invalid_role: 'That role is not allowed here.',
  invalid_expiry: 'Choose an expiry between 1 and 365 days.',
  invalid_max_uses: 'Maximum uses must be between 1 and 5000.',
  cannot_modify_own_membership: 'You cannot change your own membership.',
  cannot_modify_self: 'You cannot change your own account status.',
  cannot_leave: 'You cannot leave this organisation (organisation admins must be removed by a platform admin).',
  last_platform_admin: 'At least one platform administrator must remain.',
  invalid_status: 'That status is not allowed.',
  comic_not_approved: 'Approve the comic before publishing it.',
  comic_incomplete: 'Add at least 3 panels (or an uploaded image) and a takeaway before publishing.',
  asset_mismatch: 'The uploaded file does not belong to this comic.',
  asset_missing: 'The uploaded file could not be found. Please upload it again.',
  invalid_file_type: 'Only PNG, JPEG or WebP images are allowed.',
  invalid_file_size: 'Images must be 5 MB or smaller.',
};

type MaybeError = { message?: string; code?: string } | null | undefined;

export function errorCode(error: MaybeError): string | undefined {
  if (!error?.message) return undefined;
  const msg = error.message.trim();
  return MESSAGES[msg] ? msg : undefined;
}

export function toUserMessage(error: MaybeError, fallback = 'Something went wrong. Please try again.'): string {
  if (!error) return fallback;
  const code = errorCode(error);
  if (code) return MESSAGES[code];
  if (error.code === '23505') return 'That already exists.';
  if (error.code === '23503') return 'This item is still in use and cannot be removed.';
  if (error.code === '42501') return MESSAGES.forbidden;
  if (error.code === '23514') return 'Some values are not allowed. Please check the form.';
  return fallback;
}

export type ActionState = { ok?: boolean; error?: string; message?: string; fieldErrors?: Record<string, string>; redirectTo?: string };

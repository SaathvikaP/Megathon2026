'use client';

import Link from 'next/link';
import { useActionState, useEffect } from 'react';
import { FieldError, FormMessage, SubmitButton } from '@/components/forms';
import type { ActionState } from '@/lib/errors';
import { forgotPasswordAction, resetPasswordAction, signInAction, signUpAction } from './actions';

const initial: ActionState = {};

function Field({ label, name, type = 'text', autoComplete, state, help, required = true }: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  state: ActionState;
  help?: string;
  required?: boolean;
}) {
  const err = state.fieldErrors?.[name];
  return (
    <div>
      <label htmlFor={name} className="label">{label}</label>
      <input
        id={name}
        name={name}
        type={type}
        autoComplete={autoComplete}
        required={required}
        className="input"
        aria-invalid={Boolean(err)}
        aria-describedby={err ? `${name}-error` : help ? `${name}-help` : undefined}
      />
      {help ? <p id={`${name}-help`} className="help">{help}</p> : null}
      <FieldError state={state} name={name} />
    </div>
  );
}

export function SignInForm({ next, onSignedIn }: { next: string; onSignedIn: (redirectTo: string) => void }) {
  const [state, action] = useActionState(signInAction, initial);
  const signedIn = Boolean(state.ok && state.redirectTo);

  useEffect(() => {
    if (state.ok && state.redirectTo) onSignedIn(state.redirectTo);
  }, [state, onSignedIn]);

  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="next" value={next} />
      <Field label="Email" name="email" type="email" autoComplete="email" state={state} />
      <Field label="Password" name="password" type="password" autoComplete="current-password" state={state} />
      <FormMessage state={state} />
      {signedIn ? (
        <p role="status" className="rounded-lg bg-brand-50 px-3 py-2 text-sm font-medium text-brand-900">
          Signed in. Taking you to your dashboard…
        </p>
      ) : (
        <SubmitButton className="btn-primary w-full" pendingText="Signing in…">Sign in</SubmitButton>
      )}
      <div className="flex justify-between text-sm">
        <Link href="/forgot-password" className="link">Forgot password?</Link>
        <Link href="/signup" className="link">Create an account</Link>
      </div>
    </form>
  );
}

export function SignUpForm() {
  const [state, action] = useActionState(signUpAction, initial);
  if (state.ok) return <FormMessage state={state} />;
  return (
    <form action={action} className="space-y-4" noValidate>
      <Field label="Display name" name="displayName" autoComplete="nickname" state={state} help="A first name or nickname is enough. Your teacher sees this name." />
      <Field label="Email" name="email" type="email" autoComplete="email" state={state} />
      <Field label="Password" name="password" type="password" autoComplete="new-password" state={state} help="At least 8 characters with a letter and a number." />
      <Field label="Confirm password" name="confirm" type="password" autoComplete="new-password" state={state} />
      <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-950">
        <label className="flex items-start gap-2">
          <input type="checkbox" name="consent" className="mt-1 h-4 w-4" required />
          <span>
            I understand this is a learning platform. I will never enter real bank details, card numbers, UPI PINs or OTPs here.
            If I am under 18, a parent, guardian or teacher knows I am using it.
          </span>
        </label>
        <FieldError state={state} name="consent" />
      </div>
      <FormMessage state={state} />
      <SubmitButton className="btn-primary w-full" pendingText="Creating account…">Create account</SubmitButton>
      <p className="text-center text-sm">Already have an account? <Link href="/login" className="link">Sign in</Link></p>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action] = useActionState(forgotPasswordAction, initial);
  return (
    <form action={action} className="space-y-4" noValidate>
      <Field label="Email" name="email" type="email" autoComplete="email" state={state} />
      <FormMessage state={state} />
      <SubmitButton className="btn-primary w-full" pendingText="Sending…">Send reset link</SubmitButton>
      <p className="text-center text-sm"><Link href="/login" className="link">Back to sign in</Link></p>
    </form>
  );
}

export function ResetPasswordForm() {
  const [state, action] = useActionState(resetPasswordAction, initial);
  return (
    <form action={action} className="space-y-4" noValidate>
      <Field label="New password" name="password" type="password" autoComplete="new-password" state={state} help="At least 8 characters with a letter and a number." />
      <Field label="Confirm new password" name="confirm" type="password" autoComplete="new-password" state={state} />
      <FormMessage state={state} />
      <SubmitButton className="btn-primary w-full" pendingText="Updating…">Update password</SubmitButton>
    </form>
  );
}

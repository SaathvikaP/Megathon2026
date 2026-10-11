'use client';

import { useFormStatus } from 'react-dom';
import type { ReactNode } from 'react';
import type { ActionState } from '@/lib/errors';

export function SubmitButton({ children, pendingText = 'Saving…', className = 'btn-primary', name, value, confirm, disabled = false }: {
  children: ReactNode;
  pendingText?: string;
  className?: string;
  name?: string;
  value?: string;
  confirm?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={className}
      disabled={pending || disabled}
      aria-disabled={pending || disabled}
      name={name}
      value={value}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {pending ? pendingText : children}
    </button>
  );
}

export function FormMessage({ state }: { state: ActionState | undefined }) {
  if (!state) return null;
  if (state.error) {
    return (
      <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-900">
        {state.error}
      </p>
    );
  }
  if (state.message) {
    return (
      <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
        {state.message}
      </p>
    );
  }
  return null;
}

export function FieldError({ state, name }: { state: ActionState | undefined; name: string }) {
  const msg = state?.fieldErrors?.[name];
  if (!msg) return null;
  return (
    <p className="mt-1 text-xs text-red-800" id={`${name}-error`}>
      {msg}
    </p>
  );
}

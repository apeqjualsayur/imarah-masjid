"use client";

import type { ComponentProps, ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { CircleAlert, CircleCheck } from "lucide-react";

const control =
  "mt-1.5 block min-h-tap w-full rounded-chip border border-border bg-surface px-4 py-3 text-base text-ink placeholder:text-muted";

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="font-semibold">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-sm text-muted">{hint}</span> : null}
    </label>
  );
}

export function TextInput(props: ComponentProps<"input">) {
  return <input {...props} className={`${control} ${props.className ?? ""}`} />;
}

export function SelectInput(props: ComponentProps<"select">) {
  return <select {...props} className={`${control} ${props.className ?? ""}`} />;
}

export function TextArea(props: ComponentProps<"textarea">) {
  return <textarea {...props} className={`${control} ${props.className ?? ""}`} />;
}

const buttonStyles = {
  primary: "bg-primary text-surface hover:bg-primary-dark",
  secondary: "border border-border bg-surface text-primary-dark hover:bg-tint",
  quiet: "text-primary-dark underline underline-offset-4",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: keyof typeof buttonStyles }) {
  return (
    <button
      {...props}
      className={`inline-flex min-h-tap items-center justify-center gap-2 rounded-chip px-5 font-semibold disabled:opacity-60 ${buttonStyles[variant]} ${className}`}
    />
  );
}

/** Disables itself and shows the pending label while the form is sending. */
export function SubmitButton({
  children,
  pendingLabel,
  ...props
}: ComponentProps<typeof Button> & { pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || props.disabled} aria-busy={pending} {...props}>
      {pending ? pendingLabel : children}
    </Button>
  );
}

/** Status message. Uses an icon and words, never colour alone. */
export function Notice({ tone, children }: { tone: "error" | "success"; children: ReactNode }) {
  const Icon = tone === "error" ? CircleAlert : CircleCheck;
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={`flex items-start gap-2 rounded-chip px-4 py-3 text-sm ${
        tone === "error" ? "bg-warn-bg text-warn-ink" : "bg-tint text-primary-dark"
      }`}
    >
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

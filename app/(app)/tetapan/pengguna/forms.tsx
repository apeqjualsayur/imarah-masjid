"use client";

import { useActionState, useState } from "react";
import { Check, Copy, MessageCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button, Field, Notice, SelectInput, SubmitButton, TextInput } from "@/components/ui/forms";
import { ROLES, type Role } from "@/lib/permissions";
import {
  changeRole,
  inviteUser,
  revokeInvitation,
  setActive,
  type InviteState,
  type RowState,
} from "./actions";

export function InviteForm() {
  const t = useTranslations("users");
  const roles = useTranslations("roles");
  const errors = useTranslations("errors");
  const [state, action] = useActionState(inviteUser, {} as InviteState);

  return (
    <>
      <form action={action} className="mt-4 grid gap-4 md:grid-cols-[1fr_14rem_auto] md:items-end">
        <Field label={t("email")}>
          <TextInput name="email" type="email" autoComplete="off" required />
        </Field>
        <Field label={t("role")}>
          <SelectInput name="role" required defaultValue="">
            <option value="" disabled>
              {t("chooseRole")}
            </option>
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {roles(role)}
              </option>
            ))}
          </SelectInput>
        </Field>
        <SubmitButton pendingLabel={t("sending")}>{t("sendInvite")}</SubmitButton>
      </form>

      {state.error ? (
        <div className="mt-4">
          <Notice tone="error">{errors(state.error)}</Notice>
        </div>
      ) : null}
      {state.link ? <InviteLink link={state.link} email={state.email ?? ""} emailed={!!state.emailed} /> : null}
    </>
  );
}

function InviteLink({ link, email, emailed }: { link: string; email: string; emailed: boolean }) {
  const t = useTranslations("users");
  const [copied, setCopied] = useState(false);
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(t("whatsappText", { link }))}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="mt-4 space-y-3 rounded-chip bg-tint p-4">
      <Notice tone="success">{emailed ? t("emailSent", { email }) : t("emailNotSent", { email })}</Notice>
      <label className="block">
        <span className="text-sm font-semibold">{t("linkLabel")}</span>
        <TextInput readOnly value={link} onFocus={(e) => e.currentTarget.select()} data-testid="invite-link" />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={copy}>
          {copied ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
          {copied ? t("copied") : t("copy")}
        </Button>
        <a
          href={whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-tap items-center gap-2 rounded-chip border border-border bg-surface px-5 font-semibold text-primary-dark"
        >
          <MessageCircle aria-hidden className="size-4" />
          {t("shareWhatsApp")}
        </a>
      </div>
      <p className="text-sm text-muted">{t("linkHelp")}</p>
    </div>
  );
}

export function MemberControls({
  userId,
  name,
  role,
  active,
}: {
  userId: string;
  name: string;
  role: Role;
  active: boolean;
}) {
  const t = useTranslations("users");
  const roles = useTranslations("roles");
  const errors = useTranslations("errors");
  const [roleState, roleAction] = useActionState(changeRole.bind(null, userId), {} as RowState);
  const [statusState, statusAction] = useActionState(setActive.bind(null, userId, !active), {} as RowState);
  const error = roleState.error ?? statusState.error;

  return (
    <div className="flex flex-wrap items-end gap-2">
      {active ? (
        <form action={roleAction} className="flex items-end gap-2">
          <label>
            <span className="sr-only">{t("roleFor", { name })}</span>
            <SelectInput name="role" defaultValue={role} className="mt-0 w-40">
              {ROLES.map((option) => (
                <option key={option} value={option}>
                  {roles(option)}
                </option>
              ))}
            </SelectInput>
          </label>
          <SubmitButton variant="secondary" pendingLabel={t("saving")}>
            {t("saveRole")}
          </SubmitButton>
        </form>
      ) : null}
      <form
        action={statusAction}
        onSubmit={(event) => {
          if (active && !window.confirm(t("confirmDeactivate", { name }))) event.preventDefault();
        }}
      >
        <SubmitButton variant="secondary" pendingLabel={t("saving")} aria-label={`${t(active ? "deactivate" : "reactivate")}: ${name}`}>
          {t(active ? "deactivate" : "reactivate")}
        </SubmitButton>
      </form>
      {error ? (
        <div className="basis-full">
          <Notice tone="error">{errors(error)}</Notice>
        </div>
      ) : null}
    </div>
  );
}

export function RevokeButton({ id, email }: { id: string; email: string }) {
  const t = useTranslations("users");
  const errors = useTranslations("errors");
  const [state, action] = useActionState(revokeInvitation.bind(null, id), {} as RowState);

  return (
    <form action={action} className="flex flex-col items-end gap-2">
      <SubmitButton variant="secondary" pendingLabel={t("saving")} aria-label={`${t("revoke")}: ${email}`}>
        {t("revoke")}
      </SubmitButton>
      {state.error ? <Notice tone="error">{errors(state.error)}</Notice> : null}
    </form>
  );
}

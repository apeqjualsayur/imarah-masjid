import Link from "next/link";
import { MessageCircle, Pencil, Plus } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { BackLink } from "@/components/BackLink";
import { ConsentBadges } from "@/components/kariah/ConsentBadges";
import { DeleteButton } from "@/components/kariah/DeleteButton";
import { HouseholdHistory } from "@/components/kariah/HouseholdHistory";
import { formatDate } from "@/lib/dates";
import { ageOn } from "@/lib/kariah";
import { can } from "@/lib/permissions";
import { formatPhone, whatsappLink } from "@/lib/phone";
import { requireMember } from "@/lib/session";
import { deleteHousehold } from "../actions";
import { loadHousehold } from "./data";

export default async function HouseholdPage({ params }: PageProps<"/kariah/[id]">) {
  const { role } = await requireMember("kariah.view");
  const { id } = await params;
  const household = await loadHousehold(id);
  const t = await getTranslations("kariah");
  const locale = await getLocale();
  const canEdit = can(role, "kariah.edit");
  const wa = household.phone && household.whatsapp_opt_in ? whatsappLink(household.phone) : null;
  const today = new Date();

  const consentLine = (at: string | null) => (at ? t("consentOn", { date: formatDate(at, locale) }) : t("consentNo"));

  return (
    <>
      <BackLink href="/kariah" label={t("title")} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight">{household.head_name}</h1>
        {canEdit ? (
          <Link
            href={`/kariah/${household.id}/ubah`}
            className="inline-flex min-h-tap items-center gap-2 rounded-chip border border-border bg-surface px-4 font-semibold text-primary-dark"
          >
            <Pencil aria-hidden className="size-4" />
            {t("edit")}
          </Link>
        ) : null}
      </div>

      <section aria-labelledby="butiran" className="mt-5 rounded-card bg-surface p-5">
        <h2 id="butiran" className="sr-only">
          {t("details")}
        </h2>
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[10rem_1fr]">
          <dt className="text-sm text-muted">{t("address")}</dt>
          <dd className="whitespace-pre-line">{household.address || "—"}</dd>
          <dt className="text-sm text-muted">{t("phone")}</dt>
          <dd className="flex flex-wrap items-center gap-3">
            {household.phone ? formatPhone(household.phone) : "—"}
            {wa ? (
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-tap items-center gap-1 text-sm font-semibold text-primary-dark underline underline-offset-4"
              >
                <MessageCircle aria-hidden className="size-4" />
                WhatsApp
              </a>
            ) : null}
          </dd>
          <dt className="text-sm text-muted">{t("consentTitle")}</dt>
          <dd className="space-y-1">
            <ConsentBadges whatsapp={household.whatsapp_opt_in} pdpa={!!household.pdpa_consent_at} />
            <p className="text-sm text-muted">
              WhatsApp: {consentLine(household.whatsapp_consent_at)} · PDPA: {consentLine(household.pdpa_consent_at)}
            </p>
          </dd>
        </dl>
      </section>

      <section aria-labelledby="ahli" className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="ahli" className="text-lg font-bold">
            {t("members")}
          </h2>
          {canEdit ? (
            <Link
              href={`/kariah/${household.id}/ahli/baru`}
              className="inline-flex min-h-tap items-center gap-2 rounded-chip bg-primary px-4 font-semibold text-surface"
            >
              <Plus aria-hidden className="size-4" />
              {t("addMember")}
            </Link>
          ) : null}
        </div>
        {household.members.length === 0 ? (
          <p className="mt-3 rounded-card bg-surface p-5 text-muted">{t("noMembers")}</p>
        ) : (
          <ul className="mt-3 divide-y divide-rule rounded-card bg-surface">
            {household.members.map((member) => (
              <li key={member.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{member.name}</p>
                  <p className="text-sm text-muted">
                    {[
                      member.relation ? t(`relations.${member.relation}`) : null,
                      member.date_of_birth ? t("age", { age: ageOn(member.date_of_birth, today) }) : null,
                      member.ic_last4 ? t("icShown", { last4: member.ic_last4 }) : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </p>
                </div>
                {canEdit ? (
                  <Link
                    href={`/kariah/${household.id}/ahli/${member.id}`}
                    className="inline-flex min-h-tap items-center gap-1 text-sm font-semibold text-primary-dark"
                    aria-label={`${t("edit")}: ${member.name}`}
                  >
                    <Pencil aria-hidden className="size-4" />
                    {t("edit")}
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-sm text-muted">{t("icNote")}</p>
      </section>

      {can(role, "audit.view") ? <HouseholdHistory householdId={household.id} /> : null}

      {canEdit ? (
        <section aria-labelledby="padam" className="mt-8 border-t border-rule pt-5">
          <h2 id="padam" className="sr-only">
            {t("deleteHousehold")}
          </h2>
          <DeleteButton
            action={deleteHousehold.bind(null, household.id)}
            label={t("deleteHousehold")}
            confirmText={t("confirmDeleteHousehold", { name: household.head_name })}
          />
        </section>
      ) : null}
    </>
  );
}

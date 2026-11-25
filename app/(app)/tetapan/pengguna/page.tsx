import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { formatDate } from "@/lib/dates";
import { isRole, type Role } from "@/lib/permissions";
import { requireMember } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { InviteForm, MemberControls, RevokeButton } from "./forms";

type MasjidUser = {
  user_id: string;
  full_name: string | null;
  email: string;
  role: string;
  status: string;
  joined_at: string;
};

type Invitation = { id: string; email: string; role: string; expires_at: string };

export default async function PenggunaPage() {
  const { user } = await requireMember("users.manage");
  const t = await getTranslations("users");
  const roles = await getTranslations("roles");
  const locale = await getLocale();
  const supabase = await createClient();

  const [{ data: usersData }, { data: invitesData }] = await Promise.all([
    supabase.rpc("masjid_users"),
    supabase
      .from("invitations")
      .select("id, email, role, expires_at")
      .is("accepted_at", null)
      .is("revoked_at", null)
      .order("created_at", { ascending: false }),
  ]);
  const users = (usersData ?? []) as MasjidUser[];
  const invites = (invitesData ?? []) as Invitation[];

  return (
    <>
      <Link href="/tetapan" className="inline-flex min-h-tap items-center gap-1 text-sm font-semibold text-primary-dark">
        <ChevronLeft aria-hidden className="size-4" />
        {t("back")}
      </Link>
      <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
      <p className="mt-1 text-muted">{t("lead")}</p>

      <section aria-labelledby="jemput" className="mt-6 rounded-card bg-surface p-5">
        <h2 id="jemput" className="text-lg font-bold">
          {t("inviteTitle")}
        </h2>
        <InviteForm />
      </section>

      <section aria-labelledby="ahli" className="mt-6">
        <h2 id="ahli" className="text-lg font-bold">
          {t("members")}
        </h2>
        <ul className="mt-3 divide-y divide-rule rounded-card bg-surface">
          {users.map((member) => {
            const isSelf = member.user_id === user.id;
            const active = member.status === "active";
            return (
              <li key={member.user_id} className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-4">
                <div className="min-w-0 flex-1 basis-56">
                  <p className="font-semibold">
                    {member.full_name || member.email}
                    {isSelf ? <span className="ml-2 text-sm font-normal text-muted">({t("you")})</span> : null}
                  </p>
                  {member.full_name ? <p className="text-sm break-all text-muted">{member.email}</p> : null}
                  <p className="mt-1 text-sm">
                    <span className="font-semibold text-primary-dark">{roles(member.role)}</span>
                    {" · "}
                    <span className={active ? "" : "font-semibold text-warn-ink"}>
                      {t(active ? "statusActive" : "statusRemoved")}
                    </span>
                  </p>
                </div>
                {!isSelf && isRole(member.role) ? (
                  <MemberControls
                    userId={member.user_id}
                    name={member.full_name || member.email}
                    role={member.role as Role}
                    active={active}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="menunggu" className="mt-6">
        <h2 id="menunggu" className="text-lg font-bold">
          {t("pending")}
        </h2>
        {invites.length === 0 ? (
          <p className="mt-3 rounded-card bg-surface px-4 py-4 text-muted">{t("noPending")}</p>
        ) : (
          <ul className="mt-3 divide-y divide-rule rounded-card bg-surface">
            {invites.map((invite) => {
              const expired = new Date(invite.expires_at) < new Date();
              return (
                <li key={invite.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-4">
                  <div className="min-w-0 flex-1 basis-56">
                    <p className="font-semibold break-all">{invite.email}</p>
                    <p className="text-sm text-muted">
                      {roles(invite.role)}
                      {" · "}
                      <span className={expired ? "font-semibold text-warn-ink" : ""}>
                        {expired
                          ? t("expired")
                          : t("expires", { date: formatDate(invite.expires_at, locale) })}
                      </span>
                    </p>
                  </div>
                  <RevokeButton id={invite.id} email={invite.email} />
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}

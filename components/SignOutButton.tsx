import { LogOut } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { signOut } from "@/app/(auth)/actions";

export async function SignOutButton({ className = "" }: { className?: string }) {
  const t = await getTranslations("auth");

  return (
    <form action={signOut}>
      <button
        type="submit"
        className={`flex min-h-tap items-center gap-2 rounded-chip px-3 text-sm font-semibold text-primary-dark hover:bg-tint ${className}`}
      >
        <LogOut aria-hidden className="size-5" />
        {t("signOut")}
      </button>
    </form>
  );
}

import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getUser } from "@/lib/session";
import { NewPasswordForm } from "./form";

// Reached from the reset email (which signs the person in) or from Settings.
export default async function TetapkanKataLaluanPage() {
  if (!(await getUser())) redirect("/log-masuk");
  const t = await getTranslations("auth");

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">{t("newPasswordTitle")}</h1>
      <NewPasswordForm />
    </>
  );
}

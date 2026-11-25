import "server-only";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type HouseholdDetail = {
  id: string;
  head_name: string;
  address: string | null;
  phone: string | null;
  whatsapp_opt_in: boolean;
  whatsapp_consent_at: string | null;
  pdpa_consent_at: string | null;
  created_at: string;
  members: {
    id: string;
    name: string;
    relation: string | null;
    date_of_birth: string | null;
    ic_last4: string | null;
  }[];
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * One household with its members, read through RLS. Another masjid's id, or
 * a made-up one, is simply "not found".
 */
export async function loadHousehold(id: string): Promise<HouseholdDetail> {
  if (!UUID.test(id)) notFound();
  const supabase = await createClient();
  const { data } = await supabase
    .from("households")
    .select(
      "id, head_name, address, phone, whatsapp_opt_in, whatsapp_consent_at, pdpa_consent_at, created_at, members(id, name, relation, date_of_birth, ic_last4)",
    )
    .eq("id", id)
    .order("created_at", { referencedTable: "members" })
    .maybeSingle();
  if (!data) notFound();
  return data as HouseholdDetail;
}

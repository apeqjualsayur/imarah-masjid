// Fake data only. Never put real kariah or bank details here.
import { createHash } from "node:crypto";

export type MasjidKey = "a" | "b";
export type Role = "pengerusi" | "bendahari" | "setiausaha" | "ajk" | "imam";
export type Row = Record<string, unknown>;

// September 2026 is locked by the seed. October stays open.
export const LOCKED_MONTH = "2026-09-01";
export const OPEN_DATE = "2026-10-15";

// Fixed ids make the seed safe to run twice and let tests find each row.
function seedId(masjid: MasjidKey, table: number, n: number) {
  const m = masjid === "a" ? 1 : 2;
  const suffix = `${table}`.padStart(6, "0") + `${n}`.padStart(6, "0");
  return `0000000${m}-0000-4000-8000-${suffix}`;
}

export const masjidId = (masjid: MasjidKey) => seedId(masjid, 0, 1);

export const seedRoles: Record<MasjidKey, Role[]> = {
  a: ["pengerusi", "bendahari", "setiausaha", "ajk", "imam"],
  b: ["pengerusi", "bendahari", "setiausaha"],
};

export const seedEmail = (masjid: MasjidKey, role: Role) => `${role}.${masjid}@imarah.test`;

const roleNames: Record<Role, string> = {
  pengerusi: "Pengerusi",
  bendahari: "Bendahari",
  setiausaha: "Setiausaha",
  ajk: "AJK",
  imam: "Imam",
};
/** "Bendahari Contoh A": fake, but reads like a name in the app. */
export const seedUserName = (masjid: MasjidKey, role: Role) => `${roleNames[role]} Contoh ${masjid.toUpperCase()}`;

/** Each masjid has one open invitation. Tests know its link token. */
export const seedInviteToken = (masjid: MasjidKey) => `seed-invite-${masjid}`;
export const seedInviteEmail = (masjid: MasjidKey) => `jemputan.${masjid}@imarah.test`;
const sha256 = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");

const masjidNames = { a: "Masjid Contoh A", b: "Surau Contoh B" };

/** Rows per table, in the order they must be inserted. */
export function seedRows(masjid: MasjidKey, users: Partial<Record<Role, string>>): [string, Row[]][] {
  const masjid_id = masjidId(masjid);
  const pengerusi = users.pengerusi;
  const bendahari = users.bendahari;

  const memberships = seedRoles[masjid].map((role, n) => ({
    id: seedId(masjid, 1, n),
    masjid_id,
    user_id: users[role],
    role,
  }));

  const invitations = [
    {
      id: seedId(masjid, 14, 0),
      masjid_id,
      email: seedInviteEmail(masjid),
      role: "ajk",
      token_hash: sha256(seedInviteToken(masjid)),
      invited_by: pengerusi,
      expires_at: "2099-01-01T00:00:00Z",
    },
  ];

  const households = [1, 2, 3, 4, 5].map((n) => ({
    id: seedId(masjid, 2, n),
    masjid_id,
    head_name: `Ketua Contoh ${masjid.toUpperCase()}${n}`,
    address: `${n} Jalan Contoh`,
    phone: `010000000${n}`,
    whatsapp_opt_in: n % 2 === 0,
    whatsapp_consent_at: n % 2 === 0 ? "2026-01-01T00:00:00Z" : null,
    pdpa_consent_at: "2026-01-01T00:00:00Z",
  }));

  const members = households.map((household, n) => ({
    id: seedId(masjid, 3, n),
    masjid_id,
    household_id: household.id,
    name: `Ahli Contoh ${n}`,
    ic_last4: `000${n}`,
    relation: "anak",
  }));

  // New rows go on the end: the seed only adds rows whose id is missing.
  const funds = ["Tabung Am", "Pembangunan", "Khairat", "Amal Jariah"].map((name, n) => ({
    id: seedId(masjid, 4, n),
    masjid_id,
    name,
    restricted: n === 1 || n === 2,
  }));

  const categories = [
    { name: "Kutipan Jumaat", type: "income" },
    { name: "Derma", type: "income" },
    { name: "Utiliti", type: "expense" },
    { name: "Sewaan dewan", type: "income" },
    { name: "Khairat", type: "income" },
    { name: "Lain-lain", type: "income" },
    { name: "Gaji", type: "expense" },
    { name: "Penyelenggaraan", type: "expense" },
    { name: "Kebajikan", type: "expense" },
    { name: "Lain-lain", type: "expense" },
  ].map((category, n) => ({ id: seedId(masjid, 5, n), masjid_id, ...category }));

  const transactions = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => {
    const income = n % 3 !== 2;
    return {
      id: seedId(masjid, 6, n),
      masjid_id,
      fund_id: funds[n % funds.length].id,
      category_id: categories[income ? n % 2 : 2].id,
      amount_sen: 10_000 + n * 1_250,
      direction: income ? "in" : "out",
      date: `2026-${n < 5 ? "09" : "10"}-${`${n + 10}`}`,
      ref_no: `${income ? "RC" : "PV"}-2610-${`${n}`.padStart(3, "0")}`,
      method: n % 2 === 0 ? "cash" : "bank_transfer",
      created_by: bendahari,
    };
  });

  // The second is a pre-Step 7 sample: confirmed, with no ledger entry of its own.
  const collections = [
    { id: seedId(masjid, 7, 0), date: "2026-10-16", counted_by: bendahari, confirmed_by: null, status: "counted" },
    { id: seedId(masjid, 7, 1), date: "2026-10-23", counted_by: bendahari, confirmed_by: pengerusi, status: "confirmed" },
  ].map((collection) => ({ ...collection, masjid_id, fund_id: funds[0].id, total_sen: 142_050 }));

  const khairatPlans = [{ id: seedId(masjid, 8, 0), masjid_id, year: 2026, fee_sen: 5_000 }];

  const khairatMembers = households.slice(0, 2).map((household, n) => ({
    id: seedId(masjid, 9, n),
    masjid_id,
    household_id: household.id,
    plan_id: khairatPlans[0].id,
    paid_sen: n === 0 ? 5_000 : 0,
  }));

  const bankLines = [
    { id: seedId(masjid, 10, 0), date: "2026-10-16", amount_sen: 11_250, description: "DuitNow Contoh" },
    { id: seedId(masjid, 10, 1), date: "2026-09-16", amount_sen: 12_500, description: "Pindahan Contoh" },
  ].map((line) => ({ ...line, masjid_id }));

  const receiptCounters = [{ id: seedId(masjid, 11, 0), masjid_id, year: 2026, last_no: 10 }];

  const reports = [
    {
      id: seedId(masjid, 12, 0),
      masjid_id,
      type: "penyata_bulanan",
      period: "2026-09",
      storage_path: `contoh/${masjid}/2026-09.pdf`,
      generated_by: bendahari,
    },
  ];

  // Periods go last: once September is locked, nothing dated in it can be added.
  const periods = [
    {
      id: seedId(masjid, 13, 0),
      masjid_id,
      month: LOCKED_MONTH,
      locked_at: "2026-10-05T00:00:00Z",
      locked_by: pengerusi,
    },
  ];

  return [
    ["memberships", memberships],
    ["invitations", invitations],
    ["households", households],
    ["members", members],
    ["funds", funds],
    ["categories", categories],
    ["transactions", transactions],
    ["collections", collections],
    ["khairat_plans", khairatPlans],
    ["khairat_members", khairatMembers],
    ["bank_lines", bankLines],
    ["receipt_counters", receiptCounters],
    ["reports", reports],
    ["periods", periods],
  ];
}

// Two zones with clearly different times, so tests can tell them apart.
const masjidPlaces = {
  a: { state: "Selangor", address: "Taman Contoh A, 40000 Shah Alam", prayer_zone: "SGR01" },
  b: { state: "Pulau Pinang", address: "Kampung Contoh B, 10000 George Town", prayer_zone: "PNG01" },
};

export function seedMasjid(masjid: MasjidKey): Row {
  return {
    id: masjidId(masjid),
    name: masjidNames[masjid],
    plan: "standard",
    ...masjidPlaces[masjid],
  };
}

/** Masjid A gets a sample logo; B keeps initials. */
export const seedLogoPath = (masjid: MasjidKey) => `masjids/${masjidId(masjid)}/logo-contoh.svg`;
export const SEED_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
<circle cx="48" cy="48" r="48" fill="#0F766E"/>
<path d="M26 66V52a22 22 0 0 1 44 0v14H56V56a8 8 0 0 0-16 0v10z" fill="#FFFFFF"/>
<path d="M18 66V42l3-6 3 6v24zM72 66V42l3-6 3 6v24z" fill="#FFFFFF"/>
<rect x="16" y="68" width="64" height="5" rx="2" fill="#F6E3B8"/>
<circle cx="48" cy="23" r="5" fill="#F6E3B8"/>
</svg>
`;

export const firstRowId = (masjid: MasjidKey, table: string) => {
  const tableNumbers: Record<string, number> = {
    memberships: 1,
    households: 2,
    members: 3,
    funds: 4,
    categories: 5,
    transactions: 6,
    collections: 7,
    khairat_plans: 8,
    khairat_members: 9,
    bank_lines: 10,
    receipt_counters: 11,
    reports: 12,
    periods: 13,
    invitations: 14,
  };
  if (table === "masjids") return masjidId(masjid);
  return seedId(masjid, tableNumbers[table], table === "households" ? 1 : 0);
};

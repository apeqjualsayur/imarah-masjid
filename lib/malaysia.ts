// States and JAKIM e-Solat prayer zones. Place names are proper nouns, so they
// are the same in both languages. Check codes against JAKIM e-Solat in Step 4,
// when prayer times start using them.

export type PrayerZone = { code: string; areas: string };

export const STATES = [
  "Johor",
  "Kedah",
  "Kelantan",
  "Melaka",
  "Negeri Sembilan",
  "Pahang",
  "Perak",
  "Perlis",
  "Pulau Pinang",
  "Sabah",
  "Sarawak",
  "Selangor",
  "Terengganu",
  "Wilayah Persekutuan Kuala Lumpur",
  "Wilayah Persekutuan Labuan",
  "Wilayah Persekutuan Putrajaya",
] as const;

export type State = (typeof STATES)[number];

export const PRAYER_ZONES: Record<State, PrayerZone[]> = {
  Johor: [
    { code: "JHR01", areas: "Pulau Aur, Pulau Pemanggil" },
    { code: "JHR02", areas: "Johor Bahru, Kota Tinggi, Mersing, Kulai" },
    { code: "JHR03", areas: "Kluang, Pontian" },
    { code: "JHR04", areas: "Batu Pahat, Muar, Segamat, Gemas, Tangkak" },
  ],
  Kedah: [
    { code: "KDH01", areas: "Kota Setar, Kubang Pasu, Pokok Sena" },
    { code: "KDH02", areas: "Kuala Muda, Yan, Pendang" },
    { code: "KDH03", areas: "Padang Terap, Sik" },
    { code: "KDH04", areas: "Baling" },
    { code: "KDH05", areas: "Bandar Baharu, Kulim" },
    { code: "KDH06", areas: "Langkawi" },
    { code: "KDH07", areas: "Puncak Gunung Jerai" },
  ],
  Kelantan: [
    {
      code: "KTN01",
      areas: "Bachok, Kota Bharu, Machang, Pasir Mas, Pasir Puteh, Tanah Merah, Tumpat, Kuala Krai, Mukim Chiku",
    },
    { code: "KTN02", areas: "Gua Musang (Galas, Bertam), Jeli, Lojing" },
  ],
  Melaka: [{ code: "MLK01", areas: "Seluruh Negeri Melaka" }],
  "Negeri Sembilan": [
    { code: "NGS01", areas: "Tampin, Jempol" },
    { code: "NGS02", areas: "Jelebu, Kuala Pilah, Rembau" },
    { code: "NGS03", areas: "Port Dickson, Seremban" },
  ],
  Pahang: [
    { code: "PHG01", areas: "Pulau Tioman" },
    { code: "PHG02", areas: "Kuantan, Pekan, Muadzam Shah" },
    { code: "PHG03", areas: "Jerantut, Temerloh, Maran, Bera, Chenor, Jengka" },
    { code: "PHG04", areas: "Bentong, Lipis, Raub" },
    { code: "PHG05", areas: "Genting Sempah, Janda Baik, Bukit Tinggi" },
    { code: "PHG06", areas: "Cameron Highlands, Genting Highlands, Bukit Fraser" },
    { code: "PHG07", areas: "Rompin" },
  ],
  Perak: [
    { code: "PRK01", areas: "Tapah, Slim River, Tanjung Malim" },
    { code: "PRK02", areas: "Kuala Kangsar, Sungai Siput, Ipoh, Batu Gajah, Kampar" },
    { code: "PRK03", areas: "Lenggong, Pengkalan Hulu, Gerik" },
    { code: "PRK04", areas: "Temengor, Belum" },
    {
      code: "PRK05",
      areas: "Kampung Gajah, Teluk Intan, Bagan Datuk, Seri Iskandar, Beruas, Parit, Lumut, Sitiawan, Pulau Pangkor",
    },
    { code: "PRK06", areas: "Selama, Taiping, Bagan Serai, Parit Buntar" },
    { code: "PRK07", areas: "Bukit Larut" },
  ],
  Perlis: [{ code: "PLS01", areas: "Kangar, Padang Besar, Arau" }],
  "Pulau Pinang": [{ code: "PNG01", areas: "Seluruh Negeri Pulau Pinang" }],
  Sabah: [
    { code: "SBH01", areas: "Sandakan, Bukit Garam, Semawang, Temanggong, Tambisan" },
    { code: "SBH02", areas: "Beluran, Telupid, Pinangah, Terusan, Kuamut" },
    { code: "SBH03", areas: "Lahad Datu, Silabukan, Kunak, Sahabat, Semporna, Tungku" },
    { code: "SBH04", areas: "Tawau, Balong, Merotai, Kalabakan" },
    { code: "SBH05", areas: "Kudat, Kota Marudu, Pitas, Pulau Banggi" },
    { code: "SBH06", areas: "Gunung Kinabalu" },
    { code: "SBH07", areas: "Kota Kinabalu, Ranau, Kota Belud, Tuaran, Penampang, Papar, Putatan" },
    { code: "SBH08", areas: "Pensiangan, Keningau, Tambunan, Nabawan" },
    { code: "SBH09", areas: "Beaufort, Kuala Penyu, Sipitang, Tenom, Long Pasia, Membakut, Weston" },
  ],
  Sarawak: [
    { code: "SWK01", areas: "Limbang, Lawas, Sundar, Trusan" },
    { code: "SWK02", areas: "Miri, Niah, Bekenu, Sibuti, Marudi" },
    { code: "SWK03", areas: "Pandan, Belaga, Suai, Tatau, Sebauh, Bintulu" },
    { code: "SWK04", areas: "Sibu, Mukah, Dalat, Song, Igan, Oya, Balingian, Kanowit, Kapit" },
    { code: "SWK05", areas: "Sarikei, Matu, Julau, Rajang, Daro, Bintangor, Belawai" },
    {
      code: "SWK06",
      areas: "Lubok Antu, Sri Aman, Roban, Debak, Kabong, Lingga, Engkilili, Betong, Spaoh, Pusa, Saratok",
    },
    { code: "SWK07", areas: "Serian, Simunjan, Samarahan, Sebuyau, Meludam" },
    { code: "SWK08", areas: "Kuching, Bau, Lundu, Sematan" },
    { code: "SWK09", areas: "Kampung Patarikan" },
  ],
  Selangor: [
    { code: "SGR01", areas: "Gombak, Petaling, Sepang, Hulu Langat, Hulu Selangor, Shah Alam" },
    { code: "SGR02", areas: "Kuala Selangor, Sabak Bernam" },
    { code: "SGR03", areas: "Klang, Kuala Langat" },
  ],
  Terengganu: [
    { code: "TRG01", areas: "Kuala Terengganu, Marang, Kuala Nerus" },
    { code: "TRG02", areas: "Besut, Setiu" },
    { code: "TRG03", areas: "Hulu Terengganu" },
    { code: "TRG04", areas: "Dungun, Kemaman" },
  ],
  "Wilayah Persekutuan Kuala Lumpur": [{ code: "WLY01", areas: "Kuala Lumpur, Putrajaya" }],
  "Wilayah Persekutuan Labuan": [{ code: "WLY02", areas: "Labuan" }],
  "Wilayah Persekutuan Putrajaya": [{ code: "WLY01", areas: "Kuala Lumpur, Putrajaya" }],
};

export function isState(value: unknown): value is State {
  return STATES.includes(value as State);
}

export function isZoneInState(state: State, code: string) {
  return PRAYER_ZONES[state].some((zone) => zone.code === code);
}

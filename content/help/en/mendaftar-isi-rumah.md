---
title: Registering households and importing CSV
screen: /kariah
roles: [setiausaha]
---

# Registering households and importing CSV

The kariah registry keeps the households in the masjid's area: head of household, address, phone, family members and their consent. Only the Setiausaha can add, edit and import. The Pengerusi, Bendahari and AJK can view. The Imam does not see the registry.

## Adding one household

1. Go to **Kariah** and press **Add household**.
2. Fill in **Head of household**, **Address** and **Phone** (for example 012-345 6789).
3. Tick the consent boxes if the household agrees:
   - **WhatsApp**: receiving masjid announcements by WhatsApp (needs a mobile number).
   - **PDPA**: details are kept by the masjid for kariah and khairat matters only.
4. Press **Save**. The consent dates are recorded automatically.
5. On the household page, press **Add member** for each family member: name, relation, date of birth and the last 4 digits of the IC number.

**IC number:** only the last 4 digits are stored. If you paste a full number, Imarah cuts it before saving.

## Importing from Excel (CSV)

1. Go to **Kariah** and press **Import CSV**.
2. Press **Download CSV template**. Open it in Excel or Google Sheets.
3. Fill in one row per household: nama_ketua, alamat, telefon, whatsapp (ya/tidak), pdpa (ya/tidak).
4. Save as **CSV**. (In Excel: File > Save As > CSV UTF-8.)
5. Back in Imarah, choose the file and press **Check file**. Nothing is saved yet.
6. Check the preview. Green rows will be imported. Rows with errors show why.
7. Press **Import**. Only rows without errors are imported. A summary shows how many were imported and skipped.
8. Fix the skipped rows in the file and import again. Rows already imported are detected as "Already registered" and not repeated.

Family members are added on each household's page after the import.

## Editing or deleting

- Open the household and press **Edit**. Unticking a consent box removes its consent date.
- **Delete household** removes the household and all its members. It cannot be deleted if khairat or finance records refer to it.

## Change history

The Pengerusi and Bendahari can see the **Change history** under each household: who changed it, when, and which fields. For personal details (name, address, phone, IC) only "changed" is shown. Old values are not kept in the log, to protect privacy.

## If something goes wrong

- **"Excel damaged the phone number (for example 1.23E+09)."** In Excel, format the phone column as Text and type the numbers again.
- **"Phone number is not valid."** Check the number of digits. Mobile numbers start with 01 and have 10 or 11 digits.
- **"WhatsApp needs a mobile number."** Landlines (03, 04 ...) cannot receive WhatsApp.
- **"Already registered in the kariah."** A household with the same phone, or the same name and address, already exists.
- **"Name column not found."** The first row of the file must have the column names as in the template.
- **Strange letters (for example Ã©) in names.** Save the file again as "CSV UTF-8".

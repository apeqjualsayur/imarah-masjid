---
title: "Bank matching and the monthly reconciliation"
screen: /kewangan/bank
roles: [pengerusi, bendahari]
---

# Bank matching and the monthly reconciliation

**Bank matching** compares the masjid's bank statement with the Imarah ledger. The goal: a **difference of RM 0.00** for every month, before that month is locked.

- **Import, match, mark cash, cancel an import:** Bendahari only.
- **View the reconciliation:** Pengerusi and Bendahari.
- Imarah never asks for or stores bank passwords or logins. You upload the statement yourself.

## 1. Download the statement from the bank

In the masjid's internet banking, download the account statement as **CSV** (sometimes called "Excel (CSV)" or "Export"). One month or more.

## 2. Import the statement

1. Go to **Finance > Bank matching** and press **Import statement**.
2. Choose the CSV file.
3. **The first time for this bank:** choose **New bank**, fill in a bank name (for example "Maybank main account"), and check the columns chosen:
   - **Date column** and **date order** (usually Day/Month/Year).
   - **Description column** (and a second one, such as the reference, if you like).
   - **Separate debit and credit**, or **one amount column** (money out has a minus, DR or brackets).

   Imarah guesses the columns from the header names. The choice is saved, so the next statement from the same bank is recognised.
4. Press **Check**. The list shows every line: **New**, **Already in** (imported before) or **Month locked**.
5. Press **Import N new lines**.

Importing the same file twice **adds nothing**. Imarah recognises lines already in by their date, amount and description. Two identical payments on the same day in one statement still count as two.

## 3. Match each line

After the import, Imarah opens that month's reconciliation.

- **Suggestions:** for each bank line, Imarah looks for a ledger entry with the **same amount and direction**, dated **within 3 days**. Press **Accept** if it is right, or **Reject** (it is not suggested again for that line).
- **Other choices:** open the line to choose any entry with the same amount, at any date.
- **Create a ledger entry:** for money not yet recorded (for example a donation straight into the account). The form is filled in with the date, amount and description; choose the fund and category, then save. It is matched by itself.
- **Mark as a cash deposit:** for cash paid into the bank (for example the Friday collection). That money is already in the ledger as a cash entry, so no new entry is needed. The same goes for a **cash withdrawal** from the bank.

A bank line matches one entry only. Cash entries cannot be matched because they do not go through the bank.

## 4. Read the reconciliation

- **Bank total:** every bank line in the month (in minus out).
- **Ledger total:** the month's bank transfer, DuitNow and cheque entries, plus the cash deposits and withdrawals marked.
- **Difference:** bank total minus ledger total. When everything is matched, it is **RM 0.00** and shows **Balanced**.

If there is a difference, look at:

- **Bank lines not matched:** for example a bank charge. Create a ledger entry for it (a suitable expense category).
- **Ledger entries not in the bank:** for example a cheque not yet cashed, or an entry recorded with the wrong method.
- **Matched across months:** the bank and the ledger record it in different months (for example a transfer on the 30th that reaches the bank on the 2nd). This is a genuine timing difference.

## Fixing mistakes

- **A wrong match:** open **Matched or marked** and press **Unmatch** (or **Remove cash mark**).
- **Wrong columns at import:** on the **Import statement** page, under **Past imports**, press **Cancel import**. This works only before any of its lines is matched. Then import again.
- **A ledger entry is cancelled:** its match is removed automatically. Match the bank line to the correct entry.

A locked month cannot change: imports, matches and cash marks are refused for it.

Every action is in the audit log. Bank descriptions are not kept in the log because they may carry donors' names.

## If something goes wrong

- **"The chosen columns are not in this file."** The bank changed its file layout. Choose **New bank** and choose the columns again.
- **"the date could not be read" on some lines.** Check the **Date order**. Those lines are skipped; the others can still be imported.
- **"Every line is already imported."** This file was imported before. Nothing to do.
- **"Cash entries do not go through the bank."** If the money was really a bank transfer, cancel that entry and record it again with the right method.
- **"This month is locked."** Ask the Pengerusi to unlock the month (with a reason) if it must be corrected.

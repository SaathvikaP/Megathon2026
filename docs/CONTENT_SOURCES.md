# Content sources and review notes

All learning content (14 lessons, 15 Money Quest questions, 15 practice questions and 15 comic scripts) was written for this project in plain language for Indian Grade 11–12 students. The source of truth is `backend/content/*.mjs` (the four pillars live in `frontend/src/lib/content/pillars.mjs` because the landing page uses them too). `npm run db:seed-sql` turns it into the seed migration. `backend/tests/content.test.mjs` checks the answer key, safety wording, links and that the seed is current, and `frontend/tests/unit/content-compat.test.ts` checks that every lesson and comic script is valid for the app.

No articles or long passages were copied from any source. There are no statistics, survey figures or quotations. Every worked example with rupee amounts, interest rates or returns is labelled *hypothetical*, and investing examples state that real returns vary and can be negative.

## Reference links

These are shown to students as "further reading" on lessons, questions and comics (defined in `backend/content/references.mjs`). They point to official Indian bodies wherever possible. The lessons summarise widely known, general principles and send students to these sites for current rules, rather than quoting them.

| Key | Publisher | Link | Used for |
| --- | --- | --- | --- |
| `rbiFinEd` | Reserve Bank of India | https://www.rbi.org.in/FinancialEducation/ | Banking basics, KYC, safe digital banking |
| `sebiInvestor` | SEBI | https://investor.sebi.gov.in/ | Investing basics, risk, fake investment promises |
| `ncfe` | National Centre for Financial Education | https://ncfe.org.in/ | Budgeting and saving basics for students |
| `npci` | NPCI | https://www.npci.org.in/ | UPI, where current safety advice lives |
| `cybercrime` | Ministry of Home Affairs | https://cybercrime.gov.in/ | Reporting cyber fraud (helpline 1930) |
| `sachet` | Reserve Bank of India | https://sachet.rbi.org.in/ | Reporting unauthorised deposit schemes |
| `dicgc` | DICGC | https://www.dicgc.org.in/ | Deposit insurance. The lesson deliberately gives no amount and sends students here for the current limit |
| `rbiCms` | Reserve Bank of India | https://cms.rbi.org.in/ | Escalating unresolved bank complaints (Integrated Ombudsman Scheme) |
| `vanguardOyf` | Vanguard | https://ownyourfuture.vanguard.com/ | US-focused; used only for general budgeting and saving principles, not for Indian rules or products |
| `bankingTerms` | Scribd user upload | https://www.scribd.com/document/294551371/Banking-Terminologies | Older general glossary (cheques, interest, overdraft). Not an official source and partly outdated; not relied on for any current rule |

Where each page was opened while the content was being written is not recorded. **Before launch, a reviewer should open every link above**, check that it still resolves and is relevant, and replace or remove any that don't. Consider dropping `bankingTerms` once an official glossary link is found. Admins can edit references on each lesson in `/admin/lessons`.

## Claims to confirm with a teacher or finance professional before launch

These statements are general and deliberately avoid figures, but they describe real rules, which can change:

- **Minor accounts:** "Many banks let students aged 10 and above operate their own account, often with limits" (lesson *Bank Accounts, Cards and Nominees*).
- **Deposit insurance:** deposits are insured by DICGC up to a limit per depositor per bank. No amount is stated.
- **Fraud reporting:** cyber fraud is reported at cybercrime.gov.in or on helpline **1930**. This also appears in the site footer and the comics.
- **Complaints:** unresolved bank complaints can be escalated through the RBI Integrated Ombudsman Scheme at cms.rbi.org.in.
- **Illegal deposit schemes** are reported on RBI's Sachet portal.
- **UPI safety:** a UPI PIN is entered only to *send* money or approve a payment, never to *receive* money. Never share a PIN or OTP, and a refund never requires a PIN.

## Safety rules the content follows

- Students are never asked for real banking details. Every UPI ID, phone number, account number and amount in the questions and comics is fictional.
- Scam examples teach recognition and reporting; they don't explain how to carry out a scam.
- Content explains concepts and doesn't recommend specific products, funds, shares, banks or apps.
- External activity links (`/admin/activities`) can only be added by a platform admin who confirms they checked the destination. None are seeded, because no third-party game has been verified.

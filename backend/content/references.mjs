// "Further reading" links attached to lessons, questions and comics.
// Lesson text is original and does not quote these pages; see docs/CONTENT_SOURCES.md
// for what each link is used for and the pre-launch link review.

export const REF = {
  rbiFinEd: {
    title: 'Financial Education resources (FAME messages, Financial Literacy Week)',
    publisher: 'Reserve Bank of India',
    url: 'https://www.rbi.org.in/FinancialEducation/',
    note: 'Official awareness material on banking basics, KYC and safe digital banking.',
  },
  sebiInvestor: {
    title: 'SEBI Investor education portal',
    publisher: 'Securities and Exchange Board of India',
    url: 'https://investor.sebi.gov.in/',
    note: 'Investor education on money matters, investment avenues and risk.',
  },
  ncfe: {
    title: 'National Centre for Financial Education',
    publisher: 'NCFE (promoted by RBI, SEBI, IRDAI and PFRDA)',
    url: 'https://ncfe.org.in/',
    note: 'Financial education material for students and the public.',
  },
  npci: {
    title: 'UPI product information and safety guidance',
    publisher: 'National Payments Corporation of India',
    url: 'https://www.npci.org.in/',
    note: 'Operator of UPI. Refer to the official site for current safety advice.',
  },
  cybercrime: {
    title: 'National Cyber Crime Reporting Portal (helpline 1930)',
    publisher: 'Ministry of Home Affairs, Government of India',
    url: 'https://cybercrime.gov.in/',
    note: 'Official channel to report cyber financial fraud.',
  },
  sachet: {
    title: 'Sachet portal for reporting illegal deposit schemes',
    publisher: 'Reserve Bank of India',
    url: 'https://sachet.rbi.org.in/',
    note: 'Check and report unauthorised entities collecting deposits.',
  },
  dicgc: {
    title: 'Deposit insurance information',
    publisher: 'Deposit Insurance and Credit Guarantee Corporation',
    url: 'https://www.dicgc.org.in/',
    note: 'Explains deposit insurance cover for bank deposits; check current limits on the site.',
  },
  rbiCms: {
    title: 'RBI Complaint Management System (Integrated Ombudsman Scheme)',
    publisher: 'Reserve Bank of India',
    url: 'https://cms.rbi.org.in/',
    note: 'Escalation route if a bank does not resolve a complaint.',
  },
  vanguardOyf: {
    title: 'Own Your Future',
    publisher: 'Vanguard',
    url: 'https://ownyourfuture.vanguard.com/',
    note: 'US-focused financial-wellness material; used only for general budgeting and saving principles.',
  },
  bankingTerms: {
    title: 'Banking Terminologies (document hosted on Scribd)',
    publisher: 'Scribd user upload',
    url: 'https://www.scribd.com/document/294551371/Banking-Terminologies',
    note: 'Older glossary of general banking terms (cheques, interest, overdraft). Some figures in it are outdated; not used for current rules.',
  },
};

export const refs = (...keys) =>
  keys.map((k) => {
    const r = REF[k];
    if (!r) throw new Error(`Unknown reference key: ${k}`);
    return r;
  });

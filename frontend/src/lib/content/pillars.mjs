// Also imported by backend/scripts/build-seed.mjs to seed public.learning_pillars,
// so keep this file plain JavaScript with no imports.
export const PILLARS = [
  {
    slug: 'plan-and-budget',
    title: 'Plan & Budget',
    tagline: 'Make every rupee count',
    description:
      'Understand where your money comes from, where it goes, and how to plan for what matters most to you.',
    icon: 'wallet',
    sort_order: 1,
  },
  {
    slug: 'save-and-manage',
    title: 'Save & Manage',
    tagline: 'Build a safety cushion',
    description:
      'Learn why saving matters, how bank accounts and cards work, and how interest helps savings grow.',
    icon: 'piggy-bank',
    sort_order: 2,
  },
  {
    slug: 'understand-investing',
    title: 'Understand Investing',
    tagline: 'Grow money over time, wisely',
    description:
      'Explore risk, return, inflation, fees, compounding and diversification without hype or guarantees.',
    icon: 'trending-up',
    sort_order: 3,
  },
  {
    slug: 'stay-financially-safe',
    title: 'Stay Financially Safe',
    tagline: 'Spot scams before they spot you',
    description:
      'Recognise UPI scams, phishing and fake investment promises, and know how to report problems safely.',
    icon: 'shield',
    sort_order: 4,
  },
];

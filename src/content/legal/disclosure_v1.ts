export const CURRENT_DISCLOSURE_VERSION = '1.0';

export const DISCLOSURE_SECTIONS = [
  {
    title: '1. No Medical Advice',
    body:
      "FlareFinder AI is a health-tracking diary intended for educational and personal organization purposes only. It does NOT provide medical advice, diagnosis, or treatment. It is not a substitute for clinical judgment.",
  },
  {
    title: '2. AI & Data Accuracy',
    body:
      'This App uses Artificial Intelligence. AI can produce inaccurate results ("hallucinations"). Do not rely on "Safe" or "Unsafe" verdicts as absolute fact. Always read labels manually.',
  },
  {
    title: '3. Emergency Situations',
    body:
      'If you have a fever, signs of infection, or intense pain, STOP using this app and seek immediate professional medical assistance or go to the nearest ER.',
  },
  {
    title: '4. Assumption of Risk',
    body:
      'By proceeding, you agree that you are solely responsible for any lifestyle changes you make. The developers are not liable for any adverse health events.',
  },
  {
    title: '5. Data Sovereignty & Privacy',
    body:
      'Your privacy is absolute. All logs, photos, and clinical results are stored locally on this device. We do not have a central database. Important: Clearing your browser cache or clicking the "Purge" button in Settings will permanently delete all your data. Data is only transmitted to secure AI models temporarily when you request specific insights or analysis.',
  },
];

export default {
  version: CURRENT_DISCLOSURE_VERSION,
  sections: DISCLOSURE_SECTIONS,
};

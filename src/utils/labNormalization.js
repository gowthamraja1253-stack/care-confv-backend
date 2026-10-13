/**
 * Utility for normalizing laboratory observation names to ensure consistency
 * across the application when creating longitudinal graphs.
 */

const labTestDictionary = [
  {
    canonicalName: 'Creatinine',
    displayName: 'Serum Creatinine',
    aliases: ['serum creatinine', 's. creatinine', 'creatinine', 'creat', 's.creat'],
    category: 'Renal',
  },
  {
    canonicalName: 'Hemoglobin',
    displayName: 'Hemoglobin (Hb)',
    aliases: ['hemoglobin', 'haemoglobin', 'hb', 'hgb'],
    category: 'Hematology',
  },
  {
    canonicalName: 'HbA1c',
    displayName: 'Glycated Hemoglobin (HbA1c)',
    aliases: ['hba1c', 'glycated hemoglobin', 'a1c'],
    category: 'Metabolic',
  },
  {
    canonicalName: 'Fasting Glucose',
    displayName: 'Fasting Blood Sugar (FBS)',
    aliases: ['fasting glucose', 'fasting blood sugar', 'fbs', 'fbg', 'fasting blood glucose'],
    category: 'Metabolic',
  },
  {
    canonicalName: 'Total Cholesterol',
    displayName: 'Total Cholesterol',
    aliases: ['total cholesterol', 'cholesterol', 'tc', 'chol'],
    category: 'Lipid',
  },
  {
    canonicalName: 'ALT',
    displayName: 'ALT (SGPT)',
    aliases: ['alt', 'sgpt', 'alanine aminotransferase', 'serum glutamic pyruvic transaminase'],
    category: 'Liver',
  },
  {
    canonicalName: 'AST',
    displayName: 'AST (SGOT)',
    aliases: ['ast', 'sgot', 'aspartate aminotransferase', 'serum glutamic oxaloacetic transaminase'],
    category: 'Liver',
  },
];

export const normalizeTestName = (inputName) => {
  if (!inputName) return '';
  const lowerInput = String(inputName).trim().toLowerCase();
  
  for (const entry of labTestDictionary) {
    if (entry.aliases.includes(lowerInput)) {
      return entry.canonicalName;
    }
  }
  
  // Return the original trimmed name if no canonical mapping is found
  return String(inputName).trim();
};

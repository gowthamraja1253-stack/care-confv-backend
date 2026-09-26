import config from '../config/env.js';
import { groqChatCompletion } from '../utils/groqClient.js';

/**
 * Rule-Based Clinical Triage Engine Fallback
 * Provides robust, offline-resilient healthcare triage for rural settings
 */
export const runRuleBasedTriage = (symptomRecord) => {
  const { symptoms = [], durationDays = 1, severity = 'mild', notes = '' } = symptomRecord;
  const symptomList = symptoms.map((s) => s.toLowerCase());
  const notesLower = (notes || '').toLowerCase();

  const hasFever = symptomList.some((s) => s.includes('fever') || s.includes('chills'));
  const hasCough = symptomList.some((s) => s.includes('cough'));
  const hasBreathless = symptomList.some((s) => s.includes('breath') || s.includes('shortness'));
  const hasChestPain = symptomList.some((s) => s.includes('chest'));
  const hasStomach = symptomList.some((s) => s.includes('stomach') || s.includes('abdominal') || s.includes('cramps'));
  const hasDiarrheaOrVomit = symptomList.some((s) => s.includes('diarrhea') || s.includes('motion') || s.includes('nausea') || s.includes('vomit'));
  const hasJoint = symptomList.some((s) => s.includes('joint') || s.includes('swelling'));
  const hasHeadache = symptomList.some((s) => s.includes('headache'));
  const hasRash = symptomList.some((s) => s.includes('rash') || s.includes('itching'));

  // 1. EMERGENCY TRIAGE RULES
  if (hasChestPain || (hasBreathless && severity === 'severe') || notesLower.includes('unconscious') || notesLower.includes('severe bleeding')) {
    return {
      possibleConditions: [
        'Acute Cardiopulmonary Discomfort',
        'Severe Respiratory Distress',
        'Emergency Medical Evaluation Required',
      ],
      severityScore: 9,
      recommendedAction: 'emergency',
      explanation:
        'Chest pain or severe shortness of breath are critical red-flag indicators. We strongly recommend immediate emergency medical attention or contacting the 108 helpline without delay.',
      source: 'rule-based',
    };
  }

  // 2. HIGH RISK / DOCTOR TELECONSULTATION RULES
  if (severity === 'severe' || (hasFever && hasBreathless) || (hasFever && durationDays >= 4)) {
    const conditions = [];
    if (hasFever && hasCough) conditions.push('Acute Respiratory Infection', 'Bronchitis / Seasonal Influenza');
    if (hasFever && !hasCough) conditions.push('Acute Febrile Illness (Dengue / Typhoid screening advised)');
    if (hasStomach && hasDiarrheaOrVomit) conditions.push('Acute Gastroenteritis with High Dehydration Risk');
    if (conditions.length === 0) conditions.push('Systemic Viral Illness', 'Acute Symptom Flare-up');

    return {
      possibleConditions: conditions.slice(0, 3),
      severityScore: 8,
      recommendedAction: 'consult-doctor',
      explanation: `Symptoms have persisted for ${durationDays} days with high severity. A teleconsultation with a medical doctor is recommended today to prescribe appropriate medication and prevent complications.`,
      source: 'rule-based',
    };
  }

  // 3. CLINIC VISIT / PHC SCREENING RULES
  if (durationDays >= 7 || (hasCough && durationDays >= 14) || (hasStomach && hasDiarrheaOrVomit)) {
    const conditions = [];
    if (hasCough && durationDays >= 14) conditions.push('Subacute Bronchial Infection', 'Tuberculosis (TB) Sputum Screening Advised');
    else if (hasStomach || hasDiarrheaOrVomit) conditions.push('Gastrointestinal Infection', 'Dietary Indigestion / Dysentery');
    else if (hasJoint) conditions.push('Musculoskeletal Arthritis', 'Post-Viral Reactive Joint Inflammation');
    else conditions.push('Persistent Subacute Illness', 'Primary Health Centre (PHC) Checkup Advised');

    return {
      possibleConditions: conditions.slice(0, 3),
      severityScore: severity === 'moderate' ? 6 : 5,
      recommendedAction: 'visit-clinic',
      explanation: `Symptoms lasting ${durationDays} days should be examined at your nearest Primary Health Centre or Community Health Unit for basic diagnostic checks.`,
      source: 'rule-based',
    };
  }

  // 4. MODERATE DOCTOR CONSULT OR CLINIC VISIT
  if (severity === 'moderate') {
    const conditions = [];
    if (hasFever) conditions.push('Viral Upper Respiratory Tract Infection', 'Seasonal Flu');
    if (hasHeadache) conditions.push('Tension Headache / Sinus Congestion');
    if (hasRash) conditions.push('Allergic Contact Dermatitis', 'Heat Rash / Urticaria');
    if (conditions.length === 0) conditions.push('Common Viral Illness', 'Fatigue Syndrome');

    return {
      possibleConditions: conditions.slice(0, 3),
      severityScore: 5,
      recommendedAction: 'consult-doctor',
      explanation: 'Moderate discomfort reported. Connecting with a doctor online will help you receive precise guidance and fast relief.',
      source: 'rule-based',
    };
  }

  // 5. MILD / SELF-CARE RULES
  const mildConditions = [];
  if (hasHeadache) mildConditions.push('Mild Stress/Tension Headache', 'Dehydration Headache');
  if (hasCough) mildConditions.push('Mild Common Cold / Pharyngeal Irritation');
  if (hasJoint) mildConditions.push('Mild Muscle Fatigue / Exertion Strain');
  if (hasRash) mildConditions.push('Mild Skin Irritation');
  if (mildConditions.length === 0) mildConditions.push('Mild Viral Malaise', 'Common Cold');

  return {
    possibleConditions: mildConditions.slice(0, 3),
    severityScore: 2,
    recommendedAction: 'self-care',
    explanation: 'Mild symptoms detected for a brief duration. Rest, warm fluids, adequate hydration, and fever monitoring at home are recommended. Consult a doctor if symptoms worsen after 48 hours.',
    source: 'rule-based',
  };
};

/**
 * Main AI Symptom Analysis Function
 * Calls Groq LLM API with fallback to clinical rule engine
 * @param {Object} symptomRecord
 * @returns {Promise<Object>} { possibleConditions, severityScore, recommendedAction, explanation, source }
 */
export const analyzeSymptoms = async (symptomRecord) => {
  const { symptoms = [], durationDays = 1, severity = 'mild', notes = '' } = symptomRecord;

  // Check if Groq API key is configured
  if (config.groqApiKey && config.groqApiKey.trim()) {
    try {
      const systemPrompt = `You are an expert clinical triage AI assistant for rural and primary healthcare.
Analyze the patient's reported symptoms, duration, severity, and notes.
Respond with a strictly valid JSON object matching this exact schema:
{
  "possibleConditions": ["Condition 1", "Condition 2", "Condition 3"],
  "severityScore": <integer between 1 and 10>,
  "recommendedAction": "<one of: self-care | visit-clinic | consult-doctor | emergency>",
  "explanation": "<2-3 sentence plain language explanation and practical next step for the patient>"
}
Guidelines for recommendedAction:
- "emergency": Red-flag symptoms like chest pain, severe breathlessness, fainting, severe traumatic injury.
- "consult-doctor": Moderate-to-severe symptoms, fever >= 3 days, multi-symptom distress requiring prescription.
- "visit-clinic": Persistent subacute symptoms (e.g. cough > 14 days, chronic joint pain, digestive disorder) needing in-person lab/vitals test at PHC.
- "self-care": Mild cold, brief headache, mild fatigue manageable with rest and hydration.
Ensure the explanation is clear, empathetic, and easy to understand for rural patients. Do NOT prescribe specific prescription antibiotic dosages.`;

      const userPrompt = `Patient Assessment:
Symptoms: ${symptoms.join(', ')}
Duration: ${durationDays} day(s)
Patient Reported Severity: ${severity}
Additional Patient Notes: ${notes || 'None provided'}

Please provide the clinical triage JSON output:`;

      const data = await groqChatCompletion({
        apiKey: config.groqApiKey,
        model: config.groqModel || 'qwen/qwen3.8-27b',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
        max_tokens: 600,
      });

      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        console.warn('[Groq AI Warning] No content in Groq response. Using fallback triage.');
        return runRuleBasedTriage(symptomRecord);
      }

      const parsed = JSON.parse(content);

      // Validate & normalize returned fields
      const validActions = ['self-care', 'visit-clinic', 'consult-doctor', 'emergency'];
      const action = validActions.includes(parsed.recommendedAction)
        ? parsed.recommendedAction
        : 'consult-doctor';

      const score = Math.max(1, Math.min(10, Math.round(Number(parsed.severityScore) || 5)));
      const conditions = Array.isArray(parsed.possibleConditions) && parsed.possibleConditions.length > 0
        ? parsed.possibleConditions.slice(0, 4)
        : ['General Viral Symptom Evaluation'];
      const explanation = parsed.explanation || 'Please monitor symptoms and consult a doctor if discomfort increases.';

      return {
        possibleConditions: conditions,
        severityScore: score,
        recommendedAction: action,
        explanation,
        source: 'llm',
      };
    } catch (llmError) {
      console.warn('[Groq AI Error] Exception calling LLM:', llmError.message, 'Using rule-based triage fallback.');
      return runRuleBasedTriage(symptomRecord);
    }
  }

  // Fallback to rule engine if no API key is set
  return runRuleBasedTriage(symptomRecord);
};

/**
 * Conversational Multi-Turn AI Symptom Triage Doctor
 * @param {Object} params { messages: Array, patientProfile: Object }
 * @returns {Promise<Object>} { reply, triageLevel, severityScore, possibleConditions, recommendedAction, redFlagDetected, quickReplies }
 */
export const chatSymptomTriage = async ({ messages = [], patientProfile = {} }) => {
  const {
    name = 'Patient',
    age = 35,
    gender = 'Unspecified',
    village = 'Rural Center',
    chronicFlags = [],
    preferredLanguage = 'English',
  } = patientProfile;

  const chronicStr = chronicFlags.length > 0 ? chronicFlags.join(', ') : 'None reported';

  const systemPrompt = `You are "Dr. Ayush", an expert, warm, and empathetic AI Clinical Triage Doctor for rural & primary healthcare in India.

PATIENT CONTEXT:
- Name: ${name}, Age: ${age}, Gender: ${gender}, Village: ${village}
- Known Chronic Conditions: ${chronicStr}
- Preferred Language: ${preferredLanguage}

YOUR CLINICAL GOALS:
1. Conduct an empathetic, natural medical conversation to understand the patient's symptoms.
2. If the patient has just mentioned 1-2 vague symptoms, ask 1-2 focused, high-yield clarifying questions (e.g. duration in days, severity, fever temperature, cough type, vomiting/diarrhea, breathing difficulty).
3. If RED-FLAG emergency symptoms are mentioned (severe crushing chest pain radiating to arm/jaw, acute breathlessness, fainting, severe head trauma, coughing blood, sudden facial/arm weakness), immediately alert EMERGENCY and advise calling the 108 emergency ambulance.
4. When sufficient symptoms are understood, provide a clear, structured clinical assessment:
   - 🩺 **What It Could Be**: 1-3 likely possibilities explained in simple, non-frightening terms.
   - 📊 **Triage Level**: Clearly state one of [Self-Care at Home | Consult Doctor Online | Visit Nearest PHC / Clinic | Emergency 108].
   - 🌿 **Safe Home Care & First-Aid**: Hydration (ORS/warm water), rest, cooling sponge for fever, steam, dietary guidance.
   - ⚠️ **Red Flag Warnings**: What danger signs mean they must see a doctor immediately.
5. LANGUAGE: Respond naturally in the patient's language (${preferredLanguage} or whatever language they chat in, including Hindi, Tamil, Telugu, Kannada, English, Hinglish).

STRUCTURED METADATA:
At the very end of your response, ALWAYS append a hidden metadata tag on a new line in this exact JSON format:
<!--TRIAGE_META:{"triageLevel":"self-care"|"consult-doctor"|"visit-clinic"|"emergency","severityScore":1-10,"possibleConditions":["Condition 1","Condition 2"],"recommendedAction":"self-care"|"consult-doctor"|"visit-clinic"|"emergency","redFlagDetected":true|false,"quickReplies":["Short reply 1","Short reply 2","Short reply 3"]}-->

Guidelines for triageLevel:
- "emergency": Severe breathlessness, chest pain, stroke signs, heavy bleeding. Score: 9-10.
- "consult-doctor": Moderate fever > 2 days, persistent pain, infection symptoms needing prescription. Score: 6-8.
- "visit-clinic": Symptoms lasting > 7 days, persistent cough > 2 weeks, joint swelling needing PHC checkup. Score: 4-6.
- "self-care": Mild viral cold, fatigue, mild brief headache. Score: 1-3.

Do NOT prescribe exact dosages of high-risk prescription antibiotics. Keep your tone encouraging and reassuring.`;

  // Format messages for Groq API
  const formattedMessages = [
    { role: 'system', content: systemPrompt },
    ...messages.map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: String(m.content || ''),
    })),
  ];

  if (config.groqApiKey && config.groqApiKey.trim()) {
    try {
      const data = await groqChatCompletion({
        apiKey: config.groqApiKey,
        model: config.groqModel || 'qwen/qwen3.8-27b',
        messages: formattedMessages,
        temperature: 0.3,
        max_tokens: 750,
      });

      const rawContent = data.choices?.[0]?.message?.content || '';

      // Extract metadata tag
      let reply = rawContent;
      let meta = {
        triageLevel: 'consult-doctor',
        severityScore: 5,
        possibleConditions: ['General Symptom Assessment'],
        recommendedAction: 'consult-doctor',
        redFlagDetected: false,
        quickReplies: ['Fever for 2 days', 'Taking rest & fluids', 'Need doctor guidance'],
      };

      const metaMatch = rawContent.match(/<!--TRIAGE_META:([\s\S]*?)(?:-->|$)/);
      if (metaMatch && metaMatch[1]) {
        try {
          const parsedMeta = JSON.parse(metaMatch[1].trim());
          meta = { ...meta, ...parsedMeta };
        } catch (e) {
          // Meta tag may be incomplete if truncated
        }
      }
      reply = rawContent.replace(/<!--TRIAGE_META:[\s\S]*?(?:-->|$)/g, '').trim();

        return {
          reply,
          triageLevel: meta.triageLevel || 'consult-doctor',
          severityScore: meta.severityScore || 5,
          possibleConditions: meta.possibleConditions || ['General Health Evaluation'],
          recommendedAction: meta.recommendedAction || meta.triageLevel || 'consult-doctor',
          redFlagDetected: !!meta.redFlagDetected,
          quickReplies: meta.quickReplies || ['Fever for 2 days', 'No other issues', 'What should I eat?'],
          source: 'groq-llm',
        };
    } catch (llmErr) {
      console.warn('[Groq AI Chat Exception]:', llmErr.message);
    }
  }

  // Intelligent Context-Aware Rule Fallback
  return fallbackConversationalTriage(messages, patientProfile);
};

/**
 * Intelligent Conversational Fallback when offline or LLM unavailable
 */
const fallbackConversationalTriage = (messages, patientProfile) => {
  const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')?.content || '';
  const text = lastUserMsg.toLowerCase();

  const isEmergency =
    text.includes('chest') ||
    text.includes('heart') ||
    text.includes('unconscious') ||
    (text.includes('breath') && (text.includes('severe') || text.includes('hard') || text.includes('not able')));

  if (isEmergency) {
    return {
      reply: `⚠️ **Urgent Medical Alert**\n\nThe symptoms you described indicate acute cardiopulmonary distress. Please do not wait. \n\n🚨 **Immediate Action Required:**\n- Contact the **108 Emergency Helpline** or proceed to your nearest Community Hospital/Emergency Center immediately.\n- Keep the patient sitting upright and in a well-ventilated area.\n- Avoid heavy exertion while awaiting help.`,
      triageLevel: 'emergency',
      severityScore: 9,
      possibleConditions: ['Acute Respiratory / Cardiopulmonary Distress', 'Emergency Clinical Evaluation Required'],
      recommendedAction: 'emergency',
      redFlagDetected: true,
      quickReplies: ['Calling 108 now', 'Patient is resting', 'At hospital'],
      source: 'rule-based',
    };
  }

  const hasFever = text.includes('fever') || text.includes('temperature') || text.includes('chills') || text.includes('बुखार');
  const hasCough = text.includes('cough') || text.includes('throat') || text.includes('cold') || text.includes('खांसी');
  const hasStomach = text.includes('stomach') || text.includes('belly') || text.includes('vomit') || text.includes('diarrhea') || text.includes('loose');
  const hasHeadache = text.includes('headache') || text.includes('head') || text.includes('migraine');

  if (hasFever && hasCough) {
    return {
      reply: `🩺 **Clinical Assessment for Fever & Respiratory Symptoms**\n\nI understand you are experiencing fever accompanied by cough. \n\n**Possible Causes:**\n- Acute Viral Upper Respiratory Infection\n- Seasonal Influenza / Bronchial Irritation\n\n**Recommended Home Care:**\n- 💧 Drink plenty of warm water, clear broths, and ORS solution to maintain hydration.\n- 🛌 Complete bed rest and warm steam inhalation twice daily.\n- 🧽 Lukewarm sponge baths if body temperature exceeds 101°F (38.3°C).\n\n**Next Step:**\nIf the fever has lasted **more than 2 days** or worsens, connect with our online doctor today for a teleconsultation to get a verified prescription.`,
      triageLevel: 'consult-doctor',
      severityScore: 6,
      possibleConditions: ['Viral Upper Respiratory Infection', 'Seasonal Influenza'],
      recommendedAction: 'consult-doctor',
      redFlagDetected: false,
      quickReplies: ['Fever started yesterday', 'Fever is high (3 days)', 'Taking warm fluids', 'Book Teleconsult'],
      source: 'rule-based',
    };
  }

  if (hasStomach) {
    return {
      reply: `🩺 **Clinical Assessment for Digestive Discomfort**\n\nBased on your reported stomach discomfort/nausea: \n\n**Possible Causes:**\n- Acute Gastroenteritis / Dietary Indigestion\n- Mild Foodborne Irritation\n\n**Recommended Home Care:**\n- 💧 Sip Oral Rehydration Salts (ORS) or coconut water continuously to avoid dehydration.\n- 🥣 Eat bland, easily digestible foods like rice porridge (khichdi) or banana.\n- ❌ Avoid spicy, oily, or unboiled water.\n\n**Next Step:**\nIf you have frequent vomiting or cannot keep liquids down for 12 hours, please consult a medical doctor immediately.`,
      triageLevel: 'consult-doctor',
      severityScore: 5,
      possibleConditions: ['Acute Gastroenteritis', 'Dietary Indigestion'],
      recommendedAction: 'consult-doctor',
      redFlagDetected: false,
      quickReplies: ['1-2 loose motions only', 'Severe vomiting', 'Started taking ORS'],
      source: 'rule-based',
    };
  }

  // General helpful triage response
  return {
    reply: `Namaste! I am Dr. Ayush, your AI Health Assistant. \n\nI have noted your symptoms: "${lastUserMsg}". \n\nCould you please share a few more details so I can provide you with precise clinical guidance?\n1. **How many days** have you had this?\n2. Is the discomfort **mild, moderate, or severe**?\n3. Do you have any fever, vomiting, or breathing trouble?`,
    triageLevel: 'self-care',
    severityScore: 3,
    possibleConditions: ['General Health Evaluation'],
    recommendedAction: 'self-care',
    redFlagDetected: false,
    quickReplies: ['Started 2 days ago', 'Mild discomfort only', 'Severe body pain', 'No fever'],
    source: 'rule-based',
  };
};

export default {
  analyzeSymptoms,
  runRuleBasedTriage,
  chatSymptomTriage,
};

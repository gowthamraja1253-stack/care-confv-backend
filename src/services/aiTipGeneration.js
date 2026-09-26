import config from '../config/env.js';
import { groqChatCompletion } from '../utils/groqClient.js';

/**
 * Determine the current Indian health season based on the month
 */
export const getIndianSeasonContext = (date = new Date()) => {
  const month = date.getMonth(); // 0-indexed: 0 = Jan, 8 = Sept
  if (month >= 5 && month <= 8) {
    // June - September: Monsoon
    return {
      season: 'Monsoon / Post-Monsoon',
      risks: 'Waterborne infections, vector-borne illnesses (dengue, malaria, chikungunya), fungal skin irritation, viral fevers',
      focus: 'Boiled water, mosquito nets, dry footwear, fresh warm food',
    };
  } else if (month >= 9 && month <= 10) {
    // October - November: Autumn / Post-Harvest
    return {
      season: 'Autumn / Crop Harvest',
      risks: 'Respiratory allergies, asthma flare-ups from stubble/paddy dust, smog, temperature drops',
      focus: 'Mask outdoors, warm saline gargles, avoid morning damp air',
    };
  } else if (month >= 11 || month <= 1) {
    // December - February: Winter
    return {
      season: 'Winter',
      risks: 'Joint stiffness, hypertension spikes, cold, bronchitis, pediatric viral wheeze',
      focus: 'Warm layers, hydration with warm liquids, indoor exercise, sodium control',
    };
  } else {
    // March - May: Summer
    return {
      season: 'Summer / Pre-Monsoon',
      risks: 'Dehydration, heat stroke, gastroenteritis, electrolyte depletion',
      focus: 'Electrolyte intake, ORS, shade, protective headwear, hydration',
    };
  }
};

/**
 * Rule-based fallback engine for preventive health tips
 * Generates 3 rich, clinically sound tips across all 5 languages
 */
export const runRuleBasedTipGeneration = ({ patient = {}, riskProfile = null, recentSymptoms = [], preferredLanguage = 'en' }) => {
  const seasonInfo = getIndianSeasonContext();
  const lang = (preferredLanguage || patient.preferredLanguage || 'en').toLowerCase().substring(0, 2);
  const age = patient.age || 35;
  const chronicFlags = Array.isArray(patient.chronicFlags) ? patient.chronicFlags : [];
  const riskType = riskProfile?.riskType || (chronicFlags.includes('Hypertension') ? 'hypertension' : chronicFlags.includes('Diabetes Type-2') ? 'diabetes' : 'general');
  const riskLevel = riskProfile?.level || 'low';

  const hasRecentFever = recentSymptoms.some(s => 
    s.possibleConditions?.some(c => c.toLowerCase().includes('fever') || c.toLowerCase().includes('flu') || c.toLowerCase().includes('rhinitis'))
  );

  // 1. Hindi (hi)
  if (lang === 'hi') {
    const tips = [];

    // Seasonal / Vector-borne tip
    tips.push({
      tipText: `मौसमी स्वास्थ्य सुरक्षा (${seasonInfo.season}): पानी को उबालकर पिएं और घर के आसपास पानी जमा न होने दें।`,
      category: 'seasonal',
      actionableAdvice: 'मच्छरदानी का उपयोग करें और बच्चों को पूरी आस्तीन के कपड़े पहनाएं ताकि डेंगू और मौसमी बुखार से बचाव हो सके।',
      icon: '🌧️',
      language: 'hi',
      source: 'rule-based',
    });

    // Chronic / Risk-based tip
    if (riskType === 'hypertension' || chronicFlags.includes('Hypertension')) {
      tips.push({
        tipText: 'रक्तचाप (बीपी) नियंत्रण: भोजन में अतिरिक्त नमक और अचार का सेवन कम करें।',
        category: 'chronic-care',
        actionableAdvice: 'प्रतिदिन सुबह 20-30 मिनट तेज पैदल चलें और सप्ताह में एक बार पीएचसी पर बीपी चेक कराएं।',
        icon: '❤️',
        language: 'hi',
        source: 'rule-based',
      });
    } else if (riskType === 'diabetes' || chronicFlags.includes('Diabetes Type-2')) {
      tips.push({
        tipText: 'ब्लड शुगर संतुलन: भोजन में मेथी, करेला और हरी पत्तेदार सब्जियों को शामिल करें।',
        category: 'nutrition',
        actionableAdvice: 'मीठे पेय और रिफाइंड आटे से बचें। भोजन के 30 मिनट बाद हल्का टहलना फायदेमंद है।',
        icon: '🥗',
        language: 'hi',
        source: 'rule-based',
      });
    } else {
      tips.push({
        tipText: 'दैनिक पोषण व रोग प्रतिरोधक क्षमता: स्थानीय मौसमी फल, आंवला और दालों का नियमित सेवन करें।',
        category: 'nutrition',
        actionableAdvice: 'दिन में कम से कम 2.5 लीटर स्वच्छ पानी पिएं और भोजन से पहले साबुन से हाथ धोएं।',
        icon: '🍎',
        language: 'hi',
        source: 'rule-based',
      });
    }

    // Hygiene / Symptom recovery tip
    if (hasRecentFever) {
      tips.push({
        tipText: 'संक्रमण से रिकवरी: गुनगुना पानी पिएं और पर्याप्त आराम करें।',
        category: 'hygiene',
        actionableAdvice: 'धूल और सुबह की ठंडी हवा से बचें। गुनगुने नमक के पानी से गरारे करने से गले को आराम मिलता है।',
        icon: '🛡️',
        language: 'hi',
        source: 'rule-based',
      });
    } else {
      tips.push({
        tipText: 'स्वच्छता व जल संरक्षण: पीने के पानी के बर्तन को हमेशा ढककर रखें और रोजाना साफ करें।',
        category: 'hygiene',
        actionableAdvice: 'भोजन पकाने और बच्चों को खाना खिलाने से पहले हाथों की अच्छी स्वच्छता पेट की बीमारियों से बचाती है।',
        icon: '🧼',
        language: 'hi',
        source: 'rule-based',
      });
    }

    return tips;
  }

  // 2. Tamil (ta)
  if (lang === 'ta') {
    const tips = [];
    tips.push({
      tipText: `பருவகால சுகாதார பாதுகாப்பு (${seasonInfo.season}): குடிநீரை நன்கு காய்ச்சி வடிகட்டி அருந்தவும்.`,
      category: 'seasonal',
      actionableAdvice: 'கொசுக்கள் உற்பத்தியாகாமல் சுற்றுப்புறத்தை தூய்மையாக வைத்துக்கொண்டு டெங்கு காய்ச்சலைத் தவிர்க்கவும்.',
      icon: '🌧️',
      language: 'ta',
      source: 'rule-based',
    });

    if (riskType === 'hypertension' || chronicFlags.includes('Hypertension')) {
      tips.push({
        tipText: 'இரத்த அழுத்தக் கட்டுப்பாடு: உணவில் உப்பின் அளவைக் குறைத்து ஊறுகாயைத் தவிர்க்கவும்.',
        category: 'chronic-care',
        actionableAdvice: 'தினமும் காலை நடைப்பயிற்சி செய்து, மாதத்திற்கு ஒருமுறை ஆரம்ப சுகாதார நிலையத்தில் பிபி பரிசோதிக்கவும்.',
        icon: '❤️',
        language: 'ta',
        source: 'rule-based',
      });
    } else {
      tips.push({
        tipText: 'பாரம்பரிய ஊட்டச்சத்து: முருங்கைக்கீரை, பயறு வகைகள் மற்றும் காய்கறிகளை உணவில் சேர்க்கவும்.',
        category: 'nutrition',
        actionableAdvice: 'நோய் எதிர்ப்புச் சக்தியை அதிகரிக்க எலுமிச்சை, நெல்லிக்காய் மற்றும் போதுமான நீர் உட்கொள்ளவும்.',
        icon: '🥗',
        language: 'ta',
        source: 'rule-based',
      });
    }

    tips.push({
      tipText: 'சுய சுகாதாரம்: உணவு உண்ணும் முன்பும் கழிப்பறை சென்ற பின்னும் சோப்பு போட்டு கை கழுவவும்.',
      category: 'hygiene',
      actionableAdvice: 'சுத்தமான கை கழுவும் பழக்கம் வயிற்றுப்போக்கு மற்றும் தொற்று நோய்களிலிருந்து குடும்பத்தைப் பாதுகாக்கும்.',
      icon: '🧼',
      language: 'ta',
      source: 'rule-based',
    });

    return tips;
  }

  // 3. Telugu (te)
  if (lang === 'te') {
    const tips = [];
    tips.push({
      tipText: `కాలానుగుణ ఆరోగ్య రక్షణ (${seasonInfo.season}): కాచి చల్లార్చిన నీటిని మాత్రమే తాగండి.`,
      category: 'seasonal',
      actionableAdvice: 'దోమలు చేరకుండా పరిసరాలను శుభ్రంగా ఉంచుకోండి. డెంగ్యూ, మలేరియా నుండి రక్షణ పొందండి.',
      icon: '🌧️',
      language: 'te',
      source: 'rule-based',
    });

    if (riskType === 'hypertension' || chronicFlags.includes('Hypertension')) {
      tips.push({
        tipText: 'రక్తపోటు (BP) నియంత్రణ: ఆహారంలో ఉప్పు మరియు నూనె వాడకాన్ని తగ్గించండి.',
        category: 'chronic-care',
        actionableAdvice: 'రోజూ 30 నిమిషాలు నడవండి. క్రమం తప్పకుండా బీపీ చెకప్ చేయించుకోండి.',
        icon: '❤️',
        language: 'te',
        source: 'rule-based',
      });
    } else {
      tips.push({
        tipText: 'రోగనిరోధక శక్తి & పోషకాహారం: ఆకుకూరలు, పప్పులు మరియు ఉసిరిని రోజూ తీసుకోండి.',
        category: 'nutrition',
        actionableAdvice: 'రోజుకు కనీసం 2.5 లీటర్ల నీరు తాగి శరీరాన్ని హైడ్రేటెడ్‌గా ఉంచుకోండి.',
        icon: '🥗',
        language: 'te',
        source: 'rule-based',
      });
    }

    tips.push({
      tipText: 'వ్యక్తిగత పరిశుభ్రత: భోజనానికి ముందు చేతులను సబ్బుతో శుభ్రంగా కడుక్కోండి.',
      category: 'hygiene',
      actionableAdvice: 'మంచి పరిశుభ్రత పాటించడం ద్వారా కడుపు సంబంధిత వ్యాధుల నుండి సురక్షితంగా ఉండవచ్చు.',
      icon: '🧼',
      language: 'te',
      source: 'rule-based',
    });

    return tips;
  }

  // 4. Kannada (kn)
  if (lang === 'kn') {
    const tips = [];
    tips.push({
      tipText: `ಋತುಮಾನದ ಆರೋಗ್ಯ ರಕ್ಷಣೆ (${seasonInfo.season}): ಕಾಯಿಸಿ ಆರಿಸಿದ ನೀರನ್ನು ಮಾತ್ರ ಕುಡಿಯಿರಿ.`,
      category: 'seasonal',
      actionableAdvice: 'ಸೊಳ್ಳೆಗಳು ಉತ್ಪತ್ತಿಯಾಗದಂತೆ ಮನೆಯ ಸುತ್ತಮುತ್ತ ನೀರು ನಿಲ್ಲದಂತೆ ಎಚ್ಚರವಹಿಸಿ.',
      icon: '🌧️',
      language: 'kn',
      source: 'rule-based',
    });

    if (riskType === 'hypertension' || chronicFlags.includes('Hypertension')) {
      tips.push({
        tipText: 'ರಕ್ತದೊತ್ತಡ (BP) ನಿಯಂತ್ರಣ: ಆಹಾರದಲ್ಲಿ ಉಪ್ಪಿನ ಪ್ರಮಾಣವನ್ನು ಕಡಿಮೆ ಮಾಡಿ.',
        category: 'chronic-care',
        actionableAdvice: 'ಪ್ರತಿದಿನ ವಾಕಿಂಗ್ ಮಾಡಿ ಮತ್ತು ನಿಯಮಿತವಾಗಿ ಪ್ರಾಥಮಿಕ ಆರೋಗ್ಯ ಕೇಂದ್ರದಲ್ಲಿ ತಪಾಸಣೆ ಮಾಡಿಸಿಕೊಳ್ಳಿ.',
        icon: '❤️',
        language: 'kn',
        source: 'rule-based',
      });
    } else {
      tips.push({
        tipText: 'ಪೌಷ್ಟಿಕ ಆಹಾರ ಮತ್ತು ಆರೋಗ್ಯ: ಸ್ಥಳೀಯ ಹಸಿರು ತರಕಾರಿಗಳು, ಕಾಳುಗಳು ಮತ್ತು ಹಣ್ಣುಗಳನ್ನು ಸೇವಿಸಿ.',
        category: 'nutrition',
        actionableAdvice: 'ದೇಹದಲ್ಲಿ ರೋಗನಿರೋಧಕ ಶಕ್ತಿಯನ್ನು ಹೆಚ್ಚಿಸಲು ಸಾಕಷ್ಟು ನೀರು ಮತ್ತು ನೈಸರ್ಗಿಕ ಆಹಾರ ಸೇವಿಸಿ.',
        icon: '🥗',
        language: 'kn',
        source: 'rule-based',
      });
    }

    tips.push({
      tipText: 'ವೈಯಕ್ತಿಕ ನೈರ್ಮಲ್ಯ: ಊಟಕ್ಕೆ ಮುಂಚೆ ಮತ್ತು ಶೌಚಾಲಯ ಬಳಕೆಯ ನಂತರ ಕೈಗಳನ್ನು ಸಾಬೂನಿನಿಂದ ತೊಳೆಯಿರಿ.',
      category: 'hygiene',
      actionableAdvice: 'ಸ್ವಚ್ಛತೆಯ ಅಭ್ಯಾಸವು ಸೋಂಕು ಮತ್ತು ಜಠರದ ತೊಂದರೆಗಳನ್ನು ತಡೆಯಲು ಸಹಕಾರಿಯಾಗಿದೆ.',
      icon: '🧼',
      language: 'kn',
      source: 'rule-based',
    });

    return tips;
  }

  // 5. English (en) Default
  const tips = [];
  tips.push({
    tipText: `Seasonal Wellness Alert (${seasonInfo.season}): Boil drinking water and prevent stagnant water pooling.`,
    category: 'seasonal',
    actionableAdvice: 'Use mosquito repellent nets and wear full-length clothing to avoid vector-borne fevers.',
    icon: '🌧️',
    language: 'en',
    source: 'rule-based',
  });

  if (riskType === 'hypertension' || chronicFlags.includes('Hypertension')) {
    tips.push({
      tipText: 'Hypertension Care: Limit table salt, pickles, and processed fried snacks.',
      category: 'chronic-care',
      actionableAdvice: 'Maintain 30 minutes of daily brisk walking and get blood pressure checked at your local PHC monthly.',
      icon: '❤️',
      language: 'en',
      source: 'rule-based',
    });
  } else if (riskType === 'diabetes' || chronicFlags.includes('Diabetes Type-2')) {
    tips.push({
      tipText: 'Glycemic Balance: Include fenugreek, whole pulses, and leafy greens in meals.',
      category: 'nutrition',
      actionableAdvice: 'Avoid sugary drinks and refined flour. Take a gentle 15-minute walk after meals.',
      icon: '🥗',
      language: 'en',
      source: 'rule-based',
    });
  } else {
    tips.push({
      tipText: 'Immunity & Nutrition: Incorporate local seasonal greens, lentils, and citrus fruits.',
      category: 'nutrition',
      actionableAdvice: 'Drink at least 2.5 liters of clean water daily and maintain consistent sleep routines.',
      icon: '🍎',
      language: 'en',
      source: 'rule-based',
    });
  }

  if (hasRecentFever) {
    tips.push({
      tipText: 'Post-Infection Care: Stay warm and stay hydrated with light electrolyte broths/ORS.',
      category: 'hydration',
      actionableAdvice: 'Avoid exposure to early morning damp air and continue warm saline gargles for throat soothing.',
      icon: '🛡️',
      language: 'en',
      source: 'rule-based',
    });
  } else {
    tips.push({
      tipText: 'Hygiene Best Practice: Wash hands thoroughly with soap before cooking and feeding children.',
      category: 'hygiene',
      actionableAdvice: 'Keep water storage vessels covered and clean to prevent seasonal enteric infections.',
      icon: '🧼',
      language: 'en',
      source: 'rule-based',
    });
  }

  return tips;
};

/**
 * Generate AI-tailored Preventive Health Tips using Groq LLM API with intelligent fallback
 */
export const generatePreventiveTips = async ({
  patient = {},
  riskProfile = null,
  recentSymptoms = [],
  preferredLanguage = 'en',
}) => {
  const seasonInfo = getIndianSeasonContext();
  const langCode = (preferredLanguage || patient.preferredLanguage || 'en').toLowerCase().substring(0, 2);
  const langNames = {
    hi: 'Hindi (हिन्दी)',
    ta: 'Tamil (தமிழ்)',
    te: 'Telugu (తెలుగు)',
    kn: 'Kannada (ಕನ್ನಡ)',
    en: 'English',
  };
  const targetLanguageName = langNames[langCode] || 'English';

  if (config.groqApiKey && config.groqApiKey.trim()) {
    try {
      const prompt = `You are a clinical rural public health expert in India.
Generate exactly 3 actionable, empathetic, culturally relevant preventive health tips for a patient with the following context:

Patient Profile:
- Age: ${patient.age || 35}
- Gender: ${patient.gender || 'Not specified'}
- Village / Region: ${patient.village || 'Rural Community'}
- Chronic Conditions: ${(patient.chronicFlags || []).join(', ') || 'None'}
- Current Season: ${seasonInfo.season} (${seasonInfo.risks})
- Clinical Risk Profile: Score ${riskProfile?.score ?? 'N/A'}/100, Level: ${riskProfile?.level || 'low'}, Type: ${riskProfile?.riskType || 'general'}
- Recent Symptom Checkups: ${recentSymptoms.map(s => s.possibleConditions?.join(', ')).filter(Boolean).join('; ') || 'No acute symptoms recently'}

REQUIREMENTS:
1. Provide the tips ENTIRELY in ${targetLanguageName}.
2. Return ONLY a valid JSON array of 3 objects with this schema:
[
  {
    "tipText": "<Concise 1-2 sentence core preventive tip>",
    "category": "<one of: seasonal | nutrition | hygiene | chronic-care | lifestyle | hydration>",
    "actionableAdvice": "<Clear, realistic action step suitable for a village household>",
    "icon": "<1 relevant emoji>"
  }
]
3. Keep advice natural, supportive, and free of medical jargon.`;

      const data = await groqChatCompletion({
        apiKey: config.groqApiKey,
        model: config.groqModel || 'qwen/qwen3.8-27b',
        messages: [
          {
            role: 'system',
            content: `You are an expert rural healthcare advisor in India. Respond ONLY in valid JSON matching the requested array schema in ${targetLanguageName}.`,
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 600,
      });

      const contentStr = data.choices?.[0]?.message?.content;
        if (contentStr) {
          const parsed = JSON.parse(contentStr);
          const tipsArray = Array.isArray(parsed) ? parsed : parsed.tips || parsed.preventiveTips;
          if (Array.isArray(tipsArray) && tipsArray.length >= 2) {
            return tipsArray.slice(0, 3).map(t => ({
              tipText: t.tipText || t.text,
              category: t.category || 'seasonal',
              actionableAdvice: t.actionableAdvice || t.advice || '',
              icon: t.icon || '💡',
              language: langCode,
              source: 'llm',
            }));
          }
        }
    } catch (err) {
      console.warn('[AI Tip Generation] Groq API fallback triggered:', err.message);
    }
  }

  // Fallback to rule-based generation
  return runRuleBasedTipGeneration({
    patient,
    riskProfile,
    recentSymptoms,
    preferredLanguage: langCode,
  });
};

export default {
  getIndianSeasonContext,
  runRuleBasedTipGeneration,
  generatePreventiveTips,
};

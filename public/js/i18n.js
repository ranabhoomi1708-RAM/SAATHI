// public/js/i18n.js
// Internationalization support (English and Hindi)

let currentLang = localStorage.getItem('saathi_lang') || 'en';

const translations = {
  hi: {
    'Sign out': 'साइन आउट',
    'Overview': 'अवलोकन',
    'Medicines': 'दवाइयाँ',
    'Appointments': 'अपॉइंटमेंट',
    'Circle': 'केयर सर्कल',
    'Activity': 'गतिविधि',
    'Reports': 'रिपोर्ट्स',
    'Today Summary': 'आज का सारांश',
    'Adherence': 'नियमितता',
    'Today Doses': 'आज की खुराकें',
    'Take': 'ली',
    'Skip': 'छोड़ी',
    'Mood': 'मूड',
    'Low Stock': 'कम दवाइयाँ',
    'Upcoming Visits': 'आने वाली विज़िट',
    'Add': 'जोड़ें',
    'Scan': 'स्कैन करें',
    'Instructions': 'निर्देश',
    'Edit': 'संपादित करें',
    'Delete': 'हटाएँ',
    'Add Visit': 'विज़िट जोड़ें',
    'Upcoming': 'आगामी',
    'Done': 'पूर्ण',
    'Status': 'स्थिति',
    'Claim': 'साथ जाऊँगा/जाऊँगी',
    'Prepare': 'तैयारी करें',
    'Join Code': 'जुड़ने का कोड',
    'Rotate Code': 'नया कोड बनाएँ',
    'Copy': 'कॉपी करें',
    'Name': 'नाम',
    'Relation': 'संबंध',
    'Role': 'भूमिका',
    'Actions': 'कार्रवाई',
    'Revoke': 'रद्द करें',
    'Notify upcoming appointments': 'आगामी अपॉइंटमेंट की सूचना दें',
    'Leave Circle': 'सर्कल छोड़ें',
    'Outbox': 'आउटबॉक्स',
    'Demo Tools': 'डेमो टूल्स',
    'Weekly Summary': 'साप्ताहिक सारांश',
    'Print': 'प्रिंट करें',
    'Missed By Slot': 'समय के अनुसार छूटी खुराकें',
    'Mood Trend': 'मूड रुझान',
    'Emergency Card': 'आपातकालीन कार्ड',
    'Blood Group': 'ब्लड ग्रुप',
    'Allergies': 'एलर्जी',
    'Doctor': 'डॉक्टर',
    'Date': 'तारीख',
    'Purpose': 'उद्देश्य',
    'Outcome': 'निष्कर्ष'
  }
};

export function getLang() {
  return currentLang;
}

export function setLang(lang) {
  currentLang = lang;
  localStorage.setItem('saathi_lang', lang);
  window.dispatchEvent(new CustomEvent('saathi:langchange', { detail: { lang } }));
}

export function t(key) {
  if (currentLang === 'hi' && translations.hi && translations.hi[key]) {
    return translations.hi[key];
  }
  return key;
}

export default { t, getLang, setLang };

// Lightweight i18n for InfraSure ERP (English / हिन्दी / తెలుగు).
// Scaffold: covers the app chrome (nav, top bar, login, common labels, dashboard
// headings). Extend the dictionaries below to localize more strings; t() falls back
// to English, then to the key itself, so partial coverage degrades gracefully.
import { createContext, useContext, useState } from "react";

export const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी" },
  { code: "te", label: "తెలుగు" },
];

const STRINGS = {
  en: {
    "app.tagline": "Construction compliance",
    "auth.title": "InfraSure ERP",
    "auth.subtitle": "Construction compliance platform",
    "auth.email": "Email",
    "auth.password": "Password",
    "auth.signin": "Sign in",
    "top.workspace": "Tenant workspace",
    "top.logout": "Logout",
    "top.alerts": "Alerts",
    "alerts.allclear": "All clear — no active alerts.",
    "qa.title": "Quick actions",
    "qa.newDPR": "New DPR",
    "qa.logSafety": "Log Safety Audit",
    "qa.newFinance": "New Finance Record",
    "qa.newContract": "New Contract",
    "nav.home": "Dashboard",
    "nav.compliance": "Compliance KPIs",
    "nav.audit": "Audit Readiness",
    "nav.ai": "AI Insights",
    "nav.contracts": "Contracts",
    "nav.finance": "Finance",
    "nav.safety": "Safety",
    "nav.environment": "Environment",
    "nav.labour": "Labour",
    "nav.rera": "RERA",
    "nav.vendors": "Vendors",
    "nav.disputes": "Disputes",
    "nav.billing": "Billing",
    "nav.integrations": "Integrations",
    "nav.map": "Project Map",
    "map.title": "Project compliance map",
    "map.legend.compliant": "Compliant",
    "map.legend.pending": "Pending",
    "map.legend.noncompliant": "Non-compliant",
    "map.empty": "No geo-tagged sites yet.",
    "sev.critical": "Critical",
    "sev.warning": "Warning",
    "sev.ok": "OK",
  },
  hi: {
    "app.tagline": "निर्माण अनुपालन",
    "auth.title": "इंफ्राश्योर ईआरपी",
    "auth.subtitle": "निर्माण अनुपालन मंच",
    "auth.email": "ईमेल",
    "auth.password": "पासवर्ड",
    "auth.signin": "साइन इन करें",
    "top.workspace": "किरायेदार कार्यक्षेत्र",
    "top.logout": "लॉग आउट",
    "top.alerts": "अलर्ट",
    "alerts.allclear": "सब ठीक है — कोई सक्रिय अलर्ट नहीं।",
    "qa.title": "त्वरित क्रियाएँ",
    "qa.newDPR": "नई दैनिक प्रगति रिपोर्ट",
    "qa.logSafety": "सुरक्षा ऑडिट दर्ज करें",
    "qa.newFinance": "नया वित्त रिकॉर्ड",
    "qa.newContract": "नया अनुबंध",
    "nav.home": "डैशबोर्ड",
    "nav.compliance": "अनुपालन केपीआई",
    "nav.audit": "ऑडिट तत्परता",
    "nav.ai": "एआई अंतर्दृष्टि",
    "nav.contracts": "अनुबंध",
    "nav.finance": "वित्त",
    "nav.safety": "सुरक्षा",
    "nav.environment": "पर्यावरण",
    "nav.labour": "श्रम",
    "nav.rera": "रेरा",
    "nav.vendors": "विक्रेता",
    "nav.disputes": "विवाद",
    "nav.billing": "बिलिंग",
    "nav.integrations": "एकीकरण",
    "nav.map": "परियोजना मानचित्र",
    "map.title": "परियोजना अनुपालन मानचित्र",
    "map.legend.compliant": "अनुपालक",
    "map.legend.pending": "लंबित",
    "map.legend.noncompliant": "गैर-अनुपालक",
    "map.empty": "अभी तक कोई जियो-टैग साइट नहीं।",
    "sev.critical": "गंभीर",
    "sev.warning": "चेतावनी",
    "sev.ok": "ठीक",
  },
  te: {
    "app.tagline": "నిర్మాణ సమ్మతి",
    "auth.title": "ఇన్‌ఫ్రాష్యూర్ ఈఆర్‌పీ",
    "auth.subtitle": "నిర్మాణ సమ్మతి వేదిక",
    "auth.email": "ఇమెయిల్",
    "auth.password": "పాస్‌వర్డ్",
    "auth.signin": "సైన్ ఇన్ చేయండి",
    "top.workspace": "టెనెంట్ వర్క్‌స్పేస్",
    "top.logout": "లాగ్ అవుట్",
    "top.alerts": "హెచ్చరికలు",
    "alerts.allclear": "అంతా సవ్యంగా ఉంది — క్రియాశీల హెచ్చరికలు లేవు.",
    "qa.title": "త్వరిత చర్యలు",
    "qa.newDPR": "కొత్త రోజువారీ నివేదిక",
    "qa.logSafety": "భద్రతా ఆడిట్ నమోదు",
    "qa.newFinance": "కొత్త ఆర్థిక రికార్డు",
    "qa.newContract": "కొత్త ఒప్పందం",
    "nav.home": "డాష్‌బోర్డ్",
    "nav.compliance": "సమ్మతి కేపీఐలు",
    "nav.audit": "ఆడిట్ సంసిద్ధత",
    "nav.ai": "ఏఐ అంతర్దృష్టులు",
    "nav.contracts": "ఒప్పందాలు",
    "nav.finance": "ఆర్థికం",
    "nav.safety": "భద్రత",
    "nav.environment": "పర్యావరణం",
    "nav.labour": "శ్రామికం",
    "nav.rera": "రెరా",
    "nav.vendors": "విక్రేతలు",
    "nav.disputes": "వివాదాలు",
    "nav.billing": "బిల్లింగ్",
    "nav.integrations": "అనుసంధానాలు",
    "nav.map": "ప్రాజెక్ట్ మ్యాప్",
    "map.title": "ప్రాజెక్ట్ సమ్మతి మ్యాప్",
    "map.legend.compliant": "సమ్మతం",
    "map.legend.pending": "పెండింగ్",
    "map.legend.noncompliant": "సమ్మతం కాదు",
    "map.empty": "ఇంకా జియో-ట్యాగ్ సైట్‌లు లేవు.",
    "sev.critical": "క్లిష్టమైన",
    "sev.warning": "హెచ్చరిక",
    "sev.ok": "సరే",
  },
};

const I18nContext = createContext({ lang: "en", t: (k) => k, setLang: () => {} });

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(
    () => localStorage.getItem("lang") || "en"
  );
  const setLang = (l) => {
    localStorage.setItem("lang", l);
    setLangState(l);
  };
  const t = (key) => STRINGS[lang]?.[key] ?? STRINGS.en[key] ?? key;
  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export const useI18n = () => useContext(I18nContext);

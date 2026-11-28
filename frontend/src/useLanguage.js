import { useSyncExternalStore } from "react";

const messages = {
  en: {
    appTitle: "LMS AI Platform",
    login: "Log in",
    logout: "Log out",
    createAccount: "Create account",
    alreadyRegistered: "Already registered? Log in",
  },
  ta: {
    appTitle: "LMS AI கற்றல் தளம்",
    login: "உள்நுழைய",
    logout: "வெளியேறு",
    createAccount: "கணக்கு உருவாக்கு",
    alreadyRegistered: "ஏற்கெனவே கணக்கு உள்ளதா? உள்நுழைய",
  },
};

let language = "en";
try {
  if (localStorage.getItem("lms-language") === "ta") language = "ta";
} catch {
  // Use English when storage is unavailable.
}

document.documentElement.lang = language;
const listeners = new Set();

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return language;
}

function setLanguage(value) {
  language = value === "ta" ? "ta" : "en";
  document.documentElement.lang = language;
  try {
    localStorage.setItem("lms-language", language);
  } catch {
    // Language switching still works without storage.
  }
  listeners.forEach((listener) => listener());
}

export default function useLanguage() {
  const current = useSyncExternalStore(subscribe, getSnapshot);
  return {
    language: current,
    setLanguage,
    t: (key) => messages[current][key] ?? messages.en[key] ?? key,
  };
}
import { useEffect, useState } from 'react';

const KEY = 'gymscreener-settings-v1';

export const DEFAULT_SETTINGS = {
  onboarded: false,
  members: {}, // { shopId: true } = jeg er (eller blir) medlem
  firstTime: {}, // { shopId: true } = jeg har ikke handlet her før
  points: false, // regn bonuspoeng som rabatt
  codes: true, // bruk rabattkoder fra butikkenes egne sider
  delivery: 'cheapest',
  proxy: '',
};

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    return s ? { ...DEFAULT_SETTINGS, ...s } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function useSettings() {
  const [settings, setSettings] = useState(load);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(settings));
    } catch {
      /* privat modus: innstillingene gjelder bare denne økten */
    }
  }, [settings]);
  return [settings, setSettings];
}

export function useStored(key, initial) {
  const [v, setV] = useState(() => {
    try {
      const s = localStorage.getItem(`gymscreener-${key}`);
      return s ? JSON.parse(s) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(`gymscreener-${key}`, JSON.stringify(v));
    } catch {
      /* ignorer */
    }
  }, [key, v]);
  return [v, setV];
}

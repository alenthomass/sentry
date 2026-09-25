/* ============================================================================
   Sentry · Style strings
   The design template takes inline style strings. The ones that change with
   state (selected chips, progress bars, colour tones) are built here, using
   the exact values from the reference design.
   ============================================================================ */

// ── START: Fixed styles from the reference design ──────────────────────────
export var FADE = 'transition:background-color .22s ease,color .22s ease,border-color .22s ease,transform .18s ease,box-shadow .22s ease;';
export var FADE_SMALL = 'transition:background-color .22s ease,color .22s ease,transform .18s ease;';

export var STYLE = {
  tabActive: 'display:flex;flex-direction:column;align-items:center;gap:5px;width:56px;color:#8552FF;font-weight:700;cursor:pointer;transition:color .22s ease,transform .22s ease;transform:translateY(-2px)',
  tabInactive: 'display:flex;flex-direction:column;align-items:center;gap:5px;width:56px;color:#9A95AE;font-weight:600;cursor:pointer;transition:color .22s ease,transform .22s ease',
  pillSelected: FADE + 'padding:9px 15px;border-radius:999px;background:#1B1233;border:1.5px solid #1B1233;color:#FFFFFF;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap',
  pill: FADE + 'padding:9px 15px;border-radius:999px;background:#FFFFFF;border:1.5px solid #E6E1F1;color:#0B0620;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap',
  chipSelected: FADE + 'padding:11px 15px;border-radius:999px;background:#8552FF;color:#FFFFFF;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap',
  chip: FADE + 'padding:11px 15px;border-radius:999px;background:#F3F1FA;color:#4A4266;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap',
  smallChipSelected: FADE_SMALL + 'padding:10px 14px;border-radius:999px;background:#8552FF;color:#FFFFFF;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap',
  smallChip: FADE_SMALL + 'padding:10px 14px;border-radius:999px;background:#F3F1FA;color:#4A4266;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap',
  segmentSelected: FADE + 'padding:7px 14px;border-radius:999px;background:#FFFFFF;color:#0B0620;font-size:11px;font-weight:800;cursor:pointer;box-shadow:0 1px 4px rgba(5,0,17,0.10)',
  segment: FADE + 'padding:7px 14px;border-radius:999px;color:#7C7893;font-size:11px;font-weight:700;cursor:pointer',
  buttonEnabled: 'flex-shrink:0;margin-top:16px;text-align:center;padding:16px;border-radius:999px;font-size:15px;font-weight:700;background:#8552FF;color:#FFFFFF;cursor:pointer',
  buttonDisabled: 'flex-shrink:0;margin-top:16px;text-align:center;padding:16px;border-radius:999px;font-size:15px;font-weight:700;background:#EFEBF8;color:#9A95AE;cursor:default',
  valueText: 'font-size:13px;font-weight:800;color:#0B0620',
  valueTextLarge: 'font-size:16px;font-weight:800;color:#0B0620',
  valueTextRed: 'font-size:13px;font-weight:800;color:#C4342C',
  valueTextGreen: 'font-size:13px;font-weight:800;color:#4E8A41',
  valueTextAmber: 'font-size:13px;font-weight:800;color:#9A5B00'
};

export var TONES = {
  red: { background: '#FDE7E5', text: '#C4342C', bar: '#F2544B' },
  purple: { background: '#F3EDFF', text: '#6B36F0', bar: '#8552FF' },
  green: { background: '#EAF7E6', text: '#4E8A41', bar: '#ABE39E' }
};
export var CATEGORY_ICONS = {
  rent: { path: 'M3.5 9.2L10 4l6.5 5.2V16a.8.8 0 01-.8.8H4.3a.8.8 0 01-.8-.8V9.2zM8.2 16.8v-4.3h3.6v4.3', tint: '#F3EDFF', ink: '#6B36F0' },
  grocery: { path: 'M3 4h2.2l1.7 8.3h8l1.6-5.8H6M8 16.3h.01M14 16.3h.01', tint: '#EAF7E6', ink: '#4E8A41' },
  eatout: { path: 'M4.5 8h9v2.8a4.5 4.5 0 01-9 0V8zM13.5 9h1.2a1.9 1.9 0 010 3.8h-1.5M7 3.8v2M10 3.8v2', tint: '#FFF1E0', ink: '#9A5B00' },
  transport: { path: 'M5.5 3.8h9a1.5 1.5 0 011.5 1.5v8.4H4V5.3a1.5 1.5 0 011.5-1.5zM4 9.6h12M6.8 13.7v2.3M13.2 13.7v2.3M7 11.7h.01M13 11.7h.01', tint: '#E6F1FD', ink: '#1F6FC4' },
  shopping: { path: 'M4.8 7h10.4l-.9 9.2a.9.9 0 01-.9.8H6.6a.9.9 0 01-.9-.8L4.8 7zM7.5 7V6a2.5 2.5 0 015 0v1', tint: '#FDE7F1', ink: '#B4306E' },
  course: { path: 'M10 5.8C8.6 4.7 6.4 4.3 3.8 4.5v10.6c2.6-.2 4.8.2 6.2 1.3 1.4-1.1 3.6-1.5 6.2-1.3V4.5c-2.6-.2-4.8.2-6.2 1.3zM10 5.8v10.6', tint: '#EFEAFF', ink: '#5B3FD1' },
  society: { path: 'M10 3.6l1.9 4 4.4.6-3.2 3 .8 4.4L10 13.5l-3.9 2.1.8-4.4-3.2-3 4.4-.6L10 3.6z', tint: '#FFF6D6', ink: '#8A6A00' },
  health: { path: 'M10 16.2s-6-3.5-6-8.1a3.3 3.3 0 016-1.9 3.3 3.3 0 016 1.9c0 4.6-6 8.1-6 8.1z', tint: '#FDE7E5', ink: '#C4342C' },
  mobile: { path: 'M7 3h6a1.2 1.2 0 011.2 1.2v11.6A1.2 1.2 0 0113 17H7a1.2 1.2 0 01-1.2-1.2V4.2A1.2 1.2 0 017 3zM9 14.4h2', tint: '#E4F6F4', ink: '#227A70' }
};

export function categoryIcon(categoryId) {
  var icon = CATEGORY_ICONS[categoryId] || CATEGORY_ICONS.shopping;
  return {
    iconPath: icon.path,
    iconInk: icon.ink,
    iconBoxStyle: 'width:40px;height:40px;border-radius:13px;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:' + icon.tint
  };
}
// ── END: Fixed styles from the reference design ────────────────────────────


// ── START: Turning style strings into React style objects ─────────────────
export type Bindings = Record<string, any>;
export interface ViewProps { v: Bindings }

var styleCache: Record<string, Record<string, string>> = {};

export function css(styleText: string) {
  if (!styleText) return undefined;
  if (styleCache[styleText]) return styleCache[styleText];
  var style: Record<string, string> = {};
  String(styleText).split(';').forEach(function (declaration) {
    var colon = declaration.indexOf(':');
    if (colon < 0) return;
    var key = declaration.slice(0, colon).trim();
    var value = declaration.slice(colon + 1).trim();
    if (!key) return;
    style[key.indexOf('--') === 0 ? key : key.replace(/-([a-z])/g, function (match, letter) { return letter.toUpperCase(); })] = value;
  });
  return (styleCache[styleText] = style);
}
// ── END: Turning style strings into React style objects ───────────────────


// ── START: Styles that depend on state ─────────────────────────────────────
export function toneForPercent(percent) {
  if (percent >= 90) return TONES.red;
  if (percent >= 70) return TONES.purple;
  return TONES.green;
}

export function chipStyle(tone, padding?: string) {
  return 'padding:' + (padding || '5px 10px') + ';border-radius:999px;white-space:nowrap;font-size:11px;font-weight:800;transition:background-color .3s ease,color .3s ease;background:' + tone.background + ';color:' + tone.text;
}

export function barStyle(percent, color, radius) {
  var width = Math.max(0, Math.min(100, percent));
  return 'transition:width .55s cubic-bezier(.32,1,.35,1),background-color .3s ease;width:' + width + '%;height:100%;border-radius:' + (radius || 4) + 'px;background:' + color;
}

export function rowStyle(index, count, baseStyle) {
  return baseStyle + (index < count - 1 ? ';border-bottom:1px solid #F0EDF7' : '');
}

export function deleteButtonStyle(isArmed) {
  return 'width:28px;height:28px;border-radius:14px;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;transition:background-color .2s ease,color .2s ease;' +
    (isArmed ? 'background:#F2544B;color:#FFFFFF' : 'background:#F3F1FA;color:#9A95AE');
}

export function switchTrackStyle(isOn) {
  return 'width:46px;height:28px;border-radius:14px;flex-shrink:0;display:flex;align-items:center;padding:3px;box-sizing:border-box;transition:background-color .25s ease;background:' + (isOn ? '#8552FF' : '#E3DFF0');
}

export function switchKnobStyle(isOn) {
  return 'width:22px;height:22px;border-radius:11px;background:#FFFFFF;box-shadow:0 1px 3px rgba(5,0,17,0.2);transition:transform .25s cubic-bezier(.32,1,.35,1);transform:translateX(' + (isOn ? '18px' : '0') + ')';
}

export function bankLogoStyle(color: string, size?: number) {
  size = size || 36;
  return 'width:' + size + 'px;height:' + size + 'px;border-radius:' + Math.round(size / 3) + 'px;background:' + color +
    ';display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:' + (size > 40 ? 15 : 12) + 'px;font-weight:800;color:#FFFFFF;letter-spacing:-0.02em';
}

export function choiceChips(options, selectedValue, onSelect, small?: boolean) {
  return options.map(function (option) {
    var isSelected = option.value === selectedValue;
    return {
      label: option.label,
      chipStyle: small === false ? (isSelected ? STYLE.chipSelected : STYLE.chip) : (isSelected ? STYLE.smallChipSelected : STYLE.smallChip),
      select: function () { onSelect(option.value); }
    };
  });
}
// ── END: Styles that depend on state ───────────────────────────────────────

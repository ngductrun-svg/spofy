export function StemSubjects() {
  return <ul className="stem-subjects" aria-label="Các lĩnh vực khoa học tại SPOFY">
    <li><svg viewBox="0 0 32 32" aria-hidden="true"><ellipse cx="16" cy="16" rx="14" ry="5" /><ellipse cx="16" cy="16" rx="14" ry="5" transform="rotate(60 16 16)" /><ellipse cx="16" cy="16" rx="14" ry="5" transform="rotate(120 16 16)" /><circle cx="16" cy="16" r="2" className="stem-nucleus" /><circle cx="29" cy="18" r="1.5" className="stem-nucleus" /></svg><span>Vật lý<small>F = ma</small></span></li>
    <li><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M12 3h8M13 3v10L5 26q-1 3 3 3h16q4 0 3-3l-8-13V3M9 21h14" /><circle cx="14" cy="23" r="1" /><circle cx="19" cy="25" r="1" /><circle cx="17" cy="16" r="1" /></svg><span>Hóa học<small>H₂O · C · O</small></span></li>
    <li><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M8 2c0 7 16 7 16 14S8 23 8 30M24 2c0 7-16 7-16 14s16 7 16 14M9 5h14M11 9h10M9 14h14M9 18h14M11 23h10M9 27h14" /></svg><span>Sinh học<small>ADN · A–T · G–C</small></span></li>
  </ul>;
}

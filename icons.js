// אייקוני קו מצוירים ביד לכל תרגיל - בלי אימוג'י, בלי ספריות חיצוניות
const EXERCISE_ICONS = {
  abs: `
    <g fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
      <line x1="10" y1="58" x2="58" y2="58"></line>
      <circle cx="44" cy="19" r="6" fill="currentColor" stroke="none"></circle>
      <path d="M40 25 C 34 32, 30 38, 25 46"></path>
      <path d="M25 46 L 38 46 L 38 58"></path>
      <path d="M14 58 L 20 46"></path>
      <path d="M33 33 L 40 45"></path>
    </g>`,
  pushup: `
    <g fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
      <line x1="4" y1="52" x2="60" y2="52"></line>
      <circle cx="13" cy="27" r="6" fill="currentColor" stroke="none"></circle>
      <path d="M18 30 C 26 31, 34 32, 40 33"></path>
      <path d="M40 33 L 55 40"></path>
      <path d="M55 40 L 55 52"></path>
      <path d="M17 30 L 10 40 L 17 50"></path>
    </g>`,
  squat: `
    <g fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
      <line x1="8" y1="57" x2="56" y2="57"></line>
      <circle cx="31" cy="14" r="6" fill="currentColor" stroke="none"></circle>
      <path d="M30 20 L 34 35"></path>
      <path d="M34 35 L 22 43 L 29 57"></path>
      <path d="M34 35 L 40 45 L 36 57"></path>
      <path d="M31 23 L 47 30"></path>
    </g>`,
  calf: `
    <g fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
      <line x1="10" y1="57" x2="54" y2="57"></line>
      <circle cx="33" cy="12" r="6" fill="currentColor" stroke="none"></circle>
      <path d="M33 18 L 33 37"></path>
      <path d="M33 37 L 33 50 L 41 54"></path>
      <path d="M20 55 L 33 50"></path>
      <path d="M22 50 L 22 41"></path>
      <path d="M18 45 L 22 39 L 26 45"></path>
    </g>`
};

function renderExerciseIcons(root) {
  (root || document).querySelectorAll('svg[data-icon]').forEach(svg => {
    const key = svg.getAttribute('data-icon');
    if (EXERCISE_ICONS[key]) svg.innerHTML = EXERCISE_ICONS[key];
  });
}

document.addEventListener('DOMContentLoaded', () => renderExerciseIcons());

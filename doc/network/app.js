const progressLine = document.querySelector('#progressLine');
const miniProgress = document.querySelector('#miniProgress');
const progressText = document.querySelector('#progressText');
const tocLinks = [...document.querySelectorAll('.sidebar > a')];
const chapters = [...document.querySelectorAll('.chapter')];

function updateReadingProgress() {
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  const percent = maxScroll > 0 ? Math.min(100, Math.round(window.scrollY / maxScroll * 100)) : 0;
  progressLine.style.width = `${percent}%`;
  miniProgress.style.width = `${percent}%`;
  progressText.textContent = `${percent}%`;
  let current = chapters[0]?.id;
  chapters.forEach(chapter => {
    if (chapter.getBoundingClientRect().top <= 150) current = chapter.id;
  });
  tocLinks.forEach(link => link.classList.toggle('active', link.getAttribute('href') === `#${current}`));
}

window.addEventListener('scroll', updateReadingProgress, { passive: true });
window.addEventListener('resize', updateReadingProgress);
updateReadingProgress();

const themeBtn = document.querySelector('#themeBtn');
themeBtn.addEventListener('click', () => {
  document.body.classList.toggle('dark');
  themeBtn.textContent = document.body.classList.contains('dark') ? '☀' : '◐';
});

const answered = new Map();
const scoreEl = document.querySelector('#score');
function updateScore() {
  scoreEl.textContent = [...answered.values()].filter(Boolean).length;
}

document.querySelectorAll('.quiz-card').forEach((card, index) => {
  card.querySelectorAll('.options button').forEach(button => {
    button.addEventListener('click', () => {
      if (answered.has(index)) return;
      const correct = button.dataset.value === card.dataset.answer;
      answered.set(index, correct);
      button.classList.add(correct ? 'correct' : 'wrong');
      if (!correct) card.querySelector(`[data-value="${card.dataset.answer}"]`).classList.add('correct');
      const feedback = card.querySelector('.feedback');
      feedback.textContent = correct ? feedback.dataset.ok : feedback.dataset.no;
      updateScore();
    });
  });
});

document.querySelector('#resetQuiz').addEventListener('click', () => {
  answered.clear();
  document.querySelectorAll('.options button').forEach(button => button.classList.remove('correct', 'wrong'));
  document.querySelectorAll('.feedback').forEach(feedback => feedback.textContent = '');
  updateScore();
});

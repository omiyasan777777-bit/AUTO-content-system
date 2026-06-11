/* Jizo Papa LP — script.js
   最小限のJS。スクロール時の控えめなfade-upのみ。
*/

(function () {
  'use strict';

  // Intersection Observer for fade-up
  const targets = document.querySelectorAll('.fade-up');

  if (!targets.length) return;

  const options = {
    root: null,
    rootMargin: '0px 0px -60px 0px',
    threshold: 0.1,
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        // 少しずつ遅延をつけて静かに現れる
        const delay = entry.target.dataset.delay || 0;
        setTimeout(() => {
          entry.target.classList.add('is-visible');
        }, delay);
        observer.unobserve(entry.target);
      }
    });
  }, options);

  targets.forEach((el, i) => {
    // 同一セクション内の要素はわずかにずらす
    el.dataset.delay = i * 80;
    observer.observe(el);
  });

  // ページ読み込み時にヒーロー内の要素をすぐ表示（スクロール前）
  document.querySelectorAll('.hero .fade-up').forEach((el) => {
    setTimeout(() => {
      el.classList.add('is-visible');
    }, 200);
  });

})();

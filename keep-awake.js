/* ES5, no build or backend. NoSleep.js-inspired video fallback (MIT media assets).
 * Media progress confirms playback only, not that a device's sleep policy changed.
 */
(function () {
  'use strict';
  var button = document.getElementById('keep-awake-toggle');
  var bar = document.getElementById('keep-awake-bar');
  var video = document.getElementById('keep-awake-video');
  var retryButton = document.getElementById('keep-awake-retry');
  var diagnostic = document.getElementById('keep-awake-diagnostic');
  var navigationButton = document.getElementById('keep-awake-navigation');
  var capability = document.getElementById('keep-awake-capability');
  var nativeAvailable = !!(navigator.wakeLock && typeof navigator.wakeLock.request === 'function');
  var formats = [], lock = null, timer = null, wanted = false, generation = 0;
  var mode = '', nextVideo = false, progressed = false, previousMediaTime = -1;
  var started = 0, lastProgress = 0, lastCheck = 0;
  var mediaRoute = 0; // 0: browser choice; 1: explicit MP4; 2: inline MP4.
  var navigationCancel = null, navigationCount = 0, lastNavigation = 0;
  var navigationLimit = 20 * 60 * 1000;
  var navigationRecord = 'kindlenoodle-navigation-test';

  function rememberNavigation() {
    try {
      window.sessionStorage.setItem(navigationRecord, JSON.stringify({
        started: started, count: navigationCount
      }));
    } catch (ignored) {}
  }
  function forgetNavigation() {
    try { window.sessionStorage.removeItem(navigationRecord); } catch (ignored) {}
  }

  function mediaLabel() {
    if (mediaRoute === 1) { return 'MP4 文件'; }
    if (mediaRoute === 2) { return 'MP4 内嵌'; }
    return /\.webm(?:[?#]|$)/.test(video.currentSrc || '') ? 'WebM' : '自动选格式';
  }
  function mediaDetails() {
    return mediaLabel() + '；加载状态 ' + video.readyState + '；网络状态 ' + video.networkState +
      '；媒体错误 ' + (video.error ? video.error.code : 0) + '；时间 ' + (video.currentTime || 0).toFixed(2) + ' 秒';
  }

  function text(id, value) {
    var element = document.getElementById(id);
    if (element.textContent !== value) { element.textContent = value; }
  }
  function show(state, message, detail) {
    bar.setAttribute('data-state', state);
    text('keep-awake-status', message);
    text('keep-awake-detail', detail);
    text('keep-awake-nav-state', state === 'native' ? '· 开' : (state === 'navigation' ? '· 实验中' : (state === 'video' ? '· 待验证' : (wanted ? '· 检测中' : '· 关'))));
    text('keep-awake-toggle', wanted ? (mode === 'navigation' ? '停止实验' : '关闭常亮') : (nextVideo ? '尝试兼容常亮' : '开启常亮'));
    button.setAttribute('aria-pressed', wanted ? 'true' : 'false');
    retryButton.style.display = !wanted && (state === 'failed' || state === 'unsupported') && mediaRoute < 2 ? 'block' : 'none';
    retryButton.textContent = mediaRoute === 0 ? '改用 MP4 测试' : 'MP4 内嵌测试';
    navigationButton.disabled = wanted;
  }
  function releaseSentinel(sentinel) {
    try {
      var result = sentinel.release();
      if (result && typeof result.then === 'function') { result.then(function () {}, function () {}); }
    } catch (ignored) {}
  }
  function stop(state, message, detail, preserveRecord) {
    wanted = false;
    generation += 1;
    if (timer !== null) { window.clearInterval(timer); timer = null; }
    if (navigationCancel !== null) { window.clearTimeout(navigationCancel); navigationCancel = null; }
    if (!preserveRecord) { forgetNavigation(); }
    if (lock) { releaseSentinel(lock); lock = null; }
    try { video.pause(); } catch (ignored) {}
    video.style.display = 'none';
    mode = '';
    show(state, message, detail);
  }
  function videoFailure(message) {
    if (wanted && mode === 'video') {
      text('keep-awake-diagnostic', mediaDetails());
      diagnostic.style.display = 'block';
      stop('failed', message, '保活未启用；仍可正常使用时钟。');
    }
  }
  function nativeFailure() {
    if (formats.length) {
      nextVideo = true;
      stop('retry-video', '系统保活未获准', '再点一次按钮，尝试无声视频保活。');
    } else {
      stop('failed', '系统未允许常亮', '保活未启用；此浏览器也不支持兼容模式。');
    }
  }
  function monitor() {
    var now = new Date().getTime();
    if (!wanted) { return; }
    if (now - lastCheck > (mode === 'navigation' ? 45000 : 90000)) {
      stop('interrupted', '页面运行曾中断', '请重新开启；无法确认此前是否休眠。');
      return;
    }
    lastCheck = now;
    if (mode === 'navigation') {
      if (document.hidden || document.webkitHidden) { leave(); return; }
      if (now - started >= navigationLimit) {
        stop('test-complete', '20 分钟实验已结束', '已停止尝试。这不是成功判定：请确认期间有无屏保、时钟是否一直更新。');
        return;
      }
      if (now - lastNavigation >= 15000) { navigationPulse(now); }
      return;
    }
    if (mode === 'native' && !lock && now - started >= 15000) {
      nativeFailure();
    } else if (mode === 'video') {
      if (!progressed && now - started >= 15000) { videoFailure('浏览器未能播放保活视频'); }
      else if (progressed && now - lastProgress >= 30000) { videoFailure('保活视频已中断'); }
    }
  }
  function navigationPulse(now) {
    // NoSleep.js used this workaround only for iOS < 10. On Kindle it is an
    // opt-in experiment, not a screen wake lock. A real reload must never restart it.
    lastNavigation = now;
    navigationCount += 1;
    rememberNavigation();
    var current = generation;
    show('navigation', '旧浏览器实验中 · 待实测',
      '已尝试 ' + navigationCount + ' 次；剩余约 ' + Math.ceil((navigationLimit - (now - started)) / 60000) +
      ' 分钟。请回到时钟，不触摸屏幕。');
    try {
      window.location.href = window.location.href.split('#')[0];
      navigationCancel = window.setTimeout(function () {
        navigationCancel = null;
        if (wanted && mode === 'navigation' && current === generation) {
          try { window.stop(); }
          catch (error) { stop('failed', '浏览器无法取消加载', '实验已停止。'); }
        }
      }, 0);
    } catch (error) { stop('failed', '浏览器拒绝导航实验', '实验未运行。'); }
  }
  function startVideo() {
    mode = 'video';
    show('requesting-video', '正在尝试兼容常亮…', mediaLabel() + '，请保持本页打开。');
    video.style.display = 'block';
    video.muted = true;
    video.loop = true;
    var current = generation, result;
    try {
      // A retry deliberately overrides the browser's choice. Inline MP4 also
      // bypasses HTTP media requests/range handling while preserving static hosting.
      if (mediaRoute) {
        video.src = mediaRoute === 1 ? 'awake-assets/nosleep.mp4' : window.KindleAwakeMP4;
        video.load();
      }
      result = video.play();
      // Old WebKit returns undefined here, not a Promise.
      if (result && typeof result.then === 'function') {
        result.then(function () {}, function () {
          if (current === generation) { videoFailure('浏览器拒绝播放保活视频'); }
        });
      }
    } catch (error) { videoFailure('此浏览器无法播放保活视频'); }
  }
  function startNative() {
    mode = 'native';
    show('requesting-native', '正在请求系统保活…', '请保持本页打开。');
    var current = generation;
    try {
      navigator.wakeLock.request('screen').then(function (sentinel) {
        if (current !== generation || !wanted) { releaseSentinel(sentinel); return; }
        lock = sentinel;
        show('native', '系统保活已启用', '离开或刷新页面后，请重新开启。');
        sentinel.addEventListener('release', function () {
          if (current === generation && wanted) {
            stop('released', '系统已释放保活', '如需继续，请重新开启。');
          }
        });
      }, function () { if (current === generation) { nativeFailure(); } });
    } catch (error) { nativeFailure(); }
  }

  try {
    if (typeof video.canPlayType === 'function') {
      var types = [
        ['webm', 'video/webm; codecs="vp8"'],
        ['mp4', 'video/mp4; codecs="avc1.42E01E"']
      ];
      for (var i = 0; i < types.length; i += 1) {
        var support = video.canPlayType(types[i][1]);
        if (support && support !== 'no') {
          formats.push(types[i][0]);
          var source = document.createElement('source');
          source.src = 'awake-assets/nosleep.' + types[i][0];
          source.type = types[i][1];
          video.appendChild(source);
        }
      }
    }
  } catch (ignored) {}

  video.addEventListener('timeupdate', function () {
    if (!wanted || mode !== 'video' || video.paused) { return; }
    if (video.currentTime > 0 && video.currentTime !== previousMediaTime) {
      lastProgress = new Date().getTime();
      if (!progressed) {
        progressed = true;
        show('video', '兼容保活运行中 · 待实测', '请静置 20 分钟，观察是否进入屏保。');
      }
    }
    previousMediaTime = video.currentTime;
    // The long MP4 uses NoSleep's first-second replay workaround for old decoders.
    if (video.duration > 1 && video.currentTime > 0.5) {
      try { video.currentTime = Math.random() * 0.5; } catch (ignored) {}
    }
  }, false);
  video.addEventListener('error', function () { if (video.error) { videoFailure('保活视频加载或解码失败'); } }, false);
  video.addEventListener('pause', function () { if (video.paused) { videoFailure('保活视频已停止'); } }, false);

  button.onclick = function () {
    if (wanted) { stop('off', '常亮已关闭', '实验功能：需浏览器支持。'); return; }
    if (!mediaRoute && !nativeAvailable && !formats.length) {
      show('unsupported', '此浏览器不支持网页常亮', '未检测到保活接口或可播放的视频。');
      return;
    }
    wanted = true;
    diagnostic.style.display = 'none';
    generation += 1;
    progressed = false; previousMediaTime = -1;
    started = new Date().getTime(); lastProgress = started; lastCheck = started;
    timer = window.setInterval(monitor, 5000);
    if (nativeAvailable && !nextVideo && !mediaRoute) { startNative(); }
    else { startVideo(); }
  };
  retryButton.onclick = function () {
    if (wanted || mediaRoute >= 2) { return; }
    if (mediaRoute === 1 && !window.KindleAwakeMP4) {
      show('failed', '内嵌测试资源未加载', '请刷新网页后重试。');
      return;
    }
    mediaRoute += 1;
    button.onclick();
  };
  navigationButton.onclick = function () {
    if (wanted) { return; }
    if (typeof window.stop !== 'function') {
      show('failed', '此浏览器无法执行导航实验', '缺少取消加载的能力；实验未启动。');
      return;
    }
    if (document.hidden || document.webkitHidden) { return; }
    wanted = true;
    mode = 'navigation';
    generation += 1;
    navigationCount = 0;
    started = new Date().getTime(); lastCheck = started; lastNavigation = started;
    diagnostic.style.display = 'none';
    rememberNavigation();
    timer = window.setInterval(monitor, 5000);
    show('navigation', '旧浏览器实验中 · 待实测', '每 15 秒尝试一次，20 分钟后停止。请回到时钟，不触摸屏幕。');
  };
  // Navigation cancellation may interrupt other requests. Restrict this experiment
  // to the clock/settings tabs so it cannot reload an active cooking/focus timer.
  window.KindleAwakeOnTabChange = function (tab) {
    if (wanted && mode === 'navigation' && tab !== 0 && tab !== 3) {
      stop('off', '导航实验已停止', '此实验仅用于时钟，避免影响番茄钟或泡面计时。');
    }
  };
  function leave() {
    if (wanted) { stop('paused', '离开页面，保活已停止', '返回后请重新开启常亮。', mode === 'navigation'); }
  }
  document.addEventListener('visibilitychange', function () { if (document.hidden) { leave(); } }, false);
  document.addEventListener('webkitvisibilitychange', function () { if (document.webkitHidden) { leave(); } }, false);
  window.addEventListener('pagehide', leave, false);
  button.disabled = false;
  navigationButton.disabled = false;
  capability.textContent = '标准保活接口：' + (nativeAvailable ? '可用' : '未暴露') +
    '；安全上下文：' + (window.isSecureContext === true ? '是' : (window.isSecureContext === false ? '否' : '无法检测')) +
    '；浏览器自报视频格式：' + (formats.length ? formats.join('、') : '无') +
    '。HTTP 下未暴露接口，不能据此判断 HTTPS 下是否支持。';
  show('off', '常亮未开启 · 实验功能', '仅在本页生效；是否防休眠需实测。');
  var previousNavigation = null;
  try { previousNavigation = JSON.parse(window.sessionStorage.getItem(navigationRecord) || 'null'); } catch (ignored) {}
  forgetNavigation();
  if (previousNavigation && typeof previousNavigation.count === 'number') {
    show('interrupted', '上次导航实验中断，未自动重启',
      '上次发起 ' + previousNavigation.count + ' 次尝试。可能发生了整页重载或页面离开，不能据此认定常亮有效。');
  }
}());

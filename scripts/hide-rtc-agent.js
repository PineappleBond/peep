// 隐藏 RTC Agent 弹窗
(function() {
  const rtcAgent = document.querySelector('rtc-agent');
  if (rtcAgent) {
    rtcAgent.style.display = 'none';
    return 'rtc-agent hidden';
  }
  return 'no rtc-agent found';
})();
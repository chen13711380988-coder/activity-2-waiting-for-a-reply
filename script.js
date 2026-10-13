// ACTIVITY 2: WAITING FOR A REPLY
// This version runs in real seconds and chooses one predefined status sequence.

// 1. Find the parts of the page that the program reads or changes.
const setupPanel = document.querySelector('#setup-panel');
const simulation = document.querySelector('#simulation');
const summary = document.querySelector('#summary');
const expectedTimeInput = document.querySelector('#expected-time');
const timeUnitInput = document.querySelector('#time-unit');
const urgentInput = document.querySelector('#urgent-deadline');
const startButton = document.querySelector('#start-button');
const switchViewButton = document.querySelector('#switch-view-button');
const resetButton = document.querySelector('#reset-button');
const elapsedOutput = document.querySelector('#elapsed-time');
const checkOutput = document.querySelector('#check-count');
const conversationView = document.querySelector('#conversation-view');
const socialFeed = document.querySelector('#social-feed');
const viewLabel = document.querySelector('#view-label');
const messageSignal = document.querySelector('#message-signal');
const typingSignal = document.querySelector('#typing-signal');
const replyMessage = document.querySelector('#reply-message');
const expectedDisplay = document.querySelector('#expected-display');
const effortDisplay = document.querySelector('#effort-display');
const thresholdDisplay = document.querySelector('#threshold-display');
const decisionPanel = document.querySelector('#decision-panel');
const decisionReason = document.querySelector('#decision-reason');
const actionOptions = document.querySelector('#action-options');
const interpretationPanel = document.querySelector('#interpretation-panel');
const interpretationOptions = document.querySelector('#interpretation-options');
const summaryList = document.querySelector('#summary-list');

// 2. Store all information that changes during one waiting experience.
let state = {};

function freshState() {
  return {
    expectedSeconds: 10,
    effort: 'low',
    multiplier: 1,
    thresholdSeconds: 10,
    urgent: false,
    elapsedSeconds: 0,
    checks: 0,
    currentStatus: 'Sent',
    statusHistory: ['Sent'],
    repeatedTyping: false,
    replyArrived: false,
    followUpSent: false,
    waitingEnded: false,
    isAway: false,
    timerId: null,
    events: [],
    nextEventIndex: 0,
    shownMoments: new Set(),
    pendingPrompt: null,
    decisionActive: false,
    finalAction: 'Still waiting',
    interpretation: 'Not selected yet',
    sequenceName: ''
  };
}

// 3. Time helpers keep every calculation in seconds.
function multiplierFor(effort) {
  if (effort === 'medium') return 1.5;
  if (effort === 'high') return 2;
  return 1;
}

function formatClock(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function formatDuration(totalSeconds) {
  const rounded = Math.ceil(totalSeconds);
  const minutes = Math.floor(rounded / 60);
  const seconds = rounded % 60;
  if (minutes && seconds) return `${minutes} min ${seconds} sec`;
  if (minutes) return `${minutes} min`;
  return `${seconds} sec`;
}

// 4. Each possible sequence is understandable and testable.
// One sequence is selected randomly when the experience starts.
function buildSequences(expected, threshold) {
  const at = (fraction, minimum = 1) => Math.max(minimum, Math.round(expected * fraction));
  const afterThreshold = Math.floor(threshold) + Math.max(3, Math.round(expected * .25));

  return [
    {
      name: 'quick reply',
      events: [
        { time: at(.3), status: 'Read' },
        { time: at(.55, at(.3) + 1), status: 'Typing' },
        { time: at(.85, at(.55) + 1), status: 'Replied' }
      ]
    },
    {
      name: 'typing changes',
      events: [
        { time: at(.25), status: 'Typing' },
        { time: at(.5, at(.25) + 1), status: 'Typing disappeared' },
        { time: at(.75, at(.5) + 1), status: 'Typing' },
        { time: afterThreshold, status: 'Replied' }
      ]
    },
    {
      name: 'read pause',
      events: [
        { time: at(.3), status: 'Read' },
        { time: Math.floor(expected) + 2, status: 'Typing' },
        { time: Math.floor(expected) + 4, status: 'Typing disappeared' },
        { time: afterThreshold + 3, status: 'Replied' }
      ]
    },
    {
      name: 'quiet wait',
      events: [
        { time: at(.45), status: 'Read' },
        { time: afterThreshold + 5, status: 'Replied' }
      ]
    }
  ].map(sequence => ({
    ...sequence,
    events: sequence.events.sort((a, b) => a.time - b.time)
  }));
}

function selectRandomSequence() {
  const sequences = buildSequences(state.expectedSeconds, state.thresholdSeconds);
  const selected = sequences[Math.floor(Math.random() * sequences.length)];
  state.sequenceName = selected.name;
  state.events = selected.events;
  state.nextEventIndex = 0;
}

// 5. Detect when Typing appears, changes or disappears, and appears again.
function detectRepeatedTyping(history) {
  let sawTyping = false;
  let sawChangeAfterTyping = false;

  for (const status of history) {
    if (status === 'Typing') {
      if (sawTyping && sawChangeAfterTyping) return true;
      sawTyping = true;
    } else if (sawTyping) {
      sawChangeAfterTyping = true;
    }
  }
  return false;
}

// 6. Timer controls. The timer pauses while the decision space offers choices.
function startTimer() {
  if (state.timerId || state.waitingEnded || state.decisionActive) return;
  state.timerId = window.setInterval(tick, 1000);
}

function pauseTimer() {
  window.clearInterval(state.timerId);
  state.timerId = null;
}

function tick() {
  state.elapsedSeconds += 1;
  elapsedOutput.textContent = formatClock(state.elapsedSeconds);
  processScheduledEvents();
  evaluateTimeMoments();
}

// 7. Status changes happen automatically, not through user controls.
function processScheduledEvents() {
  while (
    state.nextEventIndex < state.events.length &&
    state.events[state.nextEventIndex].time <= state.elapsedSeconds
  ) {
    const event = state.events[state.nextEventIndex];
    state.nextEventIndex += 1;
    changeStatus(event.status);
    if (state.waitingEnded) return;
  }
}

function changeStatus(newStatus) {
  const wasRepeatedTyping = state.repeatedTyping;
  state.currentStatus = newStatus;
  state.statusHistory.push(newStatus);
  state.repeatedTyping = detectRepeatedTyping(state.statusHistory);

  if (newStatus === 'Replied') {
    state.replyArrived = true;
    pauseTimer();
    if (state.isAway) {
      state.pendingPrompt = { type: 'reply' };
    } else {
      revealReplyAndEnd();
    }
    return;
  }

  updateVisibleStatus();

  if (newStatus === 'Typing disappeared') {
    offerDecision('typing-disappeared', 'The Typing signal disappeared without a reply. What would you do next?');
  } else if (state.repeatedTyping && !wasRepeatedTyping) {
    offerDecision('typing-returned', 'Typing appeared again after changing or disappearing. The recipient appears active, but a reply has not arrived.');
  }
}

function updateVisibleStatus() {
  messageSignal.textContent = state.currentStatus;
  typingSignal.hidden = state.currentStatus !== 'Typing';
  messageSignal.hidden = state.currentStatus === 'Typing';
}

// 8. Time-based meaningful moments use the agreed thresholds.
function evaluateTimeMoments() {
  if (state.replyArrived || state.waitingEnded) return;

  const expectedExceededAt = Math.floor(state.expectedSeconds) + 1;
  const thresholdExceededAt = Math.floor(state.thresholdSeconds) + 1;

  // Low effort can make these two moments occur together, so show one prompt.
  if (state.elapsedSeconds >= thresholdExceededAt && !state.shownMoments.has('threshold-exceeded')) {
    state.shownMoments.add('threshold-exceeded');
    state.shownMoments.add('expected-exceeded');
    const activityNote = state.repeatedTyping ? ' Typing has also reappeared, suggesting that the recipient is active.' : '';
    offerDecision('threshold-exceeded', `The ${formatDuration(state.thresholdSeconds)} effort-adjusted waiting threshold has passed.${activityNote}`);
    return;
  }

  if (state.elapsedSeconds >= expectedExceededAt && !state.shownMoments.has('expected-exceeded')) {
    state.shownMoments.add('expected-exceeded');
    offerDecision('expected-exceeded', `The expected reply time of ${formatDuration(state.expectedSeconds)} has passed.`);
  }
}

// 9. The decision section stays below the chat and offers choices at meaningful moments.
function offerDecision(type, reason) {
  const prompt = { type, reason };
  if (state.isAway) {
    state.pendingPrompt = prompt;
    return;
  }

  pauseTimer();
  state.decisionActive = true;
  decisionReason.textContent = reason;
  showActions(availableActions());
  decisionPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function availableActions() {
  return state.urgent
    ? ['Send a follow-up message', 'Continue waiting', 'Stop waiting', 'Try another communication method', 'Act without a reply']
    : ['Send a follow-up message', 'Continue waiting', 'Stop waiting'];
}

function resetDecisionPanel(message = 'You can choose an action at any time while you wait.') {
  state.decisionActive = false;
  decisionReason.textContent = message;
  showActions(availableActions());
}

function showActions(actions, disabled = false) {
  actionOptions.replaceChildren();
  actions.forEach(action => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'action-button';
    button.textContent = action;
    button.disabled = disabled;
    button.addEventListener('click', () => chooseAction(action));
    actionOptions.append(button);
  });
}

function showInterpretationOptions() {
  const interpretations = [
    "The recipient may not want to reply to me.",
    'The recipient may be dealing with an emergency.',
    'The recipient may see this as a serious conversation and need time to think about a reply.',
    "I'm not sure why the reply was delayed."
  ];

  interpretationOptions.replaceChildren();
  interpretations.forEach(interpretation => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'interpretation-button';
    button.textContent = interpretation;
    button.addEventListener('click', () => {
      state.interpretation = interpretation;
      interpretationOptions.querySelectorAll('button').forEach(option => option.classList.remove('selected'));
      button.classList.add('selected');
      const summaryValue = summaryList.querySelector('[data-summary-key="Sender interpretation"] dd');
      if (summaryValue) summaryValue.textContent = interpretation;
    });
    interpretationOptions.append(button);
  });
  interpretationPanel.classList.remove('hidden');
}

function chooseAction(action) {
  state.finalAction = action;
  state.decisionActive = false;

  if (action === 'Send a follow-up message') {
    state.followUpSent = true;
    addFollowUpMessage();
    resetDecisionPanel('Your follow-up was sent. The model is observing the next signal.');
    startTimer();
    return;
  }

  if (action === 'Stop waiting' || action === 'Act without a reply') {
    endExperience(action);
    return;
  }

  // Continue waiting and trying another method both leave the model running.
  resetDecisionPanel(action === 'Continue waiting'
    ? 'You chose to continue waiting. The model is observing what happens next.'
    : 'You chose another communication method. The message wait continues in the background.');
  startTimer();
}

// 10. A follow-up appears in the chat and starts a short automatic sequence.
function addFollowUpMessage() {
  const group = document.createElement('div');
  group.className = 'message-group outgoing';
  const bubble = document.createElement('div');
  bubble.className = 'message sent-message';
  bubble.textContent = 'Just checking in — are you able to reply?';
  group.append(bubble, messageSignal, typingSignal);
  conversationView.insertBefore(group, replyMessage);

  state.currentStatus = 'Sent';
  state.statusHistory.push('Sent');
  updateVisibleStatus();

  const now = state.elapsedSeconds;
  state.events = [
    { time: now + 2, status: 'Read' },
    { time: now + 4, status: 'Typing' },
    { time: now + 7, status: 'Replied' }
  ];
  state.nextEventIndex = 0;
}

// 11. Switching away hides all status changes. Returning counts as a check.
function toggleActivityView() {
  if (state.isAway) {
    state.isAway = false;
    socialFeed.classList.add('hidden');
    conversationView.classList.remove('hidden');
    switchViewButton.textContent = 'Switch to do other things';
    viewLabel.textContent = 'Conversation';
    state.checks += 1;
    checkOutput.textContent = state.checks;
    updateVisibleStatus();

    if (state.replyArrived) {
      revealReplyAndEnd();
      return;
    }

    if (state.pendingPrompt) {
      const prompt = state.pendingPrompt;
      state.pendingPrompt = null;
      offerDecision(prompt.type, prompt.reason);
    }
  } else {
    state.isAway = true;
    conversationView.classList.add('hidden');
    socialFeed.classList.remove('hidden');
    switchViewButton.textContent = 'Back to conversation';
    viewLabel.textContent = 'Social feed';
  }
}

// 12. A reply or stopping ends the experience and produces a summary.
function revealReplyAndEnd() {
  state.isAway = false;
  socialFeed.classList.add('hidden');
  conversationView.classList.remove('hidden');
  replyMessage.classList.remove('hidden');
  typingSignal.hidden = true;
  messageSignal.hidden = false;
  messageSignal.textContent = 'Replied';
  endExperience('Reply arrived');
}

function endExperience(finalAction) {
  if (state.waitingEnded) return;
  pauseTimer();
  state.waitingEnded = true;
  state.finalAction = finalAction;
  state.decisionActive = false;

  // Keep the chat visible beside the completed decision space.
  state.isAway = false;
  socialFeed.classList.add('hidden');
  conversationView.classList.remove('hidden');
  switchViewButton.textContent = 'Experience complete';
  switchViewButton.disabled = true;
  viewLabel.textContent = 'Conversation';
  decisionReason.textContent = `Final outcome: ${finalAction}. Review the waiting summary below.`;
  showActions(availableActions(), true);

  const facts = [
    ['Elapsed time', formatDuration(state.elapsedSeconds)],
    ['Expected reply time', formatDuration(state.expectedSeconds)],
    ['Response effort', state.effort],
    ['Waiting threshold', formatDuration(state.thresholdSeconds)],
    ['Conversation checks', state.checks],
    ['Repeated Typing pattern', state.repeatedTyping ? 'Yes' : 'No'],
    ['Status sequence', state.sequenceName],
    ['Follow-up sent', state.followUpSent ? 'Yes' : 'No'],
    ['Reply arrived', state.replyArrived ? 'Yes' : 'No'],
    ['Final action', state.finalAction],
    ['Sender interpretation', state.interpretation]
  ];

  summaryList.replaceChildren();
  facts.forEach(([term, value]) => {
    const group = document.createElement('div');
    const dt = document.createElement('dt');
    const dd = document.createElement('dd');
    dt.textContent = term;
    dd.textContent = value;
    group.dataset.summaryKey = term;
    group.append(dt, dd);
    summaryList.append(group);
  });

  summary.classList.remove('hidden');
  showInterpretationOptions();
  summary.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// 13. Start and reset the experience.
startButton.addEventListener('click', () => {
  const enteredTime = Number(expectedTimeInput.value);
  if (!Number.isFinite(enteredTime) || enteredTime < 1) {
    expectedTimeInput.focus();
    return;
  }

  const effort = document.querySelector('input[name="effort"]:checked').value;
  const expectedSeconds = timeUnitInput.value === 'minutes' ? enteredTime * 60 : enteredTime;

  state = freshState();
  state.expectedSeconds = expectedSeconds;
  state.effort = effort;
  state.multiplier = multiplierFor(effort);
  state.thresholdSeconds = Math.ceil(expectedSeconds * state.multiplier);
  state.urgent = urgentInput.checked;
  selectRandomSequence();

  expectedDisplay.textContent = formatDuration(state.expectedSeconds);
  effortDisplay.textContent = effort;
  thresholdDisplay.textContent = formatDuration(state.thresholdSeconds);
  setupPanel.classList.add('hidden');
  simulation.classList.remove('hidden');
  switchViewButton.disabled = false;
  resetDecisionPanel('You can choose an action at any time while you wait. The model will explain meaningful moments here.');
  updateVisibleStatus();

  if (state.urgent) {
    offerDecision('urgent-deadline', 'You marked this situation as having an urgent deadline. Waiting may not be the only reasonable action.');
  } else {
    startTimer();
  }
});

switchViewButton.addEventListener('click', toggleActivityView);
resetButton.addEventListener('click', () => window.location.reload());

state = freshState();

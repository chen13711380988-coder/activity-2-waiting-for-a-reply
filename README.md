# Activity 2: Waiting for a Reply

## Phenomenon

This project represents the experience of waiting after sending one message. The unit of analysis begins when one message is sent and ends when the first reply arrives or the sender stops waiting.

The model explores how elapsed time, expected reply time, message-status history, an urgent decision deadline, and expected response effort can shape the actions available to the sender. It records checking behavior but does not use the number of checks to make decisions.

The model treats message signals as evidence. It cannot know what the recipient is thinking or why a status changed.

## Run the prototype

Open `index.html` in a browser. No installation or internet connection is required.

1. Set an expected reply time in seconds or minutes.
2. Select low, medium, or high expected response effort.
3. Choose whether the situation has an urgent deadline.
4. Start waiting while real time advances automatically.
5. Watch the model select and run one predefined status sequence.
6. Switch to a generic social feed, then return to check the conversation.
7. Use the always-visible action buttons in the decision section below the chat whenever you want to make a choice.
8. Review the summary while the completed conversation remains visible.

## Model rules

- Low effort threshold: expected reply time × 1
- Medium effort threshold: expected reply time × 1.5
- High effort threshold: expected reply time × 2
- An urgent deadline overrides ordinary waiting thresholds.
- A repeated Typing pattern occurs when Typing appears, changes or disappears, and then appears again before a reply.
- If that pattern occurs after the waiting threshold, the model presents both continuing to wait and sending a follow-up.
- Status sequences are selected randomly from a small predefined collection: a quick reply, changing Typing signals, a Read pause, or a quiet wait.
- Status changes remain hidden while the user views the alternate activity.
- Returning to the conversation counts as one check.
- The decision section and its action buttons remain below the chat throughout the experience. At meaningful moments, its explanation changes to describe what happened.
- The conversation remains visible when the final waiting summary appears.
- The final summary identifies which predefined sequence was selected.
- The user makes the final decision.

## Files

- `index.html` contains the page structure.
- `style.css` controls the visual design and responsive layout.
- `script.js` contains the numbered model sequence and interaction logic.

## AI use

AI helped organize the phenomenon into observable states, identify unclear instructions, review assumptions, and translate the revised pseudocode into a browser-based model. Important decisions—including the unit of analysis, included variables, threshold multipliers, and final actions—were made through the student's responses.

## Reflection

Write your reflection here after testing the prototype. Consider what matched your intention, what you changed, how AI supported the process, and what remains uncertain.

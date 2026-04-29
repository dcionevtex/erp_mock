# Backlog

## UI / Design

- [ ] **Apply VTEX brand guidelines to the frontend**
  Apply the official VTEX brand design system (colors, typography, spacing, components) across the entire dashboard UI to make the demo feel native to the VTEX ecosystem.

## Configuration Panel

- [ ] **App Key does not need to be masked**
  The App Key is not a secret — it can be displayed in plain text in the UI. Only the App Token must remain hidden.

- [ ] **Show the stored App Key value next to the CONFIGURED badge**
  After an App Key is saved, display it alongside the "CONFIGURED" indicator (e.g. `CONFIGURED · vtexappkey-mystore-XXXXX`) so the operator can confirm which key is active. The App Token must continue to show only "CONFIGURED" with no value revealed.

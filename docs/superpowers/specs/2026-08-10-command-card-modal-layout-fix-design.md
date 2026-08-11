# Command Card Modal Layout Fix Design

## Problem

The command-card form sets its own width to `min(620px, 82vw)`. Obsidian's modal content area can be narrower than that value after its own padding, theme sizing, or display scaling is applied. The form then overflows its parent, clipping the language control and primary action on the right.

## Design

The modal element owns the dialog width through a dedicated class. The form fills the available content width with `width: 100%` and `min-width: 0`. On normal desktop widths, title and language use a flexible two-column grid with a bounded language column. Below `520px`, they stack into one column and the action buttons share the available width.

The fix does not change fields, validation, keyboard handling, Markdown generation, or editor insertion behavior.

## Verification

- A modal test verifies the dedicated dialog class is added and removed with the modal lifecycle.
- A CSS contract test verifies the dialog owns width, the form fills its parent, and the narrow layout stacks metadata fields.
- The complete plugin check must pass before the rebuilt release is copied to the Vault.

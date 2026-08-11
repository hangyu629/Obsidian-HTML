# Command Library Copy Control Design

## Problem

Obsidian's Markdown renderer adds a native `.copy-code-button` to fenced code blocks. Command Library also adds `.command-library-copy` to each command-card header, so every card displays two controls for the same operation.

## Design

Keep the Command Library header control because it is visible before scanning the code body and already provides exact multiline copying with success feedback. Hide `.copy-code-button` only when it is inside `.command-library-card`. Native copy controls remain available in other templates and in ordinary Markdown code blocks.

## Verification

Extend the Command Library template contract test to require the scoped hide rule and reject an unscoped global hide rule. Run the full release check and verify the rebuilt template in the local Vault.

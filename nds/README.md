# Noovuu ↔ NDS design-system bridge

## Immutable upstream source

**Do not edit NDS in Figma as part of this integration.** Both Figma files remain authoritative, formally structured, and untouched by this implementation:

- Foundations: https://www.figma.com/design/7icpj1CzrvQqYTj4OivGQz/NDS-Foundations
- Components: https://www.figma.com/design/1PGClUIE7siCUmnGSkdlUH/NDS-Components

Nothing in this repository writes to, renames, publishes, flattens, detaches, imports over, or otherwise alters those Figma files. The GitHub integration is *read-only from Figma → application code*.

## Implemented

1. `nds/nds-tokens.css` — 511 resolved, deduplicated CSS custom-property definitions extracted from seven NDS Foundations collections: Color (354 source variables), Type (39), Spacing (44), Radius (13), Opacity (44), Border Weight (9), and Width & Height (8). The 511 CSS declarations include 2 generated name disambiguations for source code-syntax collisions; they do not modify source names.
2. The stylesheet includes the 11 actual responsive typography differences in the NDS Mobile mode. Spacing and radius are the actual NDS values, not guessed values.
3. The NDS Color collection currently defines **only one actual difference** between Light and Dark modes; no additional dark appearance is invented.
4. `nds/noovuu-components.css` — an intentionally reversible app-specific adapter for global typography, surfaces, panels, navigation, buttons, fields, focus states, the Budget Builder drawer and scrim, and discard confirmation.
5. `index.html` loads these two new stylesheets *after* the existing embedded CSS, allowing a small non-destructive migration that preserves the calculator and drawer JavaScript.

## Component mapping — code adapter, not yet full React components

| Noovuu UI | NDS component / concept | Implementation |
| --- | --- | --- |
| Wizard primary actions | Button/Primary | `.wz-btn` uses NDS primary tokens for enabled, hover, active and disabled states |
| Secondary actions | Button/Primary white and secondary styling | `.wz-btn.secondary`, cancel, close, reset and similar controls |
| Form fields | TextField, NumberField, Select, MoneyField | Shared field surface, border, radius and focus token styles |
| Fixed header | GlobalNav | Tokenized header surface and navigation states |
| Budget Builder drawer | NDS surfaces, radius, scrim | Tokenized drawer background, header, backdrop |
| Discard confirmation | NDS surface + destructive button tokens | Kept existing destructive-state logic and dialog behavior |

Component behavior remains governed by the app's JavaScript. Visual token integration is **not** Code Connect, a complete component-system conversion, or continuous Figma synchronization. Those are subsequent stages.

## Safe rollback

Remove the two `<link rel="stylesheet" ...>` tags from `index.html` to restore the original presentation; no application JavaScript or Figma content requires repair. Any merge can also be reverted by Git. The independent `nds/` directory may remain harmlessly in the repository.

## Next phase: controlled source sync

A subsequent build script can read Figma via an authorized, *read-only* API and regenerate the token CSS under code review. Preserve the existing variable IDs, collection structure, modes and aliases. Check in tests to catch missing aliases, duplicate web syntax names, and accidental source-token changes before building. Do not permit automated writes to the Figma files.

## Known limitations

- Font families defined by NDS are `Instrument Sans` and `Space Grotesk`; they are loaded from Google Fonts in the app head with local fallback fonts if unavailable.
- The prototype is still one HTML file with vanilla JavaScript; extraction to shared components / React and Code Connect mappings is not complete.
- These changes were validated statically for existing JS/markup preservation, stylesheet loading, and token references; full visual/browser regression testing is still advised before expanding component coverage.

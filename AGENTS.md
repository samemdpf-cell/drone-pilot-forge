<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep the mobile navigation in two grid rows and allow metric units to wrap independently of values so installation controls and GPS coordinates remain readable on narrow screens.
- Run document extraction in an authenticated server function through AI Gateway; keep deterministic cross-document comparison in a shared pure module so alerts remain testable and manually reviewable.
- Reset the session-only preflight checklist when the displayed location changes so checks do not carry over to another flight location.
- Render geographic maps with the asynchronously loaded Google Maps JavaScript API and disable built-in POI clicks; only verified authoritative airspace data may be presented as restrictions, never inferred airport circles or basemap features.

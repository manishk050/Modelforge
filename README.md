# ModelForge

A Puter-native multi-model AI workspace starter.

## Current MVP

- Dynamic model discovery through `puter.ai.listModels()`
- Model selector with search
- Streaming chat via `puter.ai.chat()`
- Reasoning effort controls when supported by the selected model
- MAX mode (requests `xhigh` reasoning; availability remains model-dependent)
- Basic multi-model comparison
- Chat history persisted locally for the MVP
- Optional Puter sign-in
- File upload attempt through Puter filesystem
- Responsive chat UI

## Run

```bash
npm install
npm run dev
```

For deployment, build with `npm run build` and host the `dist/` directory with Puter Sites or another static host.

## Important product constraint

Model access and quotas are governed by Puter and each user's account/allowance. The app does not bypass provider or Puter access controls.

## Next engineering steps

1. Replace local chat persistence with per-user Puter KV.
2. Add Puter Worker for agent orchestration and server-side tool routing.
3. Add tool calling: web search, URL fetch, file search, calculator, document creation.
4. Add model capability matrix from the live model metadata instead of regex heuristics.
5. Add project-scoped memory and persistent knowledge bases.
6. Add robust model comparison UI rather than concatenated responses.
7. Add automated fallback when a model is unavailable.
8. Add export/share and document generation.

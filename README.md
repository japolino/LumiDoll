# LumiDoll

A drawn figure for you and for the person you're with in the story. A [Lumiverse](https://lumiverse.chat) extension.

- **LumiDoll** drawer tab: a preview with every control. 4 builds per sex that blend, 9 hairstyles, animal ears, tails and horns, and an outfit made of described garments (kind, cut, colour, pattern, material, wear) that fit any build. Ready-made outfits, and the look as JSON to copy or paste.
- **Status window**: a small floating window with your doll and **With you**, the person the latest reply is about (or the one you pin). Drag it anywhere; the head folds it to a pill. Right-click it to hide it.
- **Dress it** from your persona, from a character's card and lorebook, from a typed description, or from the latest replies ("Update from story" changes only what the story changed).
- **Follows the story** on its own, if you want (see below).
- **Each chat keeps its own dolls.** Someone dressed in one chat isn't changed by another.

It works on any card, with or without [Warp](https://github.com/japolino/warp). It is aimed at cards without art.

## Install

1. In Lumiverse, open **Extensions** → **Install from Source**.
2. Paste `https://github.com/japolino/LumiDoll` and install. The built files (`dist/`) are in the repo.
3. Enable the permissions it asks for:

| Permission | Why |
|---|---|
| `generation` | The helper model writes looks; LumiDoll hears when a reply is finished; the list of connections in Settings |
| `chat_mutation` | Reading the chat's latest replies (Lumiverse puts message reading under this permission). LumiDoll never changes a message |
| `chats` | Finding the chat's character |
| `characters` | Reading the character's card |
| `world_books` | Reading lorebook entries about a person |
| `cors_proxy` | Calling Jev, only when you turn Jev on |
| `ui_panels` | The floating status window (the drawer tab works without it) |

## Follow the story

Settings → **Follow the story**:

- **After each reply, with Jev** (default): runs only when Jev is set up. After each reply, Jev checks who the reply is about and what changed on each doll (about a quarter of a second). Someone new is dressed once, the first time they're with you.
- **After each reply, always**: the same, but without Jev the helper model does it: one call per doll, every reply.
- **Only when I ask**: the dolls change only when you press a button.

Without Warp, the people the "With you" doll can show are the card's character (when the card is one person, not a narrator or world card) and everyone you have dressed in this chat. To add someone, open the second tab in the drawer, type their name and press **From card & lorebook**.

## Jev (optional)

[Jev](https://typesafe.ai) is a classifier: it answers typed questions (a choice, a score or a yes/no, each with how sure it is) instead of writing text. It is faster and cheaper than a helper model, and its answers are always well formed.

When Jev is on and set up, **every question Jev can answer goes to Jev**: what someone wears and looks like, what the latest reply changed, who the reply is about, and Warp's outfit text. The helper model is used only when Jev can't give an answer.

Settings → **Jev**: turn on **Use Jev**, paste your TypeSafe key and press **Save**. The key is stored encrypted on the server (the host's enclave, as Warp does it); the page never sees it again. **Jev on OpenRouter** sets the endpoint and model for Jev through OpenRouter (use an OpenRouter key). **Test Jev** asks one small question and shows the answer time. With Jev on, story text is sent to the endpoint you set.

## With Warp

When [Warp](https://github.com/japolino/warp) runs a game in the chat, LumiDoll follows Warp instead of reading the story itself:

- **With you** is a person Warp says is present (`people[].present`): the one the reply names most, or the one you pin.
- A doll is re-dressed **only when Warp's appearance or outfit text for that person changes**, and only that part (a new outfit keeps the body and hair). With Jev this is one Jev call; without Jev, one helper call. No call reads the story.
- Someone's first look reads their card and lorebook plus Warp's words for them.
- In the drawer, **Match Warp** dresses the doll as Warp describes them now.

The two extensions talk through window events in the page:

- `warp-state-v1` (Warp → any): `{ version: 1, provider: "warp", chatId, messageId, you: { name, appearance?, outfit? }, people: [{ id, name, present, appearance?, outfit? }], … }`. Sent when Warp's state for the open chat changes.
- `warp-state-request-v1` (any → Warp): `{ version: 1 }`. LumiDoll sends it on load and when you switch chats; Warp answers with `warp-state-v1`.

If Warp isn't installed, or has nothing to say about a chat (no people, no outfit), LumiDoll works on its own as above.

## Where the dolls are kept

In the browser's local storage, per chat (the 40 most recent chats, up to 16 people each). Settings (helper connection, Jev, Follow the story) are stored per user on the server. Dolls made in Warp's old Doll tab are picked up the first time a chat opens.

## Develop

```bash
bun install
bun run verify   # tests + typecheck
bun run build    # dist/backend.js and dist/frontend.js
bun run dev      # the dev page at http://localhost:5178/
```

The dev page runs the LumiDoll tab and the status window outside Lumiverse, shows the same look on every build, and has a **Pretend Warp** box that sends a `warp-state-v1` event. The helper and Jev don't run there; the log shows what LumiDoll would ask its backend.

Tests use a pretend host (`src/backend/fake-host.ts`): no network, no models, no keys.

| Path | What |
|---|---|
| `src/doll/` | The drawing: bodies, faces, hair, garments, patterns, outfits, and the checker that makes any look drawable |
| `src/backend/dress.ts` | A look from a card, persona, description, the story or Warp's words (Jev first, then the helper) |
| `src/backend/questions.ts` | The doll as Jev's typed questions |
| `src/backend/follow.ts` | After a reply without Warp: who it's about, then what changed |
| `src/backend/jev.ts` | The Jev client and its encrypted key |
| `src/frontend/lab.ts` | The drawer tab and each chat's dolls |
| `src/frontend/panel.ts` | The status window |
| `src/frontend/warp-bridge.ts`, `src/shared/warp-state.ts` | Listening for Warp |

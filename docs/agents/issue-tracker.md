# Issue tracker: Gitea

Issues and specs for this repo live as Gitea issues on `git.codelab.tec.br`, in `vctrtvfrrr/ponto-automatico`. Use the [`tea`](https://gitea.com/gitea/tea) CLI for all operations.

`tea` infers owner/repo and login from the git remote when run inside the clone, so `--repo` is not needed. The default login is `vctrtvfrrr`; pass `--login agent` to act as the bot account instead.

## Conventions

- **Create an issue**: `tea issues create --title "..." --description "$(cat body.md)" --labels "..."`. `tea` has no stdin flag for the description, so read a multi-line body from a file with `$(cat ...)`. Always pass both `--title` and `--description` — with either missing, `tea` drops into an interactive prompt and hangs in a non-terminal session.
- **Read an issue**: `tea issues <index> --comments`.
- **List issues**: `tea issues list --state open --output json --fields index,title,body,state,author,labels,comments`, with `--labels "..."` to filter. `--state` accepts `all|open|closed`.
- **Comment on an issue**: `tea comment <index> < body.md` — **always via stdin, never as an argument**. Passed as an argument, `tea` blocks waiting for the stdin that a non-terminal session never provides, and the comment is never published.
- **Apply / remove labels**: `tea issues edit <index> --add-labels "..."` / `--remove-labels "..."`. `--add-labels` takes precedence over `--remove-labels` in the same call, so use separate calls when doing both.
- **Close**: `tea issues close <index>`. It accepts no closing comment, so post the explanation first with `tea comment <index> < body.md`, then close.
- **Create a label** (this repo has none yet): `tea labels create --name <name> --color "#<hex>" --description "..."`.

## Pull requests as a triage surface

**PRs as a request surface: no.** _(Set to `yes` if this repo treats external PRs as feature requests; `/triage` reads this flag.)_

When set to `yes`, PRs run through the same labels and states as issues, using the `tea pulls` equivalents:

- **Read a PR**: `tea pulls <index> --comments`; `tea pulls review-comments <index>` for review threads.
- **List PRs for triage**: `tea pulls list --state open --output json --fields index,title,body,author,labels`, then drop PRs authored by the repo owner (maintainer work in flight, not an incoming request). Gitea's API exposes no `authorAssociation`, so compare the author against the repo's collaborators (`tea api repos/{owner}/{repo}/collaborators`).
- **Comment / label / close**: `tea comment <index> < body.md` (the same command serves issues and PRs), `tea pulls edit <index> --add-labels`/`--remove-labels`, `tea pulls close <index>`.

Gitea shares one index space across issues and PRs, so a bare `#42` may be either — resolve with `tea pulls 42` and fall back to `tea issues 42`.

## When a skill says "publish to the issue tracker"

Create a Gitea issue.

## When a skill says "fetch the relevant ticket"

Run `tea issues <index> --comments`.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a single issue with **child** issues as tickets.

- **Map**: a single issue labelled `wayfinder:map`, holding the Notes / Decisions-so-far / Fog body. `tea issues create --labels wayfinder:map --title "..." --description "$(cat map.md)"`.
- **Child ticket**: an issue carrying `Part of #<map>` at the top of its description and labels `wayfinder:<type>` (`research`/`prototype`/`grilling`/`task`). Gitea has no sub-issue relation, so the map body also keeps a task list (`- [ ] #<child>`) as the ordered index. Once claimed, the ticket is assigned to the driving dev.
- **Blocking**: Gitea's **native issue dependencies** — the canonical, UI-visible representation. Add an edge with `tea api -X POST "repos/{owner}/{repo}/issues/<child>/dependencies" -F index=<blocker>`, which makes `<child>` depend on `<blocker>`. Read a ticket's blockers with `tea api "repos/{owner}/{repo}/issues/<child>/dependencies"` — it returns the blocking issues with their `state`, so a ticket is unblocked when every entry is `closed`. Remove an edge with `-X DELETE` against the same path. (`tea` has no first-class dependency command; `tea api` is the only route.)
- **Frontier query**: list the map's open children (`tea issues list --state open --labels "wayfinder:research,wayfinder:prototype,wayfinder:grilling,wayfinder:task" --output json --fields index,title,assignees`), drop any with an open blocker or an assignee; first in map task-list order wins.
- **Claim**: `tea issues edit <index> --add-assignees vctrtvfrrr` — the session's first write.
- **Resolve**: `tea comment <index> < answer.md`, then `tea issues close <index>`, then append a context pointer (gist + link) to the map's Decisions-so-far with `tea issues edit <map> --description "$(cat map.md)"`.

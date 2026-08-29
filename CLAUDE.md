# Hackaton — working agreement

## Pull requests

This is a hackathon repo: PRs are merged by the author and are not reviewed. Keep the
PR creation step as cheap as possible. These rules override the global `pull-request`
skill for this repository.

- Do not load or follow the `pull-request` skill here.
- Open PRs with a single command: `gh pr create --title "<conventional commit title>" --body ""`.
- No description body, no labels, no assignee, no reviewers, no Zenhub pipeline move.
- Do not read the diff, the commit history, or related issues to compose a PR body.
- The title is the conventional-commit summary of the branch. Nothing else.
- If a PR genuinely needs context, the author asks for it explicitly.

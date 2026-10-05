# QuickSub CI/CD

QuickSub uses `.github/workflows/ci-cd.yml` for GitHub Actions.

## Pipeline behavior

Every pull request to `main`, and every push to `main` or `test`, runs:

1. Deterministic installs from both lockfiles.
2. Production dependency audits for the website and API.
3. TypeScript, ESLint, coverage-gated tests, and the Vite production build.
4. A generated-catalog consistency check.
5. The full headless browser regression suite against the verified build.
6. Artifact uploads for the build, verification logs, and browser evidence.

Only a successful push to `main` can deploy production. Deployment is disabled by default so a fork or an incompletely configured repository cannot publish accidentally.

## Enable Vercel production deployment

In GitHub, open **Settings → Secrets and variables → Actions**.

Create these repository secrets:

- `VERCEL_TOKEN`: a Vercel access token with access to the QuickSub project.
- `VERCEL_ORG_ID`: the `orgId` from the linked Vercel project's `.vercel/project.json`.
- `VERCEL_PROJECT_ID`: the `projectId` from that same file.

Create this repository variable:

- `ENABLE_VERCEL_DEPLOY` = `true`

Also create a GitHub environment named `production`. Add required reviewers there if production deployments should require human approval.

The website's runtime secrets remain configured in Vercel, not GitHub. Keep `SUPABASE_SERVICE_ROLE_KEY`, payment credentials, Gemini credentials, email credentials, and cron secrets in Vercel's encrypted Production environment variables.

## Database migrations

Database migrations are intentionally not applied automatically. This project has existing production data and migrations can change authentication, orders, payments, and subscriptions. Apply unapplied files from `supabase/migrations` in filename order through the Supabase SQL editor, verify them, and then enable or run the production deployment.

## Branch protection

Protect `main` in **Settings → Branches** and require these checks before merging:

- `Verify application`
- `Browser regression suite`

Recommended settings:

- Require a pull request before merging.
- Require branches to be up to date.
- Block force pushes and branch deletion.
- Require the `production` environment approval for deployment when appropriate.

## Manual runs and artifacts

Use **Actions → QuickSub CI/CD → Run workflow** to run validation manually. Build and test artifacts are downloadable from the completed workflow run and expire after the configured retention period.

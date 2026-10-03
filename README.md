# @attio/n8n-nodes-attio

This is an n8n community node package. It lets you use [Attio](https://attio.com) in your n8n workflows.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/sustainable-use-license/) workflow automation platform.

[Installation](#installation)
[Operations](#operations)
[Credentials](#credentials)
[Development](#development)
[Resources](#resources)

## Installation

### n8n UI

1. In n8n, go to **Settings > Community Nodes**.
2. Select **Install**.
3. Enter `@attio/n8n-nodes-attio` and confirm.

### Self-hosted (npm)

From your n8n installation's custom nodes folder (`~/.n8n/nodes` by default):

```sh
npm install @attio/n8n-nodes-attio
```

Then restart n8n.

Refer to the [n8n community nodes installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) for more detail.

## Operations

- **Task**
  - **Create**: create a plaintext task, optionally with a deadline, assignees and linked records.
  - **Update**: change a task's deadline, completion status, assignees or linked records. Attio doesn't allow task content to be edited through the API.
- **Workspace**
  - **Get**: get the workspace and scopes of the connected access token.

Task operations need the `task:read-write`, `object_configuration:read`, `record_permission:read` and `user_management:read` scopes.

## Credentials

The package provides an **Attio API** credential that authenticates with an Attio access token, sent as a bearer token.

### Create an Attio access token

1. In Attio, open **Workspace settings > Developers**.
2. Create a new integration and give it a name, for example `n8n`.
3. Grant the integration the scopes your workflows need, such as read/write access to records and lists.
4. Copy the integration's access token.

Refer to the [Attio authentication guide](https://docs.attio.com/rest-api/guides/authentication) for more detail.

### Add the credential in n8n

1. In n8n, go to **Credentials > Add credential** and select **Attio API**.
2. Paste the access token into **Access Token**.
3. Save. n8n checks the token against Attio's `/v2/self` endpoint and reports whether it is valid.

## Development

Requires Node.js 24+ (n8n needs it for `pnpm run dev`) and pnpm 11.

```sh
nvm use                       # picks up Node 24 from .nvmrc
npm install -g pnpm@11.26.0   # see note below
```

Install pnpm with npm rather than Corepack. Node 24 enables Corepack's `pnpm` shim, which downloads pnpm from the public npm registry and ignores the Artifactory registry in `~/.npmrc`, so it times out on Attio's network. If `pnpm` is already the Corepack shim, run `corepack disable pnpm` first.

```sh
pnpm install
pnpm run dev     # start n8n on http://localhost:5678 with this package loaded
pnpm run lint
pnpm run build
```

CI runs lint and build on every pull request.

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
- [Attio REST API reference](https://docs.attio.com/rest-api/overview)

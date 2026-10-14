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

- **List Entry**
  - **Create**: add a record to a list. The record must belong to the object the list is for, such as people or companies, which is read from the list. Choose the record from a searchable dropdown, which matches names, domains and email addresses and shows up to 25 results, or give its ID. Entry attributes load from the list, or can be mapped automatically from input fields named after attribute slugs. They're optional, so a record can be added without any. A record can be added to the same list more than once.
  - **Get**: get a list entry by ID.
- **Note**
  - **Create**: create a note on a record, in plain text or markdown, optionally backdated or linked to a meeting.
  - **Delete**: delete a note by ID.
  - **Get**: get a note by ID.
  - **Get Many**: list notes, optionally only those on a specific record.
  - **Update**: change a note's title or content. Notes can't be moved to another record.
- **Record**
  - **Create**: create a record on any object, such as people, companies or deals. Attributes load from the chosen object, or can be mapped automatically from input fields named after attribute slugs. A person's name is one field that takes the full name in "First Last" order, such as `Jane Doe`. The last word becomes the last name.
  - **Create or Update**: create a record, or update the existing one that has the same value for a unique attribute, such as `email_addresses` for people or `domains` for companies. The attribute to match on must be given a value. Multi-value attributes are overwritten, except the one being matched on, which keeps its existing values.
  - **Delete**: delete a record by ID.
  - **Get**: get a record by ID.
  - **Get Many**: find records on an object using Attio's query endpoint. Filter by building conditions on attributes (all or any must match), by writing an Attio [filter object](https://docs.attio.com/rest-api/guides/filtering-and-sorting) as JSON for nested `$and`/`$or`/`$not` and path filters, or by using a saved view's filter. Sort by one or more attributes. Record references sort by the referenced record's name, interactions by date and locations by city, region or country. Owner and other actor references can't be sorted. Condition values for number, currency, rating and checkbox attributes are converted to numbers and booleans. Each condition and sort rule can use part of an attribute's value, chosen under **Field**, such as the domain of an email address or a last name. Record reference conditions, such as a person's company, compare the referenced record's ID, or the domain or email address of a referenced company or person. They compare the record ID unless **Field** is set to the domain or email address.
  - **Update**: update a record by ID, changing only the attributes given. Values for multi-value attributes are added to the existing ones, or replace them with **Multi-Select Write Mode** set to **Overwrite**.
- **Task**
  - **Create**: create a plaintext task, optionally with a deadline, assignees and linked records.
  - **Delete**: delete a task by ID.
  - **Get**: get a task by ID.
  - **Get Many**: list tasks, optionally filtered by assignee, completion status or linked record, and sorted by created or completed date.
  - **Update**: change a task's deadline, completion status, assignees or linked records. Attio doesn't allow task content to be edited through the API.

List entry operations need the `list_entry:read-write` and `list_configuration:read` scopes. Searching for a record in the dropdown also needs `record_permission:read` and `object_configuration:read`.

Task operations need the `task:read-write`, `object_configuration:read`, `record_permission:read` and `user_management:read` scopes.

Record operations need the `record_permission:read-write` and `object_configuration:read` scopes.

Note operations need the `note:read-write`, `object_configuration:read` and `record_permission:read` scopes.

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

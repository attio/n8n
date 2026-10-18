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

- **Activity**
  - **Create**: log a record of an activity, such as a phone call. Every activity needs a timestamp, for when it happened, and at least one linked record, the records it's logged against, such as a company or deal. It shows on each linked record's activity timeline. With **Linked Records** set to **Add Records**, add each one by choosing its object, then searching for it under **From list**, giving its ID, or giving a person's email address or a company's domain. An email address or domain must match exactly one existing record, otherwise the activity isn't created. To link a varying number of records, such as one from each input item, set **Linked Records** to **JSON** and give an array of email addresses and domains, like `["jane@example.com", "example.com"]`, or of Attio record references using the [`target_object` syntax](https://docs.attio.com/rest-api/guides/activities#linking-records-by-attribute-value). To link the records from every input item in one activity, build the array with an expression like `{{ $input.all().flatMap(item => item.json.values.email_addresses.map(email => email.email_address)) }}`, and turn on **Execute Once** in the node's settings so the activity is only created once. The other attributes load from the chosen activity, or can be mapped automatically from input fields named after attribute slugs. Other record references, such as participants or a call's caller, take email addresses, phone numbers and domains separated by commas, which Attio matches to people and companies. For participants, an email address that belongs to a workspace member links the member. Activities are in early access and must be enabled for the workspace.
- **List Entry**
  - **Create**: add a record to a list. The record must belong to the object the list is for, such as people or companies, which is read from the list. Give the record's ID, or switch to **From list** to search all records of the list's object (not just those already in the list) by name, domain or email address, showing up to 25 results. Entry attributes load from the list, or can be mapped automatically from input fields named after attribute slugs. They're optional, so a record can be added without any. A record can be added to the same list more than once.
  - **Create or Update**: add a record to a list, or update its entry if it's already there, using the same fields as Create. Fails if the record is in the list more than once, as there's no way to tell which entry to update. Multi-value entry attributes are overwritten.
  - **Delete**: remove an entry from a list by entry ID. The record itself isn't deleted.
  - **Get**: get a list entry by ID.
  - **Get Many**: find entries in a list using Attio's query endpoint, with the same filter and sort options as record **Get Many**, on the list's entry attributes. Conditions and sorts can also use **Parent Record**, the record each entry belongs to, to find a record's entries by its ID, or a company's by domain or a person's by email address. Sorting by it sorts by the record's name. Record reference conditions and sorts start their path from the list. Each entry includes its parent record, with its attribute values, as `parent_record`, fetched with one query per page of entries. Turn off **Include Parent Record** to skip it. Legacy lists for more than one object can't filter or sort by parent record.
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

### Attio Trigger

Starts a workflow from an Attio webhook, which the trigger creates when the workflow is activated and deletes when it's deactivated. Attio only delivers webhooks over HTTPS, so n8n's webhook URL must be public and use HTTPS. Each delivery is checked against the webhook's signature.

- **Record Created**: a record is created on the chosen object. Outputs the record.
- **Record Updated**: values on a record of the chosen object are updated, optionally only for one attribute. Outputs the record once per delivery, even if several attributes changed.
- **Include List Entries** (Record Created and Record Updated): adds the record's entries across all lists as `list_entries`, with each entry's list and ID but not its values. Use List Entry **Get** for the values. It's empty if the access token can't read lists.
- **Record Deleted**: a record is deleted from the chosen object. Outputs the event, with the deleted record's IDs and the actor that deleted it.
- **List Entry Created**: a record is added to the chosen list. Outputs the entry, as List Entry **Get** does.
- **List Entry Updated**: values on an entry in the chosen list are updated, optionally only for one list attribute. Outputs the entry once per delivery, even if several attributes changed.
- **List Entry Deleted**: a record is removed from the chosen list. Outputs the event, with the deleted entry's IDs, its parent record's object and ID, and the actor that removed it.
- **Include Parent Record** (list entry events, on by default): adds the entry's parent record, with its attribute values, as `parent_record`. It's `null` if the record has since been deleted. List entry events need the `list_entry:read` and `list_configuration:read` scopes, and `record_permission:read` and `object_configuration:read` for the parent record.
- **Task Created**: a task is created. Outputs the task, as Task **Get** does.
- **Include Linked Records and Members** (Task Created): adds the full record to each linked record as `target_record`, and the workspace member to each assignee as `referenced_actor` and to the creator as `created_by_actor.workspace_member`. A linked record that's since been deleted has no `target_record`.
- **Call Recording Created**: a call recording finishes processing and Attio has generated its transcript and summary, which can take a few minutes after the call ends. Outputs the recording with its transcript, which is `null` if none is available. Its `video_url` expires an hour after the trigger fires. Needs the `meeting:read` and `call_recording:read` scopes.
- **Include Meeting** (Call Recording Created): adds the recording's meeting as `meeting`, with its title, times, participants and linked records. Also needs the `record_permission:read` scope. A meeting that's since been deleted is left out.
- **Activity Created**: a record of the chosen activity, such as a phone call, is logged. Outputs the activity record with its values. Activities are in early access and must be enabled for the workspace. Needs the `activity_configuration:read` and `activity_record:read` scopes.

List entry operations need the `list_entry:read-write` and `list_configuration:read` scopes. Searching for a record in the dropdown, filtering on record references and parent records, or including parent records in Get Many, also needs `record_permission:read` and `object_configuration:read`.

Activity operations need the `activity_record:read-write`, `activity_configuration:read`, `object_configuration:read` and `record_permission:read` scopes.

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

### Testing the trigger

Attio only sends webhooks to HTTPS URLs, so the Attio Trigger can't be activated or tested against `http://localhost`. Expose n8n through an HTTPS tunnel, such as [ngrok](https://ngrok.com/), and set `WEBHOOK_URL` to the tunnel's public address so n8n registers webhooks with it:

```sh
ngrok http 5678                                                   # terminal 1
WEBHOOK_URL=https://<your-subdomain>.ngrok-free.app/ pnpm run dev  # terminal 2, with the address ngrok prints
```

Then select **Execute step** on the trigger and make a matching change in Attio, such as creating a person. Free ngrok addresses change each time ngrok starts, so restart `pnpm run dev` with the new address.

### Releasing

n8n only verifies community nodes published from GitHub Actions with [npm provenance](https://docs.npmjs.com/generating-provenance-statements), so packages are never published from a laptop. From an up-to-date `main` with a clean working tree, run:

```sh
pnpm run release
```

This lints, builds, prompts for the version bump, updates `CHANGELOG.md`, then commits, tags, pushes and creates a GitHub release. The tag push runs [`publish.yml`](.github/workflows/publish.yml), which publishes `@attio/n8n-nodes-attio` to npm with provenance. The workflow authenticates with npm [Trusted Publishing](https://docs.npmjs.com/trusted-publishers), configured on npmjs.com for the `attio/n8n` repository and the `publish.yml` workflow.

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
- [Attio REST API reference](https://docs.attio.com/rest-api/overview)

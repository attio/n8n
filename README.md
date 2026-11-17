# @attio/n8n-nodes-attio

This is an n8n community node package. It lets you use [Attio](https://attio.com) in your n8n workflows: create, update and search records, list entries, notes, tasks and activities, and start workflows when something changes in Attio.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/sustainable-use-license/) workflow automation platform.

[Installation](#installation)
[Operations](#operations)
[Credentials](#credentials)
[Example workflow](#example-workflow)
[Compatibility](#compatibility)
[Development](#development)
[Support](#support)
[Resources](#resources)
[License](#license)

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

### Attio

| Resource | Operations |
| --- | --- |
| Activity | Create |
| List Entry | Create, Create or Update, Delete, Get, Get Many |
| Note | Create, Delete, Get, Get Many, Update |
| Record | Create, Create or Update, Delete, Get, Get Many, Update |
| Task | Create, Delete, Get, Get Many, Update |

- **Attributes** load from the chosen object, list or activity, or can be mapped automatically from input fields named after attribute slugs.
- **Create or Update** finds a record by a unique attribute, such as `email_addresses` for people or `domains` for companies, or a list entry by its record. Multi-value attributes are overwritten.
- **Update** adds values to a record's multi-value attributes. Set **Multi-Select Write Mode** to **Overwrite** to replace them.
- **Get Many** on records and list entries filters by conditions, an Attio [filter object](https://docs.attio.com/rest-api/guides/filtering-and-sorting) or a saved view, and sorts by one or more attributes. List entries can also filter and sort by their parent record, and include it as `parent_record`.
- **Activities** need a timestamp and at least one linked record, given by ID, by search, or by a person's email address or a company's domain. Activities are in early access and must be enabled for the workspace.
- Attio's API doesn't allow task content to be edited, or notes to be moved to another record.

### Attio Trigger

Starts a workflow from an Attio webhook, which the trigger creates when the workflow is activated and deletes when it's deactivated. Attio only delivers webhooks over HTTPS, so n8n's webhook URL must be public and use HTTPS.

| Event | Fires when | Option |
| --- | --- | --- |
| Record Created | A record is created on the chosen object | Include List Entries |
| Record Updated | A record's values change, optionally only for one attribute | Include List Entries |
| Record Deleted | A record is deleted from the chosen object | |
| List Entry Created | A record is added to the chosen list | Include Parent Record |
| List Entry Updated | An entry's values change, optionally only for one attribute | Include Parent Record |
| List Entry Deleted | A record is removed from the chosen list | Include Parent Record |
| Task Created | A task is created | Include Linked Records and Members |
| Call Recording Created | A call recording's transcript and summary are ready | Include Meeting |
| Activity Created | An activity of the chosen type is logged | |

A call recording's `video_url` expires an hour after the trigger fires.

### Scopes

Grant the Attio access token the scopes for what your workflows use:

| Used for | Scopes |
| --- | --- |
| Records | `record_permission:read-write`, `object_configuration:read` |
| List entries | `list_entry:read-write`, `list_configuration:read`, plus `record_permission:read` and `object_configuration:read` to search for records, filter on records or include parent records |
| Notes | `note:read-write`, `object_configuration:read`, `record_permission:read` |
| Tasks | `task:read-write`, `object_configuration:read`, `record_permission:read`, `user_management:read` |
| Activities | `activity_record:read-write`, `activity_configuration:read`, `object_configuration:read`, `record_permission:read` |
| List entry events | `list_entry:read`, `list_configuration:read`, plus `record_permission:read` and `object_configuration:read` to include the parent record |
| Call Recording Created | `meeting:read`, `call_recording:read`, plus `record_permission:read` to include the meeting |
| Activity Created | `activity_configuration:read`, `activity_record:read` |

## Credentials

The package provides an **Attio API** credential that authenticates with an Attio access token, sent as a bearer token.

### Create an Attio access token

1. In Attio, open **Workspace settings > Developers**.
2. Create a new integration and give it a name, for example `n8n`.
3. Grant the integration the [scopes](#scopes) your workflows need.
4. Copy the integration's access token.

Refer to the [Attio authentication guide](https://docs.attio.com/rest-api/guides/authentication) for more detail.

### Add the credential in n8n

1. In n8n, go to **Credentials > Add credential** and select **Attio API**.
2. Paste the access token into **Access Token**.
3. Save. n8n checks the token against Attio's `/v2/self` endpoint and reports whether it is valid.

## Example workflow

[`examples/follow-up-with-new-people.json`](examples/follow-up-with-new-people.json) creates a task to follow up with each new person in Attio, due in two days and linked to their record. It uses only the Attio Trigger and Attio nodes.

To try it, import the file with **Import from File** in n8n's workflow menu, then follow the setup steps in the note on the canvas.

## Compatibility

Tested with n8n 2.45.1.

## Development

Requires Node.js 24+ (n8n needs it for `pnpm run dev`) and pnpm 11.

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

n8n only verifies community nodes published from GitHub Actions with [npm provenance](https://docs.npmjs.com/generating-provenance-statements), so every release goes through a reviewed pull request and no release is published from a laptop.

1. In a pull request, bump the version and add an entry for it to `CHANGELOG.md`:

   ```sh
   npm version minor --no-git-tag-version   # or patch, major, prerelease
   ```

2. Once the pull request is reviewed and merged, [`publish.yml`](.github/workflows/publish.yml) publishes the new version of `@attio/n8n-nodes-attio` to npm with provenance, then tags the merge commit and creates a GitHub release. Prereleases such as `1.0.0-rc.1` are published under npm's `next` dist-tag.

The workflow authenticates with npm [Trusted Publishing](https://docs.npmjs.com/trusted-publishers), configured on npmjs.com for the `attio/n8n` repository, the `publish.yml` workflow and the `npm` environment. Don't run `pnpm run release` locally: it's the command the workflow runs to publish, and on a laptop it tries to tag and push to `main` directly.

## Support

- To report a bug or request a feature, [open an issue](https://github.com/attio/n8n/issues).
- For help with Attio itself, see the [Attio Help Center](https://attio.com/help).

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
- [Attio REST API reference](https://docs.attio.com/rest-api/overview)

## License

[MIT](LICENSE)

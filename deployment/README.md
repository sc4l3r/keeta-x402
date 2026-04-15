# Deployment

The facilitator and server can be deployed to GCP Cloud Run using Pulumi.

## Prerequisites

- A GCP project with billing enabled
- A GCS bucket for Pulumi state storage
- A GCP KMS keyring and key for Pulumi secrets encryption

## Setup

```bash
pnpm install

# Configure Pulumi state backend
pulumi login gs://<your-bucket>/

# Create a stack with GCP KMS secrets provider
pulumi stack init dev --secrets-provider="gcpkms://projects/<project>/locations/<location>/keyRings/<keyring>/cryptoKeys/<key>"

# Set configuration
pulumi config set gcp:project <your-project-id>
pulumi config set gcp:region us-central1
pulumi config set --secret facilitatorPassphrase "<passphrase>"
# Optional: set a custom domain for the facilitator.
# Otherwise it will only be available under its cloud run GCP URL.
# pulumi config set --secret facilitatorDomain "facilitator.x402.example.com"

# Optional: deploy the example server
pulumi config set deployServer true
pulumi config set serverAddress "<server-keeta_...-address>"
```

## Deployment

To deploy the facilitator and optionally the resource server run:

```bash
pulumi up
```

In the outputs you'll find:

- `facilitatorCloudRunUrl`: The GCP Cloud Run URL under which the facilitator is available
- `facilitatorCustomURL`: If `facilitatorDomain` is set the custom URL under which the facilitator is available
- `facilitatorIps`: If `facilitatorDomain` is set the public IPv4 and IPv6 IPs of your facilitator
- `serverUrl`: If `deployServer` is `true`, the URL of the demo resource server

If you've configured `facilitatorDomain` and it's the first time bringing up the Pulumi stack with that domain, make sure to set your A and AAAA DNS records for the domain to the given `facilitatorIps`.

import * as gcp from "@pulumi/gcp";
import * as pulumi from "@pulumi/pulumi";
import { gcp as gcpComponents } from "@keetanetwork/pulumi-components";

const config = new pulumi.Config();
const gcpConfig = new pulumi.Config("gcp");

const project = gcpConfig.require("project");
const region =
  gcpConfig.get("region") ??
  ("us-central1" as gcpComponents.constants.GCPRegion);
const facilitatorDomain = config.get("facilitatorDomain");
const deployServer = config.getBoolean("deployServer") ?? false;

// Docker Registry
const registry = new gcp.artifactregistry.Repository("registry", {
  repositoryId: "keeta-x402",
  format: "DOCKER",
  location: region,
});

const registryUrl = pulumi.interpolate`${region}-docker.pkg.dev/${project}/${registry.repositoryId}`;

// Common Cloud Run service args for the facilitator
const facilitatorArgs: gcpComponents.apps.CloudRunServiceArgs = {
  gcp: { project },
  region: region as gcpComponents.constants.GCPRegion,

  image: {
    build: {
      directory: "..",
      imageName: "facilitator",
      registryUrl,
      target: "facilitator",
    },
  },

  environment: {
    FACILITATOR_PASSPHRASE: {
      value: config.requireSecret("facilitatorPassphrase"),
      secret: true,
    },
  },

  service: {
    cpuLimit: 1,
    memoryLimit: 512,
  },
};

// Deploy facilitator
let facilitator: gcpComponents.apps.CloudRunService;
let facilitatorIps: pulumi.Output<string[]> | undefined;

if (facilitatorDomain) {
  // Use the FullStackApp component (without frontend) when a facilitatorDomain is configured
  // as that handles the HTTP to HTTPS routing, proxy, etc.
  const fullStack = new gcpComponents.apps.FullStackApp("facilitator", {
    loadBalancer: {
      domain: facilitatorDomain,
      ssl: { domains: [facilitatorDomain] },
    },
    frontend: null,
    backend: facilitatorArgs,
  });

  facilitator = fullStack.backend;
  facilitatorIps = fullStack.ips;
} else {
  // Otherwise deploy a standalone Cloud Run service accessible via its default URL
  facilitator = new gcpComponents.apps.CloudRunService(
    "facilitator",
    facilitatorArgs,
  );
}

// Optional demo resource server Cloud Run Service
// Can be deployed to have a running server x402 clients can use for testing purposes
let serverService: gcpComponents.apps.CloudRunService | undefined;

if (deployServer) {
  serverService = new gcpComponents.apps.CloudRunService("server", {
    gcp: { project },
    region: region as gcpComponents.constants.GCPRegion,

    image: {
      build: {
        directory: "..",
        imageName: "server",
        registryUrl,
        target: "server",
      },
    },

    environment: {
      SERVER_ADDRESS: config.require("serverAddress"),
      // Use the Cloud Run URL directly
      FACILITATOR_URL: facilitator.service.statuses.apply(
        (s) => s[0]?.url ?? "",
      ),
    },

    service: {
      cpuLimit: 0.5,
      memoryLimit: 128,
    },
  });
}

// Outputs
export const facilitatorCloudRunUrl = facilitator.service.statuses.apply(
  (s) => s[0]?.url,
);
export { facilitatorIps };
export const facilitatorCustomUrl = facilitatorDomain
  ? "https://" + facilitatorDomain
  : undefined;
export const serverUrl = serverService?.service.statuses.apply(
  (s) => s[0]?.url,
);

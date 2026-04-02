/**
 * 011 baseline IaC intent model.
 * This file documents provisioned resource groups and explicit healthcheck targets
 * consumed by deploy validation flows and SC-005 evidence capture.
 */

type RuntimeResourcePlan = {
  network: string[];
  compute: string[];
  data: string[];
  registry: string[];
  ingress: string[];
  healthcheckTargets: string[];
};

export const runtimePlan: RuntimeResourcePlan = {
  network: ["vpc", "public-subnets", "private-subnets", "security-groups"],
  compute: ["cluster", "api-service", "mcp-service", "worker-service"],
  data: ["postgres-instance", "redis-cache"],
  registry: ["api-image-repo", "worker-image-repo"],
  ingress: ["application-load-balancer", "https-listener", "target-groups"],
  healthcheckTargets: [
    "http://localhost:3000/health",
    "http://localhost:3001/health",
    "http://localhost:3002/health"
  ]
};

if (process.env.NODE_ENV !== "test") {
  const summary = {
    resourceGroups: {
      network: runtimePlan.network.length,
      compute: runtimePlan.compute.length,
      data: runtimePlan.data.length,
      registry: runtimePlan.registry.length,
      ingress: runtimePlan.ingress.length
    },
    healthcheckTargets: runtimePlan.healthcheckTargets
  };

  console.log(JSON.stringify(summary));
}

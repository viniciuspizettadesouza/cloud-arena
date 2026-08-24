# Networking Component Decision

Status: SPIKE-B2 complete  
Updated: 2026-08-25

The MVP Web API pattern requires public HTTP/HTTPS ingress, TLS termination capability, health checks, and routing to VM backends. The comparable capability is a managed Layer 7 application load balancer, not a claim that the products are identical.

## Decision

| Provider | Selected component | Why it fits | Material differences retained |
| --- | --- | --- | --- |
| AWS | Internet-facing Application Load Balancer | Layer 7 HTTP/HTTPS listeners, target groups, and health checks for EC2 backends. | Regional resource; pricing includes load-balancer hours and LCUs. Cross-zone behavior, certificates, WAF, and data processing are separate considerations. |
| Azure | Application Gateway Standard_v2 | Layer 7 web traffic load balancer with HTTP attributes, TLS termination, autoscaling, health probes, and zone redundancy where supported. | Regional resource with fixed and capacity-unit charges. WAF_v2 is a different, excluded SKU. Minimum platform capacity and subnet/public-IP requirements must be disclosed. |
| GCP | Global external Application Load Balancer, Premium Tier | Managed proxy-based Layer 7 HTTP/HTTPS load balancer with Compute Engine instance-group backends and one global external IP. | Global frontend with regional backends; component pricing is split across forwarding/rule/proxy/data-processing/network SKUs. Billing SKU evidence remains SPIKE-A1-GCP. |

Azure Load Balancer is not selected because its primary model is Layer 4; Application Gateway is the closer functional match to AWS ALB and GCP Application Load Balancer for the MVP's HTTP workload.

## Common baseline

- Public HTTP listener may redirect to HTTPS; HTTPS is the production intent.
- One application/backend target group or service per candidate.
- Health check/probe is required.
- TLS certificate acquisition/renewal and DNS charges are excluded from modeled cost until explicitly implemented.
- WAF, DDoS premium tiers, private ingress, client authentication, and advanced routing are excluded.
- The read-only diagram remains Internet → application load balancer → VM compute, with object storage adjacent and PostgreSQL private behind compute.

## CDN decision

CDN is not included in any MVP baseline candidate.

The current input model provides response size and total egress but does not describe cacheability, cache-control behavior, hit ratio, object popularity, geographic distribution below the selected geography, invalidations, or dynamic/personalized content. Adding a CDN without these inputs would create asymmetric cost and performance assumptions.

The semantic catalog may retain `network.cdn` as a known optional capability, but candidate generation sets it to excluded with reason `insufficient-cacheability-input`. A future pattern may include CloudFront, Azure Front Door/CDN, or Cloud CDN only after inputs and pricing cover:

- cacheable traffic percentage and expected hit ratio;
- origin type and origin egress/fill costs;
- request classes, invalidation, and regional edge pricing;
- TLS/domain/security features included in the chosen product.

## Pricing requirements

- AWS: load-balancer hours and used LCU-hours; data transfer remains in the egress model.
- Azure: Standard_v2 fixed cost and capacity units; do not price WAF meters.
- GCP: forwarding rule/load-balancer base components, data processing, and relevant network egress. Exact SKUs are deferred to SPIKE-A1-GCP.
- A missing component price makes the load-balancer portion and therefore the candidate estimate unavailable.

## Official references

- [AWS Elastic Load Balancing API overview](https://docs.aws.amazon.com/elasticloadbalancing/latest/APIReference/Welcome.html)
- [AWS Application Load Balancer listeners](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-listeners.html)
- [Azure Application Gateway overview](https://learn.microsoft.com/en-us/azure/application-gateway/overview)
- [Azure Application Gateway v2](https://learn.microsoft.com/en-us/azure/application-gateway/overview-v2)
- [GCP external Application Load Balancer overview](https://cloud.google.com/load-balancing/docs/https)
- [GCP Cloud CDN overview](https://cloud.google.com/cdn/docs/overview)

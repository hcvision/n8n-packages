# @hcvision/n8n-nodes-iff

This is an n8n community node package. It lets you use the hc:VISION IFF services in your n8n workflows.

IFF is the form platform of [hc:VISION](https://hc-vision.de/). The services are installed on the customer's own infrastructure, so you need access to an existing IFF installation.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/sustainable-use-license/) workflow automation platform.

[Installation](#installation)
[Operations](#operations)
[Credentials](#credentials)
[Compatibility](#compatibility)
[Resources](#resources)

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

## Operations

- **IFF Selfservice Trigger**: starts a workflow when IFF Selfservice publishes an event, for example when a form has been completed. The node manages its webhook subscription while the workflow is active. The backend must be able to reach the n8n production webhook URL.

## Credentials

You need an IFF installation and a client with the webhook scopes (`hcv:common:webhook`, `hcv:common:webhook:read`, `hcv:common:webhook:write`) and the Selfservice read scope.

- **IFF API URLs**: the gateway URL and the base paths of the IFF services.
- **IFF Employee IAM**: OAuth2 client credentials for the employee account.
- **IFF Employee IAM - User Sign-In (PKCE)**: OAuth2 sign-in of an individual user.

## Compatibility

Built against hc:VISION IFF 2.16.0. Use a matching IFF installation.

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
- [hc:VISION](https://hc-vision.de/)

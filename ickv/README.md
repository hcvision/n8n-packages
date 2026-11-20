# @hcvision/n8n-nodes-ickv

This is an n8n community node package. It lets you use the hc:VISION ICKV services in your n8n workflows.

ICKV is the customer communication platform of [hc:VISION](https://hc-vision.de/). The services are installed on the customer's own infrastructure, so you need access to an existing ICKV installation.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/sustainable-use-license/) workflow automation platform.

[Installation](#installation)
[Operations](#operations)
[Credentials](#credentials)
[Compatibility](#compatibility)
[Resources](#resources)

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

## Operations

- **ICKV Contact Center**: create a contact entry
- **ICKV Mailbox**: create a message for a recipient
- **ICKV Tickets**: create a ticket

## Credentials

You need an ICKV installation and an employee account in its identity provider.

- **ICKV API URLs**: the gateway URL and the base paths of the ICKV services.
- **ICKV Employee IAM**: OAuth2 client credentials for the employee account.
- **ICKV Employee IAM - User Sign-In (PKCE)**: OAuth2 sign-in of an individual user.

## Compatibility

Built against hc:VISION ICKV 0.2.3. Use a matching ICKV installation.

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
- [hc:VISION](https://hc-vision.de/)
